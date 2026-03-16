def calculate_potential_roi(capital: float):
    """
    Marketing tool based on the 'Engineering as Marketing' principle.
    Compares traditional emotional trading vs. AI-disciplined trading.
    """
    
    # Research-based assumptions for marketing tool
    baseline_win_rate = 0.45  # Typical human trader
    ai_win_rate = 0.58        # Disciplined AI-assisted trader
    
    avg_win_pct = 0.05        # 5% average win
    avg_loss_pct = 0.02       # 2% average loss (stopped out)
    
    num_trades = 100          # Simulation over 100 trades
    
    # Emotional Trading (Human)
    # Often humans take smaller wins and let losses run, but here we assume discipline as baseline
    human_expected_value = (baseline_win_rate * avg_win_pct) - ((1 - baseline_win_rate) * avg_loss_pct)
    human_profit = capital * human_expected_value * num_trades
    
    # AI Trading (Disciplined)
    ai_expected_value = (ai_win_rate * avg_win_pct) - ((1 - ai_win_rate) * avg_loss_pct)
    ai_profit = capital * ai_expected_value * num_trades
    
    improvement = ai_profit - human_profit
    improvement_pct = ((ai_profit / human_profit) - 1) * 100 if human_profit > 0 else 100.0
    
    return {
        "capital": capital,
        "human_estimate": round(human_profit, 2),
        "ai_estimate": round(ai_profit, 2),
        "improvement_delta": round(improvement, 2),
        "improvement_pct": round(improvement_pct, 2),
        "message": "AI removes emotional gating, potentially improving win rates by avoiding 'sentiment traps'."
    }
