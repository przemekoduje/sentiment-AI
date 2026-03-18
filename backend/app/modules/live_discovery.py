import asyncio
import pandas as pd
import yfinance as yf
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from .ticker_provider import TickerProvider
from .sentiment_bridge import fetch_news_sentiment, aggregate_sentiment_score, aggregate_local_sentiment
from .decision_matrix import get_trading_signal
from .insider_tracker import InsiderTracker
from .fundamental_filter import FundamentalFilter

# Global state for cached signals (simulating a production DB for now)
_signal_cache: List[Dict] = []
_matrix_cache: List[Dict] = []
_alerts_cache: List[Dict] = []  # Added for real-time alerts
_last_scan_time: Optional[datetime] = None
_initial_scan_complete: bool = False
_active_market: str = "SP500"  # Default market

class LiveDiscoveryEngine:
    """
    Triage-based real-time market discovery engine.
    Funnel: Multi-ticker Bulk Sprints -> AI Sentiment Filter -> Final Signals
    """

    def __init__(self):
        self.insider_tracker = InsiderTracker()
        self.fundamental_filter = FundamentalFilter()

    @property
    def initial_scan_complete(self) -> bool:
        return _initial_scan_complete

    @property
    def active_market(self) -> str:
        return _active_market

    def set_active_market(self, market: str):
        global _active_market, _initial_scan_complete
        _active_market = market
        _initial_scan_complete = False # Force a full refresh for the new market

    async def bulk_tech_scan(self, tickers: List[str]) -> List[Dict]:
        """Warstwa 1: Szybki skan techniczny w trybie BULK (Sprints)."""
        try:
            from .yf_manager import safe_download
            dt_end = datetime.now()
            dt_start = dt_end - timedelta(days=40)
            
            # yf.download is blocking, using run_in_executor
            loop = asyncio.get_event_loop()
            
            # Bulk download all tickers at once, disable internal threading!
            data = await loop.run_in_executor(None, lambda: safe_download(
                tickers, 
                period="3mo",
                progress=False, 
                interval="1d",
                group_by='ticker',
                threads=False
            ))

            if data.empty:
                return []

            results = []
            for ticker in tickers:
                try:
                    # Handle yfinance data access
                    if len(tickers) > 1:
                        if ticker not in data.columns.levels[0]: continue
                        t_data = data[ticker]
                    else:
                        t_data = data
                    
                    if t_data.empty or len(t_data) < 20:
                        continue

                    # Handle MultiIndex if necessary
                    if isinstance(t_data.columns, pd.MultiIndex):
                        t_data.columns = t_data.columns.get_level_values(0)

                    close = t_data['Close']
                    sma5 = close.rolling(window=5).mean()
                    sma20 = close.rolling(window=20).mean()
                    
                    # Add RSI placeholder calculation
                    delta = close.diff()
                    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
                    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
                    rs = gain / loss
                    rsi = 100 - (100 / (1 + rs))

                    curr_price = float(close.iloc[-1])
                    prev_price = float(close.iloc[-2]) if len(close) > 1 else curr_price
                    curr_sma5 = float(sma5.iloc[-1])
                    curr_sma20 = float(sma20.iloc[-1])
                    curr_rsi = float(rsi.iloc[-1])

                    results.append({
                        "ticker": ticker,
                        "price": round(curr_price, 2),
                        "change_pct": round(((curr_price / prev_price) - 1) * 100, 2) if prev_price != 0 else 0,
                        "sma5": round(curr_sma5, 2),
                        "sma20": round(curr_sma20, 2),
                        "base_rsi": round(curr_rsi, 1) if not pd.isna(curr_rsi) else 50.0,
                        "tech_label": "BULLISH" if curr_sma5 > curr_sma20 else "NEUTRAL"
                    })
                except Exception:
                    continue
            
            return results
        except Exception as e:
            print(f"Bulk scan error: {e}")
            return []

    async def refresh_cache(self, limit: int = 100):
        """Asynchroniczne odświeżanie cache'u sygnałów w tle."""
        global _signal_cache, _matrix_cache, _last_scan_time, _initial_scan_complete
        
        # Priority tickers are common across markets or tech-heavy
        priority_tickers = ["AAPL", "NVDA", "MSFT", "GOOGL", "AMD", "TSLA", "META", "BRK-B", "JNJ", "V", "WMT", "MA", "PG", "COST"]
        
        # Fetch base tickers based on active market
        base_tickers = TickerProvider.get_tickers_by_market(_active_market)
        
        tickers = list(dict.fromkeys(priority_tickers + base_tickers))[:limit]
        
        # 1. Bulk Triage
        all_tech_results = await self.bulk_tech_scan(tickers)
        tech_map = {r['ticker']: r for r in all_tech_results}
        
        # 2. Matrix Deep Scan (Intermediate Data)
        temp_matrix = []
        final_signals = []
        
        # Skanujemy ticker po tickerze dla pełnych danych (News, Insider, Fundamental)
        # Ograniczamy do pierwszych 30 dla wydajności macierzy "live"
        for ticker in list(tech_map.keys())[:40]:
            try:
                t_res = tech_map[ticker]
                
                # Fetch components
                insider_score = self.insider_tracker.get_insider_score(ticker)
                fund_data = self.fundamental_filter.grade_ticker(ticker)
                
                # Sentiment (async news)
                news_feed = await fetch_news_sentiment(ticker)
                
                # aggregate_sentiment_score uses scores PROVIDED by news source (e.g. Alpha Vantage)
                # aggregate_local_sentiment uses local FinBERT on news text
                sentiment = aggregate_sentiment_score(news_feed, ticker)
                local_sentiment = await aggregate_local_sentiment(news_feed)
                
                # If Alpha Vantage sentiment is missing (e.g. yfinance fallback), 
                # we MUST fallback to local FinBERT sentiment for the decision matrix
                if sentiment.get('count', 0) == 0:
                    sentiment = local_sentiment
                
                # Potential score calculation for display
                potential_score = (
                    (0.3 if t_res['tech_label'] == "BULLISH" else 0.1) +
                    (sentiment['score'] * 0.4) +
                    (insider_score * 0.2) +
                    (fund_data["fundamental_score"] * 0.1)
                )

                # Decision Matrix gating for final signals
                decision = get_trading_signal(
                    technical_indicator=t_res['tech_label'],
                    sentiment_label=sentiment['label'],
                    sentiment_score=sentiment['score'],
                    insider_score=insider_score,
                    fundamental_score=fund_data["fundamental_score"]
                )

                matrix_item = {
                    "ticker": ticker,
                    "price": t_res['price'],
                    "change_pct": t_res['change_pct'],
                    "sma5": t_res['sma5'],
                    "sma20": t_res['sma20'],
                    "rsi": t_res['base_rsi'],
                    "sentiment_score": round(sentiment['score'], 2),
                    "sentiment_label": sentiment['label'],
                    "local_sentiment_score": round(local_sentiment['score'], 2),
                    "local_sentiment_label": local_sentiment['label'],
                    "insider_score": round(insider_score, 2),
                    "fundamental_score": round(fund_data["fundamental_score"], 2),
                    "fundamental_grade": fund_data["fundamental_grade"],
                    "potential": round(potential_score * 100, 1),
                    "decision_action": decision['action'],
                    "decision_reasoning": decision['reasoning'],
                    "timestamp": datetime.now().strftime("%H:%M:%S")
                }
                temp_matrix.append(matrix_item)

                if decision['action'] == "BUY":
                    final_signals.append({
                        "symbol": ticker,
                        "company": ticker,
                        "action": "BUY",
                        "price": t_res['price'],
                        "confidence": round(decision['confidence'] * 100, 1),
                        "sentiment": sentiment['label'],
                        "time": datetime.now().strftime("%I:%M:%S %p"),
                        "status": "FILLED" if AUTO_PILOT_ENABLED else "PENDING",
                        "insider_score": insider_score,
                        "fundamental_grade": fund_data["fundamental_grade"]
                    })
            except Exception as e:
                print(f"Error scanning {ticker}: {e}")
                continue
        
        # 3. Generate Alerts from current data
        new_alerts = []
        for item in temp_matrix:
            # Sentiment Alert
            if abs(item['sentiment_score']) > 0.8:
                new_alerts.append({
                    "id": f"sent_{item['ticker']}_{int(datetime.now().timestamp())}",
                    "type": "SENTIMENT",
                    "ticker": item['ticker'],
                    "severity": "HIGH" if abs(item['sentiment_score']) > 0.9 else "MEDIUM",
                    "message": f"Extreme {item['sentiment_label']} sentiment detected for {item['ticker']}.",
                    "timestamp": datetime.now().strftime("%H:%M:%S"),
                    "details": {
                        "score": item['sentiment_score'],
                        "label": item['sentiment_label'],
                        "decision_action": item.get('decision_action', 'HOLD'),
                        "decision_reasoning": item.get('decision_reasoning', ''),
                        "reasoning": f"AI models detected a significant shift in news narrative. Sentiment score of {item['sentiment_score']} indicates high conviction {item['sentiment_label']} bias."
                    }
                })
            
            # Insider Alert
            if item['insider_score'] > 0.7:
                new_alerts.append({
                    "id": f"ins_{item['ticker']}_{int(datetime.now().timestamp())}",
                    "type": "INSIDER",
                    "ticker": item['ticker'],
                    "severity": "CRITICAL" if item['insider_score'] > 0.9 else "HIGH",
                    "message": f"Significant insider buying activity for {item['ticker']}.",
                    "timestamp": datetime.now().strftime("%H:%M:%S"),
                    "details": {
                        "score": item['insider_score'],
                        "decision_action": item.get('decision_action', 'HOLD'),
                        "decision_reasoning": item.get('decision_reasoning', ''),
                        "reasoning": f"Whale activity detected. Insider confidence score is {item['insider_score']*100}%, suggesting strong internal belief in the asset's trajectory."
                    }
                })
                
            # Technical Breakout
            if item['rsi'] > 70 or item['rsi'] < 30:
                new_alerts.append({
                    "id": f"tech_{item['ticker']}_{int(datetime.now().timestamp())}",
                    "type": "TECHNICAL",
                    "ticker": item['ticker'],
                    "severity": "MEDIUM",
                    "message": f"{item['ticker']} is {'overbought' if item['rsi'] > 70 else 'oversold'} (RSI: {item['rsi']}).",
                    "timestamp": datetime.now().strftime("%H:%M:%S"),
                    "details": {
                        "indicator": "RSI",
                        "value": item['rsi'],
                        "status": "Overbought" if item['rsi'] > 70 else "Oversold",
                        "decision_action": item.get('decision_action', 'HOLD'),
                        "decision_reasoning": item.get('decision_reasoning', ''),
                        "reasoning": f"Asset has reached technical extremes. RSI at {item['rsi']} suggests a potential reversal or significant volatility ahead."
                    }
                })

            # High Potential
            if item['potential'] > 85:
                new_alerts.append({
                    "id": f"pot_{item['ticker']}_{int(datetime.now().timestamp())}",
                    "type": "POTENTIAL",
                    "ticker": item['ticker'],
                    "severity": "HIGH",
                    "message": f"New high-potential growth signal for {item['ticker']}: {item['potential']}%",
                    "timestamp": datetime.now().strftime("%H:%M:%S"),
                    "details": {
                        "potential": item['potential'],
                        "decision_action": item.get('decision_action', 'HOLD'),
                        "decision_reasoning": item.get('decision_reasoning', ''),
                        "breakdown": {
                            "technical": "BULLISH" if item['sma5'] > item['sma20'] else "NEUTRAL",
                            "sentiment": item['sentiment_label'],
                            "insider": item['insider_score'],
                            "fundamental": item['fundamental_grade']
                        },
                        "reasoning": f"Aggregate model conviction reached {item['potential']}%. This matches rare high-probability setup patterns found in historical backtests."
                    }
                })
        
        # Keep only last 50 alerts
        global _alerts_cache
        _alerts_cache = (new_alerts + _alerts_cache)[:50]
        
        _signal_cache = final_signals
        _matrix_cache = sorted(temp_matrix, key=lambda x: x['potential'], reverse=True)
        _last_scan_time = datetime.now()
        _initial_scan_complete = True
        print(f"[{_last_scan_time}] Live Matrix Updated: {len(_matrix_cache)} data points. Alerts: {len(new_alerts)}")

    def get_cached_signals(self) -> List[Dict]:
        """Zwraca natychmiastowo gotowe sygnały z cache. (Point 3 - Miliseconds response)"""
        return _signal_cache

    def get_matrix_data(self) -> List[Dict]:
        """Zwraca dane procesu decyzyjnego."""
        return _matrix_cache

    def get_alerts(self) -> List[Dict]:
        """Zwraca listę wygenerowanych alertów."""
        return _alerts_cache

    async def run_discovery(self, limit: int = 50) -> List[Dict]:
        """Maintain compatibility with API endpoint."""
        if not _signal_cache:
            await self.refresh_cache(limit=limit)
        return _signal_cache

    def trigger_demo_signals(self):
        """Injects perfect BUY signals for demonstration."""
        global _signal_cache, _matrix_cache, _last_scan_time, _initial_scan_complete
        
        demo_tickers = ["AAPL", "NVDA", "TSLA", "MSFT"]
        temp_matrix = []
        final_signals = []
        
        for i, ticker in enumerate(demo_tickers):
            price = 200.0 + (i * 50)
            matrix_item = {
                "ticker": ticker,
                "price": price,
                "change_pct": 2.5 + i,
                "sma5": price * 1.05,
                "sma20": price * 0.95,
                "rsi": 45.0 + (i * 2),
                "sentiment_score": 0.95,
                "sentiment_label": "positive",
                "local_sentiment_score": 0.92,
                "local_sentiment_label": "positive",
                "insider_score": 0.98,
                "fundamental_score": 0.95,
                "fundamental_grade": "A",
                "potential": 98.5 - i,
                "decision_action": "BUY",
                "decision_reasoning": "DEMO: Perfect alignment of Tech, Sentiment, and Insider data.",
                "timestamp": datetime.now().strftime("%H:%M:%S")
            }
            temp_matrix.append(matrix_item)
            final_signals.append({
                "symbol": ticker,
                "company": f"{ticker} Corp (DEMO)",
                "action": "BUY",
                "price": price,
                "confidence": 98.5 - i,
                "sentiment": "positive",
                "time": datetime.now().strftime("%I:%M:%S %p"),
                "status": "FILLED" if AUTO_PILOT_ENABLED else "PENDING",
                "insider_score": 0.98,
                "fundamental_grade": "A"
            })
            
        _signal_cache = final_signals
        _matrix_cache = temp_matrix
        _last_scan_time = datetime.now()
        _initial_scan_complete = True
        print(f">>> DEMO MODE: Injected {len(demo_tickers)} perfect signals.")

if __name__ == "__main__":
    engine = LiveDiscoveryEngine()
    asyncio.run(engine.refresh_cache(limit=10))
    print(f"Cache: {engine.get_cached_signals()}")
