import os
from openai import OpenAI
import json
from dotenv import load_dotenv

# Load ENV from backend/.env
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv(os.path.join(BASE_DIR, ".env"))

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def analyze_sentiment(text: str):
    """Legacy single-ticker analysis (kept for compatibility)."""
    return analyze_sentiment_batch([{"ticker": "UNKNOWN", "text": text}])[0]

def analyze_sentiment_batch(items: list):
    """
    Warstwa 2: GPT Batching (Selector Prompt).
    Analizuje do 20 spółek w jednym zapytaniu, co redukuje koszty o ~90%.
    """
    if not os.getenv("OPENAI_API_KEY"):
        return [{
            "ticker": item["ticker"],
            "label": "neutral",
            "score": 0.5,
            "reasoning": "OpenAI API Key Missing",
            "confidence": 0.0
        } for item in items]

    if not items: return []

    try:
        # Konstruujemy batch prompt
        prompt_content = "Analyze the sentiment of headlines for multiple companies. For each company, provide a sentiment score (0.0 to 1.0), a label (positive/negative/neutral), and a brief reasoning.\n\n"
        for i, item in enumerate(items):
            prompt_content += f"--- COMPANY {i+1}: {item['ticker']} ---\n{item['text']}\n\n"

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a financial analyst. Return ONLY a JSON object where keys are the ticker symbols provided, and values are objects with: label, score, reasoning, confidence."},
                {"role": "user", "content": prompt_content}
            ],
            response_format={"type": "json_object"}
        )
        
        raw_results = json.loads(response.choices[0].message.content)
        
        # Mapujemy wyniki z powrotem na listę w kolejności wejściowej
        final_results = []
        for item in items:
            ticker = item['ticker']
            res = raw_results.get(ticker, {
                "label": "neutral",
                "score": 0.5,
                "reasoning": "Missing from GPT response",
                "confidence": 0.0
            })
            res["ticker"] = ticker
            final_results.append(res)
            
        return final_results
    except Exception as e:
        print(f"!!! OpenAI Batch Sentiment Error: {e}")
        return [{
            "ticker": item["ticker"],
            "label": "neutral",
            "score": 0.5,
            "reasoning": f"AI Error: {str(e)}",
            "confidence": 0.0
        } for item in items]
