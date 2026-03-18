import pandas as pd
import numpy as np

def calculate_adl(data: pd.DataFrame):
    """Calculates Accumulation/Distribution Line."""
    clv = ((data['Close'] - data['Low']) - (data['High'] - data['Close'])) / (data['High'] - data['Low'])
    clv = clv.fillna(0) # Handle flat candles
    adl = (clv * data['Volume']).cumsum()
    return adl

def get_volume_signal(data: pd.DataFrame):
    """
    Analyzes volume to find breakouts and accumulation zones.
    Returns: {signal, reasoning}
    """
    if data.empty or len(data) < 21:
        return {"signal": "NEUTRAL", "reasoning": "Insufficent data"}

    close = data['Close']
    volume = data['Volume']
    
    # 1. Volume Breakout
    avg_vol = volume.rolling(window=20).mean()
    curr_vol = volume.iloc[-1]
    curr_change = (close.iloc[-1] / close.iloc[-2]) - 1 if len(close) > 1 else 0
    
    is_breakout = curr_vol > (avg_vol.iloc[-1] * 1.5) and curr_change > 0.01
    
    # 2. Accumulation/Distribution Trend
    adl = calculate_adl(data)
    adl_ema_short = adl.ewm(span=5).mean()
    adl_ema_long = adl.ewm(span=20).mean()
    
    is_accumulating = adl_ema_short.iloc[-1] > adl_ema_long.iloc[-1]
    
    if is_breakout and is_accumulating:
        return {
            "signal": "BUY",
            "reasoning": f"Volume Breakout detected ({round(curr_vol/avg_vol.iloc[-1], 1)}x avg) with strong Accumulation trend."
        }
    elif is_breakout:
        return {
            "signal": "BUY",
            "reasoning": f"Volume Breakout detected ({round(curr_vol/avg_vol.iloc[-1], 1)}x avg). High conviction price move."
        }
    elif is_accumulating:
        return {
            "signal": "NEUTRAL",
            "reasoning": "Institutional accumulation detected (ADL rising), but no price breakout yet."
        }
    
    return {
        "signal": "NEUTRAL",
        "reasoning": "Normal volume activity, no significant accumulation detected."
    }
