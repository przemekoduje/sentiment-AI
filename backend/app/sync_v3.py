import asyncio
import os
from datetime import datetime
from app.modules.sentiment_bridge import fetch_news_sentiment
from app.modules.sentiment_analyzer import analyze_sentiment
from app.modules.firebase_helper import save_analysis_snapshot, update_heatmap_data, update_system_performance
from app.modules.technical_analysis import get_technical_indicator
from app.modules.yf_manager import safe_download
import pandas as pd
import random

async def analyze_ticker(ticker: str):
    """Performs full analysis for a single ticker and syncs to Firestore."""
    print(f"--- ANALYZING {ticker} ---")
    
    try:
        # 1. Fetch News
        news = await fetch_news_sentiment(ticker)
        
        # 2. GPT-4o-mini Analysis
        # Aggregating headlines into one prompt for cost efficiency
        headlines = "\n".join([item.get('title', '') for item in news[:5]])
        if not headlines:
            headlines = f"No recent news for {ticker}. Analyze overall market position."
            
        gpt_result = analyze_sentiment(headlines)
        
        # 3. Get Price Data
        data = await asyncio.to_thread(safe_download, [ticker], period="5d", interval="1d")
        current_price = 0.0
        if not data.empty:
            # Handle multi-index (common in newer yfinance versions even for single ticker)
            if isinstance(data['Close'], (pd.Series, pd.DataFrame)):
                val = data['Close'].iloc[-1]
                if isinstance(val, (pd.Series, pd.DataFrame)):
                    current_price = float(val.iloc[0])
                else:
                    current_price = float(val)

        # 4. Technical Signal
        tech_data, _ = get_technical_indicator(ticker)
        
        # 5. Logic for Signal
        # Simple heuristic for this v3 worker
        sentiment_score = gpt_result.get('score', 0.5)
        label = gpt_result.get('label', 'neutral')
        
        signal = "NEUTRAL"
        if label == "positive" and sentiment_score > 0.6:
            signal = "BUY"
        elif label == "negative" and sentiment_score > 0.6:
            signal = "SELL"

        # 6. Kelly Calculation (Mocked for now or reuse existing logic)
        prob_win = 0.5 + (sentiment_score - 0.5) if label == "positive" else 0.5 - (0.5 - sentiment_score)
        kelly = max(0, (prob_win * 2 - 1) / 2) # Half-Kelly

        # 7. Compile Snapshot
        snapshot = {
            "ticker": ticker,
            "current_price": current_price,
            "sentiment_score": sentiment_score,
            "sentiment_label": label,
            "reasoning": gpt_result.get('reasoning', "Dynamic market analysis completed."),
            "signal": signal,
            "round_kelly": kelly,
            "technical_signal": tech_data.get('signal', 'NEUTRAL')
        }

        # 8. Save to Firestore
        save_analysis_snapshot(ticker, snapshot)
        update_heatmap_data(ticker, sentiment_score if label == "positive" else -sentiment_score, label)
        
        print(f"DONE {ticker}: {signal} (Score: {sentiment_score})")

    except Exception as e:
        print(f"!!! Error analyzing {ticker}: {e}")

async def sync_all():
    """Main loop to sync core tickers."""
    tickers = ["AAPL", "NVDA", "TSLA", "MSFT", "GOOGL", "AMZN", "META", "NFLX"]
    
    # Update performance metrics first (Mock/Demo for the Simulator)
    now = int(datetime.now().timestamp())
    equity_curve = [{"time": now - (i * 86400), "value": 1000 + i * 15 + random.uniform(0, 50)} for i in range(30)][::-1]
    bench_curve = [{"time": now - (i * 86400), "value": 1000 + i * 8 + random.uniform(0, 20)} for i in range(30)][::-1]
    
    update_system_performance(
        metrics={"win_rate": 72.5, "profit_factor": 2.4, "max_dd": -8.2, "alpha": 14.5},
        equity_curve=equity_curve,
        benchmark_curve=bench_curve
    )

    while True:
        print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Pulse Start - Analyzing Markets...")
        for t in tickers:
            await analyze_ticker(t)
            await asyncio.sleep(2) # Avoid hitting APIs too fast
            
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Cycle Complete. Sleeping for 15 minutes...")
        await asyncio.sleep(900) # 15 minutes

if __name__ == "__main__":
    asyncio.run(sync_all())
