import asyncio
import sys
import os

# Add the backend directory to sys.path so we can import 'app'
sys.path.insert(0, os.getcwd())

from app.modules.live_discovery import LiveDiscoveryEngine

async def test():
    print("Initializing engine...")
    engine = LiveDiscoveryEngine()
    print("Running refresh_cache(limit=2)...")
    try:
        await engine.refresh_cache(limit=2)
        print("Success! Matrix data size:", len(engine.get_matrix_data()))
    except Exception as e:
        import traceback
        print(f"Error caught: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test())
