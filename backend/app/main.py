import os
import traceback
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
import uvicorn
import pandas as pd
import yfinance as yf
from dotenv import load_dotenv

# Load environment variables from .env
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
load_dotenv(dotenv_path=env_path)

from .modules.live_discovery import LiveDiscoveryEngine
from .modules.decision_matrix import get_trading_signal
from .modules.roi_calculator import calculate_potential_roi
from .modules.technical_analysis import get_technical_indicator
from .modules.sentiment_bridge import fetch_news_sentiment, aggregate_sentiment_score
from .modules.backtester import BacktestEngine
from .modules.bulk_backtester import BulkBacktester
from .modules.portfolio_manager import PortfolioManager
import asyncio

app = FastAPI(title="Sentiment AI Trading Engine")

# Init discovery engine once for global cache
discovery_engine = LiveDiscoveryEngine()
portfolio = PortfolioManager(initial_capital=10000.0)

# --- Background Market Monitor (Production Scaling) ---
async def market_monitor_loop():
    """Pętla tła: Skanuje rynek cyklicznie i symuluje trading na żywo."""
    print(">>> Starting Background Market Monitor...")
    while True:
        try:
            # Skanujemy 100 najwiekszych spółek (Phase 5)
            await discovery_engine.refresh_cache(limit=100)
            
            # Simulated Trading: Automatyczne otwieranie pozycji na podstawie sygnałów BUY
            signals = discovery_engine.get_cached_signals()
            current_time = datetime.now().isoformat()
            
            for signal in signals:
                ticker = signal['symbol']
                if signal['action'] == "BUY" and ticker not in portfolio.positions:
                    # Symulujemy SL/TP na poziomie 5% / 10%
                    entry_price = signal['price']
                    sl = entry_price * 0.95
                    tp = entry_price * 1.10
                    portfolio.open_position(
                        ticker=ticker,
                        entry_price=entry_price,
                        entry_time=current_time,
                        sl=sl,
                        tp=tp,
                        sl_pct=0.05
                    )
                    print(f"LIVE_TRADE: Opened BUY for {ticker} at ${entry_price}")

            # Odświeżamy co 5 minut
            await asyncio.sleep(300) 
        except Exception as e:
            print(f"Monitor Loop Error: {e}")
            await asyncio.sleep(60)

@app.on_event("startup")
async def startup_event():
    # Uruchamiamy monitor w tle
    asyncio.create_task(market_monitor_loop())

# CORS setup for Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"status": "running", "message": "Sentiment AI API is online"}

@app.get("/api/live/performance")
async def get_live_performance():
    """
    Zwraca aktualne statystyki portfela na żywo.
    """
    total_trades = len(portfolio.trade_log)
    win_rate = 0
    if total_trades > 0:
        wins = len([t for t in portfolio.trade_log if t['pnl'] > 0])
        win_rate = (wins / total_trades) * 100
    
    # Oblicz Net P&L (zamknięte + otwarte)
    current_prices = {s['symbol']: s['price'] for s in discovery_engine.get_cached_signals()}
    total_equity = portfolio.update_equity(current_prices, datetime.now().isoformat())
    net_pnl = total_equity - portfolio.initial_capital

    return {
        "total_trades_24h": total_trades,
        "win_rate": round(win_rate, 1),
        "net_pnl": round(net_pnl, 2),
        "active_positions_count": len(portfolio.positions),
        "trade_log": portfolio.trade_log[-10:] # Ostatnie 10 transakcji
    }

@app.get("/api/live/discovery")
async def discovery():
    """
    Real-time market discovery scan for high-potential 'BUY' opportunities.
    Returns cached results for millisecond response (Phase 5).
    """
    try:
        if not discovery_engine.initial_scan_complete:
            return {"status": "scanning", "message": "Initial market scan in progress...", "signals": []}
            
        signals = discovery_engine.get_cached_signals()
        return {
            "status": "active",
            "timestamp": datetime.now().isoformat(),
            "signals": signals
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/live/matrix")
async def get_live_matrix():
    """
    Zwraca surowe dane procesu decyzyjnego dla wszystkich skanowanych tickerów.
    Umożliwia wizualizację "myślenia" silnika na żywo.
    """
    print(f"[{datetime.now()}] Incoming request: /api/live/matrix")
    try:
        data = discovery_engine.get_matrix_data()
        return {
            "status": "active",
            "timestamp": datetime.now().isoformat(),
            "matrix": data
        }
    except Exception as e:
        import traceback
        err_msg = f"CRITICAL ERROR in /api/live/matrix: {str(e)}"
        print(err_msg)
        traceback.print_exc()
        # Return full error in detail for easier debugging in browser console
        raise HTTPException(status_code=500, detail=f"{err_msg}\n{traceback.format_exc()}")

@app.get("/api/live/alerts")
async def get_live_alerts():
    """
    Zwraca listę ostatnio wygenerowanych alertów systemowych.
    """
    try:
        alerts = discovery_engine.get_alerts()
        return {
            "status": "active",
            "timestamp": datetime.now().isoformat(),
            "alerts": alerts
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/signals")
async def get_signals(ticker: str = "AAPL"):
    """
    Merging technical signals with AI sentiment.
    """
    try:
        # 1. Get Technical Signal (now returns a detailed dict)
        tech_data, current_price = get_technical_indicator(ticker)
        
        # 2. Get Real-Time Sentiment from Alpha Vantage
        news_feed = await fetch_news_sentiment(ticker)
        sentiment_data = aggregate_sentiment_score(news_feed, ticker)
        
        # 3. Decision Matrix gating
        decision_data = get_trading_signal(
            technical_indicator=tech_data['signal'],
            sentiment_label=sentiment_data['label'],
            sentiment_score=sentiment_data['score']
        )
        
        return {
            "ticker": ticker,
            "current_price": tech_data['price'],
            "signal": decision_data['action'],
            "confidence": decision_data['confidence'],
            "sentiment_label": sentiment_data['label'],
            "technical_signal": tech_data['signal'],
            "technical_indicators": tech_data['indicators'],
            "formations": tech_data['formations'],
            "reasoning": decision_data['reasoning'],
            "is_confident": decision_data['is_confident'],
            "timestamp": datetime.now().isoformat(),
            "news_feed": news_feed[:10]  # Return top 10 news
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/calculate-roi")
async def get_roi(capital: float = 10000.0):
    """
    ROI calculator for marketing tool.
    """
    return calculate_potential_roi(capital)

@app.get("/api/chart/trade")
async def get_trade_chart(
    ticker: str,
    entry_time: str,
    exit_time: str,
    backtest_start: str = Query(None),
    backtest_end: str = Query(None),
    interval: str = Query("1d")
):
    """
    Fetches OHLC data for trade popups.
    """
    try:
        # Helper for flexible date parsing
        def parse_date(date_str):
            if not date_str: return None
            try:
                # Try full ISO first, return as naive UTC
                return datetime.fromisoformat(date_str.replace('Z', '+00:00')).replace(tzinfo=None)
            except ValueError:
                try:
                    # Try YYYY-MM-DD
                    return datetime.strptime(date_str[:10], "%Y-%m-%d")
                except Exception:
                    return None

        # Common logic for trade context: 90 days before entry, 90 days after exit
        entry_dt = parse_date(entry_time) or datetime.now()
        exit_dt = parse_date(exit_time) or datetime.now()
        
        # Use backtest bounds if provided, otherwise default to trade context
        if backtest_start:
            bt_start = parse_date(backtest_start)
            if bt_start:
                start_dt = bt_start
        else:
            start_dt = entry_dt - timedelta(days=90)

        if backtest_end:
            bt_end = parse_date(backtest_end)
            if bt_end:
                end_dt = bt_end
        else:
            end_dt = exit_dt + timedelta(days=90)

        # Cap end_dt at today to avoid yfinance errors
        today = datetime.now()
        # Ensure comparison works (make end_dt naive if it's aware)
        if end_dt.tzinfo is not None:
             end_dt = end_dt.replace(tzinfo=None)
             
        if end_dt > today:
            end_dt = today
            
        start_date = start_dt.strftime("%Y-%m-%d")
        end_date = end_dt.strftime("%Y-%m-%d")
        
        print(f"DEBUG: Ticker={ticker}, Interval={interval}, Range: {start_date} to {end_date}")
        data = yf.download(ticker, start=start_date, end=end_date, interval=interval, progress=False)
        print(f"DEBUG: Downloaded {len(data)} rows for {ticker} with interval {interval}")
        
        if data.empty:
            return {"ticker": ticker, "data": [], "error": "No data found"}

        # Flatten columns if MultiIndex (yf v0.2.40+ behavior)
        if isinstance(data.columns, pd.MultiIndex):
            data.columns = data.columns.get_level_values(0)
        
        # Ensure we have a Close column and it's 1D
        if 'Close' not in data.columns:
            return {"ticker": ticker, "data": [], "error": f"Close price not found for {ticker}"}
            
        # Add Technical Indicators for the Chart
        data['SMA5'] = data['Close'].rolling(window=5).mean()
        data['SMA20'] = data['Close'].rolling(window=20).mean()
        
        chart_data = []
        for index, row in data.iterrows():
            close_val = row['Close']
            sma5_val = row['SMA5']
            sma20_val = row['SMA20']
            
            if isinstance(close_val, pd.Series):
                close_val = close_val.iloc[0]
            if isinstance(sma5_val, pd.Series):
                sma5_val = sma5_val.iloc[0]
            if isinstance(sma20_val, pd.Series):
                sma20_val = sma20_val.iloc[0]
                
            # For intraday, lightweight charts prefers UTC timestamps (seconds)
            # For daily, it prefers YYYY-MM-DD strings
            if interval == "1d":
                formatted_time = index.strftime("%Y-%m-%d")
            else:
                formatted_time = int(index.timestamp())

            chart_data.append({
                "date": formatted_time,
                "price": round(float(close_val), 2),
                "sma5": round(float(sma5_val), 2) if not pd.isna(sma5_val) else None,
                "sma20": round(float(sma20_val), 2) if not pd.isna(sma20_val) else None
            })
        
        # Fetch insider markers for UI overlay
        insider_markers = []
        try:
            raw_markers = discovery_engine.insider_tracker.get_historical_insider_data(
                ticker, start_date, end_date
            )
            for m in raw_markers:
                if interval != "1d" and "date" in m:
                    # Convert "YYYY-MM-DD" to timestamp (start of day)
                    dt = datetime.strptime(m["date"], "%Y-%m-%d")
                    m["date"] = int(dt.timestamp())
                insider_markers.append(m)
        except Exception:
             # Non-fatal error for markers
             pass
        
        return {
            "ticker": ticker,
            "data": chart_data,
            "markers": {
                "entry": entry_time,
                "exit": exit_time,
                "insiders": insider_markers
            }
        }
    except Exception as e:
        import traceback
        print(f"CRITICAL ERROR in /api/chart/trade: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/backtest")
async def run_backtest(
    ticker: str = "AAPL",
    start_date: str = "2024-01-01",
    end_date: str = "2024-03-01",
    capital: float = 10000.0,
    sl: float = 0.05,
    tp: float = 0.1,
    use_live_sentiment: bool = False,
):
    """
    Executes a historical simulation.
    """
    try:
        engine = BacktestEngine(
            ticker=ticker,
            start_date=start_date,
            end_date=end_date,
            capital=capital,
            sl_pct=sl,
            tp_pct=tp,
            use_live_sentiment=use_live_sentiment,
        )
        results = await engine.run()
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/backtest/bulk")
async def run_bulk_backtest(
    start_date: str = "2024-01-01",
    end_date: str = None,
    capital: float = 10000.0,
    sl_pct: float = 0.05,
    tp_pct: float = 0.10,
    use_live_sentiment: bool = False,
):
    try:
        bulk = BulkBacktester()
        report = await bulk.run_market_scan(
            start_date=start_date,
            end_date=end_date,
            capital=capital,
            sl_pct=sl_pct,
            tp_pct=tp_pct,
            use_live_sentiment=use_live_sentiment,
        )
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
