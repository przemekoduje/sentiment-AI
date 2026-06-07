import pandas as pd
import numpy as np

class VSAQuantEngine:
    """
    Stage 1: Quantitative Engine (Institutional Lens)
    Calculates normalized vectors and identifies Wyckoff anomalies (Effort vs Result).
    """
    
    @staticmethod
    def calculate_metrics(df: pd.DataFrame):
        """
        Normalizes volume, spread and calculates closing position using institutional benchmarks.
        """
        if df.empty or len(df) < 50:
            return None

        # 1. Relative Volume (Effort) vs SMA50
        df['Vol_SMA50'] = df['Volume'].rolling(window=50).mean()
        df['Vol_SMA20'] = df['Volume'].rolling(window=20).mean()
        df['Rel_Vol'] = df['Volume'] / df['Vol_SMA50']
        
        # 2. Relative Spread vs ATR14
        df['H-L'] = df['High'] - df['Low']
        df['H-PC'] = abs(df['High'] - df['Close'].shift(1))
        df['L-PC'] = abs(df['Low'] - df['Close'].shift(1))
        df['TR'] = df[['H-L', 'H-PC', 'L-PC']].max(axis=1)
        df['ATR14'] = df['TR'].rolling(window=14).mean()
        df['Rel_Spread'] = (df['High'] - df['Low']) / df['ATR14']
        
        # 3. Closing Position (Result) - Terciles
        df['Spread'] = df['High'] - df['Low']
        df['Close_Pos'] = np.where(df['Spread'] > 0, 
                                  (df['Close'] - df['Low']) / df['Spread'], 
                                  0.5)
        
        # 4. Trend Context
        df['SMA20'] = df['Close'].rolling(window=20).mean()
        df['SMA50_Price'] = df['Close'].rolling(window=50).mean()
        df['Trend'] = np.where(df['SMA20'] > df['SMA50_Price'], 'UP', 'DOWN')
        
        # 5. Bar Type (Up/Down)
        df['Bar_Type'] = np.where(df['Close'] >= df['Open'], 'UP', 'DOWN')
        
        return df

    @staticmethod
    def _categorize(row):
        """Helper to categorize metrics into Wyckoff states."""
        # Volume Categories
        if row['Rel_Vol'] > 2.5: v_cat = "ULTRA_HIGH"
        elif row['Rel_Vol'] > 1.5: v_cat = "HIGH"
        elif row['Rel_Vol'] > 0.8: v_cat = "AVERAGE"
        else: v_cat = "LOW"

        # Spread Categories
        if row['Rel_Spread'] > 1.5: s_cat = "WIDE"
        elif row['Rel_Spread'] > 0.8: s_cat = "AVERAGE"
        else: s_cat = "NARROW"

        # Close Position Categories (Terciles)
        if row['Close_Pos'] > 0.66: c_cat = "UPPER"
        elif row['Close_Pos'] > 0.33: c_cat = "MIDDLE"
        else: c_cat = "LOWER"

        return v_cat, s_cat, c_cat

    @staticmethod
    def detect_anomalies(df: pd.DataFrame, limit_recent: bool = False):
        """
        Institutional Anomaly Detection: Effort vs Result & Dissonance.
        """
        anomalies = []
        check_df = df.iloc[-20:] if limit_recent else df
        
        for idx, row in check_df.iterrows():
            if pd.isna(row['Rel_Vol']) or pd.isna(row['Rel_Spread']):
                continue

            v_cat, s_cat, c_cat = VSAQuantEngine._categorize(row)
            tags = []
            
            # 1. STOPPING VOLUME (Absorption)
            if v_cat == "ULTRA_HIGH" and c_cat == "UPPER" and row['Trend'] == 'DOWN':
                tags.append("STOP_VOL_ABSORPTION")
            
            # 2. BUYING CLIMAX (Distribution into strength)
            if v_cat == "ULTRA_HIGH" and s_cat == "WIDE" and c_cat == "LOWER" and row['Bar_Type'] == 'UP':
                tags.append("BUYING_CLIMAX")

            # 3. NO DEMAND (Lack of institutional interest in UP moves)
            if v_cat == "LOW" and s_cat == "NARROW" and row['Bar_Type'] == 'UP':
                tags.append("NO_DEMAND")
            
            # 4. NO SUPPLY (Testing the bottom)
            if v_cat == "LOW" and s_cat == "NARROW" and row['Bar_Type'] == 'DOWN':
                tags.append("NO_SUPPLY")

            # 5. DISSONANCE (Extreme Effort, No Result - Absorption)
            if row['Rel_Vol'] > 2.0 and row['Rel_Spread'] < 1.0:
                tags.append("EFFORT_RESULT_DISSONANCE")

            # 6. THIN BOOK TRAP (Wide spread on low volume)
            if row['Rel_Spread'] > 1.5 and row['Rel_Vol'] < 0.8:
                tags.append("THIN_BOOK_TRAP")

            if tags:
                anomalies.append({
                    "date": idx.strftime("%Y-%m-%d %H:%M"),
                    "price": round(float(row['Close']), 2),
                    "metrics": {
                        "vol_cat": v_cat,
                        "spread_cat": s_cat,
                        "close_cat": c_cat,
                        "rel_vol": round(float(row['Rel_Vol']), 2),
                        "rel_spread": round(float(row['Rel_Spread']), 2),
                        "close_pos": round(float(row['Close_Pos']), 2)
                    },
                    "tags": tags
                })
                
        return anomalies
