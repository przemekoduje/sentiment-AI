import asyncio
import pandas as pd
from typing import List, Dict
from datetime import datetime
from .backtester import BacktestEngine
from .portfolio_manager import PortfolioManager
from .ticker_provider import TickerProvider


class BulkBacktester:
    """
    Unified Portfolio Simulation.

    One capital pool is shared across all tickers.
    The simulation walks chronologically, day-by-day, checking all tickers
    for SL/TP exits and new BUY signals on each session.

    Position sizing rule:
        Position Size (USD) = Initial Capital * SL%
        e.g. $10,000 capital + 5% SL = $500 allocated per position.

    This means the number of simultaneous positions is limited by available cash.
    """

    def __init__(self):
        pass

    async def run_market_scan(
        self,
        tickers: List[str] = None,
        start_date: str = "2024-01-01",
        end_date: str = None,
        capital: float = 10000.0,
        sl_pct: float = 0.05,
        tp_pct: float = 0.10,
        use_live_sentiment: bool = False,
        strategy_type: str = "trend"
    ) -> Dict:
        """Runs a unified portfolio backtest across all tickers."""
        if not tickers:
            tickers = TickerProvider.get_sp500_tickers()

        scan_list = tickers[:20]

        # --- Step 1: Fetch & prepare data for all tickers in parallel ---
        sem = asyncio.Semaphore(5)

        async def fetch(ticker):
            async with sem:
                engine = BacktestEngine(
                    ticker=ticker,
                    start_date=start_date,
                    end_date=end_date,
                    sl_pct=sl_pct,
                    tp_pct=tp_pct,
                    use_live_sentiment=use_live_sentiment,
                    strategy_type=strategy_type
                )
                data = await engine.prepare_data()
                if data is None or data.empty:
                    return None
                return {"ticker": ticker, "engine": engine, "data": data}

        raw_items = await asyncio.gather(*[fetch(t) for t in scan_list])
        items = [x for x in raw_items if x is not None]

        if not items:
            return {"error": "No valid market data returned for the scan."}

        # --- Step 2: Build a unified chronological clock ---
        all_dates = sorted(set(
            date
            for item in items
            for date in item["data"].index.strftime("%Y-%m-%d").tolist()
        ))

        # --- Step 3: Single shared portfolio ---
        portfolio = PortfolioManager(initial_capital=capital)

        # Index data by ticker for O(1) lookup
        data_by_ticker = {item["ticker"]: item["data"] for item in items}
        engine_by_ticker = {item["ticker"]: item["engine"] for item in items}
        # Inject shared portfolio into each engine
        for item in items:
            item["engine"].portfolio = portfolio

        # --- Step 4: Walk the clock ---
        for date_str in all_dates:
            current_prices: Dict[str, float] = {}

            for ticker, data in data_by_ticker.items():
                # Get today's row if exists
                if date_str not in data.index.strftime("%Y-%m-%d").tolist():
                    continue

                date_idx = data.index.strftime("%Y-%m-%d").tolist().index(date_str)
                row = data.iloc[date_idx]
                price = float(row["Close"].iloc[0]) if isinstance(row["Close"], pd.Series) else float(row["Close"])
                current_prices[ticker] = price

                # --- Exit checks first ---
                if ticker in portfolio.positions:
                    pos = portfolio.positions[ticker]
                    if price <= pos["sl"]:
                        portfolio.close_position(ticker, price, date_str, "STOP LOSS")
                    elif price >= pos["tp"]:
                        portfolio.close_position(ticker, price, date_str, "TAKE PROFIT")

            # --- Entry checks (only after exits are processed) ---
            for ticker, data in data_by_ticker.items():
                if date_str not in data.index.strftime("%Y-%m-%d").tolist():
                    continue

                date_idx = data.index.strftime("%Y-%m-%d").tolist().index(date_str)
                if date_idx == 0:
                    continue  # Need previous row for signal

                row = data.iloc[date_idx]
                prev_row = data.iloc[date_idx - 1]
                price = current_prices.get(ticker)
                if price is None:
                    continue

                if ticker in portfolio.positions:
                    continue  # Already holding this ticker

                engine = engine_by_ticker[ticker]
                data_slice = data.iloc[max(0, date_idx-30):date_idx+1]
                signal = engine.get_signal(data_slice)

                if signal == "BUY":
                    sl_val = price * (1 - sl_pct)
                    tp_val = price * (1 + tp_pct)
                    portfolio.open_position(ticker, price, date_str, sl_val, tp_val, sl_pct)

            # --- Update equity curve after all actions ---
            portfolio.update_equity(current_prices, date_str)

        try:
            # --- Step 5: Force-close any remaining positions at last known price ---
            for ticker in list(portfolio.positions.keys()):
                data = data_by_ticker.get(ticker)
                if data is not None and not data.empty:
                    last_price = float(data.iloc[-1]["Close"].iloc[0]) if isinstance(data.iloc[-1]["Close"], pd.Series) else float(data.iloc[-1]["Close"])
                    portfolio.close_position(ticker, last_price, all_dates[-1], "BACKTEST END")
    
            # --- Step 6: Build rich results ---
            trade_log = sorted(portfolio.trade_log, key=lambda x: x.get("entry_time", ""), reverse=True)
    
            final_equity = portfolio.equity_curve[-1]["equity"] if portfolio.equity_curve else capital
            total_pnl = final_equity - capital
            roi_pct = round((total_pnl / capital) * 100, 2)
            wins = [t for t in portfolio.trade_log if t["pnl"] > 0]
            win_rate = round((len(wins) / len(portfolio.trade_log)) * 100, 2) if portfolio.trade_log else 0
        except Exception as e:
            print(f"Error in BulkBacktester reporting: {e}")
            raise e

        # Per-ticker stats from trade log
        ticker_stats: Dict[str, Dict] = {}
        for t in portfolio.trade_log:
            tk = t["ticker"]
            if tk not in ticker_stats:
                ticker_stats[tk] = {"pnl": 0.0, "wins": 0, "trades": 0}
            ticker_stats[tk]["pnl"] += t["pnl"]
            ticker_stats[tk]["trades"] += 1
            if t["pnl"] > 0:
                ticker_stats[tk]["wins"] += 1

        sorted_tickers = sorted(ticker_stats.items(), key=lambda x: x[1]["pnl"], reverse=True)
        top_performers    = [{"ticker": tk, "pnl": round(stats["pnl"], 2)} for tk, stats in sorted_tickers[:5]]
        bottom_performers = [{"ticker": tk, "pnl": round(stats["pnl"], 2)} for tk, stats in sorted_tickers[-5:]]

        all_results = [
            {
                "ticker": tk,
                "pnl": round(stats["pnl"], 2),
                "trades": stats["trades"],
                "win_rate": round((stats["wins"] / stats["trades"]) * 100, 2) if stats["trades"] else 0,
            }
            for tk, stats in sorted_tickers
        ]

        return {
            "summary": {
                "initial_capital": capital,
                "final_equity": round(final_equity, 2),
                "tickers_scanned": len(scan_list),
                "valid_results": len(items),
                "total_aggregate_pnl": round(total_pnl, 2),
                "market_roi": roi_pct,
                "avg_win_rate": win_rate,
                "total_trades": len(portfolio.trade_log),
                "start_date": start_date,
                "end_date": end_date or datetime.now().strftime("%Y-%m-%d"),
            },
            "rankings": {
                "top": top_performers,
                "bottom": bottom_performers,
            },
            "all_results": all_results,
            "master_trade_log": trade_log,
            "equity_curve": portfolio.equity_curve,
        }
