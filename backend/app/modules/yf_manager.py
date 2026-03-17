import threading
import yfinance as yf
import pandas as pd

# Global lock for all yfinance downloads to prevent SQLite cache OperationalErrors
yf_lock = threading.Lock()

def safe_download(*args, **kwargs) -> pd.DataFrame:
    """Thread-safe wrapper around yf.download to prevent concurrent SQLite DB writes."""
    with yf_lock:
        return yf.download(*args, **kwargs)
