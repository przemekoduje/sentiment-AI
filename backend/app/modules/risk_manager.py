import random

class GeoEngine:
    """
    Vector-based Geopolitical Intelligence Engine (Faza 12).
    Placeholder for high-level geopolitical risk scoring.
    """
    def __init__(self):
        self.risk_level = "LOW" # Options: LOW, MODERATE, HIGH, CRITICAL
        self._geo_multiplier = 1.0

    def sync_global_risk(self):
        """
        Simulates geopolitical news vector analysis.
        Returns a multiplier that reduces position sizing during high risk.
        """
        # In a real scenario, this would query a Vector DB or LLM analysis
        # For now, we simulate a stable market with occasional spikes.
        roll = random.random()
        if roll > 0.95:
            self.risk_level = "CRITICAL"
            self._geo_multiplier = 0.25
        elif roll > 0.85:
            self.risk_level = "HIGH"
            self._geo_multiplier = 0.50
        elif roll > 0.70:
            self.risk_level = "MODERATE"
            self._geo_multiplier = 0.80
        else:
            self.risk_level = "LOW"
            self._geo_multiplier = 1.0
            
        return self._geo_multiplier

    @property
    def current_multiplier(self):
        return self._geo_multiplier

class RiskManager:
    """
    Centralized risk orchestration layer.
    """
    def __init__(self):
        self.geo_engine = GeoEngine()
        
    def get_adjusted_kelly(self, raw_kelly: float) -> float:
        """
        Applies GeoAI penalty and Safety Caps to the raw Kelly fraction.
        """
        geo_mult = self.geo_engine.sync_global_risk()
        adjusted = raw_kelly * geo_mult
        
        # Architecture v2 - Hard Safety Cap at 10%
        final_kelly = min(adjusted, 0.10)
        
        return round(final_kelly, 4)

# Global instances for the app
geo_engine = GeoEngine()
risk_manager = RiskManager()
