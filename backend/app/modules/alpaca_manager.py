import httpx
import os
from typing import Dict, List, Optional
from dotenv import load_dotenv

load_dotenv()

ALPACA_API_KEY = os.getenv("ALPACA_API_KEY")
ALPACA_SECRET_KEY = os.getenv("ALPACA_SECRET_KEY")
# Data API has different base URL than trading API
# For paper trading: https://paper-api.alpaca.markets
ALPACA_DATA_URL = "https://data.alpaca.markets/v2"
ALPACA_BASE_URL = "https://paper-api.alpaca.markets/v2"

async def get_latest_prices(tickers: List[str]) -> Dict[str, float]:
    """
    Fetches latest trade prices for a list of tickers from Alpaca Market Data v2.
    """
    if not ALPACA_API_KEY or not ALPACA_SECRET_KEY:
        print("!!! Alpaca Keys missing in .env")
        return {}

    if not tickers:
        return {}

    symbols_str = ",".join(tickers)
    # Added feed=iex for free tier accounts
    url = f"{ALPACA_DATA_URL}/stocks/snapshots?symbols={symbols_str}&feed=iex"
    
    headers = {
        "APCA-API-KEY-ID": ALPACA_API_KEY,
        "APCA-API-SECRET-KEY": ALPACA_SECRET_KEY
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, headers=headers)
            
            if response.status_code != 200:
                print(f"!!! Alpaca Data API Error: {response.status_code} - {response.text}")
                return {}
            
            data = response.json()
            # Snapshots for free tier often return direct symbol keys: { "AAPL": { "latestTrade": { "p": 150.0 }, ... }, ... }
            # Or sometimes nested in "snapshots" depending on the version/plan.
            
            # Handle both formats
            snapshots = data.get("snapshots", data)
            
            prices = {}
            for ticker, snapshot in snapshots.items():
                if not isinstance(snapshot, dict): continue
                latest_trade = snapshot.get("latestTrade")
                if latest_trade:
                    prices[ticker] = float(latest_trade.get("p", 0.0))
            
            return prices

    except Exception as e:
        print(f"!!! Alpaca Fetch Error: {e}")
        return {}

async def submit_order(symbol: str, qty: int, side: str = "buy", type: str = "market", time_in_force: str = "day") -> bool:
    """
    Submits an order to Alpaca. Returns True if order is accepted.
    """
    if not ALPACA_API_KEY or not ALPACA_SECRET_KEY:
        return False
        
    url = f"{ALPACA_BASE_URL}/orders"
    headers = {
        "APCA-API-KEY-ID": ALPACA_API_KEY,
        "APCA-API-SECRET-KEY": ALPACA_SECRET_KEY
    }
    payload = {
        "symbol": symbol,
        "qty": str(qty),
        "side": side,
        "type": type,
        "time_in_force": time_in_force
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers)
            if response.status_code in [200, 201]:
                print(f"ORDER SUCCESS: {side} {qty} {symbol}")
                return True
            else:
                print(f"ORDER FAILED: {response.text}")
                return False
    except Exception as e:
        print(f"!!! Alpaca Order Error: {e}")
        return False

async def close_position_on_broker(symbol: str) -> bool:
    """
    Liquidates a position on Alpaca (Broker First Requirement).
    """
    if not ALPACA_API_KEY or not ALPACA_SECRET_KEY:
        return False
        
    url = f"{ALPACA_BASE_URL}/positions/{symbol}"
    headers = {
        "APCA-API-KEY-ID": ALPACA_API_KEY,
        "APCA-API-SECRET-KEY": ALPACA_SECRET_KEY
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.delete(url, headers=headers)
            if response.status_code in [200, 202]: # 200 OK or 202 Accepted
                print(f"CLOSE SUCCESS: {symbol}")
                return True
            else:
                print(f"CLOSE FAILED (maybe already closed?): {response.text}")
                # If 404, it means position doesn't exist on broker - we might want to return True to sync DB
                return response.status_code == 404 
    except Exception as e:
        print(f"!!! Alpaca Close Error: {e}")
        return False

if __name__ == "__main__":
    # Quick test
    import asyncio
    async def main():
        p = await get_latest_prices(["AAPL", "TSLA", "NVDA"])
        print(f"Test Prices: {p}")
    
    asyncio.run(main())
