import yfinance as yf
import pandas as pd

def get_technical_indicator(ticker: str):
    """
    Computes detailed technical indicators and formations.
    """
    try:
        data = yf.download(ticker, period="3mo", interval="1d", progress=False)
    except Exception as e:
        print(f"CRITICAL ERROR downloading data for {ticker}: {e}")
        return {"signal": "NEUTRAL", "price": 0.0, "indicators": {}, "formations": []}, 0.0
    
    if data is None or data.empty:
        print(f"FAILED to download on-demand data for {ticker}. yfinance returned empty DataFrame.")
        return {"signal": "NEUTRAL", "price": 0.0, "indicators": {}, "formations": []}, 0.0
    
    if isinstance(data.columns, pd.MultiIndex):
        data.columns = data.columns.get_level_values(0)

    # Core Indicators
    data['SMA5'] = data['Close'].rolling(window=5).mean()
    data['SMA20'] = data['Close'].rolling(window=20).mean()
    data['SMA50'] = data['Close'].rolling(window=50).mean()
    
    # RSI Calculation
    delta = data['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    data['RSI'] = 100 - (100 / (1 + rs))
    
    last_row = data.iloc[-1]
    prev_row = data.iloc[-2] if len(data) > 1 else last_row
    
    sma5 = float(last_row['SMA5'])
    sma20 = float(last_row['SMA20'])
    sma50 = float(last_row['SMA50'])
    rsi = float(last_row['RSI'])
    current_price = float(last_row['Close'])
    prev_close = float(prev_row['Close'])
    change_pct = ((current_price / prev_close) - 1) * 100 if prev_close != 0 else 0
    
    # Formations detection
    formations = []
    if sma5 > sma20 and prev_row['SMA5'] <= prev_row['SMA20']:
        formations.append("GOLDEN_CROSS_SHORT")
    if sma20 > sma50 and prev_row['SMA20'] <= prev_row['SMA50']:
        formations.append("GOLDEN_CROSS_LONG")
    if rsi < 30:
        formations.append("OVERSOLD_REVERSAL")
    if rsi > 70:
        formations.append("OVERBOUGHT_DANGER")
        
    indicators = {
        "sma5": round(sma5, 2),
        "sma20": round(sma20, 2),
        "sma50": round(sma50, 2),
        "rsi": round(rsi, 2)
    }
    
    if sma5 > sma20:
        signal = "BULLISH"
    elif sma5 < sma20:
        signal = "BEARISH"
    else:
        signal = "NEUTRAL"
        
    result = {
        "signal": signal,
        "price": round(current_price, 2),
        "change_pct": round(change_pct, 2),
        "indicators": indicators,
        "formations": formations
    }
    
    return result, float(current_price)
