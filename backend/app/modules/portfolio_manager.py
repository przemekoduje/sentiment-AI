class PortfolioManager:
    def __init__(self, initial_capital: float = 10000.0, risk_per_trade: float = 0.02):
        self.initial_capital = initial_capital
        self.current_cash = initial_capital
        self.risk_per_trade = risk_per_trade
        self.positions = {} # ticker -> {qty, entry_price, entry_time, sl, tp}
        self.equity_curve = []
        self.trade_log = []

    def calculate_position_size(self, ticker: str, entry_price: float, sl_pct: float):
        """
        Calculates quantity based on SL engagement rule:
        Position Size (USD) = Initial Capital * SL%
        Example: $10,000 capital and 5% SL -> $500 position.
        """
        if sl_pct <= 0:
            return 0
            
        allocation_usd = self.initial_capital * sl_pct
        
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
