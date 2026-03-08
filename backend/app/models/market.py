"""Market data models."""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class OrderbookLevel(BaseModel):
    """Single level in the orderbook."""
    level: int
    price: float
    size: float


class OrderbookData(BaseModel):
    """Orderbook data for a token."""
    token_id: str
    bids: List[OrderbookLevel]
    asks: List[OrderbookLevel]
    last_trade_price: Optional[float] = None
    tick_size: Optional[float] = None
    min_order_size: Optional[float] = None


class PriceHistoryPoint(BaseModel):
    """Single point in price history."""
    t: datetime
    price: float


class MarketStats(BaseModel):
    """Comprehensive market statistics."""
    market_id: str
    snapshot_ts: datetime
    title: Optional[str] = None
    category: Optional[str] = None
    
    # Token IDs
    yes_token_id: Optional[str] = None
    no_token_id: Optional[str] = None
    
    # Prices
    yes_price: Optional[float] = None
    no_price: Optional[float] = None
    ui_yes_price: Optional[float] = None
    ui_no_price: Optional[float] = None
    
    # Orderbook
    best_ask_yes: Optional[float] = None
    best_bid_yes: Optional[float] = None
    best_ask_no: Optional[float] = None
    best_bid_no: Optional[float] = None
    
    # Volume & Liquidity
    volume: Optional[float] = None
    volume_clob: Optional[float] = None
    liquidity: Optional[float] = None
    liquidity_clob: Optional[float] = None
    
    # Market info
    spread: Optional[float] = None
    active: Optional[bool] = None
    closed: Optional[bool] = None
    
    # Analytics
    volatility_1w: Optional[float] = None
    sentiment_momentum: Optional[float] = None
    orderbook_imbalance: Optional[float] = None
    
    # Trading signals
    trade_signal: Optional[str] = None
    fair_value: Optional[float] = None
    expected_value: Optional[float] = None
    kelly_fraction: Optional[float] = None
    
    # Risk metrics
    degen_risk: Optional[float] = None
    late_overconfidence: Optional[bool] = None
    slippage_notional_1k: Optional[float] = None
    slippage_notional_10k: Optional[float] = None
    
    # Predictive Strength Scoring
    predictive_strength_score: Optional[float] = None
    score_category: Optional[str] = None


class MarketListItem(BaseModel):
    """Simplified market item for list views."""
    market_id: str
    title: str
    category: Optional[str] = None
    yes_price: Optional[float] = None
    no_price: Optional[float] = None
    volume: Optional[float] = None
    liquidity: Optional[float] = None
    trade_signal: Optional[str] = None
    degen_risk: Optional[float] = None
    predictive_strength_score: Optional[float] = None
    score_category: Optional[str] = None
    snapshot_ts: datetime


class MarketFilter(BaseModel):
    """Filters for market queries."""
    category: Optional[str] = None
    min_liquidity: Optional[float] = None
    max_liquidity: Optional[float] = None
    min_volume: Optional[float] = None
    max_volume: Optional[float] = None
    trade_signal: Optional[str] = None
    active_only: bool = True
    limit: int = Field(default=50, le=500)
    offset: int = Field(default=0, ge=0)


class ExtractRequest(BaseModel):
    """Request to extract data from a Polymarket URL."""
    url: str
    depth: int = Field(default=10, ge=1, le=50)
    intervals: List[str] = Field(default=["1w", "1m"])
    fidelity_min: int = Field(default=60, ge=1)
    base_rate: float = Field(default=0.50, ge=0.0, le=1.0)


class ExtractResponse(BaseModel):
    """Response from market extraction."""
    success: bool
    markets_processed: int
    message: str
    market_ids: List[str]
