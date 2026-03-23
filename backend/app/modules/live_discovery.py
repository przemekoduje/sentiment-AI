import asyncio
import yfinance as yf
import pandas as pd
from typing import List, Dict
from datetime import datetime
from .yf_manager import safe_download
from .firebase_helper import update_heatmap_data, flush_heatmap_batch, save_analysis_snapshot
from .ticker_provider import TickerProvider
from .sentiment_analyzer import analyze_sentiment_batch

# Global cache for frontend consumption
_signal_cache = []
_matrix_cache = []
_last_scan_time = None
_initial_scan_complete = False

# Constants
SCANNED_TICKERS_LIMIT = 500
TOP_ACTIVE_LIMIT = 60 # Slightly more for the matrix
BATCH_SIZE = 50 

class LiveDiscoveryEngine:
    def __init__(self):
        global _initial_scan_complete
        self.initial_scan_complete = _initial_scan_complete
        self.active_market = "SP500"
        
    def get_cached_signals(self):
        return _signal_cache

    def get_matrix_data(self):
        return _matrix_cache

    async def get_active_candidates(self, tickers: List[str]) -> List[Dict]:
        """
        Sito Techniczne: Fetches price data for ALL tickers but identifies 'active' ones.
        Returns a list of all tickers with their price info, marked with 'is_active'.
        """
        print(f">>> Sieve: Scanning {len(tickers)} assets in batches of {BATCH_SIZE}...")
        results = []
        
        for i in range(0, len(tickers), BATCH_SIZE):
            batch = tickers[i:i+BATCH_SIZE]
            try:
                loop = asyncio.get_event_loop()
                data = await loop.run_in_executor(None, lambda: safe_download(
                    batch, 
                    period="2d",
                    interval="1h",
                    progress=False,
                    threads=True
                ))
                
                if data.empty: 
                    # Fallback for empty batch data
                    for ticker in batch:
                        results.append({"ticker": ticker, "price": 0, "change_pct": 0, "is_active": False})
                    continue

                for ticker in batch:
                    try:
                        if len(batch) > 1:
                            if ticker not in data.columns.levels[1]: 
                                results.append({"ticker": ticker, "price": 0, "change_pct": 0, "is_active": False})
                                continue
                            t_data = data.xs(ticker, axis=1, level=1)
                        else:
                            t_data = data
                        
                        if len(t_data) < 2: 
                             results.append({"ticker": ticker, "price": 0, "change_pct": 0, "is_active": False})
                             continue
                        
                        curr_close = float(t_data['Close'].iloc[-1])
                        prev_close = float(t_data['Close'].iloc[-2])
                        change_pct = ((curr_close / prev_close) - 1) * 100
                        
                        results.append({
                            "ticker": ticker,
                            "price": curr_close,
                            "change_pct": change_pct,
                            "is_active": abs(change_pct) > 0.3 # Relaxed threshold
                        })
                    except Exception:
                        results.append({"ticker": ticker, "price": 0, "change_pct": 0, "is_active": False})
            except Exception as e:
                print(f"!!! Batch Sieve Error ({i}): {e}")
            
            await asyncio.sleep(0.05)

        return results

    async def refresh_cache(self, limit=SCANNED_TICKERS_LIMIT):
        global _signal_cache, _matrix_cache, _last_scan_time, _initial_scan_complete
        
        print(f"\n>>> REFRESHING MARKET DISCOVERY ({datetime.now().strftime('%H:%M:%S')})")

        base_tickers = TickerProvider.get_tickers_by_market(self.active_market)
        if not base_tickers: return
        all_candidates = base_tickers[:limit]
        
        # 1. Technical Sieve (Full Population)
        scan_results = await self.get_active_candidates(all_candidates)
        
        # 2. Update Heatmap immediately
        print(f">>> Heatmap: Pushing {len(scan_results)} updates...")
        for r in scan_results:
            update_heatmap_data(
                r['ticker'], 
                sentiment_score=0.0, 
                label="neutral", 
                size=100.0,
                change_pct=r['change_pct'],
                price=r['price']
            )
        flush_heatmap_batch()
        
        # 3. Populate Matrix Cache (Baseline)
        # We take all active ones and fill the rest with top volume/cap to reach TOP_ACTIVE_LIMIT
        active_winners = [r for r in scan_results if r['is_active']]
        sorted_results = sorted(scan_results, key=lambda x: abs(x['change_pct']), reverse=True)
        
        # Matrix should always have data
        temp_matrix = []
        final_signals = []
        
        # We focus deep analysis on the most interesting ones
        targets = sorted_results[:TOP_ACTIVE_LIMIT]
        
        print(f">>> Analysis: Processing {len(targets)} focus tickers...")
        for t in targets:
            price = t['price']
            change = t['change_pct']
            
            # Simulated Technical Engine
            sentiment_label = "positive" if change > 0.8 else "negative" if change < -0.8 else "neutral"
            potential = 40 + (abs(change) * 15)
            
            signal_obj = {
                "ticker": t['ticker'],
                "price": price,
                "change_pct": change,
                "sentiment_label": sentiment_label,
                "sentiment_score": 0.5, # Baseline
                "potential": min(potential, 98),
                "sma5": price * 0.99, # Dummy indicators for matrix visibility
                "sma20": price * 0.98,
                "rsi": 50 + (change * 5),
                "insider_score": 0.5,
                "fundamental_score": 0.5,
                "fundamental_grade": "B",
                "decision_action": "NEUTRAL",
                "decision_reasoning": "Baseline market scan | Scanned at " + datetime.now().strftime('%H:%M'),
                "timestamp": datetime.now().strftime('%H:%M:%S')
            }
            temp_matrix.append(signal_obj)
            
            # Discovery Signals (The "BUY" radar)
            if change > 1.2:
                final_signals.append({
                    "symbol": t['ticker'],
                    "action": "BUY",
                    "price": price,
                    "confidence": 75 + abs(change),
                    "sentiment": "positive"
                })

        # Atomic update of global cache
        _signal_cache = final_signals
        _matrix_cache = temp_matrix
        _last_scan_time = datetime.now()
        _initial_scan_complete = True
        self.initial_scan_complete = True
        
        print(f">>> Scan Complete: Matrix Size={len(temp_matrix)}, Signals={len(final_signals)}")

    def update_matrix_prices(self, price_updates: Dict[str, float]):
        """Real-time price injector from price_sync_loop."""
        global _matrix_cache
        for item in _matrix_cache:
            ticker = item['ticker']
            if ticker in price_updates:
                item['price'] = price_updates[ticker]

if __name__ == "__main__":
    engine = LiveDiscoveryEngine()
    asyncio.run(engine.refresh_cache(limit=50))
