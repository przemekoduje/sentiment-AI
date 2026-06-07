import os
import sys
from sqlmodel import Session, create_engine, text

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), "app"))

from app.database import engine

def clear_vsa_data():
    print(">>> Starting VSA Data Purge...")
    with Session(engine) as session:
        try:
            # Clear VSA Cache
            session.execute(text("DELETE FROM vsa_analysis_cache"))
            print(">>> Table 'vsa_analysis_cache' cleared.")
            
            # Clear Trade Signals (v2)
            session.execute(text("DELETE FROM trade_signals_v2"))
            print(">>> Table 'trade_signals_v2' cleared.")
            
            session.commit()
            print(">>> Purge complete. Ready for Bible-compliant analysis.")
        except Exception as e:
            print(f">>> Error during purge: {e}")
            session.rollback()

if __name__ == "__main__":
    clear_vsa_data()
