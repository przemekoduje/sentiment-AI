import os
import sqlite3
from sqlmodel import create_engine, text
from dotenv import load_dotenv

# Load env
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
load_dotenv(dotenv_path=env_path)

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL:
    # Sync version for migration
    DATABASE_URL = DATABASE_URL.replace("postgresql+asyncpg", "postgresql")
else:
    DATABASE_URL = "sqlite:///fallback.db"

engine = create_engine(DATABASE_URL)

def run_migration():
    print(f">>> Running Phase 16 Migration on: {DATABASE_URL}")
    
    queries = [
        # 1. Add VSA columns to TradeSignal table (trade_signals_v2)
        "ALTER TABLE trade_signals_v2 ADD COLUMN IF NOT EXISTS vsa_macro_bias VARCHAR;",
        "ALTER TABLE trade_signals_v2 ADD COLUMN IF NOT EXISTS vsa_reasoning TEXT;",
        
        # 2. Create VSA Cache table
        """
        CREATE TABLE IF NOT EXISTS vsa_analysis_cache (
            ticker VARCHAR(20) PRIMARY KEY,
            interval VARCHAR(10),
            recommendation VARCHAR(20),
            reasoning TEXT,
            trading_plan JSON,
            vsa_metrics JSON,
            anomalies JSON,
            chart_base64 TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
    ]
    
    with engine.connect() as conn:
        for query in queries:
            try:
                # Handle SQLite vs Postgres differences for ADD COLUMN IF NOT EXISTS
                if "sqlite" in DATABASE_URL and "ADD COLUMN IF NOT EXISTS" in query:
                    # SQLite doesn't support IF NOT EXISTS in ALTER TABLE
                    # We catch the error if column exists
                    col_name = "vsa_macro_bias" if "vsa_macro_bias" in query else "vsa_reasoning"
                    try:
                        conn.execute(text(f"ALTER TABLE trade_signals_v2 ADD COLUMN {col_name} VARCHAR;"))
                        print(f"Added column {col_name} (SQLite)")
                    except Exception:
                        print(f"Column {col_name} already exists or error (SQLite)")
                else:
                    conn.execute(text(query))
                    print(f"Executed: {query[:50]}...")
            except Exception as e:
                print(f"Skipping or failed query: {e}")
        
        conn.commit()
    print(">>> Migration Phase 16 Complete.")

if __name__ == "__main__":
    run_migration()
