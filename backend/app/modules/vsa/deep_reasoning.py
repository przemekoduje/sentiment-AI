import os
from openai import OpenAI
import json
from datetime import datetime

class VSADeepReasoningEngine:
    """
    Stage 4: Deep Descriptive Reasoning (Institutional Polish Analysis).
    Generates a detailed 3-stage analysis based on VSA metrics and structure.
    """
    
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    def generate_polish_analysis(self, ticker, metrics, anomalies, phase, blocks):
        """
        Uses GPT-4o-mini to generate a structural VSA analysis in Polish.
        """
        if not os.getenv("OPENAI_API_KEY"):
            return "Błąd: Brak klucza API OpenAI."

        # Phase 16: Bible Injection (Ingest Ground Truth)
        from .bible_validator import BibleGuard
        bible_content = BibleGuard.get_bible_content()

        # Prepare context for the LLM
        context = {
            "ticker": ticker,
            "metrics": metrics,
            "anomalies": anomalies[-5:], # focus on latest
            "phase": phase,
            "blocks": blocks,
            "current_date": datetime.now().strftime("%Y-%m-%d")
        }

        # Strictly defined logic for the LLM to prevent hallucinations/misinterpretation
        system_rules = """
        Jesteś silnikiem analitycznym VSA (Volume Spread Analysis) w systemie Strategic Command. 
        TWOJE ZASADY (KRYTYCZNE):
        1. ZAKAZ używania znaków '#' i innych symboli formatowania markdown. Opis ma być czystym tekstem profesjonalnym.
        2. NO-INTRO: Zaczynasz bezpośrednio od analizy technicznej. Żadnych powitań ("Cześć", "Oto analiza").
        3. MATEMATYKA TERCYLI: 
           - Close Position (Tercyl) 0.00-0.33 = SŁABOŚĆ (SOW - Sign of Weakness). Zamknięcie w dolnej części świecy.
           - Close Position (Tercyl) 0.67-1.00 = SIŁA (SOS - Sign of Strength). Zamknięcie w górnej części świecy.
        4. MANDAT DWUKIERUNKOWY: System działa w obie strony. Szukamy okazji do pozycji KRÓTKICH (Short) z taką samą intensywnością jak DŁUGICH (Long). Analiza musi uwzględniać oba scenariusze.
        """
        prompt = f"""
        Jesteś ekspertem Volume Spread Analysis (VSA) działającym ściśle według dostarczonej "Biblii VSA".
        Twoim zadaniem jest przeprowadzenie rygorystycznej analizy mikrostruktury dla instrumentu {ticker}.
        
        DANY KONTEKST (BIBLIA VSA):
        {bible_content[:5000]}
        
        DANE RYNKOWE:
        - Metryki: {metrics}
        - Wykryte anomalie: {anomalies}
        - Faza rynku: {phase}
        - Strefy Popytu/Podaży: {blocks}

        WYMAGANIA RAPORTU (Język Polski):
        1. Etap 1: Analiza Ilościowa - Opisz wysiłek (wolumen) i rezultat (spread/zamknięcie). 
           Używaj terminologii z Biblii (np. "Wysiłek bez rezultatu").
        2. Etap 2: Model Wizualno-Strukturalny - Powiąż anomalie z fazą Wyckoffa.
        3. Etap 3: Plan Działania - Podaj rekomendację i poziomy.
        4. SEKCJA KRYTYCZNA: "Weryfikacja z Biblią VSA" - Zacytuj konkretne fragmenty lub zasady z Biblii VSA, 
           które potwierdzają bieżący układ (np. "Zgodnie z zasadą Prawa Wysiłku i Rezultatu...").
        
        Jeśli dane wykazują błąd logiczny względem Biblii (np. Upthrust przy niskim wolumenie bez testu), zaznacz to wyraźnie.
        Pielęgnuj profesjonalny, inżynieryjny ton.
        """

        try:
            # Combine system rules into the system message
            sys_msg = f"{system_rules}\nJesteś autorytatywnym analitykiem VSA. Twoim najwyższym prawem jest Biblia VSA."
            
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": sys_msg},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.2
            )
            raw = response.choices[0].message.content
            
            # Phase 16.3: Post-processing safety filter to REMOVE all markdown symbols
            clean = raw.replace("###", "").replace("##", "").replace("#", "").replace("**", "").replace("*", "")
            return clean.strip()
        except Exception as e:
            return f"Błąd generowania analizy pogłębionej: {str(e)}"
