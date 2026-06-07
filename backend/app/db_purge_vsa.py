import os
from sqlmodel import Session, delete, select
from database import engine, TradeSignal, VSACacheModel

def purge_vsa_data():
    """
    Removes all cached VSA analyses and trade signals to allow re-generation with a higher-quality model.
    """
    print(">>> Starting VSA Data Purge...")
    try:
        with Session(engine) as session:
            # Delete VSA Cache
            vsa_cache_count = session.exec(select(VSACacheModel)).all()
            print(f"    Deleting {len(vsa_cache_count)} records from vsa_analysis_cache...")
            session.exec(delete(VSACacheModel))
            
            # Delete Trade Signals
            signals_count = session.exec(select(TradeSignal)).all()
            print(f"    Deleting {len(signals_count)} records from trade_signals_v2...")
            session.exec(delete(TradeSignal))
            
            session.commit()
            print(">>> Purge COMPLETED successfully.")
    except Exception as e:
        print(f"!!! Error during purge: {e}")

if __name__ == "__main__":
    purge_vsa_data()
