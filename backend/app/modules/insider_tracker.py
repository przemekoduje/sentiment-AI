import random
from typing import Dict

class InsiderTracker:
    """
    Tracks SEC Form 4 filings to detect 'Cluster Buying' by corporate insiders.
    """
    
    def __init__(self):
        # In production, this would poll an SEC EDGAR API or a provider like OpenInsider
        self.mock_filings = {
            "NVDA": {"insiders": 4, "total_value": 1200000, "signal": "CLUSTER_BUY"},
            "TSLA": {"insiders": 2, "total_value": 500000, "signal": "NEUTRAL"},
            "AAPL": {"insiders": 0, "total_value": 0, "signal": "NEUTRAL"}
        }

    def get_insider_score(self, ticker: str) -> float:
        """
        Returns a score from 0 to 1 based on recent insider activity.
        1.0 = Strong Cluster Buy (3+ insiders)
        0.5 = Moderate Buying
        0.0 = No activity or Selling
        """
        data = self.mock_filings.get(ticker)
        if not data:
            # For demo, randomize some data if not in mock
            if random.random() > 0.8:
                return 0.7  # Simulated moderate signal
            return 0.0
            
        insiders = data.get("insiders", 0)
        if insiders >= 3:
            return 1.0
        elif insiders > 0:
            return 0.5
        return 0.0

    def get_layer_metadata(self, ticker: str) -> Dict:
        """Returns descriptive metadata for UI visualization."""
        data = self.mock_filings.get(ticker, {"insiders": 0, "signal": "NEUTRAL"})
        return {
            "insider_count": data.get("insiders", 0),
            "insider_signal": data.get("signal", "NEUTRAL"),
            "layer_name": "Smart Money"
        }
    def get_historical_insider_data(self, ticker: str, start_date: str, end_date: str) -> list:
        """
        Returns a list of dates where significant insider buying occurred.
        In production, this would query a historical database of filings.
        """
        # Mock historical data for demonstration
        if ticker == "NVDA":
            return [
                {"date": "2024-02-15", "type": "BUY", "insider": "Jensen Huang"},
                {"date": "2024-02-28", "type": "BUY", "insider": "Colette Kress"}
            ]
        elif ticker == "TSLA":
            return [
                {"date": "2024-03-05", "type": "BUY", "insider": "Elon Musk"}
            ]
        return []
