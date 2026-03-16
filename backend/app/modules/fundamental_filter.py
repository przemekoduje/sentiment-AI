import yfinance as yf
from typing import Dict, Optional

class FundamentalFilter:
    """
    Grades companies based on 'Economic Moat' indicators: ROIC, FCF, and Debt.
    """

    def grade_ticker(self, ticker: str) -> Dict:
        """
        Analyzes fundamentals and returns a quality grade (A-F) and a score (0-1).
        """
        try:
            stock = yf.Ticker(ticker)
            info = stock.info
            
            # 1. ROIC approximation (Return on Assets as proxy if ROIC not available easily)
            roa = info.get("returnOnAssets", 0)
            
            # 2. Profitability (Profit Margin)
            margin = info.get("profitMargins", 0)
            
            # 3. Financial Health (Debt to Equity)
            debt_to_equity = info.get("debtToEquity", 100) / 100.0  # Normalized
            
            # Simple grading logic
            score = 0.0
            if roa > 0.10: score += 0.4  # Good ROA
            if margin > 0.15: score += 0.3 # Good Margins
            if debt_to_equity < 1.0: score += 0.3 # Low Debt
            
            grade = "C"
            if score >= 0.9: grade = "A"
            elif score >= 0.7: grade = "B"
            elif score < 0.4: grade = "D"
            
            return {
                "fundamental_score": round(score, 2),
                "fundamental_grade": grade,
                "metrics": {
                    "roa": f"{roa*100:.1f}%",
                    "margin": f"{margin*100:.1f}%",
                    "debt_ratio": round(debt_to_equity, 2)
                }
            }
        except Exception as e:
            print(f"Fundamental error for {ticker}: {e}")
            return {"fundamental_score": 0.5, "fundamental_grade": "N/A", "metrics": {}}

    def is_quality_business(self, ticker: str) -> bool:
        """Quick boolean check for triage."""
        res = self.grade_ticker(ticker)
        return res["fundamental_score"] >= 0.6
