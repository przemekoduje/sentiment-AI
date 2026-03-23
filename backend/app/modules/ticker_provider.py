import pandas as pd
import httpx

class TickerProvider:
    """Provides a list of stock tickers (S&P 500)."""
    
    @staticmethod
    def get_sp500_tickers():
        """Fetches S&P 500 tickers from Wikipedia with robust error handling."""
        try:
            url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
            headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
            tables = pd.read_html(url, storage_options=headers)
            df = tables[0]
            tickers = df['Symbol'].tolist()
            # Clean tickers (replace dots with dashes for yfinance compatibility)
            valid_tickers = [t.replace('.', '-') for t in tickers if isinstance(t, str)]
            print(f">>> TickerProvider: Successfully fetched {len(valid_tickers)} S&P 500 tickers.")
            return valid_tickers
        except Exception as e:
            print(f"!!! Error fetching symbols from Wikipedia: {e}. Using fallback list.")
            # Solid fallback of high-caps
            return ["AAPL", "MSFT", "AMZN", "GOOGL", "META", "TSLA", "BRK-B", "UNH", "JNJ", "V", "WMT", "MA", "PG", "COST"]

    @staticmethod
    def get_nasdaq100_tickers():
        """Fetches NASDAQ 100 tickers."""
        # Top 20 for performance/free-tier focus
        return ["AAPL", "MSFT", "AMZN", "NVDA", "GOOGL", "GOOG", "META", "TSLA", "AVGO", "PEP", "COST", "ADBE", "CSCO", "NFLX", "AMD", "INTC", "TMUS", "CMCSA", "AMGN", "TXN"]

    @staticmethod
    def get_crypto_tickers():
        """Top crypto pairs (Yahoo Finance format)."""
        return ["BTC-USD", "ETH-USD", "SOL-USD", "BNB-USD", "XRP-USD", "ADA-USD", "AVAX-USD", "DOT-USD", "LINK-USD", "MATIC-USD"]

    @staticmethod
    def get_wig20_tickers():
        """Top Polish WIG20 companies (Yahoo Finance format)."""
        return ["PKO.WA", "PKN.WA", "ALE.WA", "PEO.WA", "PZU.WA", "DNP.WA", "LPP.WA", "KGH.WA", "CDR.WA", "SPL.WA"]

    @classmethod
    def get_tickers_by_market(cls, market: str):
        market = market.upper()
        if market == "NASDAQ": return cls.get_nasdaq100_tickers()
        if market == "CRYPTO": return cls.get_crypto_tickers()
        if market == "POLAND": return cls.get_wig20_tickers()
        return cls.get_sp500_tickers()

if __name__ == "__main__":
    print(f"S&P 500: {TickerProvider.get_sp500_tickers()[:5]}")
    print(f"Crypto: {TickerProvider.get_crypto_tickers()[:5]}")

