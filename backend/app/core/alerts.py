"""
Alert system for high-scoring market opportunities.

Monitors markets and generates alerts for:
- New high-scoring opportunities (score >= threshold)
- Significant score improvements
- Category-specific alerts
- Custom user-defined criteria
"""
from typing import List, Dict, Any, Optional
from datetime import datetime
from enum import Enum

from .database_duckdb import get_pool, TBL_STATS
from .scoring import calculate_market_score
from .score_history import get_score_trend


class AlertType(str, Enum):
    HIGH_SCORE = "high_score"
    SCORE_INCREASE = "score_increase"
    SCORE_DECREASE = "score_decrease"
    NEW_OPPORTUNITY = "new_opportunity"
    CATEGORY_ALERT = "category_alert"
    CUSTOM = "custom"


class AlertPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Alert:
    def __init__(
        self,
        alert_type: AlertType,
        market_id: str,
        title: str,
        message: str,
        priority: AlertPriority,
        score: float,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        self.alert_type = alert_type
        self.market_id = market_id
        self.title = title
        self.message = message
        self.priority = priority
        self.score = score
        self.metadata = metadata or {}
        self.timestamp = datetime.now()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "alert_type": self.alert_type,
            "market_id": self.market_id,
            "title": self.title,
            "message": self.message,
            "priority": self.priority,
            "score": self.score,
            "metadata": self.metadata,
            "timestamp": self.timestamp.isoformat(),
        }


class AlertConfig:
    def __init__(
        self,
        min_score: float = 70.0,
        score_increase_threshold: float = 15.0,
        score_decrease_threshold: float = -15.0,
        categories: Optional[List[str]] = None,
        min_liquidity: Optional[float] = None,
        check_interval_hours: int = 6,
    ):
        self.min_score = min_score
        self.score_increase_threshold = score_increase_threshold
        self.score_decrease_threshold = score_decrease_threshold
        self.categories = categories
        self.min_liquidity = min_liquidity
        self.check_interval_hours = check_interval_hours


async def check_high_score_alerts(config: AlertConfig) -> List[Alert]:
    """Check for markets with high predictive strength scores."""
    from ..services.market_service import MarketService
    from ..models.market import MarketFilter

    filters = MarketFilter(
        category=config.categories[0] if config.categories else None,
        min_liquidity=config.min_liquidity,
        limit=100,
    )

    markets = await MarketService.get_ranked_markets(filters)

    alerts = []
    for market in markets:
        score = market.get("predictive_strength_score", 0)
        if score >= config.min_score:
            if score >= 90:
                priority = AlertPriority.CRITICAL
            elif score >= 80:
                priority = AlertPriority.HIGH
            elif score >= 70:
                priority = AlertPriority.MEDIUM
            else:
                priority = AlertPriority.LOW

            alerts.append(Alert(
                alert_type=AlertType.HIGH_SCORE,
                market_id=market["market_id"],
                title=market.get("title", ""),
                message=f"High-scoring opportunity: {score:.1f}/100 ({market.get('score_category', 'N/A')})",
                priority=priority,
                score=score,
                metadata={
                    "category": market.get("category"),
                    "liquidity": market.get("liquidity"),
                    "expected_value": market.get("expected_value"),
                    "kelly_fraction": market.get("kelly_fraction"),
                },
            ))

    return alerts


async def check_score_change_alerts(config: AlertConfig) -> List[Alert]:
    """Check for significant score changes over the last day."""
    pool = await get_pool()

    query = f"""
    WITH latest AS (
        SELECT market_id, MAX(snapshot_ts) AS max_ts
        FROM {TBL_STATS}
        WHERE snapshot_ts >= NOW() - INTERVAL '7 days'
        GROUP BY market_id
    )
    SELECT s.market_id, s.title, s.category
    FROM {TBL_STATS} s
    INNER JOIN latest l ON s.market_id = l.market_id AND s.snapshot_ts = l.max_ts
    """

    async with pool.acquire() as conn:
        rows = await conn.fetch(query)

    alerts = []
    for row in rows:
        market_id = row["market_id"]
        trend = await get_score_trend(market_id, days=1)

        if trend["change"] >= config.score_increase_threshold:
            priority = AlertPriority.HIGH if trend["change"] >= 20 else AlertPriority.MEDIUM
            alerts.append(Alert(
                alert_type=AlertType.SCORE_INCREASE,
                market_id=market_id,
                title=row["title"],
                message=f"Score increased by {trend['change']:.1f} pts ({trend['change_percent']:.1f}%) to {trend['last_score']:.1f}",
                priority=priority,
                score=trend["last_score"],
                metadata={
                    "change": trend["change"],
                    "change_percent": trend["change_percent"],
                    "previous_score": trend["first_score"],
                    "category": row["category"],
                },
            ))

        elif trend["change"] <= config.score_decrease_threshold:
            priority = AlertPriority.MEDIUM if trend["change"] <= -20 else AlertPriority.LOW
            alerts.append(Alert(
                alert_type=AlertType.SCORE_DECREASE,
                market_id=market_id,
                title=row["title"],
                message=f"Score decreased by {abs(trend['change']):.1f} pts ({trend['change_percent']:.1f}%) to {trend['last_score']:.1f}",
                priority=priority,
                score=trend["last_score"],
                metadata={
                    "change": trend["change"],
                    "change_percent": trend["change_percent"],
                    "previous_score": trend["first_score"],
                    "category": row["category"],
                },
            ))

    return alerts


async def check_new_opportunities(
    hours_back: int = 24,
    min_score: float = 70.0,
) -> List[Alert]:
    """Check for newly discovered high-scoring markets."""
    pool = await get_pool()

    query = f"""
    WITH first_seen AS (
        SELECT market_id, MIN(snapshot_ts) AS first_ts
        FROM {TBL_STATS}
        GROUP BY market_id
    )
    SELECT s.*, fs.first_ts
    FROM {TBL_STATS} s
    INNER JOIN first_seen fs ON s.market_id = fs.market_id AND s.snapshot_ts = fs.first_ts
    WHERE fs.first_ts >= NOW() - ($1 || ' hours')::INTERVAL
    """

    async with pool.acquire() as conn:
        rows = await conn.fetch(query, str(hours_back))

    alerts = []
    for row in rows:
        market_dict = dict(row)
        score_result = calculate_market_score(market_dict)
        score = score_result["score"]

        if score >= min_score:
            priority = AlertPriority.HIGH if score >= 80 else AlertPriority.MEDIUM
            alerts.append(Alert(
                alert_type=AlertType.NEW_OPPORTUNITY,
                market_id=market_dict["market_id"],
                title=market_dict.get("title", ""),
                message=f"New market opportunity: {score:.1f}/100 ({score_result['category']})",
                priority=priority,
                score=score,
                metadata={
                    "category": market_dict.get("category"),
                    "first_seen": str(market_dict.get("first_ts")),
                    "liquidity": market_dict.get("liquidity"),
                },
            ))

    return alerts


async def get_all_alerts(config: Optional[AlertConfig] = None) -> List[Dict[str, Any]]:
    """Get all current alerts based on configuration."""
    if config is None:
        config = AlertConfig()

    all_alerts = []

    try:
        all_alerts.extend([a.to_dict() for a in await check_high_score_alerts(config)])
    except Exception as e:
        print(f"Error checking high score alerts: {e}")

    try:
        all_alerts.extend([a.to_dict() for a in await check_score_change_alerts(config)])
    except Exception as e:
        print(f"Error checking score change alerts: {e}")

    try:
        all_alerts.extend([a.to_dict() for a in await check_new_opportunities(
            hours_back=config.check_interval_hours,
            min_score=config.min_score,
        )])
    except Exception as e:
        print(f"Error checking new opportunities: {e}")

    priority_order = {
        AlertPriority.CRITICAL: 0,
        AlertPriority.HIGH: 1,
        AlertPriority.MEDIUM: 2,
        AlertPriority.LOW: 3,
    }

    all_alerts.sort(key=lambda x: (priority_order.get(x["priority"], 99), -x["score"]))
    return all_alerts


def filter_alerts(
    alerts: List[Dict[str, Any]],
    alert_type: Optional[AlertType] = None,
    min_priority: Optional[AlertPriority] = None,
    category: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Filter alerts by criteria."""
    filtered = alerts

    if alert_type:
        filtered = [a for a in filtered if a["alert_type"] == alert_type]

    if min_priority:
        priority_order = {
            AlertPriority.CRITICAL: 0,
            AlertPriority.HIGH: 1,
            AlertPriority.MEDIUM: 2,
            AlertPriority.LOW: 3,
        }
        min_level = priority_order[min_priority]
        filtered = [a for a in filtered if priority_order.get(a["priority"], 99) <= min_level]

    if category:
        filtered = [a for a in filtered if a.get("metadata", {}).get("category") == category]

    return filtered
