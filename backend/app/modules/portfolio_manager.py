class PortfolioManager:
    def __init__(self, initial_capital: float = 10000.0, risk_per_trade: float = 0.02):
        self.initial_capital = initial_capital
        self.current_cash = initial_capital
        self.risk_per_trade = risk_per_trade
        self.positions = {} # ticker -> {qty, entry_price, entry_time, sl, tp}
        self.equity_curve = []
        self.trade_log = []

    def get_financial_summary(self, current_prices: dict):
        total_involved = 0
        total_unrealized_pnl = 0
        risk_exposure = 0
        
        for ticker, pos in self.positions.items():
            price = current_prices.get(ticker, pos['entry_price'])
            total_involved += pos['qty'] * pos['entry_price']
            total_unrealized_pnl += (price - pos['entry_price']) * pos['qty']
            # Risk is defined as the distance to SL
            risk_exposure += (pos['entry_price'] - pos['sl']) * pos['qty']
            
        return {
            "cash": round(self.current_cash, 2),
            "equity": round(self.current_cash + total_involved + total_unrealized_pnl, 2),
            "involved": round(total_involved, 2),
            "unrealized_pnl": round(total_unrealized_pnl, 2),
            "risk_exposure": round(risk_exposure, 2),
            "position_count": len(self.positions)
        }

    def get_daily_advice(self, market_sentiment: float):
        """Generates intelligence advice based on current exposure."""
        if not self.positions:
            if market_sentiment > 0.6:
                return "Market sentiment is bullish. AI suggests scanning for high-confidence entries in S&P 500."
            return "Market is neutral. Focus on defensive sectors or wait for clearer signals."
            
        advice = []
        if len(self.positions) > 5:
            advice.append("High diversification reached. Monitor SL levels closely to prevent global drawdown.")
        
        avg_pnl = sum((t['pnl'] for t in self.trade_log[-5:])) if self.trade_log else 0
        if avg_pnl < 0:
            advice.append("Recent performance dip detected. Recommend reducing position sizes (SL 2-3%) for new entries.")
            
        return " | ".join(advice) if advice else "Current positions are healthy. Sentiment backup is stable."

    def calculate_position_size(self, ticker: str, entry_price: float, sl_pct: float):
        """
        Calculates quantity based on standard Money Management:
        Allocation = (Current Capital * Risk Per Trade) / Stop Loss %
        Example: $10,000 capital, 2% risk, 5% stop -> $4,000 position.
        """
        if sl_pct <= 0:
            return 0
            
        risk_amount = self.initial_capital * self.risk_per_trade
        allocation_usd = risk_amount / sl_pct
        
        # Check if we have enough cash for this allocation
        if allocation_usd > self.current_cash:
            allocation_usd = self.current_cash
            
        qty = int(allocation_usd / entry_price)
        return qty

    def open_position(self, ticker: str, entry_price: float, entry_time: str, sl: float, tp: float, sl_pct: float):
        qty = self.calculate_position_size(ticker, entry_price, sl_pct)
        if qty <= 0:
            return False
            
        total_cost = qty * entry_price
        self.current_cash -= total_cost
        self.positions[ticker] = {
            "qty": qty,
            "entry_price": entry_price,
            "entry_time": entry_time,
            "sl": sl,
            "tp": tp
        }
        return True

    def close_position(self, ticker: str, exit_price: float, exit_time: str, reason: str):
        if ticker not in self.positions:
            return False
            
        pos = self.positions[ticker]
        total_value = pos['qty'] * exit_price
        self.current_cash += total_value
        
        pnl = (exit_price - pos['entry_price']) * pos['qty']
        pnl_pct = ((exit_price / pos['entry_price']) - 1) * 100
        
        self.trade_log.append({
            "ticker": ticker,
            "entry_time": pos['entry_time'],
            "exit_time": exit_time,
            "entry_price": round(pos['entry_price'], 2),
            "exit_price": round(exit_price, 2),
            "qty": pos['qty'],
            "pnl": round(pnl, 2),
            "pnl_pct": round(pnl_pct, 2),
            "reason": reason,
            "sl": round(pos['sl'], 2),
            "tp": round(pos['tp'], 2)
        })
        
        del self.positions[ticker]
        return True

    def update_equity(self, current_prices: dict, timestamp: str):
        total_equity = self.current_cash
        for ticker, pos in self.positions.items():
            price = current_prices.get(ticker, pos['entry_price'])
            total_equity += pos['qty'] * price
            
        self.equity_curve.append({
            "date": timestamp,
            "equity": round(total_equity, 2)
        })
        return total_equity
