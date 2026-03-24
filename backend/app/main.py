import os
import traceback
from typing import Optional
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
from .modules.ticker_provider import TickerProvider
from .modules.decision_matrix import get_trading_signal
from .modules.roi_calculator import calculate_potential_roi
from .modules.technical_analysis import get_technical_indicator
from .modules.sentiment_bridge import fetch_news_sentiment, aggregate_sentiment_score, aggregate_local_sentiment
from .modules.backtester import BacktestEngine
from .modules.bulk_backtester import BulkBacktester
from .modules.portfolio_manager import PortfolioManager
from .database import TradeSignal, save_signal, get_signal_by_id, create_db_and_tables
from pydantic import BaseModel
from .modules.yf_manager import safe_download
import asyncio
import math

def sanitize_nan(obj, fallback=0.0):
    """Recursively replaces NaN/Inf with fallback in dicts, lists, and floats."""
    if isinstance(obj, dict):
        return {k: sanitize_nan(v, fallback) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_nan(v, fallback) for v in obj]
    elif isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return fallback
    return obj

app = FastAPI(title="Sentiment AI Trading Engine")

# Init discovery engine once for global cache
discovery_engine = LiveDiscoveryEngine()
portfolio = PortfolioManager(initial_capital=10000.0)

# Initialize PostgreSQL Tables
try:
    from .database import create_db_and_tables, get_portfolio_settings
    create_db_and_tables()
    get_portfolio_settings() # Initialize default settings row if missing
    print("PostgreSQL Tables Synced & Initialized.")
except Exception as e:
    print(f"DB Init Warning: {e}")

# --- Background Market Monitor (Production Scaling) ---
async def market_monitor_loop():
    """Pętla tła: Skanuje rynek cyklicznie i zarządza pozycjami (Auto-Pilot)."""
    # 15. Periodic Firebase Flush (Optimization Layer)
    last_flush = datetime.now()
    
    while True:
        try:
            # 1. Skanujemy rynek (Phase 5 + Metoda Sita)
            await discovery_engine.refresh_cache(limit=500)
            
            # Okresowy flush heatmapy (co 30 min)
            if (datetime.now() - last_flush).total_seconds() > 1800:
                from .modules.firebase_helper import flush_heatmap_single_object
                flush_heatmap_single_object()
                last_flush = datetime.now()
            
            # 2. Monitorowanie otwartych pozycji (Automatyczne Wyjście)
            if portfolio.positions:
                current_time = datetime.now().isoformat()
                position_tickers = list(portfolio.positions.keys())
                try:
                    # Pobieramy ceny dla otwartych pozycji
                    data = await asyncio.to_thread(safe_download, position_tickers, period="1d", interval="1m", progress=False)
                    if not data.empty:
                        for ticker in position_tickers:
                            # Re-check if ticker still in positions (concurrency safety)
                            if ticker not in portfolio.positions: continue
                            
                            pos = portfolio.positions[ticker]
                            try:
                                if isinstance(data['Close'], pd.DataFrame):
                                    if ticker in data['Close'].columns:
                                        current_price = float(data['Close'][ticker].iloc[-1])
                                    else:
                                        current_price = float(data['Close'].iloc[-1])
                                else: # Series
                                    current_price = float(data['Close'].iloc[-1])
                            except Exception:
                                continue
                            
                            if current_price <= pos['sl']:
                                await portfolio.close_position(ticker, current_price, current_time, "STOP_LOSS (AUTO)")
                                print(f"AUTO_PILOT: Closed {ticker} at ${current_price} due to STOP_LOSS")
                            elif current_price >= pos['tp']:
                                await portfolio.close_position(ticker, current_price, current_time, "TAKE_PROFIT (AUTO)")
                                print(f"AUTO_PILOT: Closed {ticker} at ${current_price} due to TAKE_PROFIT")
                except Exception as e:
                    print(f"Auto-Pilot Monitor Error (Exit Check): {e}")

            # 3. Automatyczne otwarcie (Auto-Pilot Entry)
            if portfolio.auto_pilot_enabled:
                signals = discovery_engine.get_cached_signals()
                current_time = datetime.now().isoformat()
                # Sort signals by confidence/kelly for prioritization
                for signal in sorted(signals, key=lambda x: x.get('kelly_fraction', 0), reverse=True):
                    ticker = signal.get('ticker') or signal.get('symbol')
                    if not ticker: continue
                    
                    if signal.get('action') == "BUY" and ticker not in portfolio.positions:
                        entry_price = signal.get('price', 0)
                        if entry_price <= 0: continue
                        sl = entry_price * 0.95
                        tp = entry_price * 1.10
                        
                        success = await portfolio.open_position(
                            ticker=ticker, entry_price=entry_price, entry_time=current_time,
                            sl=sl, tp=tp, sl_pct=0.05,
                            kelly_fraction=signal.get('kelly_fraction', 0.02)
                        )
                        if success:
                            print(f"AUTO_PILOT: Executed BUY for {ticker} at ${entry_price}")

            await asyncio.sleep(120) # Szybsze pętlowanie w trybie Auto
        except Exception as e:
            print(f"Monitor Loop Error: {e}")
            await asyncio.sleep(60)

async def price_sync_loop():
    """
    High-Frequency Price Sync: Polls Alpaca every 12s for active tickers.
    Updates Firestore snapshots to trigger real-time UI refresh.
    """
    from .modules.alpaca_manager import get_latest_prices
    
    while True:
        try:
            # 1. Identify which tickers need real-time updates
            # (Those in current matrix + those in active portfolio)
            matrix_data = discovery_engine.get_matrix_data()
            matrix_tickers = [item['ticker'] for item in matrix_data]
            portfolio_tickers = list(portfolio.positions.keys())
            
            target_tickers = list(set(matrix_tickers + portfolio_tickers))
            
            if target_tickers:
                # 2. Fetch from Alpaca
                prices = await get_latest_prices(target_tickers)
                if prices:
                    # 3. Update cache & Firestore
                    discovery_engine.update_matrix_prices(prices)
            
            await asyncio.sleep(12) # ~5 updates per minute
        except Exception as e:
            print(f"Price Sync Loop Error: {e}")
            await asyncio.sleep(10)

@app.on_event("startup")
async def startup_event():
    # 1. Inicjalizacja danych statycznych (Market Caps)
    from .modules.market_cap_provider import MarketCapProvider
    # Start background tasks with priority for Discovery
    asyncio.create_task(market_monitor_loop())
    
    # Delay market cap refresh to avoid yf deadlock at startup
    async def delayed_caps():
        await asyncio.sleep(15) 
        await MarketCapProvider.refresh_caps()
    asyncio.create_task(delayed_caps())
    # Uruchamiamy szybką synchronizację cen
    asyncio.create_task(price_sync_loop())
    
    # 3. Natychmiastowe wypełnienie heatmapy (Initial Flush)
    try:
        from .modules.firebase_helper import flush_heatmap_single_object
        asyncio.create_task(asyncio.to_thread(flush_heatmap_single_object))
    except Exception as e:
        print(f"!!! Startup Heatmap Flush Error: {e}")

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

@app.get("/api/markets")
async def get_markets():
    """List available market categories."""
    return [
        {"id": "SP500", "label": "S&P 500", "description": "Top US Large Cap"}
    ]

@app.get("/api/markets/active")
async def get_active_market():
    """Returns the currently active market for the background monitor."""
    return {"active_market": discovery_engine.active_market}

@app.post("/api/markets/active")
async def set_active_market(market: str = Query(...)):
    """Sets the active market category."""
    valid_markets = ["SP500", "NASDAQ", "CRYPTO", "POLAND"]
    if market.upper() not in valid_markets:
        raise HTTPException(status_code=400, detail="Invalid market category")
    
    discovery_engine.set_active_market(market.upper())
    return {"status": "updated", "active_market": market.upper()}

@app.get("/api/demo-boost")
async def trigger_demo():
    discovery_engine.trigger_demo_signals()
    return {"status": "success", "message": "Demo signals injected."}

@app.get("/api/autopilot")
async def get_autopilot_status():
    from .database import get_portfolio_settings
    settings = await asyncio.to_thread(get_portfolio_settings)
    return {"enabled": settings.auto_pilot_enabled}

@app.post("/api/autopilot")
async def toggle_autopilot(enabled: bool = Query(...)):
    from .database import update_portfolio_settings
    await asyncio.to_thread(update_portfolio_settings, auto_pilot=enabled)
    portfolio.refresh_state()
    state = "ENABLED" if enabled else "DISABLED"
    print(f">>> AUTO-PILOT {state}")
    return {"status": "updated", "enabled": enabled}

@app.post("/api/portfolio/close")
async def close_trade(ticker: str = Query(...)):
    """
    Emergency Close Endpoint (User Initiated).
    """
    from .modules.yf_manager import safe_download
    try:
        # Optimization: Try to get price from discovery engine cache first (much faster)
        cached_data = discovery_engine.get_matrix_data()
        ticker_data = next((item for item in cached_data if item['ticker'] == ticker), None)
        
        current_price = 0.0
        if ticker_data and ticker_data.get('price'):
            current_price = float(ticker_data['price'])
            print(f">>> Fast-Close: Using cached price for {ticker}: {current_price}")
        else:
            # Fallback to fresh download (only if not in cache)
            data = await asyncio.to_thread(safe_download, [ticker], period="1d", interval="1m", progress=False)
            if data.empty or 'Close' not in data.columns:
                raise HTTPException(status_code=400, detail="Cannot fetch current price for closing.")
            current_price = float(data['Close'].iloc[-1])
            print(f">>> Standard-Close: Fetched fresh price for {ticker}: {current_price}")
        if math.isnan(current_price) or math.isinf(current_price):
            raise HTTPException(status_code=400, detail="Current price is NaN/Inf, cannot close position.")
            
        success = await portfolio.close_position(ticker, current_price, datetime.now().isoformat(), "MANUAL_CLOSE")
        
        if success:
            return {"status": "success", "message": f"Closed {ticker} at {current_price}"}
        else:
            raise HTTPException(status_code=400, detail="Failed to close position (maybe already closed).")
    except Exception as e:
        print(f"!!! Emergency Close Error: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/markets/tickers")
async def get_market_tickers():
    """Returns the full list of tickers for the currently active market."""
    active_market = discovery_engine.active_market
    tickers = TickerProvider.get_tickers_by_market(active_market)
    return {
        "market": active_market,
        "count": len(tickers),
        "tickers": tickers
    }

@app.get("/api/live/performance")
async def get_live_performance():
    """
    Zwraca aktualne statystyki portfela na żywo z bazy danych.
    """
    from .database import get_trade_history, Session, engine, select, TradeLog
    
    with Session(engine) as session:
        all_trades = session.exec(select(TradeLog)).all()
        total_trades = len(all_trades)
        wins = len([t for t in all_trades if t.pnl > 0])
        win_rate = (wins / total_trades * 100) if total_trades > 0 else 0
        
        # Ostatnie 10 dla logu
        last_trades = all_trades[-10:] if all_trades else []

    # Oblicz Net P&L (zamknięte + otwarte)
    try:
        # Use .get('ticker') for resilience
        current_prices = {s.get('ticker') or s.get('symbol'): s.get('price', 0) for s in discovery_engine.get_cached_signals()}
        summary = portfolio.get_financial_summary(current_prices)
        net_pnl = summary['equity'] - portfolio.initial_capital
    except Exception as e:
        print(f"!!! Error calculating live performance: {e}")
        summary = {"equity": portfolio.initial_capital, "position_count": 0}
        net_pnl = 0.0

    return sanitize_nan({
        "total_trades_24h": total_trades,
        "win_rate": win_rate,
        "net_pnl": net_pnl,
        "active_positions_count": summary['position_count'],
        "trade_log": [t.dict() for t in last_trades]
    })

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
        return sanitize_nan({
            "status": "active",
            "timestamp": datetime.now().isoformat(),
            "signals": signals
        })
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
        return sanitize_nan({
            "status": "active",
            "timestamp": datetime.now().isoformat(),
            "matrix": data
        })
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
        return sanitize_nan({
            "status": "active",
            "timestamp": datetime.now().isoformat(),
            "alerts": alerts
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/signals")
async def get_signals(ticker: str = "AAPL"):
    if ticker == "ALL":
        return {"status": "error", "message": "Global signals not supported yet. Select a specific ticker."}
    """
    Merging technical signals with AI sentiment.
    Uses background cache if available for faster response.
    """
    try:
        # Check cache first
        cached_matrix = discovery_engine.get_matrix_data()
        ticker_cache = next((item for item in cached_matrix if item['ticker'] == ticker), None)
        
        # If not in cache, we will fall through to on-demand fetch (slower but complete)

        if ticker_cache:
            # Reconstruct response from cache
            return sanitize_nan({
                "ticker": ticker,
                "current_price": ticker_cache['price'],
                "change_pct": ticker_cache.get('change_pct', 0),
                "signal": "BULLISH" if ticker_cache['sma5'] > ticker_cache['sma20'] else "NEUTRAL",
                "confidence": ticker_cache['potential'] / 100,
                "sentiment_label": ticker_cache['sentiment_label'],
                "sentiment_score": ticker_cache.get('sentiment_score', 0),
                "local_sentiment_label": ticker_cache.get('local_sentiment_label', "---"),
                "local_sentiment_score": ticker_cache.get('local_sentiment_score', 0),
                "technical_signal": "BULLISH" if ticker_cache['sma5'] > ticker_cache['sma20'] else "NEUTRAL",
                "technical_indicators": {
                    "sma5": ticker_cache['sma5'],
                    "sma20": ticker_cache['sma20'],
                    "rsi": ticker_cache.get('rsi', 50.0)
                },
                "formations": [],
                "reasoning": "Data retrieved from background market scan cache.",
                "is_confident": ticker_cache['potential'] > 60,
                "news_feed": ticker_cache.get('news_feed', []),
                "timestamp": datetime.now().isoformat()
            })

        # Fallback to on-demand fetch if not in cache
        # 1. Get Technical Signal (now returns a detailed dict)
        tech_data, current_price = get_technical_indicator(ticker)
        
        # 2. Get Real-Time Sentiment (AV with yfinance fallback)
        news_feed = await fetch_news_sentiment(ticker)
        sentiment_data = aggregate_sentiment_score(news_feed, ticker)
        local_sentiment_data = await aggregate_local_sentiment(news_feed)
        
        # Fallback to local sentiment if AV sentiment is missing
        if sentiment_data.get('count', 0) == 0:
            sentiment_data = local_sentiment_data
        
        # 3. Decision Matrix gating
        decision_data = get_trading_signal(
            technical_indicator=tech_data['signal'],
            sentiment_label=sentiment_data['label'],
            sentiment_score=sentiment_data['score']
        )
        
        # --- NEW: On-Demand Firestore Sync for Mission Control ---
        try:
            from .modules.firebase_helper import save_analysis_snapshot
            snapshot_data = {
                "ticker": ticker,
                "current_price": tech_data['price'],
                "sentiment_score": sentiment_data['score'] if sentiment_data['label'] == 'positive' else -sentiment_data['score'],
                "sentiment_label": sentiment_data['label'],
                "reasoning": decision_data['reasoning'],
                "signal": decision_data['action'],
                "round_kelly": (sentiment_data['score'] * 0.2), # Simplified Kelly
                "technical_signal": tech_data['signal'],
                "news_feed": news_feed[:5]
            }
            # Fire and forget task to update Firestore while returning API response
            asyncio.create_task(asyncio.to_thread(save_analysis_snapshot, ticker, snapshot_data))
        except Exception as e:
            print(f"!!! On-Demand Snapshot Error: {e}")

        return sanitize_nan({
            "ticker": ticker,
            "current_price": tech_data['price'],
            "change_pct": tech_data['change_pct'],
            "signal": decision_data['action'],
            "confidence": decision_data['confidence'],
            "sentiment_label": sentiment_data['label'],
            "sentiment_score": sentiment_data['score'],
            "local_sentiment_label": local_sentiment_data['label'],
            "local_sentiment_score": local_sentiment_data['score'],
            "technical_signal": tech_data['signal'],
            "technical_indicators": tech_data['indicators'],
            "formations": tech_data['formations'],
            "reasoning": decision_data['reasoning'],
            "is_confident": decision_data['is_confident'],
            "timestamp": datetime.now().isoformat(),
            "news_feed": news_feed[:10]  # Return top 10 news
        })
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
            
        # Ensure unique index and sorted dates (Fix for lightweight-charts crash)
        data = data[~data.index.duplicated(keep='first')]
        data = data.sort_index()
        
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
    strategy_type: str = "trend"
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
            strategy_type=strategy_type
        )
        results = await engine.run()
        return sanitize_nan(results)
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
    strategy_type: str = "trend"
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
            strategy_type=strategy_type
        )
        return sanitize_nan(report)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/portfolio")
async def get_portfolio_status():
    from .modules.live_discovery import _matrix_cache
    # Use latest prices from cache for ROI and equity
    price_map = {item['ticker']: item['price'] for item in _matrix_cache}
    
    from .database import get_trade_history
    financials = portfolio.get_financial_summary(price_map)
    # Use dummy market sentiment if not calculated
    advice = portfolio.get_daily_advice(0.75) if hasattr(portfolio, 'get_daily_advice') else "Monitor conditions."
    
    return sanitize_nan({
        **financials,
        "advice": advice,
        "positions": portfolio.positions,
        "trade_log": get_trade_history(20), # Last 20 trades from DB
        "equity_curve": [], # Placeholder or from DB if implemented
        "settings": {
            "initial_capital": portfolio.initial_capital,
            "risk_per_trade": getattr(portfolio, 'risk_per_trade', 0.02)
        }
    })

class TradeRequest(BaseModel):
    ticker: str
    price: float
    action: str = "BUY"
    sl_pct: float = 0.05
    tp_pct: float = 0.10
    signal_id: Optional[int] = None # Zero Trust identification

@app.post("/api/live/execute")
async def execute_manual_trade(req: TradeRequest):
    """
    Executes a manual trade from the Discovery Radar.
    Zero Trust: Risk parameters are fetched from the database using signal_id.
    """
    try:
        # Zero Trust Logic: Fetch Kelly from DB
        kelly_to_use = 0.02 # Safe fallback
        if req.signal_id:
            db_signal = get_signal_by_id(req.signal_id)
            if db_signal:
                kelly_to_use = db_signal.kelly_fraction
                print(f"ZERO TRUST: Verified Kelly Fraction {kelly_to_use} from Signal DB (ID: {req.signal_id})")
        
        # Calculate SL/TP prices
        sl_price = req.price * (1 - req.sl_pct) if req.action == "BUY" else req.price * (1 + req.sl_pct)
        tp_price = req.price * (1 + req.tp_pct) if req.action == "BUY" else req.price * (1 - req.tp_pct)
        
        success = await portfolio.open_position(
            ticker=req.ticker,
            entry_price=req.price,
            entry_time=datetime.now().isoformat(),
            sl=sl_price,
            tp=tp_price,
            sl_pct=req.sl_pct,
            kelly_fraction=kelly_to_use
        )
        
        if success:
            return {"status": "success", "message": f"Trade executed for {req.ticker}", "kelly_used": kelly_to_use}
        return {"status": "error", "message": "Failed to open position (insufficient funds or risk cap)"}
    except Exception as e:
        print(f"Execution Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class PortfolioSettings(BaseModel):
    initial_capital: float
    risk_per_trade: float

@app.post("/api/portfolio/settings")
async def update_portfolio_settings_endpoint(settings: PortfolioSettings):
    """
    Updates global portfolio parameters and persists to DB.
    """
    from .database import update_portfolio_settings as db_update
    db_update(
        initial_capital=settings.initial_capital,
        risk_per_trade=settings.risk_per_trade
    )
    portfolio.refresh_state()
    return {"status": "success", "settings": settings}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
