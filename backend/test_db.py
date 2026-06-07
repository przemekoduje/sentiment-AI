from app.database import save_vsa_cache, get_vsa_cache, engine
from app.database import VSACacheModel
from sqlmodel import Session, select
import datetime

def test_persistence():
    ticker = "BTC-TEST"
    data = {
        "ticker": ticker,
        "interval": "1d",
        "recommendation": "BUY_TEST",
        "reasoning": "Test reasoning",
        "deep_analysis": "Test Polish Deep Analysis",
        "vsa_metrics": {"test": 1},
        "anomalies": [{"type": "test"}],
        "trading_plan": {"entry": 100}
    }
    
    print(f">>> Attempting to save cache for {ticker}...")
    try:
        save_vsa_cache(data)
        print(">>> Save call completed without exception.")
    except Exception as e:
        print(f">>> ERROR during save: {e}")
        return

    print(">>> Verifying save...")
    cached = get_vsa_cache(ticker)
    if cached:
        print(f">>> SUCCESS: Found cached data for {ticker}")
        print(f">>> Deep Analysis length: {len(cached.get('deep_analysis', ''))}")
    else:
        print(">>> FAILED: Data not found in cache immediately after save.")
        
    # Check directly via SQLModel
    with Session(engine) as session:
        statement = select(VSACacheModel).where(VSACacheModel.ticker == ticker)
        results = session.exec(statement).all()
        print(f">>> Direct SQLModel check found {len(results)} records for {ticker}")

if __name__ == "__main__":
    test_persistence()
