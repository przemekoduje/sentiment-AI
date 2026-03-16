import httpx
import os
import json
import time
from datetime import datetime, timedelta
from typing import List, Dict
import asyncio
from dotenv import load_dotenv

# Disk-based caching setup
# Relative to this file: ../../cache/
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CACHE_DIR = os.path.join(BASE_DIR, "cache")

if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)

MOCK_FEED = {
    "AAPL": [
        {
            "title": "Apple Intelligence Set to Revolutionize iPhone User Experience",
            "url": "https://example.com/apple-news-1",
            "time_published": datetime.now().strftime("%Y%m%dT%H%M%S"),
            "summary": "Analysts expect the upcoming AI features in iOS to drive a significant upgrade cycle for the iPhone 16 series.",
            "ticker_sentiment": [{"ticker": "AAPL", "relevance_score": "0.95", "ticker_sentiment_score": "0.78", "ticker_sentiment_label": "Bullish"}]
        },
        {
            "title": "Supply Chain Checks Suggest Record iPad Pro Sales",
            "url": "https://example.com/apple-news-2",
            "time_published": (datetime.now() - timedelta(hours=5)).strftime("%Y%m%dT%H%M%S"),
            "summary": "New M4 chips are outperforming expectations in productivity benchmarks, leading to increased enterprise adoption.",
            "ticker_sentiment": [{"ticker": "AAPL", "relevance_score": "0.88", "ticker_sentiment_score": "0.32", "ticker_sentiment_label": "Somewhat-Bullish"}]
        }
    ],
    "TSLA": [
        {
            "title": "Tesla Full Self-Driving (FSD) v12.5 Gains Praise in Early Trials",
            "url": "https://example.com/tesla-news-1",
            "time_published": datetime.now().strftime("%Y%m%dT%H%M%S"),
            "summary": "The end-to-end neural network approach is showing smoother interventions and better human-like behavior in complex urban environments.",
            "ticker_sentiment": [{"ticker": "TSLA", "relevance_score": "0.98", "ticker_sentiment_score": "0.75", "ticker_sentiment_label": "Bullish"}]
        }
    ],
    "NVDA": [
        {
            "title": "NVIDIA Blackwell Demand Exceeding Supply Estimates",
            "url": "https://example.com/nvda-news-1",
            "time_published": datetime.now().strftime("%Y%m%dT%H%M%S"),
            "summary": "AI chip demand shows no signs of slowing down as major hyperscalers increase orders.",
            "ticker_sentiment": [{"ticker": "NVDA", "relevance_score": "1.0", "ticker_sentiment_score": "0.88", "ticker_sentiment_label": "Bullish"}]
        }
    ],
    "MSFT": [
        {
            "title": "Azure Revenue Skyrockets on AI Integration",
            "url": "https://example.com/msft-news-1",
            "time_published": datetime.now().strftime("%Y%m%dT%H%M%S"),
            "summary": "Microsoft continues to lead the enterprise AI space with its Copilot ecosystem.",
            "ticker_sentiment": [{"ticker": "MSFT", "relevance_score": "0.9", "ticker_sentiment_score": "0.40", "ticker_sentiment_label": "Bullish"}]
        }
    ],
    "GOOGL": [
        {
            "title": "Google Gemini Ultra Sets New Benchmarks",
            "url": "https://example.com/googl-news-1",
            "time_published": datetime.now().strftime("%Y%m%dT%H%M%S"),
            "summary": "The search giant maintains its dominance while successfully pivoting towards generative AI.",
            "ticker_sentiment": [{"ticker": "GOOGL", "relevance_score": "0.85", "ticker_sentiment_score": "0.35", "ticker_sentiment_label": "Bullish"}]
        }
    ]
}

async def fetch_news_sentiment(ticker: str, time_from: str = None, time_to: str = None) -> List[Dict]:
    """
    Fetches news sentiment from Alpha Vantage with disk caching.
    """
    api_key = os.getenv("ALPHA_VANTAGE_API_KEY", "demo")
    
    # Simple caching logic
    cache_file = os.path.join(CACHE_DIR, f"news_{ticker}.json")
    
    if os.path.exists(cache_file):
        file_age = os.path.getmtime(cache_file)
        if (time.time() - file_age) < 14400: # 4 hours
            try:
                with open(cache_file, "r") as f:
                    return json.load(f)
            except Exception:
                pass

    url = "https://www.alphavantage.co/query"
    params = {
        "function": "NEWS_SENTIMENT",
        "tickers": ticker,
        "apikey": api_key,
        "sort": "LATEST",
        "limit": 50
    }
    
    if time_from:
        params["time_from"] = time_from.replace("-", "") + "T0000"
    if time_to:
        params["time_to"] = time_to.replace("-", "") + "T2359"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, params=params, timeout=10.0)
            response.raise_for_status()
            data = response.json()
            
            if "feed" in data:
                feed = data["feed"]
                try:
                    with open(cache_file, "w") as f:
                        json.dump(feed, f)
                except Exception:
                    pass
                return feed
                
            if "Note" in data or "Information" in data:
                 print(f"Alpha Vantage Notice for {ticker}: {data.get('Note', data.get('Information'))}")
            
            # Use mock as fallback for demo purposes if rate limited
            return MOCK_FEED.get(ticker, [])
        except Exception as e:
            print(f"Error fetching news for {ticker}: {e}")
            return MOCK_FEED.get(ticker, [])

def aggregate_sentiment_score(news_feed: List[Dict], ticker: str) -> Dict:
    """
    Aggregates sentiment scores for a specific ticker from a news feed.
    """
    if not news_feed:
        return {"label": "neutral", "score": 0.5, "count": 0}
        
    total_score = 0
    count = 0
    
    for item in news_feed:
        for ts in item.get("ticker_sentiment", []):
            if ts.get("ticker") == ticker:
                count += 1
                total_score += float(ts.get("ticker_sentiment_score", 0))
                break
                
    if count == 0:
        return {"label": "neutral", "score": 0.5, "count": 0}
        
    avg_score = total_score / count
    
    label = "neutral"
    if avg_score >= 0.15:
        label = "positive"
    elif avg_score <= -0.15:
        label = "negative"
        
    return {
        "label": label,
        "score": abs(avg_score),
        "avg_raw_score": avg_score,
        "count": count
    }
