import httpx
import os
import asyncio
from dotenv import load_dotenv

load_dotenv()

ALPACA_API_KEY = os.getenv("ALPACA_API_KEY")
ALPACA_SECRET_KEY = os.getenv("ALPACA_SECRET_KEY")
ALPACA_DATA_URL = "https://data.alpaca.markets/v2"

async def test_alpaca():
    print(f"Testing Alpaca with Key: {ALPACA_API_KEY[:5]}...")
    url = f"{ALPACA_DATA_URL}/stocks/snapshots?symbols=AAPL,TSLA&feed=iex"
    headers = {
        "APCA-API-KEY-ID": ALPACA_API_KEY,
        "APCA-API-SECRET-KEY": ALPACA_SECRET_KEY
    }
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=headers)
        print(f"Status: {resp.status_code}")
        print(f"Full JSON: {resp.json()}")

if __name__ == "__main__":
    asyncio.run(test_alpaca())
