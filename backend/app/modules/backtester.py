import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
from .portfolio_manager import PortfolioManager
from .decision_matrix import get_trading_signal
from .sentiment_bridge import fetch_news_sentiment, aggregate_sentiment_score
from .volume_analysis import get_volume_signal
from .candlestick_patterns import get_candlestick_signal

class BacktestEngine:
    def __init__(
        self,
        ticker: str,
        start_date: str,
        end_date: str,
        capital: float = 10000.0,
        sl_pct: float = 0.05,
        tp_pct: float = 0.1,
        portfolio: PortfolioManager = None,
        use_live_sentiment: bool = False,
        strategy_type: str = "trend" # trend, volume, candlestick
    ):
        self.ticker = ticker
        self.start_date = start_date
        self.end_date = end_date
        self.sl_pct = sl_pct
        self.tp_pct = tp_pct
        self.use_live_sentiment = use_live_sentiment
        self.strategy_type = strategy_type
        # Allow an external shared portfolio to be injected (used by BulkBacktester)
        self.portfolio = portfolio if portfolio is not None else PortfolioManager(initial_capital=capital)
        # Sentiment cache: date_str -> {label, score}
        self._sentiment_cache: dict = {}

    async def prepare_data(self):
        """Fetches price data and calculates indicators."""
        start_dt = datetime.strptime(self.start_date, "%Y-%m-%d") - timedelta(days=60)
        data = yf.download(
            self.ticker,
            start=start_dt.strftime("%Y-%m-%d"),
            end=self.end_date,
            interval="1d",
            progress=False,
            auto_adjust=False
        )

        if data.empty:
            return None

        if isinstance(data.columns, pd.MultiIndex):
            data.columns = data.columns.get_level_values(0)
        data = data.loc[:, ~data.columns.duplicated()].copy()

        # Ensure critical columns are Series not DataFrames (handle edge cases)
        if isinstance(data['Close'], pd.DataFrame):
            data['Close'] = data['Close'].iloc[:, 0]
            
        data['SMA5'] = data['Close'].rolling(window=5).mean()
        data['SMA20'] = data['Close'].rolling(window=20).mean()

        clipped = data[data.index >= self.start_date].copy()
        if clipped.empty:
            return None
            
        return clipped

    async def fetch_sentiment_for_date(self, date_str: str) -> dict:
        """
        Returns sentiment for a given date.
        - Live mode: fetches from Global News Source (AV/yfinance) for that week window.
        - Simulated mode: always returns {'label': 'positive', 'score': 0.75}
        """
        if not self.use_live_sentiment:
            return {"label": "positive", "score": 0.75}

        if date_str in self._sentiment_cache:
            return self._sentiment_cache[date_str]

        try:
            # Fetch news from 7-day window around the date
            dt = datetime.strptime(date_str, "%Y-%m-%d")
            time_from = (dt - timedelta(days=3)).strftime("%Y-%m-%d")
            time_to   = (dt + timedelta(days=3)).strftime("%Y-%m-%d")
            feed = await fetch_news_sentiment(self.ticker, time_from=time_from, time_to=time_to)
            result = aggregate_sentiment_score(feed, self.ticker)
        except Exception:
            result = {"label": "neutral", "score": 0.5}

        self._sentiment_cache[date_str] = result
        return result

    async def get_signal_async(self, data_slice: pd.DataFrame, date_str: str) -> str:
        """Evaluates signal based on selected strategy_type."""
        if data_slice.empty: return "HOLD"
        
        row = data_slice.iloc[-1]
        prev_row = data_slice.iloc[-2] if len(data_slice) > 1 else row
        
        def scalar(val):
            return float(val.iloc[0]) if isinstance(val, pd.Series) else float(val)

        tech_signal = "NEUTRAL"
        reasoning = ""

        if self.strategy_type == "trend":
            sma5       = scalar(row['SMA5'])
            sma20      = scalar(row['SMA20'])
            prev_sma5  = scalar(prev_row['SMA5'])
            prev_sma20 = scalar(prev_row['SMA20'])
            if sma5 > sma20 and prev_sma5 <= prev_sma20:
                tech_signal = "BULLISH"
            elif sma5 < sma20 and prev_sma5 >= prev_sma20:
                tech_signal = "BEARISH"
        
        elif self.strategy_type == "volume":
            v_res = get_volume_signal(data_slice)
            tech_signal = "BULLISH" if v_res['signal'] == "BUY" else "NEUTRAL"
            reasoning = v_res['reasoning']

        elif self.strategy_type == "candlestick":
            c_res = get_candlestick_signal(data_slice)
            tech_signal = "BULLISH" if c_res['signal'] == "BUY" else "NEUTRAL"
            reasoning = c_res['reasoning']

        sentiment = await self.fetch_sentiment_for_date(date_str)
        decision = get_trading_signal(tech_signal, sentiment['label'], sentiment['score'])
        
        if reasoning:
            decision['reasoning'] = reasoning
            
        return decision['action']

    def get_signal(self, data_slice: pd.DataFrame) -> str:
        """Sync version used by BulkBacktester."""
        if data_slice.empty: return "HOLD"
        
        row = data_slice.iloc[-1]
        prev_row = data_slice.iloc[-2] if len(data_slice) > 1 else row
        
        def scalar(val):
            return float(val.iloc[0]) if isinstance(val, pd.Series) else float(val)

        tech_signal = "NEUTRAL"
        if self.strategy_type == "trend":
            sma5       = scalar(row['SMA5'])
            sma20      = scalar(row['SMA20'])
            prev_sma5  = scalar(prev_row['SMA5'])
            prev_sma20 = scalar(prev_row['SMA20'])
            if sma5 > sma20 and prev_sma5 <= prev_sma20:
                tech_signal = "BULLISH"
            elif sma5 < sma20 and prev_sma5 >= prev_sma20:
                tech_signal = "BEARISH"
        elif self.strategy_type == "volume":
            v_res = get_volume_signal(data_slice)
            tech_signal = "BULLISH" if v_res['signal'] == "BUY" else "NEUTRAL"
        elif self.strategy_type == "candlestick":
            c_res = get_candlestick_signal(data_slice)
            tech_signal = "BULLISH" if c_res['signal'] == "BUY" else "NEUTRAL"

        # In bulk mode we always use simulated sentiment
        sentiment = {"label": "positive", "score": 0.75}
        decision = get_trading_signal(tech_signal, sentiment['label'], sentiment['score'])
        return decision['action']

    async def run(self):
        """Single-ticker backtest using own private portfolio."""
        data = await self.prepare_data()
        if data is None or data.empty:
            return {"error": f"No data found for {self.ticker}"}

        # Need enough data for Volume/Candlestick window (approx 21-30 candles)
        start_idx = 25 if self.strategy_type != "trend" else 1

        for i in range(start_idx, len(data)):
            data_slice = data.iloc[max(0, i-30):i+1]
            row = data.iloc[i]
            timestamp = data.index[i].strftime("%Y-%m-%d")
            
            # Extract price correctly
            try:
                price = float(row['Close'].iloc[0]) if isinstance(row['Close'], pd.Series) else float(row['Close'])
            except:
                price = float(row['Close'])

            if self.ticker in self.portfolio.positions:
                pos = self.portfolio.positions[self.ticker]
                if price <= pos['sl']:
                    self.portfolio.close_position(self.ticker, price, timestamp, "STOP LOSS")
                elif price >= pos['tp']:
                    self.portfolio.close_position(self.ticker, price, timestamp, "TAKE PROFIT")

            # Use async signal with data window
            signal = await self.get_signal_async(data_slice, timestamp)

            if signal == "BUY" and self.ticker not in self.portfolio.positions:
                sl_val = price * (1 - self.sl_pct)
                tp_val = price * (1 + self.tp_pct)
                self.portfolio.open_position(self.ticker, price, timestamp, sl_val, tp_val, self.sl_pct)
            elif signal == "SELL" and self.ticker in self.portfolio.positions:
                self.portfolio.close_position(self.ticker, price, timestamp, "AI SIGNAL SELL")

            self.portfolio.update_equity({self.ticker: price}, timestamp)

        if self.ticker in self.portfolio.positions:
            try:
                last_price = float(data.iloc[-1]['Close'].iloc[0]) if isinstance(data.iloc[-1]['Close'], pd.Series) else float(data.iloc[-1]['Close'])
            except:
                last_price = float(data.iloc[-1]['Close'])
            self.portfolio.close_position(self.ticker, last_price, data.index[-1].strftime("%Y-%m-%d"), "BACKTEST END")

        return {
            "ticker": self.ticker,
            "summary": {
                "initial_capital": self.portfolio.initial_capital,
                "final_equity": self.portfolio.equity_curve[-1]['equity'] if self.portfolio.equity_curve else self.portfolio.initial_capital,
                "total_trades": len(self.portfolio.trade_log),
                "win_rate": self.calculate_win_rate(),
                "roi_pct": round(((self.portfolio.current_cash / self.portfolio.initial_capital) - 1) * 100, 2),
                "sentiment_mode": "LIVE" if self.use_live_sentiment else "SIMULATED"
            },
            "trades": self.portfolio.trade_log,
            "equity_curve": self.portfolio.equity_curve
        }

    def calculate_win_rate(self):
        if not self.portfolio.trade_log:
            return 0
        wins = [t for t in self.portfolio.trade_log if t['pnl'] > 0]
        return round((len(wins) / len(self.portfolio.trade_log)) * 100, 2)
