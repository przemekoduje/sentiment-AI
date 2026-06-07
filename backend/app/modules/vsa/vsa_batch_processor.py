import asyncio
import os
from datetime import datetime
from app.modules.vsa.pipeline import VSAMacroPipeline

TOP_15_TICKERS = [
    "AAPL", "MSFT", "NVDA", "TSLA", "AMZN", 
    "GOOGL", "META", "BRK-B", "V", "UNH", 
    "LLY", "JPM", "JNJ", "XOM", "MA"
]

REPORTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "reports", "vsa_v2")

class VSABatchProcessor:
    """
    Phase 4: Automation & Reporting.
    Runs the VSA Pipeline for multiple tickers and generates Markdown audit trails.
    """
    
    @staticmethod
    async def run_audit():
        print(f">>> STARTING VSA v2.0 BATCH AUDIT (Institutional Lens) - {datetime.now()}")
        os.makedirs(REPORTS_DIR, exist_ok=True)
        
        tasks = [VSAMacroPipeline.process_instrument(ticker, force_refresh=True, limit_recent=False) for ticker in TOP_15_TICKERS]
        results = await asyncio.gather(*tasks)
        
        summary_file = os.path.join(REPORTS_DIR, "summary.md")
        with open(summary_file, "w", encoding="utf-8") as f:
            f.write(f"# VSA Auditor v2.0 - Batch Audit Summary\n")
            f.write(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n\n")
            f.write("| Ticker | Phase | Recommendation | R/R | Logic Guard / Veto Reasoning |\n")
            f.write("| :--- | :--- | :--- | :--- | :--- |\n")
            
            for res in results:
                if "error" in res:
                    f.write(f"| {res.get('ticker', '???')} | - | ERROR | - | {res['error']} |\n")
                    continue
                
                ticker = res['ticker']
                phase = res['phase']
                rec = res['recommendation']
                rr = res['trading_plan']['risk_reward'] if res['trading_plan'] else "-"
                reason = res['reasoning']
                
                f.write(f"| {ticker} | {phase} | **{rec}** | {rr} | {reason} |\n")
                
                # Generate individual report
                VSABatchProcessor._generate_individual_report(res)
        
        print(f">>> BATCH AUDIT COMPLETE. Reports saved in {REPORTS_DIR}")
        return summary_file

    @staticmethod
    def _generate_individual_report(res):
        ticker = res['ticker']
        report_path = os.path.join(REPORTS_DIR, f"{ticker}_audit.md")
        
        with open(report_path, "w", encoding="utf-8") as f:
            f.write(f"# VSA v2.0 Audit Trail: {ticker}\n\n")
            f.write(f"## 1. Quantitative Analysis (Effort vs. Result)\n")
            f.write(f"- **Phase Identified**: {res['phase']}\n")
            f.write(f"- **Relative Volume**: {res['vsa_metrics']['rel_vol']}\n")
            f.write(f"- **Relative Spread**: {res['vsa_metrics']['rel_spread']}\n")
            f.write(f"- **Closing Position**: {res['vsa_metrics']['close_pos']}\n\n")
            
            f.write(f"### Detected Anomalies (Institutional Footprint):\n")
            if res['anomalies']:
                for a in res['anomalies'][-5:]:
                    f.write(f"- {a['date']}: {', '.join(a['tags'])} (Price: ${a['price']})\n")
            else:
                f.write("- No significant anomalies detected.\n")
            
            f.write(f"\n## 2. Decision & Veto Logic\n")
            f.write(f"- **Final Recommendation**: **{res['recommendation']}**\n")
            f.write(f"- **Reasoning**: {res['reasoning']}\n\n")
            
            if res['trading_plan']:
                f.write(f"### Trading Plan (Wyckoff Optimized):\n")
                f.write(f"- **Entry**: ${res['trading_plan']['entry']}\n")
                f.write(f"- **Stop-Loss**: ${res['trading_plan']['stop_loss']}\n")
                f.write(f"- **Take-Profit**: ${res['trading_plan']['take_profit']}\n")
                f.write(f"- **Risk/Reward**: {res['trading_plan']['risk_reward']}\n")
            
            if res['chart_base64']:
                f.write(f"\n## 3. Annotated VSA Chart\n")
                f.write(f"![VSA Chart for {ticker}](data:image/png;base64,{res['chart_base64']})\n")

if __name__ == "__main__":
    asyncio.run(VSABatchProcessor.run_audit())
