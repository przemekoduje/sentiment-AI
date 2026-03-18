import pandas as pd

def is_bullish_engulfing(data: pd.DataFrame):
    if len(data) < 2: return False
    prev = data.iloc[-2]
    curr = data.iloc[-1]
    
    # Prev is red, curr is green
    # Curr body engulfs prev body
    prev_red = prev['Close'] < prev['Open']
    curr_green = curr['Close'] > curr['Open']
    engulfs = curr['Open'] <= prev['Close'] and curr['Close'] > prev['Open']
    
    return prev_red and curr_green and engulfs

def is_hammer(data: pd.DataFrame):
    if len(data) < 1: return False
    curr = data.iloc[-1]
    
    body = abs(curr['Close'] - curr['Open'])
    lower_shadow = min(curr['Open'], curr['Close']) - curr['Low']
    upper_shadow = curr['High'] - max(curr['Open'], curr['Close'])
    
    # Small body, long lower shadow, small/no upper shadow
    return lower_shadow > (2 * body) and upper_shadow < (0.5 * body)

def get_candlestick_signal(data: pd.DataFrame):
    """
    Detects key reversal patterns.
    """
    if data.empty or len(data) < 5:
        return {"signal": "NEUTRAL", "reasoning": "Insufficient data"}

    if is_bullish_engulfing(data):
        return {"signal": "BUY", "reasoning": "Bullish Engulfing pattern detected - strong reversal signal."}
    
    if is_hammer(data):
        return {"signal": "BUY", "reasoning": "Hammer pattern detected - potential bottom reversal."}

    return {"signal": "NEUTRAL", "reasoning": "No significant candlestick patterns identified."}
