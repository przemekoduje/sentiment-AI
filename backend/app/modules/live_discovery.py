import asyncio
import yfinance as yf
import pandas as pd
from typing import List, Dict, Optional
from datetime import datetime
from .yf_manager import safe_download
from .firebase_helper import update_heatmap_data, flush_heatmap_single_object, save_analysis_snapshot, dirty_tickers
from .ticker_provider import TickerProvider
from .sentiment_analyzer import analyze_sentiment_batch
from .market_cap_provider import MarketCapProvider
from .technical_analysis import get_technical_indicator
from .decision_matrix import get_trading_signal
from ..database import TradeSignal, save_signal

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
        self.last_db_update = datetime.now()
        self.CRITICAL_TICKERS = ["AAPL", "NVDA", "TSLA", "MSFT"]
        
    def get_cached_signals(self):
        return _signal_cache

    def get_matrix_data(self):
        return _matrix_cache
        
    def get_alerts(self):
        """Returns recent system alerts based on signals."""
        return [
            {
                "id": i,
                "ticker": s.get('ticker') or s.get('symbol'),
                "type": "SIGNAL_GENERATED",
                "message": f"AI Engine detected {s['action']} signal for {s.get('ticker') or s.get('symbol')}",
                "timestamp": datetime.now().strftime('%H:%M:%S'),
                "priority": "HIGH" if s['confidence'] > 85 else "MEDIUM"
            } for i, s in enumerate(_signal_cache[:10])
        ]

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
                            "is_active": abs(change_pct) > 0.1 # Relaxed threshold further
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
        
        # 0. Fast-Track for CRITICAL_TICKERS (Immediate UI feedback)
        print(f">>> Fast-Track: Testing {len(self.CRITICAL_TICKERS)} targets...")
        try:
            critical_results = await self.get_active_candidates(self.CRITICAL_TICKERS)
            
            # Populate partial cache immediately to make UI look live
            if critical_results:
                initial_matrix = []
                for t in critical_results:
                    print(f">>> Fast-Track: Analyzing {t['ticker']}...")
                    try:
                        tech_data, _ = get_technical_indicator(t['ticker'])
                        initial_matrix.append({
                            "ticker": t['ticker'], "price": t['price'], "change_pct": t['change_pct'],
                            "sentiment_label": "positive" if t['change_pct'] > 0 else "negative",
                            "sentiment_score": 0.5, "potential": 50,
                            "sma5": tech_data['indicators'].get('sma5', 0), 
                            "sma20": tech_data['indicators'].get('sma20', 0),
                            "rsi": tech_data['indicators'].get('rsi', 50), 
                            "decision_action": "NEUTRAL",
                            "decision_reasoning": "Fast-Track partial update (Full scan pending...)",
                            "timestamp": datetime.now().strftime('%H:%M:%S')
                        })
                    except Exception as e:
                        print(f"!!! Fast-Track Analyst Error for {t['ticker']}: {e}")
                
                _matrix_cache.clear()
                _matrix_cache.extend(initial_matrix)
                
                # Also sync signals cache with proper LiveSignal format
                fast_signals = [
                    {
                        "ticker": t['ticker'],
                        "company": f"{t['ticker']} (Fast-Track)",
                        "action": "BUY" if t['change_pct'] > 0 else "SELL",
                        "size": 1.0,
                        "price": t['price'],
                        "confidence": 70, # Baseline for fast track
                        "time": datetime.now().strftime('%H:%M'),
                        "status": "PENDING",
                        "fundamental_grade": "B"
                    } for t in critical_results
                ]
                _signal_cache.clear()
                _signal_cache.extend(fast_signals)
                
                _initial_scan_complete = True # Unlock API for frontend
                self.initial_scan_complete = True
                print(f">>> Fast-Track: Initial cache (Matrix & Signals) populated with {len(initial_matrix)} tickers.")
        except Exception as e:
            print(f"!!! Fast-Track Overall Failure: {e}")

        # 1. Technical Sieve (Full Population)
        scan_results = await self.get_active_candidates(all_candidates)
        
        # Merge results, prioritizing real data over fallbacks
        final_results_map = {r['ticker']: r for r in scan_results}
        for r in critical_results:
            final_results_map[r['ticker']] = r
        scan_results = list(final_results_map.values())
        
        # 2. Update Heatmap Cache
        print(f">>> Heatmap: Pushing {len(scan_results)} updates to cache...")
        sector_map = TickerProvider.get_sp500_with_sectors()
        
        for r in scan_results:
            ticker = r['ticker']
            sector = sector_map.get(ticker, "Other")
            mkt_cap = MarketCapProvider.get_market_cap(ticker)
            
            update_heatmap_data(
                ticker, 
                sentiment_score=0.0, 
                label="neutral", 
                size=mkt_cap,
                change_pct=r['change_pct'],
                price=r['price'],
                sector=sector
            )
        
        # 2b. Smart Flush Logic: 5 minutes OR critical change
        time_elapsed = (datetime.now() - self.last_db_update).total_seconds()
        has_critical_change = any(t in dirty_tickers for t in self.CRITICAL_TICKERS)
        
        if time_elapsed > 300 or has_critical_change:
            reason = "Time Threshold (5m)" if time_elapsed > 300 else f"Critical Change ({[t for t in self.CRITICAL_TICKERS if t in dirty_tickers]})"
            print(f">>> Smart Flush Triggered: {reason}")
            flush_heatmap_single_object()
            self.last_db_update = datetime.now()
        else:
            print(f">>> Smart Flush: Postponed ({int(300 - time_elapsed)}s remaining). Dirty: {len(dirty_tickers)}")
        
        # 3. Populate Matrix Cache (Baseline)
        # We take all active ones and fill the rest with top volume/cap to reach TOP_ACTIVE_LIMIT
        active_winners = [r for r in scan_results if r['is_active']]
        sorted_results = sorted(scan_results, key=lambda x: abs(x['change_pct']), reverse=True)
        
        # Matrix should always have data
        temp_matrix = []
        final_signals = []
        
        # We focus deep analysis on the most interesting ones
        targets = sorted_results[:TOP_ACTIVE_LIMIT]
        
        candidates = sorted_results[:TOP_ACTIVE_LIMIT]
        
        # 2. Głęboka Analiza (Focus) - Przetwarzanie wybranych tickerów przez Hybrydową Macierzy
        print(f">>> Analysis: Processing {len(candidates)} focus tickers through Decision Matrix...")
        
        for t in candidates:
            ticker = t['ticker']
            price = t['price']
            change = t['change_pct'] # Changed from t['change'] to t['change_pct']
            
            # Pobieramy pełne dane techniczne dla rzetelnej oceny (SMA/RSI)
            tech_data, _ = get_technical_indicator(ticker)
            
            # Integrujemy z modelem sentymentu (asynchronicznie)
            # Uwaga: w pętli skanującej używamy uproszczonego sentymentu opartego o change dla szybkości, 
            # ale z pełną bramką logiczną Hybrid Matrix.
            sentiment_score = 0.5 + (change / 100) # Dynamic base
            sentiment_label = "positive" if change > 0 else "negative"
            
            # Wywołujemy silnik decyzyjny (Hybrid Decision Matrix)
            decision = get_trading_signal(
                technical_indicator=tech_data['signal'],
                sentiment_label=sentiment_label,
                sentiment_score=sentiment_score,
                fundamental_score=0.6 # Moderate boost
            )
            
            signal_obj = {
                "ticker": ticker,
                "price": price,
                "change_pct": change,
                "sentiment_label": sentiment_label,
                "sentiment_score": sentiment_score,
                "potential": int(decision['confidence'] * 100),
                "sma5": tech_data['indicators']['sma5'], 
                "sma20": tech_data['indicators']['sma20'],
                "rsi": tech_data['indicators']['rsi'],
                "insider_score": 0.5,
                "fundamental_score": 0.6,
                "fundamental_grade": "B",
                "decision_action": decision['action'],
                "decision_reasoning": decision['reasoning'],
                "timestamp": datetime.now().strftime('%H:%M:%S'),
                "kelly_fraction": round(decision['confidence'] * 0.1, 4) # Reduced Kelly for safety
            }
            temp_matrix.append(signal_obj)
            
            # Discovery Signals (The "BUY/SELL" radar)
            if decision['action'] in ["BUY", "SELL"]:
                try:
                    db_signal = TradeSignal(
                        ticker=ticker,
                        action=decision['action'],
                        price=price,
                        kelly_fraction=round(decision['confidence'] * 0.1, 4),
                        sentiment_score=sentiment_score,
                        reasoning=decision['reasoning']
                    )
                    sig_id = save_signal(db_signal)
                    
                    final_signals.append({
                        "ticker": ticker,
                        "company": f"{ticker} Market Entry",
                        "action": decision['action'],
                        "size": 1.0,
                        "price": price,
                        "confidence": int(decision['confidence'] * 100),
                        "time": datetime.now().strftime('%H:%M'),
                        "status": "PENDING",
                        "fundamental_grade": "B",
                        "signal_id": sig_id
                    })
                except Exception as e:
                    print(f"!!! Error persisting signal for {ticker}: {e}")

        # Atomic update of global cache using clear/extend to maintain references
        _signal_cache.clear()
        _signal_cache.extend(final_signals)
        _matrix_cache.clear()
        _matrix_cache.extend(temp_matrix)
        
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
