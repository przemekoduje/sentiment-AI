import asyncio
import os
import sys

# Ensure we can import from app
sys.path.append(os.getcwd())

from app.modules.live_discovery import LiveDiscoveryEngine
from app.modules.sentiment_bridge import fetch_news_sentiment

async def test_news():
    print("Testing fetch_news_sentiment for AAPL...")
    news = await fetch_news_sentiment("AAPL")
    print(f"Number of news items: {len(news)}")
    if news:
        print(f"First news title: {news[0].get('title')}")
    else:
        print("No news found.")

async def test_scan():
    print("\nTesting LiveDiscoveryEngine.refresh_cache...")
    engine = LiveDiscoveryEngine()
    await engine.refresh_cache(limit=10)
    matrix = engine.get_matrix_data()
    print(f"Matrix size: {len(matrix)}")
    if matrix:
        for item in matrix[:5]:
            print(f"{item['ticker']}: Price={item['price']}, NewsCount={len(item.get('news_feed', []))}")
    else:
        print("Matrix is empty.")

if __name__ == "__main__":
    asyncio.run(test_news())
    asyncio.run(test_scan())
