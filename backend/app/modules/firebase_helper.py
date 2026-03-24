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

# Global heatmap cache and dirty tracking
heatmap_cache = {}
dirty_tickers = set()

def update_heatmap_data(ticker: str, sentiment_score: float, label: str, sector: str = "Finance", size: float = 1000.0, change_pct: float = 0.0, potential_score: float = 50.0, price: float = 0.0):
    """
    Warstwa 3: Efektywność Firebase.
    Zapisuje dane do lokalnego cache'u i oznacza ticker jako 'dirty' jeśli zmiana jest istotna.
    """
    # Sprawdzanie czy zmiana jest istotna (delta-update)
    old_data = heatmap_cache.get(ticker)
    is_dirty = False
    
    if not old_data:
        is_dirty = True
    else:
        # Zmiana ceny o > 0.05% lub zmiana etykiety sentymentu
        old_price = old_data.get('price', 0)
        price_change = abs(price - old_price) / (old_price or 1)
        if price_change > 0.0005 or label != old_data.get('label'):
            is_dirty = True
            
    heatmap_cache[ticker] = {
        'ticker': ticker,
        'sentiment': sentiment_score,
        'label': label,
        'sector': sector,
        'size': size, 
        'change_pct': change_pct,
        'potential_score': potential_score,
        'price': price,
        'last_updated': datetime.now().isoformat()
    }
    
    if is_dirty:
        dirty_tickers.add(ticker)

def flush_heatmap_single_object():
    """
    WDROŻENIE: Single-Object State (The Big Blob).
    Zapisuje całą heatmapę jako jeden dokument w celu drastycznej redukcji zapisów (Quota Save).
    """
    global dirty_tickers
    if not heatmap_cache or db is None: return
    
    print(f">>> Firebase [Quota Save]: Flushing heatmap as SINGLE BLOB (Tickers: {len(heatmap_cache)})...")
    try:
        doc_ref = db.collection('global_market_state').document('all_tickers')
        
        # Przygotowanie danych (konwersja do listy dla frontendu)
        payload = {
            'market': 'SP500',
            'tickers': list(heatmap_cache.values()),
            'last_updated': firestore.SERVER_TIMESTAMP,
            'update_reason': "scheduled" if not dirty_tickers else "delta_change"
        }
        
        doc_ref.set(payload, merge=True)
        print(f">>> Firebase: Single Object Update successful. Quota saved (1 write vs {len(heatmap_cache)}).")
        
        # Reset dirty tracking
        dirty_tickers.clear()
    except Exception as e:
        print(f"!!! Firebase Single Object Error: {e}")

def flush_heatmap_batch():
    """
    DEPRECATED: Zakomentowane w celu przejścia na flush_heatmap_single_object.
    Zachowane dla kompatybilności wstecznej (jeszcze).
    """
    pass

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
