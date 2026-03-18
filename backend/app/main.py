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
from .modules.ticker_provider import TickerProvider
from .modules.decision_matrix import get_trading_signal
from .modules.roi_calculator import calculate_potential_roi
from .modules.technical_analysis import get_technical_indicator
from .modules.sentiment_bridge import fetch_news_sentiment, aggregate_sentiment_score, aggregate_local_sentiment
from .modules.backtester import BacktestEngine
from .modules.bulk_backtester import BulkBacktester
from .modules.portfolio_manager import PortfolioManager
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
AUTO_PILOT_ENABLED = False # Master switch for automated execution

# --- Background Market Monitor (Production Scaling) ---
async def market_monitor_loop():
    """Pętla tła: Skanuje rynek cyklicznie i zarządza pozycjami (Auto-Pilot)."""
    print(">>> Starting Background Market Monitor...")
    while True:
        try:
            # 1. Skanujemy rynek (Phase 5)
            await discovery_engine.refresh_cache(limit=100)
            
            # 2. Monitorowanie otwartych pozycji (Automatyczne Wyjście)
            if portfolio.positions:
                current_time = datetime.now().isoformat()
                position_tickers = list(portfolio.positions.keys())
                try:
                    # Pobieramy ceny dla otwartych pozycji
                    data = await asyncio.to_thread(safe_download, position_tickers, period="1d", interval="1m", progress=False)
                    if not data.empty:
                        for ticker in position_tickers:
                            pos = portfolio.positions[ticker]
                            # Handle single-ticker vs multi-ticker results from yfinance
                            if len(position_tickers) > 1:
                                current_price = data['Close'][ticker].iloc[-1]
                            else:
                                current_price = data['Close'].iloc[-1]
                            
                            if current_price <= pos['sl']:
                                portfolio.close_position(ticker, current_price, current_time, "STOP_LOSS (AUTO)")
                                print(f"AUTO_PILOT: Closed {ticker} at ${current_price} due to STOP_LOSS")
                            elif current_price >= pos['tp']:
                                portfolio.close_position(ticker, current_price, current_time, "TAKE_PROFIT (AUTO)")
                                print(f"AUTO_PILOT: Closed {ticker} at ${current_price} due to TAKE_PROFIT")
                except Exception as e:
                    print(f"Auto-Pilot Monitor Error (Exit Check): {e}")

            # 3. Automatyczne otwarcie (Auto-Pilot Entry)
            if AUTO_PILOT_ENABLED:
                signals = discovery_engine.get_cached_signals()
                current_time = datetime.now().isoformat()
                for signal in signals:
                    ticker = signal['symbol']
                    if signal['action'] == "BUY" and ticker not in portfolio.positions:
                        entry_price = signal['price']
                        sl = entry_price * 0.95
                        tp = entry_price * 1.10
                        success = portfolio.open_position(
                            ticker=ticker, entry_price=entry_price, entry_time=current_time,
                            sl=sl, tp=tp, sl_pct=0.05
                        )
                        if success:
                            print(f"AUTO_PILOT: Executed BUY for {ticker} at ${entry_price}")

            await asyncio.sleep(120) # Szybsze pętlowanie w trybie Auto
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
    return {"enabled": AUTO_PILOT_ENABLED}

@app.post("/api/autopilot")
async def toggle_autopilot(enabled: bool = Query(...)):
    global AUTO_PILOT_ENABLED
    AUTO_PILOT_ENABLED = enabled
    state = "ENABLED" if enabled else "DISABLED"
    print(f">>> AUTO-PILOT {state}")
    return {"status": "updated", "enabled": AUTO_PILOT_ENABLED}

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
        "win_rate": sanitize_nan(win_rate, 0.0),
        "net_pnl": sanitize_nan(net_pnl, 0.0),
        "active_positions_count": len(portfolio.positions),
        "trade_log": sanitize_nan(portfolio.trade_log[-10:]) # Ostatnie 10 transakcji
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
    Uses background cache if available for faster response.
    """
    try:
        # Check cache first
        cached_matrix = discovery_engine.get_matrix_data()
        ticker_cache = next((item for item in cached_matrix if item['ticker'] == ticker), None)
        
        # If not in cache, try to generate a minimal valid response for any ticker
        if not ticker_cache:
            # Check if it's a valid ticker format (at least 1 char)
            if not ticker or len(ticker) < 1:
                raise HTTPException(status_code=400, detail="Invalid ticker")
            
            # Return a default response instead of trying to fetch real data that might fail
            return {
                "ticker": ticker,
                "current_price": 100.0,
                "change_pct": 0.0,
                "signal": "NEUTRAL",
                "confidence": 0.5,
                "sentiment_label": "neutral",
                "sentiment_score": 0.0,
                "technical_signal": "NEUTRAL",
                "reasoning": "Ticker not found in active market cache. Showing default data.",
                "is_confident": False,
                "timestamp": datetime.now().isoformat(),
                "news_feed": []
            }

        if ticker_cache:
            # Reconstruct response from cache
            return {
                "ticker": ticker,
                "current_price": sanitize_nan(ticker_cache['price']),
                "change_pct": sanitize_nan(ticker_cache.get('change_pct', 0)),
                "signal": "BULLISH" if ticker_cache['sma5'] > ticker_cache['sma20'] else "NEUTRAL",
                "confidence": sanitize_nan(ticker_cache['potential'] / 100),
                "sentiment_label": ticker_cache['sentiment_label'],
                "sentiment_score": ticker_cache.get('sentiment_score', 0),
                "local_sentiment_label": ticker_cache.get('local_sentiment_label', "---"),
                "local_sentiment_score": ticker_cache.get('local_sentiment_score', 0),
                "technical_signal": "BULLISH" if ticker_cache['sma5'] > ticker_cache['sma20'] else "NEUTRAL",
                "technical_indicators": {
                    "sma5": sanitize_nan(ticker_cache['sma5']),
                    "sma20": sanitize_nan(ticker_cache['sma20']),
                    "rsi": sanitize_nan(ticker_cache['rsi'], fallback=50.0)
                },
                "formations": [],
                "reasoning": "Data retrieved from background market scan cache.",
                "is_confident": ticker_cache['potential'] > 60,
                "timestamp": datetime.now().isoformat(),
                "news_feed": (await fetch_news_sentiment(ticker))[:10]
            }

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
    
    financials = portfolio.get_financial_summary(price_map)
    # Use dummy market sentiment if not calculated
    advice = portfolio.get_daily_advice(0.75) 
    
    return sanitize_nan({
        **financials,
        "advice": advice,
        "positions": portfolio.positions,
        "trade_log": portfolio.trade_log[-20:], # Last 20 trades
        "equity_curve": portfolio.equity_curve[-30:], # Last 30 points
        "settings": {
            "initial_capital": portfolio.initial_capital,
            "risk_per_trade": portfolio.risk_per_trade
        }
    })

class TradeRequest(BaseModel):
    symbol: str
    price: float
    action: str = "BUY"
    sl_pct: float = 0.05
    tp_pct: float = 0.10

@app.post("/api/live/execute")
async def execute_manual_trade(req: TradeRequest):
    """
    Executes a manual trade from the Discovery Radar.
    """
    try:
        # Calculate SL/TP prices
        sl_price = req.price * (1 - req.sl_pct) if req.action == "BUY" else req.price * (1 + req.sl_pct)
        tp_price = req.price * (1 + req.tp_pct) if req.action == "BUY" else req.price * (1 - req.tp_pct)
        
        success = portfolio.open_position(
            ticker=req.symbol,
            entry_price=req.price,
            entry_time=datetime.now().isoformat(),
            sl=sl_price,
            tp=tp_price,
            sl_pct=req.sl_pct
        )
        
        if success:
            return {"status": "success", "message": f"Position opened for {req.symbol}"}
        else:
            return {"status": "error", "message": "Insufficient capital or invalid parameters"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class PortfolioSettings(BaseModel):
    initial_capital: float
    risk_per_trade: float

@app.post("/api/portfolio/settings")
async def update_portfolio_settings(settings: PortfolioSettings):
    """
    Updates global portfolio parameters.
    """
    portfolio.initial_capital = settings.initial_capital
    portfolio.risk_per_trade = settings.risk_per_trade
    # Also reset cash if capital changed significantly? 
    # For now just update the params.
    return {"status": "success", "settings": settings}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000) 
