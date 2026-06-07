import asyncio
import os
import sys
import pandas as pd

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))
sys.path.append(os.path.join(os.path.dirname(__file__), "backend", "app"))

from backend.app.modules.vsa.pipeline import VSAMacroPipeline
from backend.app.modules.vsa.data_router import VSADataRouter

async def test_traceback():
    print(">>> Phase 1: Checking DataRouter output...")
    try:
        df = await VSADataRouter.get_ohlcv("AAPL")
        print(f">>> DataRouter columns: {df.columns.tolist()}")
        
        print(">>> Phase 2: Triggering Full Pipeline...")
        result = await VSAMacroPipeline.process_instrument("AAPL")
        if "error" in result:
            print(f">>> PIPELINE RETURNED ERROR: {result['error']}")
        else:
            print(">>> PIPELINE SUCCESS!")
            
    except Exception as e:
        import traceback
        print(f"!!! CAUGHT EXCEPTION: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_traceback())
