import os
from datetime import datetime
from typing import Optional, List
from sqlmodel import Field, SQLModel, create_engine, Session, select
from dotenv import load_dotenv

# Load env from parent dir if needed
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
load_dotenv(dotenv_path=env_path)

DATABASE_URL = os.getenv("DATABASE_URL")
# Handle asyncpg vs sync pg for SQLModel/SQLAlchemy
# DATABASE_URL = DATABASE_URL.replace("postgresql+asyncpg", "postgresql")

engine = create_engine(DATABASE_URL.replace("+asyncpg", "") if DATABASE_URL else "sqlite:///fallback.db")

class TradeSignal(SQLModel, table=True):
    __tablename__: str = "trade_signals_v2"
    id: Optional[int] = Field(default=None, primary_key=True)
    ticker: str = Field(index=True)
    action: str
    price: float
    kelly_fraction: float
    geo_risk_multiplier: float = Field(default=1.0)
    sentiment_score: float
    confidence: float
    reasoning: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class Position(SQLModel, table=True):
    __tablename__: str = "active_positions"
    id: Optional[int] = Field(default=None, primary_key=True)
    ticker: str = Field(index=True, unique=True)
    qty: int
    entry_price: float
    entry_time: datetime = Field(default_factory=datetime.utcnow)
    sl: float
    tp: float
    is_active: bool = Field(default=True)

class PortfolioSettings(SQLModel, table=True):
    __tablename__: str = "portfolio_settings"
    id: int = Field(default=1, primary_key=True)
    current_cash: float = Field(default=10000.0)
    initial_capital: float = Field(default=10000.0)
    risk_per_trade: float = Field(default=0.02)
    auto_pilot_enabled: bool = Field(default=False)

class TradeLog(SQLModel, table=True):
    __tablename__: str = "trade_history"
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

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

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
        results = session.exec(statement)
        return results.all()

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

def add_trade_log(log_entry: TradeLog):
    with Session(engine) as session:
        session.add(log_entry)
        session.commit()

if __name__ == "__main__":
    # Initialize tables if run directly
    create_db_and_tables()
    print("Database tables created successfully (PostgreSQL/Supabase).")
