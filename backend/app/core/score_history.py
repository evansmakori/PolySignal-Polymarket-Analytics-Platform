"""
Score history tracking for prediction markets.

Tracks changes in predictive strength scores over time to:
- Monitor score trends
- Detect improving/declining opportunities
- Provide historical context for scoring
"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

from .database import get_pool, TBL_STATS
from .scoring import calculate_market_score


async def get_score_history(
    market_id: str,
    days: int = 30,
    interval_hours: int = 24,
) -> List[Dict[str, Any]]:
    """
    Get score history for a market over time.

    Samples one snapshot per interval_hours window over the last N days.
    """
    pool = await get_pool()

    query = f"""
    WITH snapshots AS (
        SELECT *,
            ROW_NUMBER() OVER (
                PARTITION BY DATE_TRUNC('hour', snapshot_ts)
                ORDER BY snapshot_ts DESC
            ) AS rn
        FROM {TBL_STATS}
        WHERE market_id = $1
          AND snapshot_ts >= NOW() - ($2 * INTERVAL '1 day')
    )
    SELECT * FROM snapshots
    WHERE rn = 1
    ORDER BY snapshot_ts ASC
    """

    async with pool.acquire() as conn:
        rows = await conn.fetch(query, market_id, days)

    history = []
    for row in rows:
        market_dict = dict(row)
        score_result = calculate_market_score(market_dict)
        history.append({
            "timestamp": market_dict["snapshot_ts"],
            "score": score_result["score"],
            "category": score_result["category"],
            "metrics": {
                "expected_value": market_dict.get("expected_value"),
                "kelly_fraction": market_dict.get("kelly_fraction"),
                "liquidity": market_dict.get("liquidity"),
                "volatility": market_dict.get("volatility"),
                "orderbook_imbalance": market_dict.get("orderbook_imbalance"),
                "spread": market_dict.get("spread"),
                "sentiment_momentum": market_dict.get("sentiment_momentum"),
            },
        })

    return history


async def get_score_trend(market_id: str, days: int = 7) -> Dict[str, Any]:
    """Get score trend analysis for a market."""
    history = await get_score_history(market_id, days=days, interval_hours=6)

    if len(history) < 2:
        return {
            "trend": "insufficient_data",
            "change": 0.0,
            "change_percent": 0.0,
            "direction": "unknown",
            "volatility": 0.0,
        }

    scores = [h["score"] for h in history]
    first_score = scores[0]
    last_score = scores[-1]

    change = last_score - first_score
    change_percent = (change / first_score * 100) if first_score > 0 else 0.0

    if change > 5:
        direction, trend = "improving", "up"
    elif change < -5:
        direction, trend = "declining", "down"
    else:
        direction, trend = "stable", "flat"

    import statistics
    volatility = statistics.stdev(scores) if len(scores) > 1 else 0.0

    return {
        "trend": trend,
        "direction": direction,
        "change": round(change, 2),
        "change_percent": round(change_percent, 2),
        "volatility": round(volatility, 2),
        "first_score": round(first_score, 2),
        "last_score": round(last_score, 2),
        "data_points": len(history),
    }


async def get_all_markets_score_changes(
    hours: int = 24,
    min_change: float = 10.0,
) -> List[Dict[str, Any]]:
    """Get markets with significant score changes within a time window."""
    pool = await get_pool()

    query = f"""
    WITH latest AS (
        SELECT market_id, MAX(snapshot_ts) AS latest_ts
        FROM {TBL_STATS}
        WHERE snapshot_ts >= NOW() - ($1 * INTERVAL '1 hour')
        GROUP BY market_id
    )
    SELECT s.*
    FROM {TBL_STATS} s
    INNER JOIN latest l ON s.market_id = l.market_id AND s.snapshot_ts = l.latest_ts
    """

    async with pool.acquire() as conn:
        rows = await conn.fetch(query, hours + 1)

    changes = []
    for row in rows:
        market_dict = dict(row)
        current_score = calculate_market_score(market_dict)["score"]
        changes.append({
            "market_id": market_dict["market_id"],
            "title": market_dict.get("title"),
            "category": market_dict.get("category"),
            "current_score": current_score,
            "timestamp": market_dict.get("snapshot_ts"),
        })

    return changes


async def get_top_improving_markets(
    days: int = 7,
    limit: int = 10,
) -> List[Dict[str, Any]]:
    """Get markets with the best score improvement over time."""
    pool = await get_pool()

    query = f"""
    SELECT DISTINCT market_id FROM {TBL_STATS}
    WHERE snapshot_ts >= NOW() - ($1 * INTERVAL '1 day')
    """

    async with pool.acquire() as conn:
        rows = await conn.fetch(query, days)

    market_ids = [r["market_id"] for r in rows]

    improvements = []
    for market_id in market_ids:
        trend = await get_score_trend(market_id, days=days)
        if trend["change"] > 0:
            improvements.append({
                "market_id": market_id,
                "score_change": trend["change"],
                "change_percent": trend["change_percent"],
                "current_score": trend["last_score"],
                "trend": trend,
            })

    improvements.sort(key=lambda x: x["score_change"], reverse=True)

    result = []
    for imp in improvements[:limit]:
        market = await get_market_basic_info(imp["market_id"])
        if market:
            result.append({**market, **imp})

    return result


async def get_market_basic_info(market_id: str) -> Optional[Dict[str, Any]]:
    """Get basic market information."""
    pool = await get_pool()

    query = f"""
    SELECT market_id, title, category, yes_price, liquidity, volume_24h
    FROM {TBL_STATS}
    WHERE market_id = $1
    ORDER BY snapshot_ts DESC
    LIMIT 1
    """

    async with pool.acquire() as conn:
        row = await conn.fetchrow(query, market_id)

    if not row:
        return None

    return {
        "market_id": row["market_id"],
        "title": row["title"],
        "category": row["category"],
        "yes_price": row["yes_price"],
        "liquidity": row["liquidity"],
        "volume_24h": row["volume_24h"],
    }
