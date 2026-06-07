import os
import json
import pandas as pd
from datetime import datetime, timedelta
from ..yf_manager import safe_download

CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "cache")

class VSADataRouter:
    @staticmethod
    async def get_ohlcv(ticker: str, interval: str = "1d", lookback_periods: int = 250) -> pd.DataFrame:
        """
        Fetches OHLCV data from local cache or yfinance.
        Ensures at least lookback_periods are available.
        """
        cache_file = os.path.join(CACHE_DIR, f"ohlcv_{ticker}_{interval}.json")
        
        # Check cache validity (4 hours for 1d, 1 hour for 1h)
        cache_duration = timedelta(hours=4) if interval == "1d" else timedelta(hours=1)
        
        if os.path.exists(cache_file):
            file_mtime = datetime.fromtimestamp(os.path.getmtime(cache_file))
            if datetime.now() - file_mtime < cache_duration:
                try:
                    df = pd.read_json(cache_file)
                    if len(df) >= lookback_periods:
                        # Ensure index is datetime
                        df.index = pd.to_datetime(df.index)
                        # Ensure canonical column names (Uppercase)
                        column_map = {col.capitalize(): col for col in df.columns if col.lower() in ['open', 'high', 'low', 'close', 'volume']}
                        df = df.rename(columns={v: k for k, v in column_map.items()})
                        return df
                except Exception as e:
                    print(f"VSA DataRouter: Cache read error for {ticker}: {e}")

        # Fallback to download
        print(f"VSA DataRouter: Fetching fresh data for {ticker} ({interval})...")
        period = "2y" if interval == "1d" else "1mo"
        
        df = safe_download(ticker, period=period, interval=interval, progress=False)
        
        if df.empty:
            return pd.DataFrame()

        # MultiIndex cleanup
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        
        # Save to cache
        try:
            os.makedirs(CACHE_DIR, exist_ok=True)
            df.to_json(cache_file)
        except Exception as e:
            print(f"VSA DataRouter: Cache write error for {ticker}: {e}")
            
        # Ensure canonical column names (Uppercase)
        column_map = {col.capitalize(): col for col in df.columns if col.lower() in ['open', 'high', 'low', 'close', 'volume']}
        # If they are already capitalized, capitalize() won't change them, but if they are lowercase 'close', it will map Close:close
        df = df.rename(columns={v: k for k, v in column_map.items()})
        
        return df
