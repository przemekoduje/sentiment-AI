import yfinance as yf
import json
import os
import asyncio
from typing import Dict
from .ticker_provider import TickerProvider

CACHE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "market_caps.json")

class MarketCapProvider:
    """Fetches and caches market capitalization for S&P 500 companies."""
    
    _cache: Dict[str, float] = {}
    _last_refresh = None

    @classmethod
    def get_market_cap(cls, ticker: str) -> float:
        """Returns market cap from cache, or fetches on-demand if missing."""
        if not cls._cache:
            cls.load_cache()
            
        cap = cls._cache.get(ticker)
        if cap is not None:
            return cap
            
        # On-demand fetch for missing symbols (like COIN/PLTR if not in S&P 500)
        try:
            print(f">>> MarketCapProvider: On-demand fetch for {ticker}...")
            info = yf.Ticker(ticker).fast_info
            cap = info.get('marketCap')
            if cap:
                cls._cache[ticker] = float(cap)
                return float(cap)
        except Exception as e:
            print(f"!!! MarketCapProvider: Error fetching {ticker} on-demand: {e}")
            
        return 1000000000.0 # Default fallback (1B)

    @classmethod
    def load_cache(cls):
        """Loads market caps from local JSON file."""
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, 'r') as f:
                    cls._cache = json.load(f)
                print(f">>> MarketCapProvider: Loaded {len(cls._cache)} entries from cache.")
            except Exception as e:
                print(f"!!! Error loading market cap cache: {e}")

    @classmethod
    def save_cache(cls):
        """Saves current cache to local JSON file."""
        try:
            with open(CACHE_FILE, 'w') as f:
                json.dump(cls._cache, f)
        except Exception as e:
            print(f"!!! Error saving market cap cache: {e}")

    @classmethod
    async def refresh_caps(cls):
        """Fetches fresh market caps for all S&P 500 tickers in chunks."""
        print(">>> MarketCapProvider: Refreshing S&P 500 Market Caps...")
        tickers = TickerProvider.get_sp500_tickers()
        
        # Process in chunks of 50 to avoid hitting rate limits or URL length limits
        chunk_size = 50
        for i in range(0, len(tickers), chunk_size):
            chunk = tickers[i:i + chunk_size]
            try:
                # yf.Tickers is faster for batch metadata
                batch = yf.Tickers(" ".join(chunk))
                for t in chunk:
                    try:
                        cap = batch.tickers[t].fast_info.get('marketCap')
                        if cap:
                            cls._cache[t] = float(cap)
                    except Exception:
                        continue
                print(f">>> MarketCapProvider: Progress {i+len(chunk)}/{len(tickers)}")
                # Small sleep to be polite
                await asyncio.sleep(0.5)
            except Exception as e:
                print(f"!!! Batch error for chunk {chunk[0]}...: {e}")
        
        cls.save_cache()
        print(f">>> MarketCapProvider: Refresh complete. {len(cls._cache)} tickers updated.")

# Singleton-like access
market_cap_provider = MarketCapProvider()
