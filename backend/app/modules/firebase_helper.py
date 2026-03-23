import firebase_admin
from firebase_admin import credentials, firestore
import os
import json
from datetime import datetime

# Path to service account key
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SERVICE_ACCOUNT_PATH = os.path.join(BASE_DIR, "serviceAccountKey.json")

def initialize_firebase():
    """Initializes Firebase Admin SDK if not already initialized."""
    try:
        if not firebase_admin._apps:
            if os.path.exists(SERVICE_ACCOUNT_PATH):
                cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
                firebase_admin.initialize_app(cred)
                print(">>> Firebase Admin Initialized via Service Account.")
            else:
                # Fallback for GCF or local env with GOOGLE_APPLICATION_CREDENTIALS
                firebase_admin.initialize_app()
                print(">>> Firebase Admin Initialized via Default Credentials.")
        
        return firestore.client()
    except Exception as e:
        print(f"!!! Firebase Initialization Error: {e}")
        return None

# Global db instance
db = initialize_firebase()

def save_analysis_snapshot(ticker: str, data: dict, merge: bool = True):
    """Saves ticker analysis to analysis_snapshots collection."""
    if db is None: return
    try:
        doc_ref = db.collection('analysis_snapshots').document(ticker)
        data['last_updated'] = firestore.SERVER_TIMESTAMP
        doc_ref.set(data, merge=merge)
    except Exception as e:
        print(f"!!! Firestore Save Error (Snapshot): {e}")

# Global heatmap cache to reduce Firestore writes
heatmap_cache = {}

def update_heatmap_data(ticker: str, sentiment_score: float, label: str, sector: str = "Finance", size: float = 1000.0, change_pct: float = 0.0, potential_score: float = 50.0, price: float = 0.0):
    """
    Warstwa 3: Efektywność Firebase.
    Zapisuje dane do lokalnego cache'u zamiast natychmiastowego zapisu do DB.
    """
    heatmap_cache[ticker] = {
        'ticker': ticker,
        'sentiment': sentiment_score,
        'label': label,
        'sector': sector,
        'size': size, 
        'change_pct': change_pct,
        'potential_score': potential_score,
        'price': price,
        'last_updated': datetime.now() # Marker for sync
    }

def flush_heatmap_batch():
    """
    Wykonuje zbiorczy zapis (Batch Write) wszystkich zmian z cache'u do Firestore.
    Powinno być wywoływane co 30 minut.
    """
    if not heatmap_cache or db is None: return
    
    print(f">>> Firebase: Flushing batch update for {len(heatmap_cache)} tickers...")
    try:
        batch = db.batch()
        for ticker, data in heatmap_cache.items():
            doc_ref = db.collection('sp500_heatmap').document(ticker)
            # Convert datetime because Firestore needs its own timestamp or native dt
            data['last_updated'] = firestore.SERVER_TIMESTAMP
            batch.set(doc_ref, data, merge=True)
        
        batch.commit()
        print(">>> Firebase: Batch update successful.")
        # We don't necessarily clear the cache if we want it to persist for 
        # "inactive" tickers as requested (previous state).
    except Exception as e:
        print(f"!!! Firebase Batch Error: {e}")

def update_system_performance(metrics: dict, equity_curve: list, benchmark_curve: list):
    """Updates the global system stats for the Kelly Simulator."""
    if db is None: return
    try:
        doc_ref = db.collection('system_stats').document('performance')
        doc_ref.set({
            'metrics': metrics,
            'equity_curve': equity_curve,
            'benchmark_curve': benchmark_curve,
            'last_updated': firestore.SERVER_TIMESTAMP
        }, merge=True)
    except Exception as e:
        print(f"!!! Firestore Save Error (Performance): {e}")
