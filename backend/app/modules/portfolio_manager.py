from typing import Dict, List, Optional
from datetime import datetime
from sqlmodel import Session, select
from .alpaca_manager import submit_order, close_position_on_broker
from ..database import engine, Position, PortfolioSettings, TradeLog, get_portfolio_settings, update_portfolio_settings

class PortfolioManager:
    def __init__(self, initial_capital: float = 10000.0):
        """
        Architecture v3: Database-backed Portfolio Manager.
        Loads state from PostgreSQL on initialization.
        """
        self.initial_capital = initial_capital
        self.refresh_state()

    def refresh_state(self):
        settings = get_portfolio_settings()
        # Prioritize DB values if available
        if settings.initial_capital:
            self.initial_capital = settings.initial_capital
        
        self.risk_per_trade = settings.risk_per_trade
        self.current_cash = settings.current_cash
        self.auto_pilot_enabled = settings.auto_pilot_enabled
        
        # Load positions from DB
        with Session(engine) as session:
            db_positions = session.exec(select(Position).where(Position.is_active == True)).all()
            self.positions = {p.ticker: {
                "qty": p.qty,
                "entry_price": p.entry_price,
                "entry_time": p.entry_time.isoformat(),
                "sl": p.sl,
                "tp": p.tp
            } for p in db_positions}

    def get_financial_summary(self, current_prices: dict):
        self.refresh_state() # Ensure sync with DB
        total_involved = 0
        total_unrealized_pnl = 0
        risk_exposure = 0
        
        for ticker, pos in self.positions.items():
            price = current_prices.get(ticker, pos['entry_price'])
            total_involved += pos['qty'] * pos['entry_price']
            total_unrealized_pnl += (price - pos['entry_price']) * pos['qty']
            risk_exposure += (pos['entry_price'] - pos['sl']) * pos['qty']
            
        return {
            "cash": round(self.current_cash, 2),
            "equity": round(self.current_cash + total_involved + total_unrealized_pnl, 2),
            "involved": round(total_involved, 2),
            "unrealized_pnl": round(total_unrealized_pnl, 2),
            "risk_exposure": round(risk_exposure, 2),
            "position_count": len(self.positions)
        }

    def calculate_position_size(self, ticker: str, entry_price: float, sl_pct: float, kelly_fraction: float = 0.02):
        from .risk_manager import risk_manager
        if sl_pct <= 0: return 0
        safe_kelly_fraction = risk_manager.get_adjusted_kelly(kelly_fraction)
        allocation_usd = self.initial_capital * safe_kelly_fraction
        if allocation_usd > self.current_cash:
            allocation_usd = self.current_cash
        return int(allocation_usd / entry_price)

    async def open_position(self, ticker: str, entry_price: float, entry_time: str, sl: float, tp: float, sl_pct: float, kelly_fraction: float = 0.02):
        qty = self.calculate_position_size(ticker, entry_price, sl_pct, kelly_fraction)
        if qty <= 0: return False
            
        # 1. Broker First (ACID)
        success = await submit_order(ticker, qty, side="buy")
        if not success: return False

        # 2. DB Update
        total_cost = qty * entry_price
        with Session(engine) as session:
            # Create Position record
            new_pos = Position(
                ticker=ticker,
                qty=qty,
                entry_price=entry_price,
                sl=sl,
                tp=tp,
                is_active=True
            )
            session.add(new_pos)
            
            # Update Cash in Settings
            settings = session.get(PortfolioSettings, 1)
            settings.current_cash -= total_cost
            
            session.commit()
        
        self.refresh_state()
        return True

    async def close_position(self, ticker: str, exit_price: float, exit_time: str, reason: str):
        """
        Closes position with CONCURRENCY LOCK (FOR UPDATE) and BROKER FIRST policy.
        """
        with Session(engine) as session:
            # 1. Lock the position row to prevent race conditions
            statement = select(Position).where(Position.ticker == ticker, Position.is_active == True).with_for_update()
            pos_record = session.exec(statement).first()
            
            if not pos_record:
                print(f"!!! Concurrency Alert: Position {ticker} already closing or closed.")
                return False

            # 2. Broker First Requirement
            broker_success = await close_position_on_broker(ticker)
            if not broker_success:
                print(f"!!! Broker Error: Failed to liquidate {ticker} on Alpaca.")
                return False

            # 3. Update DB state
            total_value = pos_record.qty * exit_price
            pnl = (exit_price - pos_record.entry_price) * pos_record.qty
            pnl_pct = ((exit_price / pos_record.entry_price) - 1) * 100
            
            # Record History
            log = TradeLog(
                ticker=ticker,
                entry_time=pos_record.entry_time,
                exit_time=datetime.utcnow(),
                entry_price=pos_record.entry_price,
                exit_price=exit_price,
                qty=pos_record.qty,
                pnl=pnl,
                pnl_pct=pnl_pct,
                reason=reason,
                sl=pos_record.sl,
                tp=pos_record.tp
            )
            session.add(log)
            
            # Update Cash
            settings = session.get(PortfolioSettings, 1)
            settings.current_cash += total_value
            
            # Remove Position (or mark inactive)
            session.delete(pos_record)
            
            session.commit()
            print(f"CLEANUP SUCCESS: {ticker} closed and persisted.")
            
        self.refresh_state()
        return True

    def update_equity(self, current_prices: dict, timestamp: str):
        # We might want to persist equity_curve later, for now we derive it
        summary = self.get_financial_summary(current_prices)
        return summary['equity']
