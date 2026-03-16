import asyncio
import sys
import os

# Ensure modules are importable
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__))))

from modules.live_discovery import LiveDiscoveryEngine

async def diagnose_phase_6():
    print("--- Phase 6 Diagnostic Run ---")
    engine = LiveDiscoveryEngine()
    
    # Analyze a few tickers directly to see layer integration
    tickers = ["NVDA", "TSLA", "AAPL"]
    print(f"Analyzing {tickers}...")
    
    # We simulate a partial scan for these tickers
    for ticker in tickers:
        # 1. Tech check (mocked for simplicity here, but using real modules)
        # 2. Insider check
        insider_score = engine.insider_tracker.get_insider_score(ticker)
        insider_meta = engine.insider_tracker.get_layer_metadata(ticker)
        
        # 3. Fundamental check
        fund_data = engine.fundamental_filter.grade_ticker(ticker)
        
        print(f"\n[{ticker}]")
        print(f"  Insider Score: {insider_score} ({insider_meta['insider_signal']})")
        print(f"  Fundamental Grade: {fund_data['fundamental_grade']} (Score: {fund_data['fundamental_score']})")
        print(f"  Metrics: {fund_data.get('metrics', {})}")

if __name__ == "__main__":
    asyncio.run(diagnose_phase_6())
