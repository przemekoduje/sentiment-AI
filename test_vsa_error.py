import asyncio
import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), "backend", "app"))

from backend.app.modules.vsa.pipeline import VSAMacroPipeline

async def test_traceback():
    print(">>> Triggering VSA Pipeline for AAPL...")
    try:
        result = await VSAMacroPipeline.process_instrument("AAPL")
        print("RESULT:", result)
    except Exception as e:
        import traceback
        print(f"!!! CAUGHT EXCEPTION: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_traceback())
