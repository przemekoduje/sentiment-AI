import pandas as pd
from typing import List, Dict

class VSADecisionEngine:
    """
    Stage 3: Institutional Decision Engine (Logic Guard & Action Plan).
    Translates Wyckoff anomalies into high-probability trading setups.
    """
    
    @staticmethod
    def generate_recommendation(df: pd.DataFrame, anomalies: List[Dict], blocks: List[Dict]):
        """
        Enforces Logic Guard (Confluence with structure) and generates Trading Plans.
        """
        if not anomalies:
            return VSADecisionEngine._hold_response("No significant Wyckoff anomalies detected.")
            
        latest = anomalies[-1]
        tags = latest['tags']
        price = latest['price']
        atr = float(df['ATR14'].iloc[-1])
        
        # 1. Classification & Logic Guard (Confluence)
        action = "HOLD"
        reasoning = []
        is_structure_confirmed = False
        
        # Determine Potential Direction
        if any(t in ["STOP_VOL_ABSORPTION", "NO_SUPPLY", "EFFORT_RESULT_DISSONANCE"] for t in tags):
            # Check near Demand Zone (max 1.5% proximity)
            near_demand = any(abs(price - b['price']) / b['price'] <= 0.015 for b in blocks if b['type'] == "DEMAND")
            if near_demand:
                action = "BUY"
                is_structure_confirmed = True
                reasoning.append(f"Institutional SOS: {', '.join(tags)} confirmed at Demand Zone.")
            else:
                reasoning.append(f"REJECTED: {', '.join(tags)} detected but lacked structural confluence (No Demand Zone nearby).")

        elif any(t in ["BUYING_CLIMAX", "NO_DEMAND", "THIN_BOOK_TRAP"] for t in tags):
            # Check near Supply Zone (max 1.5% proximity)
            near_supply = any(abs(price - b['price']) / b['price'] <= 0.015 for b in blocks if b['type'] == "SUPPLY")
            if near_supply:
                action = "SELL"
                is_structure_confirmed = True
                reasoning.append(f"Institutional SOW: {', '.join(tags)} confirmed at Supply Zone.")
            else:
                reasoning.append(f"REJECTED: {', '.join(tags)} detected but lacked structural confluence (No Supply Zone nearby).")

        if action == "HOLD" or not is_structure_confirmed:
            return VSADecisionEngine._hold_response(" ".join(reasoning) if reasoning else "Market context does not support institutional entry.")

        # 2. Structural Trading Plan
        entry = df['Close'].iloc[-1] # Use current close as entry, not anomaly price
        
        # SL Calculation: Structure + 1.5 * ATR buffer
        if action == "BUY":
            structure_low = min([b['price'] for b in blocks if b['type'] == "DEMAND" and b['price'] < entry] + [price])
            sl = structure_low - (1.5 * atr)
            
            # TP Calculation: Search for nearest Supply Zone or Stopping Vol / Shakeout
            liquidity_targets = [b['price'] for b in blocks if b['type'] == "SUPPLY" and b['price'] > entry]
            vsa_targets = [a['price'] for a in anomalies if any(t in ["STOP_VOL_ABSORPTION", "SPRING", "SOS"] for t in a['tags']) and a['price'] > entry]
            tp_candidates = liquidity_targets + vsa_targets
            tp = min(tp_candidates) if tp_candidates else entry + (3.0 * atr)
            
        else: # SELL
            structure_high = max([b['price'] for b in blocks if b['type'] == "SUPPLY" and b['price'] > entry] + [price])
            sl = structure_high + (1.5 * atr)
            
            # TP Calculation: Search for nearest Demand Zone or Stopping Vol / Shakeout
            liquidity_targets = [b['price'] for b in blocks if b['type'] == "DEMAND" and b['price'] < entry]
            vsa_targets = [a['price'] for a in anomalies if any(t in ["STOP_VOL_ABSORPTION", "SPRING", "SOW"] for t in a['tags']) and a['price'] < entry]
            tp_candidates = liquidity_targets + vsa_targets
            tp = max(tp_candidates) if tp_candidates else entry - (3.0 * atr)

        # 3. Hard Validation Guard (Directionality)
        if action == "BUY" and (tp <= entry or sl >= entry):
             return VSADecisionEngine._hold_response(f"LOGIC_ERROR_PRICE_MISMATCH: BUY TP({round(tp,2)}) <= Entry({round(entry,2)}) or SL >= Entry.")
        if action == "SELL" and (tp >= entry or sl <= entry):
             return VSADecisionEngine._hold_response(f"LOGIC_ERROR_PRICE_MISMATCH: SELL TP({round(tp,2)}) >= Entry({round(entry,2)}) or SL <= Entry.")

        # 4. Risk/Reward Filter (The "Hard Gate")
        risk = abs(entry - sl)
        reward = abs(tp - entry)
        rr_ratio = reward / risk if risk > 0 else 0
        
        if rr_ratio < 2.0:
            return VSADecisionEngine._hold_response(f"REJECTED: Signal {', '.join(tags)} confirmed, but R/R ratio ({round(rr_ratio, 2)}) is below 2.0 minimum.")

        return {
            "action": action,
            "reasoning": " ".join(reasoning),
            "plan": {
                "entry": round(entry, 2),
                "stop_loss": round(sl, 2),
                "take_profit": round(tp, 2),
                "risk_reward": round(rr_ratio, 2)
            }
        }

    @staticmethod
    def _hold_response(reason: str):
        # Phase 16.2: Emphasize bidirectional search
        bidirectional_suffix = "\nSystem aktywnie poszukuje punktów wejścia zarówno dla pozycji DŁUGICH (Akumulacja), jak i KRÓTKICH (Dystrybucja)."
        return {
            "action": "HOLD",
            "reasoning": f"{reason}{bidirectional_suffix}",
            "plan": None
        }
