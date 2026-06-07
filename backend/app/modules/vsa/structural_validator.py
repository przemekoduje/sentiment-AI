import io
import base64
import asyncio
import pandas as pd
import numpy as np
from scipy.signal import argrelextrema
import matplotlib
matplotlib.use('Agg') 
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import mplfinance as mpf
from typing import List, Dict

class VSAStructuralValidator:
    """
    Stage 2: Visual-Structural Model (Context Verification)
    Identifies Order Blocks (S/R) and Market Phases using Wyckoff principles.
    """
    
    @staticmethod
    def find_pivots(df: pd.DataFrame, window: int = 5):
        """Identifies Swing Highs and Lows using scipy argrelextrema."""
        # Find local peaks
        df['Pivot_High_Idx'] = argrelextrema(df['High'].values, np.greater, order=window)[0].tolist() + [None] * (len(df) - len(argrelextrema(df['High'].values, np.greater, order=window)[0]))
        df['Pivot_Low_Idx'] = argrelextrema(df['Low'].values, np.less, order=window)[0].tolist() + [None] * (len(df) - len(argrelextrema(df['Low'].values, np.less, order=window)[0]))
        
        # We need a better way to store these in the DF for alignment
        # Re-calc for proper alignment
        local_max = argrelextrema(df['High'].values, np.greater, order=window)[0]
        local_min = argrelextrema(df['Low'].values, np.less, order=window)[0]
        
        df['Swing_High'] = np.nan
        df['Swing_Low'] = np.nan
        df.iloc[local_max, df.columns.get_loc('Swing_High')] = df.iloc[local_max]['High']
        df.iloc[local_min, df.columns.get_loc('Swing_Low')] = df.iloc[local_min]['Low']
        
        return df

    @staticmethod
    def detect_market_phase(df: pd.DataFrame):
        """
        Categorizes phase: Accumulation, Markup, Distribution, Markdown.
        Based on the sequence of the last 4 major pivots.
        """
        highs = df[df['Swing_High'].notna()]['Swing_High'].tail(4).tolist()
        lows = df[df['Swing_Low'].notna()]['Swing_Low'].tail(4).tolist()
        
        if len(highs) < 2 or len(lows) < 2:
            return "UNKNOWN"

        # HH/HL = Markup
        if highs[-1] > highs[-2] and lows[-1] > lows[-2]:
            return "MARKUP (Strong Demand)"
        # LH/LL = Markdown
        elif highs[-1] < highs[-2] and lows[-1] < lows[-2]:
            return "MARKDOWN (Institutional Supply)"
        # HL/LH or range = Accumulation/Distribution
        elif abs(highs[-1] - highs[-2]) / highs[-1] < 0.03:
            # If price is at the bottom of a long fall
            return "ACCUMULATION / RANGE"
        else:
            return "DISTRIBUTION / RANGE"

    @staticmethod
    def detect_order_blocks(df: pd.DataFrame):
        """Identifies structural zones (Demand/Supply)."""
        blocks = []
        recent = df.iloc[-150:]
        lows = recent[recent['Swing_Low'].notna()]
        highs = recent[recent['Swing_High'].notna()]
        
        # Group close pivots into single zones
        for idx, row in lows.iterrows():
            blocks.append({"type": "DEMAND", "price": row['Low'], "date": idx, "width": 20})
        for idx, row in highs.iterrows():
            blocks.append({"type": "SUPPLY", "price": row['High'], "date": idx, "width": 20})
            
        return blocks

    @staticmethod
    async def render_vsa_chart_base64(df: pd.DataFrame, anomalies: List[Dict], ticker: str, interval: str, plot_length: int = 60) -> str:
        return await asyncio.to_thread(VSAStructuralValidator._render_sync, df, anomalies, ticker, interval, plot_length)

    @staticmethod
    def _render_sync(df: pd.DataFrame, anomalies: List[Dict], ticker: str, interval: str, plot_length: int = 60) -> str:
        """
        Enhanced Rendering: Drawing Order Blocks (Boxes) and VSA Arrows.
        """
        try:
            plot_df = df.iloc[-plot_length:].copy()
            # Ensure canonical column names (Uppercase) for mplfinance and overlays
            plot_df.columns = [str(c).capitalize() for c in plot_df.columns]
            phase = VSAStructuralValidator.detect_market_phase(df)
            blocks = VSAStructuralValidator.detect_order_blocks(df)

            # 1. Setup VSA Plot Overlays (Arrows for VSA Triggers)
            add_plots = []
            
            # Map tags to markers (Arrows)
            # Find anomalies that match the current plot index
            def get_tags_for_date(date):
                for a in anomalies:
                    if a['date'] == date.strftime("%Y-%m-%d %H:%M"):
                        return a['tags']
                return []

            stop_vol = [float(df.loc[idx]['Low']) * 0.98 if any("STOP_VOL" in t for t in get_tags_for_date(idx)) else float('nan') 
                        for idx in plot_df.index]
            climax = [float(df.loc[idx]['High']) * 1.02 if any("CLIMAX" in t for t in get_tags_for_date(idx)) else float('nan') 
                      for idx in plot_df.index]
            no_dem_sup = [float(df.loc[idx]['Close']) for idx in plot_df.index]
            no_dem_mask = [p if any(t in ["NO_DEMAND", "NO_SUPPLY"] for t in get_tags_for_date(idx)) else float('nan') 
                           for idx, p in zip(plot_df.index, no_dem_sup)]
            
            if any(~pd.isna(stop_vol)):
                add_plots.append(mpf.make_addplot(stop_vol, type='scatter', marker='^', markersize=200, color='#3b82f6')) # Blue Up
            if any(~pd.isna(climax)):
                add_plots.append(mpf.make_addplot(climax, type='scatter', marker='v', markersize=200, color='#f59e0b')) # Orange Down
            if any(~pd.isna(no_dem_mask)):
                add_plots.append(mpf.make_addplot(no_dem_mask, type='scatter', marker='o', markersize=50, color='gray'))

            # 2. Render Base Chart
            mc = mpf.make_marketcolors(up='#10b981', down='#ef4444', edge='inherit', wick='inherit')
            s  = mpf.make_mpf_style(marketcolors=mc, gridstyle=':', y_on_right=True, facecolor='#ffffff')
            
            buf = io.BytesIO()
            fig, axlist = mpf.plot(
                plot_df, 
                type='candle', 
                style=s, 
                volume=True, 
                addplot=add_plots,
                title=f"{ticker} ({interval}) | Phase: {phase}",
                returnfig=True,
                figsize=(14, 10),
                tight_layout=True
            )
            
            # 3. Post-Process: Draw Order Block Rectangles manually on the axis
            ax = axlist[0]
            price_min = plot_df['Low'].min()
            price_max = plot_df['High'].max()
            
            for b in blocks:
                if b['price'] >= price_min and b['price'] <= price_max:
                    color = 'green' if b['type'] == "DEMAND" else 'red'
                    # Calculate position in units (index is 0 to plot_length-1)
                    rect = patches.Rectangle(
                        (0, b['price'] * 0.998), plot_length, b['price'] * 0.004,
                        linewidth=0, edgecolor='none', facecolor=color, alpha=0.1
                    )
                    ax.add_patch(rect)
            
            fig.savefig(buf, format='png', dpi=110)
            plt.close(fig)
            
            buf.seek(0)
            return base64.b64encode(buf.read()).decode('utf-8')
        except Exception as e:
            print(f"VSA v2 Rendering Error: {e}")
            plt.close('all')
            return ""
