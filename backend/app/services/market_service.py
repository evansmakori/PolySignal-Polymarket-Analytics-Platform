"""Market service for querying market data from PostgreSQL."""
from typing import List, Optional, Dict, Any
from datetime import datetime

from ..core.database_duckdb import get_pool, TBL_STATS, TBL_HIST, TBL_OB
from ..models.market import MarketListItem, MarketStats, MarketFilter
from ..core.scoring import rank_markets, calculate_market_score


class MarketService:
    """Service for market data operations."""

    @staticmethod
    async def get_markets(filters: MarketFilter) -> List[Dict[str, Any]]:
        """Get list of markets with filters."""
        pool = await get_pool()

        conditions = []
        args = []

        def _add(clause: str, val):
            args.append(val)
            conditions.append(clause.replace("?", f"${len(args)}"))

        if filters.category:
            _add("category = ?", filters.category)
        if filters.min_liquidity is not None:
            _add("liquidity >= ?", filters.min_liquidity)
        if filters.max_liquidity is not None:
            _add("liquidity <= ?", filters.max_liquidity)
        if filters.min_volume is not None:
            _add("volume_24h >= ?", filters.min_volume)
        if filters.max_volume is not None:
            _add("volume_24h <= ?", filters.max_volume)
        if filters.trade_signal:
            _add("trade_signal = ?", filters.trade_signal)

        where_sql = "AND " + " AND ".join(conditions) if conditions else ""

        args += [filters.limit, filters.offset]
        limit_n = len(args) - 1
        offset_n = len(args)

        query = f"""
        WITH latest AS (
            SELECT market_id, MAX(snapshot_ts) AS max_ts
            FROM polymarket_market_stats
            GROUP BY market_id
        )
        SELECT
            s.market_id, s.title, s.category,
            s.yes_price, s.no_price,
            COALESCE(s.volume, s.volume_clob, 0) AS volume_24h,
            s.liquidity,
            s.trade_signal, s.snapshot_ts,
            s.degen_risk
        FROM polymarket_market_stats s
        INNER JOIN latest l ON s.market_id = l.market_id AND s.snapshot_ts = l.max_ts
        WHERE 1=1 {where_sql}
        ORDER BY s.liquidity DESC NULLS LAST
        LIMIT ${limit_n} OFFSET ${offset_n}
        """

        async with pool.acquire() as conn:
            rows = await conn.fetch(query, *args)
        return [dict(r) for r in rows]

    @staticmethod
    async def get_market_by_id(market_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed market stats by ID (latest snapshot)."""
        pool = await get_pool()
        query = f"""
        SELECT * FROM polymarket_market_stats
        WHERE market_id = $1
        ORDER BY snapshot_ts DESC
        LIMIT 1
        """
        async with pool.acquire() as conn:
            row = await conn.fetchrow(query, market_id)
        if not row:
            return None
        # Normalise column names for the rest of the app
        d = dict(row)
        d.setdefault("token_id_yes", d.get("yes_token_id"))
        d.setdefault("token_id_no",  d.get("no_token_id"))
        d.setdefault("volume_24h",   d.get("volume") or d.get("volume_clob") or 0)
        d.setdefault("volatility",   d.get("volatility_1w"))
        return d

    @staticmethod
    async def get_market_history(
        market_id: str,
        interval: str = "1w",
        limit: int = 1000,
    ) -> List[Dict[str, Any]]:
        """Get price history for a market."""
        pool = await get_pool()

        # Get YES token ID
        async with pool.acquire() as conn:
            token_row = await conn.fetchrow(
                f"""
                SELECT yes_token_id
                FROM polymarket_market_stats
                WHERE market_id = $1
                ORDER BY snapshot_ts DESC
                LIMIT 1
                """,
                market_id,
            )
            if not token_row:
                return []
            yes_token_id = token_row.get("yes_token_id")
            if not yes_token_id:
                return []

            rows = await conn.fetch(
                f"""
                SELECT t AS ts, price FROM polymarket_prices_history
                WHERE token_id = $1 AND interval = $2
                ORDER BY t DESC
                LIMIT $3
                """,
                yes_token_id, interval, limit,
            )
        return [dict(r) for r in rows]

    @staticmethod
    async def get_market_orderbook(market_id: str) -> Dict[str, Any]:
        """Get latest orderbook for a market."""
        pool = await get_pool()
        result = {"yes": {"bids": [], "asks": []}, "no": {"bids": [], "asks": []}}

        async with pool.acquire() as conn:
            token_row = await conn.fetchrow(
                f"""
                SELECT yes_token_id, no_token_id
                FROM polymarket_market_stats
                WHERE market_id = $1
                ORDER BY snapshot_ts DESC
                LIMIT 1
                """,
                market_id,
            )
            if not token_row:
                return result

            ob_query = f"""
            SELECT side, level, price, size FROM polymarket_orderbook
            WHERE token_id = $1
              AND snapshot_ts = (
                  SELECT MAX(snapshot_ts) FROM polymarket_orderbook WHERE token_id = $2
              )
            ORDER BY side, level
            """

            for side_key, col in [("yes", "yes_token_id"), ("no", "no_token_id")]:
                token_id = token_row[col]
                if token_id:
                    rows = await conn.fetch(ob_query, token_id, token_id)
                    records = [dict(r) for r in rows]
                    result[side_key] = {
                        "bids": [r for r in records if r["side"] == "bid"],
                        "asks": [r for r in records if r["side"] == "ask"],
                    }

        return result

    @staticmethod
    async def get_categories() -> List[str]:
        """Get list of unique categories."""
        pool = await get_pool()
        query = """
        SELECT DISTINCT category FROM polymarket_market_stats
        WHERE category IS NOT NULL
        ORDER BY category
        """
        async with pool.acquire() as conn:
            rows = await conn.fetch(query)
        return [r["category"] for r in rows]

    @staticmethod
    async def get_market_count() -> int:
        """Get total number of unique markets."""
        pool = await get_pool()
        query = "SELECT COUNT(DISTINCT market_id) AS count FROM polymarket_market_stats"
        async with pool.acquire() as conn:
            row = await conn.fetchrow(query)
        return row["count"] if row else 0

    @staticmethod
    async def get_ranked_markets(
        filters: MarketFilter,
        normalization_params: Optional[Dict[str, float]] = None,
    ) -> List[Dict[str, Any]]:
        """Get markets ranked by predictive strength score."""
        pool = await get_pool()

        conditions = []
        args = []

        def _add(clause: str, val):
            args.append(val)
            conditions.append(clause.replace("?", f"${len(args)}"))

        if filters.category:
            _add("category = ?", filters.category)
        if filters.min_liquidity is not None:
            _add("liquidity >= ?", filters.min_liquidity)
        if filters.max_liquidity is not None:
            _add("liquidity <= ?", filters.max_liquidity)
        if filters.min_volume is not None:
            _add("volume_24h >= ?", filters.min_volume)
        if filters.max_volume is not None:
            _add("volume_24h <= ?", filters.max_volume)
        if filters.trade_signal:
            _add("trade_signal = ?", filters.trade_signal)

        where_sql = "AND " + " AND ".join(conditions) if conditions else ""

        args += [filters.limit, filters.offset]
        limit_n = len(args) - 1
        offset_n = len(args)

        query = f"""
        WITH latest AS (
            SELECT market_id, MAX(snapshot_ts) AS max_ts
            FROM polymarket_market_stats
            GROUP BY market_id
        )
        SELECT s.*
        FROM polymarket_market_stats s
        INNER JOIN latest l ON s.market_id = l.market_id AND s.snapshot_ts = l.max_ts
        WHERE 1=1 {where_sql}
        LIMIT ${limit_n} OFFSET ${offset_n}
        """

        async with pool.acquire() as conn:
            rows = await conn.fetch(query, *args)

        markets = []
        for r in rows:
            d = dict(r)
            d.setdefault("token_id_yes", d.get("yes_token_id"))
            d.setdefault("token_id_no",  d.get("no_token_id"))
            d.setdefault("volume_24h",   d.get("volume") or d.get("volume_clob") or 0)
            d.setdefault("volatility",   d.get("volatility_1w"))
            markets.append(d)
        return rank_markets(markets, normalization_params)

    @staticmethod
    async def get_market_score(market_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed scoring breakdown for a specific market."""
        market = await MarketService.get_market_by_id(market_id)
        if not market:
            return None

        score_result = calculate_market_score(market)

        return {
            "market_id": market_id,
            "title": market.get("title"),
            "score": score_result["score"],
            "category": score_result["category"],
            "breakdown": score_result,
            "metrics": {
                "expected_value": market.get("expected_value"),
                "kelly_fraction": market.get("kelly_fraction"),
                "liquidity": market.get("liquidity"),
                "volatility": market.get("volatility"),
                "orderbook_imbalance": market.get("orderbook_imbalance"),
                "spread": market.get("spread"),
                "sentiment_momentum": market.get("sentiment_momentum"),
            },
        }

    @staticmethod
    async def get_top_opportunities(
        limit: int = 20,
        min_score: float = 60.0,
        active_only: bool = True,
    ) -> List[Dict[str, Any]]:
        """Get top scoring market opportunities."""
        filters = MarketFilter(limit=500)
        ranked = await MarketService.get_ranked_markets(filters)
        top = [m for m in ranked if m.get("predictive_strength_score", 0) >= min_score]
        return top[:limit]

    @staticmethod
    async def get_market_since_launch(market_id: str) -> Optional[Dict[str, Any]]:
        """
        Get complete market history since launch with statistics.
        
        Returns:
            {
                market_id, title, category, end_date, launch_date,
                current_price, history: [{ts, price}],
                stats: {
                    total_bars, days_since_launch, price_change_since_launch,
                    max_price, min_price, current_price, volatility_all_time
                }
            }
        """
        pool = await get_pool()
        
        # Get market metadata and YES token ID from latest snapshot
        async with pool.acquire() as conn:
            market_row = await conn.fetchrow(
                f"""
                SELECT 
                    market_id, title, category, end_date, yes_price, 
                    snapshot_ts, yes_token_id
                FROM polymarket_market_stats
                WHERE market_id = $1
                ORDER BY snapshot_ts DESC
                LIMIT 1
                """,
                market_id,
            )
        
        if not market_row:
            return None
        
        yes_token_id = market_row.get("yes_token_id")
        current_price = float(market_row["yes_price"]) if market_row["yes_price"] else 0.5
        
        # Get full history from database ordered by ts ASC (chronological)
        async with pool.acquire() as conn:
            hist_rows = await conn.fetch(
                f"""
                SELECT t AS ts, price
                FROM polymarket_prices_history
                WHERE token_id = $1
                ORDER BY t ASC
                """,
                yes_token_id,
            )
        
        history = [{"ts": r["ts"], "price": float(r["price"])} for r in hist_rows]
        
        # Calculate statistics
        if history:
            launch_date = history[0]["ts"]
            launch_price = float(history[0]["price"])
            prices = [h["price"] for h in history]
            max_price = max(prices)
            min_price = min(prices)
            price_change = current_price - launch_price
            
            # Calculate volatility (standard deviation of price changes)
            import numpy as np
            if len(prices) > 1:
                price_returns = np.diff(prices)
                volatility_all_time = float(np.std(price_returns)) if len(price_returns) > 0 else 0.0
            else:
                volatility_all_time = 0.0
            
            from datetime import timezone as tz_module
            # Ensure launch_date is timezone-aware before subtracting
            if hasattr(launch_date, 'tzinfo') and launch_date.tzinfo is None:
                launch_date = launch_date.replace(tzinfo=tz_module.utc)
            days_since_launch = (
                (datetime.now(tz_module.utc) - launch_date).total_seconds() / 86400
            )
        else:
            launch_date = market_row["snapshot_ts"]
            launch_price = current_price
            max_price = current_price
            min_price = current_price
            price_change = 0.0
            volatility_all_time = 0.0
            days_since_launch = 0.0
        
        return {
            "market_id": market_id,
            "title": market_row["title"],
            "category": market_row["category"],
            "end_date": market_row["end_date"],
            "launch_date": launch_date,
            "current_price": current_price,
            "history": history,
            "stats": {
                "total_bars": len(history),
                "days_since_launch": round(days_since_launch, 2),
                "price_change_since_launch": round(price_change, 4),
                "max_price": round(max_price, 4),
                "min_price": round(min_price, 4),
                "current_price": round(current_price, 4),
                "volatility_all_time": round(volatility_all_time, 6),
            },
        }
