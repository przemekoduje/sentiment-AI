from database import engine
from sqlalchemy import text

def purge():
    with engine.connect() as conn:
        print("Truncating vsa_analysis_cache...")
        conn.execute(text("TRUNCATE TABLE vsa_analysis_cache CASCADE;"))
        print("Deleting from trade_signals_v2...")
        conn.execute(text("DELETE FROM trade_signals_v2;"))
        conn.commit()
    print(">>> Purge completed.")

if __name__ == "__main__":
    purge()
