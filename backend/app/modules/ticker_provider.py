import pandas as pd
import httpx

class TickerProvider:
    """Provides a list of stock tickers (S&P 500)."""
    
    @staticmethod
    def get_sp500_tickers():
        """Fetches S&P 500 tickers from Wikipedia."""
        try:
            url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
            headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
            tables = pd.read_html(url, storage_options=headers)
            df = tables[0]
            tickers = df['Symbol'].tolist()
            # Clean tickers (replace dots with dashes for yfinance compatibility)
            return [t.replace('.', '-') for t in tickers]
        except Exception as e:
            print(f"Error fetching symbols: {e}")
            # Fallback to top 10 if Wikipedia fails
            return ["AAPL", "MSFT", "AMZN", "GOOGL", "META", "TSLA", "BRK-B", "UNH", "JNJ", "V"]

if __name__ == "__main__":
    tickers = TickerProvider.get_sp500_tickers()
    print(f"Fetched {len(tickers)} tickers. Top 5: {tickers[:5]}")
