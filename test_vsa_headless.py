import asyncio
import os
import sys
import pandas as pd
from unittest.mock import MagicMock

# Mock Matplotlib and other UI-heavy libs to avoid ModuleNotFoundError
sys.modules['matplotlib'] = MagicMock()
sys.modules['matplotlib.pyplot'] = MagicMock()
sys.modules['matplotlib.patches'] = MagicMock()
sys.modules['mplfinance'] = MagicMock()

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))
sys.path.append(os.path.join(os.path.dirname(__file__), "backend", "app"))

# We must mock these BEFORE importing any VSA modules that use them
os.environ["OPENAI_API_KEY"] = "mock_key"

from backend.app.modules.vsa.pipeline import VSAMacroPipeline

async def test_traceback():
    print(">>> Triggering HEADLESS VSA Pipeline for AAPL...")
    try:
        # We set render_chart=False to avoid matplotlib errors
        result = await VSAMacroPipeline.process_instrument("AAPL", render_chart=False)
        if "error" in result:
             print(f">>> PIPELINE RETURNED ERROR: {result['error']}")
        else:
             print(">>> SUCCESS!")
    except Exception as e:
        import traceback
        print(f"!!! CAUGHT EXCEPTION: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_traceback())
