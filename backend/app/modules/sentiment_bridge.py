import httpx
import os
import json
import time
from datetime import datetime, timedelta
from typing import List, Dict
import asyncio
from dotenv import load_dotenv
import yfinance as yf
from .sentiment_analyzer import analyze_sentiment, analyze_sentiment_batch

async def aggregate_batch_sentiment(ticker_news_map: Dict[str, List[Dict]]) -> Dict[str, Dict]:
    """
    Warstwa 2: Batchowy agregator sentymentu.
    Przyjmuje mapę {ticker: news_feed} i zwraca {ticker: sentiment_package}.
    """
    if not ticker_news_map: return {}

    # Przygotowanie wsadów dla GPT (headlinery)
    batch_items = []
    for ticker, news in ticker_news_map.items():
        headlines = "\n".join([n.get('title', '') for n in news[:5]])
        if not headlines:
            headlines = f"Neutral market position for {ticker}."
        batch_items.append({"ticker": ticker, "text": headlines})

    # Wywołanie batchowe (dzielimy na grupy po 20 jeśli trzeba, ale analyze_sentiment_batch obsłuży to wewnętrznie lub tu)
    # Dla uproszczenia tutaj wyślemy wszystko na raz do analyze_sentiment_batch, 
    # która powinna obsłużyć limity modeli.
    
    results = []
    # Dzielimy na paczki po 20 dla bezpieczeństwa tokenów/modelu
    for i in range(0, len(batch_items), 20):
        chunk = batch_items[i:i+20]
        results.extend(analyze_sentiment_batch(chunk))

    # Mapowanie wyników na format oczekiwany przez system
    output = {}
    for res in results:
        ticker = res['ticker']
        avg_score = res['score']
        # Rescaling score if needed (GPT returns 0 to 1, system expects absolute distance from 0.5 or raw)
        # Actually systems uses 'score' as absolute and we need a label.
        
        output[ticker] = {
            "label": res['label'],
            "score": avg_score,
            "reasoning": res['reasoning'],
            "count": len(ticker_news_map.get(ticker, [])),
            "confidence": res.get('confidence', 0.5)
        }
    return output

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
    Fetches news sentiment from Alpha Vantage or yfinance with disk caching.
    Falls back to yfinance if Alpha Vantage is unavailable or rate limited.
    """
    api_key = os.getenv("ALPHA_VANTAGE_API_KEY")
    
    # Simple caching logic
    cache_file = os.path.join(CACHE_DIR, f"news_{ticker}.json")
    
    if os.path.exists(cache_file):
        file_age = os.path.getmtime(cache_file)
        # If cache is very fresh (30 min) or reasonably fresh (4h) and not empty
        cache_max_age = 14400 # 4 hours
        try:
            with open(cache_file, "r") as f:
                cached_data = json.load(f)
                if not cached_data: cache_max_age = 1800 # 30 min if empty cache
                
                if (time.time() - file_age) < cache_max_age:
                    return cached_data
        except Exception:
            pass

    # Try Alpha Vantage first IF we have an API key that isn't "demo"
    if api_key and api_key != "demo":
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
                    if feed:
                        try:
                            with open(cache_file, "w") as f:
                                json.dump(feed, f)
                        except Exception: pass
                        return feed
                    
                if "Note" in data or "Information" in data:
                     print(f"Alpha Vantage Notice for {ticker}: {data.get('Note', data.get('Information'))}")
            except Exception as e:
                print(f"Alpha Vantage Error for {ticker}: {e}")

    # Fallback 1: Finnhub
    finnhub_key = os.getenv("FINNHUB_API_KEY")
    if finnhub_key:
        try:
            async with httpx.AsyncClient() as client:
                url = "https://finnhub.io/api/v1/company-news"
                # Last 7 days
                start = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
                end = datetime.now().strftime("%Y-%m-%d")
                res = await client.get(url, params={"symbol": ticker, "token": finnhub_key, "from": start, "to": end}, timeout=10.0)
                if res.status_code == 200:
                    news_items = res.json()
                    if news_items:
                        feed = []
                        for item in news_items[:20]:
                            feed.append({
                                "title": item.get('headline', ''),
                                "url": item.get('url', ''),
                                "time_published": datetime.fromtimestamp(item.get('datetime', time.time())).strftime("%Y%m%dT%H%M%S"),
                                "summary": item.get('summary', ''),
                                "ticker_sentiment": [],
                                "source": "finnhub"
                            })
                        with open(cache_file, "w") as f:
                            json.dump(feed, f)
                        return feed
        except Exception as e:
            print(f"Finnhub Error for {ticker}: {e}")

    # Fallback 2: NewsData.io
    newsdata_key = os.getenv("NEWSDATA_API_KEY")
    if newsdata_key:
        try:
            async with httpx.AsyncClient() as client:
                url = "https://newsdata.io/api/1/news"
                res = await client.get(url, params={"apikey": newsdata_key, "q": ticker, "language": "en"}, timeout=10.0)
                if res.status_code == 200:
                    data = res.json()
                    if data.get('results'):
                        feed = []
                        for item in data['results'][:20]:
                            feed.append({
                                "title": item.get('title', ''),
                                "url": item.get('link', ''),
                                "time_published": datetime.now().strftime("%Y%m%dT%H%M%S"), # Best effort
                                "summary": item.get('description', ''),
                                "ticker_sentiment": [],
                                "source": "newsdata"
                            })
                        with open(cache_file, "w") as f:
                            json.dump(feed, f)
                        return feed
        except Exception as e:
            print(f"NewsData Error for {ticker}: {e}")

    # Fallback 3: yfinance (Free)
    print(f">>> Using yfinance news fallback for {ticker}")
    try:
        yf_ticker = yf.Ticker(ticker)
        # ticker.news is a blocking call, run in thread
        news_items = await asyncio.to_thread(lambda: yf_ticker.news)
        
        if not news_items:
             return MOCK_FEED.get(ticker, [])

        feed = []
        for item in news_items:
            if not item: continue
            # Map yfinance structure (handle both old and nested 'content' versions)
            content = item.get('content', item) if isinstance(item, dict) else {}
            if not content: continue
            
            # Convert timestamp to AV-like string if available
            pub_time = datetime.now().strftime("%Y%m%dT%H%M%S")
            if 'pubDate' in content: # New format
                try:
                    dt = datetime.strptime(content['pubDate'], "%Y-%m-%dT%H:%M:%SZ")
                    pub_time = dt.strftime("%Y%m%dT%H%M%S")
                except: pass
            elif 'providerPublishTime' in item: # Old format
                pub_time = datetime.fromtimestamp(item['providerPublishTime']).strftime("%Y%m%dT%H%M%S")
            
            feed.append({
                "title": content.get('title', 'No Title'),
                "url": content.get('clickThroughUrl', {}).get('url', item.get('link', '') if isinstance(item, dict) else ''),
                "time_published": pub_time,
                "summary": content.get('summary', ''),
                "ticker_sentiment": [],
                "source": "yfinance"
            })
            
        if feed:
            try:
                with open(cache_file, "w") as f:
                    json.dump(feed, f)
            except Exception:
                pass
            return feed
            
    except Exception as e:
        print(f"yfinance news error for {ticker}: {e}")

    # Last fallback: Mock data
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

async def aggregate_local_sentiment(news_feed: List[Dict]) -> Dict:
    """
    Uses local FinBERT to analyze the news feed.
    """
    if not news_feed:
        return {"label": "neutral", "score": 0.5, "count": 0}
        
    total_score = 0
    count = 0
    
    # Process news items (limit to 10 for performance)
    tasks = []
    for item in news_feed[:10]:
        text = f"{item.get('title', '')}. {item.get('summary', '')}"
        if text.strip():
            # Run in thread pool because it's CPU intensive
            tasks.append(asyncio.to_thread(analyze_sentiment, text))
            
    if not tasks:
        return {"label": "neutral", "score": 0.5, "count": 0}
        
    results = await asyncio.gather(*tasks)
    
    for res in results:
        # FinBERT score is the probability of the predicted label
        # We need to convert it to a -1 to 1 range for averaging
        val = res['score']
        if res['label'] == 'negative':
            val = -val
        elif res['label'] == 'neutral':
            val = 0 # Neutral doesn't push the score
            
        total_score += val
        count += 1
        
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
