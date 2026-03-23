import httpx
import os
from typing import Dict, List, Optional
from dotenv import load_dotenv

load_dotenv()

ALPACA_API_KEY = os.getenv("ALPACA_API_KEY")
ALPACA_SECRET_KEY = os.getenv("ALPACA_SECRET_KEY")
# Data API has different base URL than trading API
# For paper/live, data URL is often the same: https://data.alpaca.markets/v2
ALPACA_DATA_URL = "https://data.alpaca.markets/v2"

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

if __name__ == "__main__":
    # Quick test
    import asyncio
    async def main():
        p = await get_latest_prices(["AAPL", "TSLA", "NVDA"])
        print(f"Test Prices: {p}")
    
    asyncio.run(main())
