import os
import json
from datetime import datetime, timedelta
from typing import Optional, List
from sqlmodel import Field, SQLModel, create_engine, Session, select
from dotenv import load_dotenv

# Load env
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
load_dotenv(dotenv_path=env_path)

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL.replace("+asyncpg", "") if DATABASE_URL else "sqlite:///fallback.db")

class TradeSignal(SQLModel, table=True):
    __tablename__ = "trade_signals_v2"
    id: Optional[int] = Field(default=None, primary_key=True)
    ticker: str = Field(index=True)
    action: str  # BUY, SELL, HOLD, SKIP
    confidence: float
    reasoning: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    status: str = Field(default="PENDING")  # PENDING, EXECUTED, CANCELLED
    market_context: Optional[str] = None
    vsa_macro_bias: Optional[str] = None
    vsa_reasoning: Optional[str] = None
    # For compatibility:
    price: Optional[float] = None
    kelly_fraction: Optional[float] = None

class VSACacheModel(SQLModel, table=True):
    __tablename__ = "vsa_analysis_cache"
    ticker: str = Field(primary_key=True)
    interval: str
    recommendation: str
    reasoning: str
    trading_plan: Optional[str] = None 
    vsa_metrics: Optional[str] = None 
    anomalies: Optional[str] = None 
    deep_analysis: Optional[str] = None
    ohlcv: Optional[str] = None
    chart_base64: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class Position(SQLModel, table=True):
    __tablename__ = "active_positions"
    id: Optional[int] = Field(default=None, primary_key=True)
    ticker: str = Field(index=True, unique=True)
    qty: int
    entry_price: float
    entry_time: datetime = Field(default_factory=datetime.utcnow)
    sl: float
    tp: float
    is_active: bool = Field(default=True)

class PortfolioSettings(SQLModel, table=True):
    __tablename__ = "portfolio_settings"
    id: int = Field(default=1, primary_key=True)
    current_cash: float = Field(default=10000.0)
    initial_capital: float = Field(default=10000.0)
    risk_per_trade: float = Field(default=0.02)
    auto_pilot_enabled: bool = Field(default=False)

class TradeLog(SQLModel, table=True):
    __tablename__ = "trade_history"
    id: Optional[int] = Field(default=None, primary_key=True)
    ticker: str
    entry_time: datetime
    exit_time: datetime = Field(default_factory=datetime.utcnow)
    entry_price: float
    exit_price: float
    qty: int
    pnl: float
    pnl_pct: float
    reason: str
    sl: float
    tp: float

def init_db():
    SQLModel.metadata.create_all(engine)
    print(">>> Database sync: Tables verified/created.")

create_db_and_tables = init_db # Backward compatibility

def save_signal(signal: TradeSignal):
    with Session(engine) as session:
        session.add(signal)
        session.commit()
        session.refresh(signal)
        return signal.id

def get_signal_by_id(signal_id: int) -> Optional[TradeSignal]:
    with Session(engine) as session:
        return session.get(TradeSignal, signal_id)

def get_latest_signals(limit: int = 50) -> List[TradeSignal]:
    with Session(engine) as session:
        statement = select(TradeSignal).order_by(TradeSignal.timestamp.desc()).limit(limit)
        return session.exec(statement).all()

def get_portfolio_settings() -> PortfolioSettings:
    with Session(engine) as session:
        settings = session.get(PortfolioSettings, 1)
        if not settings:
            settings = PortfolioSettings(id=1, current_cash=10000.0, auto_pilot_enabled=False)
            session.add(settings)
            session.commit()
            session.refresh(settings)
        return settings

def update_portfolio_settings(
    cash: Optional[float] = None, 
    auto_pilot: Optional[bool] = None,
    risk_per_trade: Optional[float] = None,
    initial_capital: Optional[float] = None
):
    with Session(engine) as session:
        settings = session.get(PortfolioSettings, 1)
        if not settings:
            settings = PortfolioSettings(id=1)
            session.add(settings)
        if cash is not None:
            settings.current_cash = cash
        if auto_pilot is not None:
            settings.auto_pilot_enabled = auto_pilot
        if risk_per_trade is not None:
            settings.risk_per_trade = risk_per_trade
        if initial_capital is not None:
            settings.initial_capital = initial_capital
        session.add(settings)
        session.commit()
        session.refresh(settings)
        return settings

def get_active_positions() -> List[Position]:
    with Session(engine) as session:
        statement = select(Position).where(Position.is_active == True)
        return session.exec(statement).all()

def get_trade_history(limit: int = 50) -> List[TradeLog]:
    with Session(engine) as session:
        statement = select(TradeLog).order_by(TradeLog.exit_time.desc()).limit(limit)
        return session.exec(statement).all()

# VSA Cache Helpers
def _safe_json_load(data):
    if not data: return None
    if isinstance(data, (dict, list)): return data
    try:
        return json.loads(data)
    except:
        return data

def get_vsa_cache(ticker: str) -> Optional[dict]:
    with Session(engine) as session:
        cache = session.get(VSACacheModel, ticker)
        # Increase TTL for base cache to 12h, main.py will handle daily deep analysis logic
        if cache and datetime.utcnow() - cache.timestamp < timedelta(hours=12):
            return {
                "ticker": cache.ticker, "interval": cache.interval,
                "recommendation": cache.recommendation, "reasoning": cache.reasoning,
                "trading_plan": _safe_json_load(cache.trading_plan),
                "vsa_metrics": _safe_json_load(cache.vsa_metrics),
                "anomalies": _safe_json_load(cache.anomalies),
                "deep_analysis": cache.deep_analysis,
                "ohlcv": _safe_json_load(cache.ohlcv),
                "chart_base64": cache.chart_base64, 
                "timestamp": cache.timestamp,
                "cached": True
            }
    return None

def save_vsa_cache(data: dict):
    with Session(engine) as session:
        cache = session.get(VSACacheModel, data['ticker'])
        if not cache: cache = VSACacheModel(ticker=data['ticker'])
        cache.interval = data.get('interval', '1d')
        cache.recommendation = data.get('recommendation', 'HOLD')
        cache.reasoning = data.get('reasoning', '')
        
        # Determine if we should dump to string or pass as is
        # If the DB column is JSON, we should pass dict. If it's TEXT, we should pass string.
        # Given our migration created JSON columns, let's try passing dicts first.
        # But for SQLite fallback it might need strings. Let's use strings to be safe if model says Optional[str].
        tp = data.get('trading_plan')
        cache.trading_plan = json.dumps(tp) if isinstance(tp, (dict, list)) else tp
        
        vm = data.get('vsa_metrics')
        cache.vsa_metrics = json.dumps(vm) if isinstance(vm, (dict, list)) else vm
        
        anom = data.get('anomalies')
        cache.anomalies = json.dumps(anom) if isinstance(anom, (dict, list)) else anom
        
        # New fields
        if 'deep_analysis' in data and data['deep_analysis']:
            cache.deep_analysis = data['deep_analysis']
        
        ohlcv = data.get('ohlcv')
        if ohlcv:
            cache.ohlcv = json.dumps(ohlcv) if isinstance(ohlcv, (dict, list)) else ohlcv
            
        cache.chart_base64 = data.get('chart_base64', '')
        cache.timestamp = datetime.utcnow()
        session.add(cache)
        session.commit()
