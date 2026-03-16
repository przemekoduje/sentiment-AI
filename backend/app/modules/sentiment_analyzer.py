from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

# Cache model and tokenizer
tokenizer = None
model = None

def get_model():
    global tokenizer, model
    if tokenizer is None or model is None:
        # FinBERT is the standard for financial sentiment analysis in this project
        model_name = "ProsusAI/finbert"
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModelForSequenceClassification.from_pretrained(model_name)
    return tokenizer, model

def analyze_sentiment(text: str):
    """
    Analyzes text and returns sentiment distribution and confidence.
    """
    tk, md = get_model()
    
    inputs = tk(text, return_tensors="pt", padding=True, truncation=True, max_length=512)
    
    with torch.no_grad():
        outputs = md(**inputs)
        
    probabilities = torch.nn.functional.softmax(outputs.logits, dim=-1)
    
    # FinBERT labels: 0: positive, 1: negative, 2: neutral
    labels = ["positive", "negative", "neutral"]
    scores = probabilities[0].tolist()
    
    sentiment_data = {labels[i]: scores[i] for i in range(len(labels))}
    
    # Determine dominant sentiment
    max_score = max(scores)
    prediction = labels[scores.index(max_score)]
    
    return {
        "label": prediction,
        "score": max_score,
        "distribution": sentiment_data
    }
