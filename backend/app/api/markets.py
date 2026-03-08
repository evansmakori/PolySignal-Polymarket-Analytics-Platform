"""Market API endpoints."""
import json
from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from typing import List, Dict, Any, Optional

from ..models.market import (
    MarketListItem,
    MarketStats,
    MarketFilter,
    ExtractRequest,
    ExtractResponse,
)
from ..services.market_service import MarketService
from ..core.extractor import extract_from_url

router = APIRouter(prefix="/markets", tags=["markets"])


@router.get("/", response_model=List[Dict[str, Any]])
async def list_markets(
    category: str = None,
    min_liquidity: float = None,
    max_liquidity: float = None,
    min_volume: float = None,
    max_volume: float = None,
    trade_signal: str = None,
    active_only: bool = True,
    limit: int = 50,
    offset: int = 0,
):
    """
    List markets with optional filters.

    - **category**: Filter by category
    - **min_liquidity**: Minimum liquidity
    - **max_liquidity**: Maximum liquidity
    - **min_volume**: Minimum volume
    - **max_volume**: Maximum volume
    - **trade_signal**: Filter by trading signal (long/short/no-trade)
    - **active_only**: Show only active markets (default: true)
    - **limit**: Maximum number of results (default: 50, max: 500)
    - **offset**: Pagination offset (default: 0)
    """
    filters = MarketFilter(
        category=category,
        min_liquidity=min_liquidity,
        max_liquidity=max_liquidity,
        min_volume=min_volume,
        max_volume=max_volume,
        trade_signal=trade_signal,
        active_only=active_only,
        limit=min(limit, 500),
        offset=offset,
    )
    return await MarketService.get_markets(filters)


@router.get("/categories", response_model=List[str])
async def get_categories():
    """Get list of all unique market categories."""
    return await MarketService.get_categories()


@router.get("/count", response_model=Dict[str, int])
async def get_market_count():
    """Get total number of unique markets in database."""
    count = await MarketService.get_market_count()
    return {"count": count}


# Track background extraction jobs
_extraction_jobs: Dict[str, Dict[str, Any]] = {}


@router.post("/extract", response_model=Dict[str, Any])
async def extract_market_data(
    request: ExtractRequest,
    background_tasks: BackgroundTasks,
):
    """
    Extract market data from a Polymarket URL.

    Runs extraction in the background and returns a job ID immediately.
    Poll /api/markets/extract/status/{job_id} to check progress.

    - **url**: Polymarket event or market URL
    - **depth**: Orderbook depth per side (default: 10)
    - **fidelity_min**: Price history fidelity in minutes (default: 60)
    - **base_rate**: Base rate for fair value calculation (default: 0.50)
    """
    import uuid
    from ..core.polymarket import resolve_markets_from_url

    # Quick validation — resolve URL synchronously first (fast, just one API call)
    try:
        markets, event_obj = resolve_markets_from_url(request.url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not markets:
        raise HTTPException(status_code=400, detail="No markets found at this URL")

    job_id = str(uuid.uuid4())[:8]
    _extraction_jobs[job_id] = {
        "status": "running",
        "url": request.url,
        "markets_found": len(markets),
        "market_ids": [],
        "error": None,
    }

    async def run_extraction():
        try:
            # Pass pre-resolved markets to avoid a second blocking API call
            result = await extract_from_url(
                url=(markets, event_obj),
                depth=request.depth,
                intervals=request.intervals,
                fidelity_min=request.fidelity_min,
                base_rate=request.base_rate,
            )
            _extraction_jobs[job_id]["status"] = "done"
            _extraction_jobs[job_id]["market_ids"] = result.get("market_ids", [])
            _extraction_jobs[job_id]["markets_processed"] = result.get("markets_processed", 0)
        except Exception as e:
            _extraction_jobs[job_id]["status"] = "error"
            _extraction_jobs[job_id]["error"] = str(e)

    background_tasks.add_task(run_extraction)

    return {
        "success": True,
        "job_id": job_id,
        "status": "running",
        "markets_found": len(markets),
        "message": f"Extracting {len(markets)} market(s) in background. Use job_id to poll status.",
        "market_ids": [str(m.get("id") or m.get("conditionId") or "") for m in markets],
    }


@router.get("/extract/status/{job_id}", response_model=Dict[str, Any])
async def get_extraction_status(job_id: str):
    """Poll the status of a background extraction job."""
    job = _extraction_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/ranked", response_model=List[Dict[str, Any]])
async def get_ranked_markets(
    category: Optional[str] = None,
    min_liquidity: Optional[float] = None,
    max_liquidity: Optional[float] = None,
    min_volume: Optional[float] = None,
    max_volume: Optional[float] = None,
    trade_signal: Optional[str] = None,
    active_only: bool = True,
    limit: int = 50,
    offset: int = 0,
):
    """
    Get markets ranked by predictive strength score.

    Returns markets sorted by their predictive strength score (highest first).
    Each market includes:
    - predictive_strength_score: Score from 0-100
    - score_category: Strong Buy / Moderate Opportunity / Neutral/Watchlist / Weak/Avoid
    - rank: Overall ranking position
    - score_breakdown: Detailed breakdown of normalized and weighted components

    Scoring is based on:
    - Expected Value (30%)
    - Kelly Fraction (20%)
    - Liquidity Score (15%)
    - Volatility (10%)
    - Orderbook Imbalance (10%)
    - Spread (5%)
    - Sentiment Momentum (10%)
    """
    filters = MarketFilter(
        category=category,
        min_liquidity=min_liquidity,
        max_liquidity=max_liquidity,
        min_volume=min_volume,
        max_volume=max_volume,
        trade_signal=trade_signal,
        active_only=active_only,
        limit=min(limit, 500),
        offset=offset,
    )
    return await MarketService.get_ranked_markets(filters)


@router.get("/opportunities", response_model=List[Dict[str, Any]])
async def get_top_opportunities(
    limit: int = Query(default=20, le=100),
    min_score: float = Query(default=60.0, ge=0, le=100),
    active_only: bool = True,
):
    """
    Get top market opportunities based on predictive strength score.

    - **limit**: Maximum number of opportunities to return (default: 20, max: 100)
    - **min_score**: Minimum predictive strength score (default: 60.0)
    - **active_only**: Show only active markets (default: true)
    """
    return await MarketService.get_top_opportunities(
        limit=limit,
        min_score=min_score,
        active_only=active_only,
    )


@router.get("/analytics/improving", response_model=List[Dict[str, Any]])
async def get_improving_markets(
    days: int = Query(default=7, ge=1, le=30),
    limit: int = Query(default=10, ge=1, le=50),
):
    """
    Get markets with the best score improvements.

    - **days**: Number of days to analyze (default: 7, max: 30)
    - **limit**: Maximum number of markets to return (default: 10, max: 50)
    """
    from ..core.score_history import get_top_improving_markets
    return await get_top_improving_markets(days=days, limit=limit)


@router.get("/alerts", response_model=List[Dict[str, Any]])
async def get_alerts(
    min_score: float = Query(default=70.0, ge=0, le=100),
    score_increase_threshold: float = Query(default=15.0, ge=0),
    alert_type: Optional[str] = None,
    priority: Optional[str] = None,
    category: Optional[str] = None,
):
    """
    Get current market alerts.

    - **min_score**: Minimum score for high-score alerts (default: 70)
    - **score_increase_threshold**: Min score increase for alerts (default: 15)
    - **alert_type**: Filter by type (high_score, score_increase, score_decrease, new_opportunity)
    - **priority**: Filter by priority (critical, high, medium, low)
    - **category**: Filter by market category
    """
    from ..core.alerts import get_all_alerts, filter_alerts, AlertConfig, AlertType, AlertPriority

    config = AlertConfig(
        min_score=min_score,
        score_increase_threshold=score_increase_threshold,
    )

    alerts = await get_all_alerts(config)

    if alert_type or priority or category:
        alert_type_enum = AlertType(alert_type) if alert_type else None
        priority_enum = AlertPriority(priority) if priority else None
        alerts = filter_alerts(
            alerts,
            alert_type=alert_type_enum,
            min_priority=priority_enum,
            category=category,
        )

    return alerts


@router.get("/event/compare", response_model=List[Dict[str, Any]])
async def compare_event_markets(
    market_ids: str = Query(..., description="Comma-separated list of market IDs"),
):
    """
    Compare multiple markets from the same event.
    
    Returns a list of markets with comprehensive metrics sorted by predictive score descending.
    
    - **market_ids**: Comma-separated market IDs (max 20)
    """
    from ..core.scoring import calculate_market_score
    
    # Parse and validate market IDs
    ids = [mid.strip() for mid in market_ids.split(',') if mid.strip()]
    
    if not ids:
        raise HTTPException(status_code=400, detail="No market_ids provided")
    if len(ids) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 market_ids allowed")
    
    # Fetch each market
    markets_data = []
    for market_id in ids:
        market = await MarketService.get_market_by_id(market_id)
        if market:
            score_result = calculate_market_score(market)
            markets_data.append({
                "market_id": market.get("market_id"),
                "title": market.get("title"),
                "yes_price": market.get("yes_price"),
                "no_price": market.get("no_price"),
                "volume_24h": market.get("volume_24h"),
                "liquidity": market.get("liquidity"),
                "expected_value": market.get("expected_value"),
                "kelly_fraction": market.get("kelly_fraction"),
                "trade_signal": market.get("trade_signal"),
                "predictive_score": score_result["score"],
                "score_category": score_result["category"],
                "spread": market.get("spread"),
                "volatility": market.get("volatility"),
                "orderbook_imbalance": market.get("orderbook_imbalance"),
            })
    
    # Sort by predictive_score descending
    markets_data.sort(key=lambda x: x["predictive_score"], reverse=True)
    
    return markets_data


@router.get("/event/summary", response_model=Dict[str, Any])
async def get_event_summary(
    market_ids: str = Query(..., description="Comma-separated list of market IDs"),
):
    """
    Get summary comparison for multiple markets from the same event.
    
    Returns aggregate metrics and top opportunities.
    
    - **market_ids**: Comma-separated market IDs (max 20)
    """
    from ..core.scoring import calculate_market_score
    
    # Parse and validate market IDs
    ids = [mid.strip() for mid in market_ids.split(',') if mid.strip()]
    
    if not ids:
        raise HTTPException(status_code=400, detail="No market_ids provided")
    if len(ids) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 market_ids allowed")
    
    # Fetch each market
    markets_data = []
    total_liquidity = 0
    scores = []
    
    for market_id in ids:
        market = await MarketService.get_market_by_id(market_id)
        if market:
            score_result = calculate_market_score(market)
            market_info = {
                "market_id": market.get("market_id"),
                "title": market.get("title"),
                "yes_price": market.get("yes_price"),
                "no_price": market.get("no_price"),
                "volume_24h": market.get("volume_24h"),
                "liquidity": market.get("liquidity"),
                "expected_value": market.get("expected_value"),
                "kelly_fraction": market.get("kelly_fraction"),
                "trade_signal": market.get("trade_signal"),
                "predictive_score": score_result["score"],
                "score_category": score_result["category"],
                "spread": market.get("spread"),
                "volatility": market.get("volatility"),
                "orderbook_imbalance": market.get("orderbook_imbalance"),
            }
            markets_data.append(market_info)
            
            if market.get("liquidity"):
                total_liquidity += market.get("liquidity", 0)
            scores.append(score_result["score"])
    
    # Sort by predictive_score descending
    markets_data.sort(key=lambda x: x["predictive_score"], reverse=True)
    
    # Find best opportunity (highest score)
    best_opportunity = None
    if markets_data:
        top = markets_data[0]
        best_opportunity = {
            "market_id": top["market_id"],
            "title": top["title"],
            "score": top["predictive_score"],
        }
    
    # Find highest YES price
    highest_yes = None
    if markets_data:
        max_yes = max(markets_data, key=lambda x: x.get("yes_price", 0))
        highest_yes = {
            "market_id": max_yes["market_id"],
            "title": max_yes["title"],
            "yes_price": max_yes["yes_price"],
        }
    
    # Find lowest spread
    lowest_spread = None
    markets_with_spread = [m for m in markets_data if m.get("spread") is not None]
    if markets_with_spread:
        min_spread = min(markets_with_spread, key=lambda x: x.get("spread", float('inf')))
        lowest_spread = {
            "market_id": min_spread["market_id"],
            "title": min_spread["title"],
            "spread": min_spread["spread"],
        }
    
    return {
        "total_markets": len(markets_data),
        "best_opportunity": best_opportunity,
        "highest_yes": highest_yes,
        "lowest_spread": lowest_spread,
        "total_liquidity": total_liquidity,
        "avg_score": round(sum(scores) / len(scores), 2) if scores else 0,
        "markets": markets_data,
    }


@router.get("/search", response_model=List[Dict[str, Any]])
async def search_markets(
    q: str = Query(..., description="Search query", min_length=2),
    limit: int = Query(default=20, le=50),
    include_events: bool = Query(default=True),
):
    """
    Search markets and events by keyword.
    
    - **q**: Search query (minimum 2 characters)
    - **limit**: Max results per type (default: 20)
    - **include_events**: Also search events (default: true)
    """
    from ..core.polymarket import search_markets as pm_search_markets, search_events as pm_search_events
    
    results = []
    
    try:
        markets = pm_search_markets(q, limit=limit)
        for m in markets:
            results.append({
                "type": "market",
                "id": str(m.get("id") or m.get("conditionId") or ""),
                "title": m.get("question") or m.get("title") or "",
                "category": m.get("category"),
                "volume_24h": m.get("volume24hr"),
                "liquidity": m.get("liquidity"),
                "yes_price": (lambda op: float(json.loads(op)[0]) if isinstance(op, str) else float(op[0]) if op else None)(m.get("outcomePrices")) if m.get("outcomePrices") else None,
                "end_date": m.get("endDateIso"),
                "slug": m.get("slug"),
                "url": f"https://polymarket.com/market/{m.get('slug')}" if m.get("slug") else None,
            })
    except Exception as e:
        pass
    
    if include_events:
        try:
            events = pm_search_events(q, limit=min(limit, 10))
            for e in events:
                results.append({
                    "type": "event",
                    "id": str(e.get("id") or ""),
                    "title": e.get("title") or "",
                    "category": e.get("category"),
                    "volume_24h": e.get("volume24hr"),
                    "liquidity": e.get("liquidity"),
                    "yes_price": None,
                    "end_date": e.get("endDate"),
                    "slug": e.get("slug"),
                    "url": f"https://polymarket.com/event/{e.get('slug')}" if e.get("slug") else None,
                    "market_count": len(e.get("markets") or []),
                })
        except Exception:
            pass
    
    return results


@router.get("/trades/{market_id}", response_model=List[Dict[str, Any]])
async def get_market_trades(
    market_id: str,
    limit: int = Query(default=20, le=100),
    live: bool = Query(default=False, description="Fetch fresh trades from Polymarket API"),
):
    """
    Get recent trades for a market.
    
    - **limit**: Number of trades to return
    - **live**: If true, fetch fresh from Polymarket API instead of DB
    """
    from ..core.database import get_pool
    from ..core.polymarket import fetch_recent_trades
    
    pool = await get_pool()
    
    # Get YES token ID
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT token_id_yes FROM polymarket_market_stats WHERE market_id = $1 ORDER BY snapshot_ts DESC LIMIT 1",
            market_id
        )
    
    if not row or not row["token_id_yes"]:
        raise HTTPException(status_code=404, detail="Market not found")
    
    token_id = row["token_id_yes"]
    
    if live:
        # Fetch fresh from API
        trades = fetch_recent_trades(token_id, limit=limit)
        return trades
    
    # Fetch from DB
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM polymarket_trades WHERE market_id = $1 ORDER BY trade_ts DESC LIMIT $2",
            market_id, limit
        )
    
    if not rows:
        # Fall back to live fetch
        trades = fetch_recent_trades(token_id, limit=limit)
        return trades
    
    return [dict(r) for r in rows]


@router.get("/{market_id}", response_model=Dict[str, Any])
async def get_market(market_id: str):
    """
    Get detailed market information by ID.

    Returns the latest snapshot of market statistics.
    """
    market = await MarketService.get_market_by_id(market_id)
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")
    return market


@router.get("/{market_id}/stats", response_model=Dict[str, Any])
async def get_market_stats(market_id: str):
    """Get market statistics (alias for get_market)."""
    return await get_market(market_id)


@router.get("/{market_id}/history", response_model=List[Dict[str, Any]])
async def get_market_history(
    market_id: str,
    interval: str = "1w",
    limit: int = 1000,
):
    """
    Get price history for a market.

    - **interval**: Time interval (1w, 1m, etc.)
    - **limit**: Maximum number of data points
    """
    return await MarketService.get_market_history(market_id, interval, limit)


@router.get("/{market_id}/orderbook", response_model=Dict[str, Any])
async def get_market_orderbook(market_id: str):
    """
    Get current orderbook for a market.

    Returns bids and asks for both YES and NO tokens.
    """
    return await MarketService.get_market_orderbook(market_id)


@router.get("/{market_id}/score", response_model=Dict[str, Any])
async def get_market_score(market_id: str):
    """
    Get detailed predictive strength score breakdown for a specific market.

    Returns score, category, breakdown, and raw metrics.
    """
    score_data = await MarketService.get_market_score(market_id)
    if not score_data:
        raise HTTPException(status_code=404, detail="Market not found")
    return score_data


@router.get("/{market_id}/score-history", response_model=List[Dict[str, Any]])
async def get_market_score_history(
    market_id: str,
    days: int = Query(default=30, ge=1, le=365),
    interval_hours: int = Query(default=24, ge=1, le=168),
):
    """
    Get historical score data for a market.

    - **days**: Number of days to look back (default: 30, max: 365)
    - **interval_hours**: Sampling interval in hours (default: 24, max: 168)
    """
    from ..core.score_history import get_score_history
    history = await get_score_history(market_id, days=days, interval_hours=interval_hours)
    if not history:
        raise HTTPException(status_code=404, detail="No score history found for this market")
    return history


@router.get("/{market_id}/score-trend", response_model=Dict[str, Any])
async def get_market_score_trend(
    market_id: str,
    days: int = Query(default=7, ge=1, le=90),
):
    """
    Get score trend analysis for a market.

    - **days**: Number of days to analyze (default: 7, max: 90)
    """
    from ..core.score_history import get_score_trend
    return await get_score_trend(market_id, days=days)


@router.get("/{market_id}/since-launch", response_model=Dict[str, Any])
async def get_market_since_launch(market_id: str):
    """
    Get complete market history since launch with comprehensive statistics.
    
    Returns full price history and statistics including:
    - Launch date and price
    - Current price
    - Price range (min/max)
    - Days since launch
    - Price change and volatility
    """
    result = await MarketService.get_market_since_launch(market_id)
    if not result:
        raise HTTPException(status_code=404, detail="Market not found or no history available")
    return result
