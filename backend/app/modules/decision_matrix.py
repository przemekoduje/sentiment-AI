def get_trading_signal(technical_indicator: str, sentiment_label: str, sentiment_score: float, 
                       insider_score: float = 0.0, fundamental_score: float = 0.5):
    """
    Hybrid Decision Matrix:
    - Tech Bullish + Sentiment Positive (>0.7) = Base BUY
    - Boosts: Insider Cluster Buying (+15%), High Fundamental Quality (+10%)
    - Gating: Rejects if Sentiment < 0.3
    """
    
    technical_bullish = technical_indicator == "BULLISH"
    sentiment_positive = sentiment_label == "positive"
    
    # Base Confidence from sentiment
    confidence = abs(sentiment_score)
    
    # Add Hybrid Boosts
    if insider_score > 0.8:
        confidence += 0.15
    if fundamental_score > 0.7:
        confidence += 0.10
        
    # Clamp confidence
    confidence = min(0.99, confidence)
    
    decision = "HOLD"
    reasoning = []
    
    # Gating Logic
    if sentiment_score < 0.3:
        return {
            "decision": "SKIP",
            "reasoning": "Sentiment Gating: Information risk too high for entry.",
            "is_confident": False,
            "confidence": confidence
        }

    if technical_bullish and sentiment_positive and sentiment_score > 0.6:
        decision = "BUY"
        reasoning.append("Bullish Tech & Positive AI Sentiment matched.")
    elif sentiment_label == "negative" and sentiment_score > 0.7:
        decision = "SELL"
        reasoning.append("Strongly Negative AI Sentiment detected.")
    else:
        decision = "HOLD"
        reasoning.append("Mixed signals across layers.")

    if insider_score > 0.8:
        reasoning.append("Smart Money: Cluster Buying detected (+15% Conf).")
    if fundamental_score > 0.7:
        reasoning.append("Quality: High Moat business grade (+10% Conf).")

    return {
        "action": decision,
        "reasoning": " | ".join(reasoning),
        "is_confident": confidence > 0.6,
        "confidence": confidence
    }
