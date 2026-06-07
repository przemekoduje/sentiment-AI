import json
import asyncio
from .data_router import VSADataRouter
from .quant_engine import VSAQuantEngine
from .structural_validator import VSAStructuralValidator
from .decision_engine import VSADecisionEngine
from ...database import get_vsa_cache, save_vsa_cache
from ..sentiment_bridge import fetch_news_sentiment, aggregate_sentiment_score

class VSAMacroPipeline:
    """
    Orchestrator for VSA Auditor v2.0 (Institutional Lens).
    Implements the "Ultimate Confluence" Veto Logic.
    """
    
    @staticmethod
    async def process_instrument(ticker: str, interval: str = "1d", render_chart: bool = True, force_refresh: bool = False, limit_recent: bool = True, plot_length: int = 60):
        try:
            # 1. Data Retrieval
            df = await VSADataRouter.get_ohlcv(ticker, interval=interval)
            if df.empty:
                return {"error": f"No data available for {ticker}"}
            
            # Standardize columns: Force Capitalized (Open, High, Low, Close, Volume)
            df.columns = [str(c).capitalize() for c in df.columns]

            # 2. Stage 1: Quantitative Engine (Wyckoff Laws)
            df = VSAQuantEngine.calculate_metrics(df)
            anomalies = VSAQuantEngine.detect_anomalies(df, limit_recent=limit_recent)
            
            # 3. Stage 2: Structural Validation (Market Phase)
            df = VSAStructuralValidator.find_pivots(df)
            phase = VSAStructuralValidator.detect_market_phase(df)
            blocks = VSAStructuralValidator.detect_order_blocks(df)
            
            # Rendering (Annotated Base64)
            chart_base64 = ""
            if render_chart:
                chart_base64 = await VSAStructuralValidator.render_vsa_chart_base64(df, anomalies, ticker, interval, plot_length=plot_length)
            
            # 4. Stage 3: Decision Engine (Logic Guard)
            decision = VSADecisionEngine.generate_recommendation(df, anomalies, blocks)
            
            # 4b. Bible Validation (Phase 16)
            from .bible_validator import BibleGuard
            
            # CRITICAL: Validate the *anomaly bar* metrics, not just the latest bar.
            # Otherwise we get LOGIC_ERROR when latest bar metrics don't match the past anomaly tags.
            if anomalies:
                latest_anomaly = anomalies[-1]
                latest_tags = latest_anomaly.get('tags', [])
                metrics_data = latest_anomaly.get('metrics', {})
                # Pass the metrics collected at the specific anomaly bar
                latest_metrics = {
                    "spread_relative": metrics_data.get('spread_cat', 'AVERAGE'),
                    "volume_relative": metrics_data.get('vol_cat', 'AVERAGE'),
                    "close_position": latest_anomaly.get('price', 0) # Fallback if close_pos missing
                }
                # If close_pos is available in metrics, use it
                if 'close_pos' in metrics_data:
                    latest_metrics["close_position"] = metrics_data['close_pos']
                elif 'close_cat' in metrics_data:
                    # Map category back to float for BibleGuard if needed, 
                    # but BibleGuard mainly uses close_v as float.
                    # In QuantEngine, anomalie dictionary DOES have rel_vol/rel_spread.
                    pass
            else:
                latest_tags = []
                latest_metrics = {}

            is_valid, bible_error = BibleGuard.validate_logic(decision['action'], latest_tags, latest_metrics)
            
            if not is_valid:
                final_action = "LOGIC_ERROR"
                final_reasoning = bible_error
            else:
                # 5. The Ultimate Confluence: Veto Logic (Sentiment vs. VSA)
                # Fetch sentiment if we have a potential trade
                final_action = decision['action']
                final_reasoning = decision['reasoning']
                
                if final_action != "HOLD":
                    news = await fetch_news_sentiment(ticker)
                    sent = aggregate_sentiment_score(news, ticker)
                    sent_label = sent['label'] # 'positive', 'negative', 'neutral'
                    
                    vsa_tags = latest_tags
                    
                    # VETO Case A: Sentiment is POSITIVE, but VSA shows Distribution/Climax
                    if sent_label == 'positive' and any(t in ["BUYING_CLIMAX", "THIN_BOOK_TRAP"] for t in vsa_tags):
                        final_action = "VETO (DISTRIBUTION)"
                        final_reasoning = f"VETO: Sentiment is BULLISH, but VSA detects Institutional Distribution ({', '.join(vsa_tags)}). SMART MONEY IS EXITING."
                    
                    # VETO Case B: Sentiment is NEGATIVE, but VSA shows Accumulation/Absorption
                    if sent_label == 'negative' and any(t in ["STOP_VOL_ABSORPTION", "EFFORT_RESULT_DISSONANCE"] for t in vsa_tags):
                        final_action = "VETO (ACCUMULATION)"
                        final_reasoning = f"VETO: Sentiment is BEARISH, but VSA detects Institutional Absorption ({', '.join(vsa_tags)}). SMART MONEY IS ACCUMULATING."

            # 6. Final Assembly
            # Calculate Change %
            current_price = float(df['Close'].iloc[-1])
            prev_price = float(df['Close'].iloc[-2]) if len(df) > 1 else current_price
            change_pct = ((current_price - prev_price) / prev_price) * 100

            # Format OHLCV for lightweight-charts
            ohlcv_list = []
            for idx, row in df.iterrows():
                ohlcv_list.append({
                    "time": idx.strftime("%Y-%m-%d"),
                    "open": float(row['Open']),
                    "high": float(row['High']),
                    "low": float(row['Low']),
                    "close": float(row['Close']),
                    "volume": float(row['Volume']),
                    "vol_sma20": float(row['Vol_SMA20']) if 'Vol_SMA20' in row else None
                })

            result = {
                "ticker": ticker,
                "interval": interval,
                "phase": phase,
                "recommendation": final_action,
                "reasoning": final_reasoning,
                "trading_plan": decision['plan'] if "VETO" not in final_action else None,
                "vsa_metrics": {
                    "rel_vol": round(float(df['Rel_Vol'].iloc[-1]), 2),
                    "rel_spread": round(float(df['Rel_Spread'].iloc[-1]), 2),
                    "close_pos": round(float(df['Close_Pos'].iloc[-1]), 2),
                    "current_price": round(current_price, 2),
                    "change_pct": round(change_pct, 2)
                },
                "anomalies": anomalies[-20:] if limit_recent else anomalies,
                "ohlcv": ohlcv_list,
                "chart_base64": chart_base64,
                "is_audit": not limit_recent
            }

            return result
            
        except Exception as e:
            return {"error": str(e)}
