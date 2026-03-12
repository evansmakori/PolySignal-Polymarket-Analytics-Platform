"""
Automatic lifecycle management for extracted market events.

Lifecycle states:
  active   → event is live and tradeable
  resolved → event outcome finalized (shown on dashboard for 30 days)
  archived → resolved > 30 days ago (hidden from dashboard, kept for analytics)
  deleted  → resolved > 180 days ago (purged from DB)

Runs daily as a background job.
"""
import asyncio
import logging
from urllib.parse import quote

from .database import get_pool, TBL_STATS
from .extractor import extract_from_url

logger = logging.getLogger(__name__)

ARCHIVE_AFTER_DAYS = 30    # resolved → archived after 30 days
DELETE_AFTER_DAYS  = 180   # archived → deleted after 180 days
SCORE_BACKFILL_INTERVAL_SECONDS = 300
ACTIVE_REFRESH_INTERVAL_SECONDS = 300
ACTIVE_REFRESH_BATCH_SIZE = 10


async def update_lifecycle_status() -> dict:
    """
    Run lifecycle transitions:
    1. Mark resolved markets with resolved_at timestamp
    2. Archive resolved events older than 30 days
    3. Delete archived events older than 180 days
    Returns counts of affected rows.
    """
    pool = await get_pool()
    counts = {"resolved": 0, "archived": 0, "deleted": 0}

    async with pool.acquire() as conn:
        r1 = await conn.execute(f"""
            UPDATE {TBL_STATS}
            SET
                lifecycle_status = 'resolved',
                resolved_at = NOW()
            WHERE
                (resolved = true OR closed = true OR automatically_resolved = true)
                AND lifecycle_status = 'active'
                AND resolved_at IS NULL
        """)
        counts["resolved"] = int(r1.split()[-1])
        if counts["resolved"]:
            logger.info(f"✓ Lifecycle: {counts['resolved']} markets marked as resolved")

        r2 = await conn.execute(f"""
            UPDATE {TBL_STATS}
            SET lifecycle_status = 'archived'
            WHERE
                lifecycle_status = 'resolved'
                AND resolved_at < NOW() - INTERVAL '{ARCHIVE_AFTER_DAYS} days'
        """)
        counts["archived"] = int(r2.split()[-1])
        if counts["archived"]:
            logger.info(f"✓ Lifecycle: {counts['archived']} markets archived")

        r3 = await conn.execute(f"""
            DELETE FROM {TBL_STATS}
            WHERE
                lifecycle_status = 'archived'
                AND resolved_at < NOW() - INTERVAL '{DELETE_AFTER_DAYS} days'
        """)
        counts["deleted"] = int(r3.split()[-1])
        if counts["deleted"]:
            logger.info(f"✓ Lifecycle: {counts['deleted']} markets deleted")

    return counts


async def run_score_backfill_job():
    """Background task that runs score backfill every 5 minutes."""
    import math
    from .scoring import calculate_market_score

    await asyncio.sleep(15)
    while True:
        try:
            pool = await get_pool()
            async with pool.acquire() as conn:
                null_markets = await conn.fetch("""
                    SELECT DISTINCT ON (market_id) market_id, liquidity, spread,
                        volume_24h, volume_total, price_change_1d, volatility,
                        expected_value, kelly_fraction, orderbook_imbalance,
                        sentiment_momentum
                    FROM polymarket_market_stats
                    WHERE predictive_score IS NULL OR predictive_score < 1.0
                    ORDER BY market_id, snapshot_ts DESC
                """)
                updated = 0
                for row in null_markets:
                    try:
                        score_result = calculate_market_score(dict(row))
                        score = score_result.get("score")
                        category = score_result.get("category", "Neutral / Watchlist")
                        liq = float(row.get("liquidity") or 1)
                        vol = float(row.get("volume_total") or 1)
                        if score is None or score < 1.0:
                            liq_score = min(100.0, max(0.0, math.log10(max(liq, 1)) / math.log10(1_000_000) * 100))
                            vol_score = min(100.0, max(0.0, math.log10(max(vol, 1)) / math.log10(10_000_000) * 100))
                            score = round(max(1.0, liq_score * 0.6 + vol_score * 0.4), 2)
                            category = "Neutral / Watchlist"
                        await conn.execute("""
                            UPDATE polymarket_market_stats
                            SET predictive_score = $1, score_category = $2
                            WHERE market_id = $3 AND (predictive_score IS NULL OR predictive_score < 1.0)
                        """, score, category, row["market_id"])
                        updated += 1
                    except Exception:
                        pass
                if updated:
                    logger.info(f"✓ Auto-backfill: fixed {updated} market scores")
        except Exception as e:
            logger.warning(f"⚠ Score backfill job error: {e}")
        await asyncio.sleep(SCORE_BACKFILL_INTERVAL_SECONDS)


async def refresh_active_events(limit: int = ACTIVE_REFRESH_BATCH_SIZE) -> dict:
    """Refresh a small batch of active extracted events from Polymarket."""
    pool = await get_pool()
    refreshed = 0
    failed = 0
    skipped = 0

    async with pool.acquire() as conn:
        rows = await conn.fetch(f"""
            WITH latest_events AS (
                SELECT
                    event_id,
                    event_slug,
                    MAX(snapshot_ts) AS last_synced,
                    BOOL_OR(COALESCE(lifecycle_status, 'active') = 'active') AS is_active
                FROM {TBL_STATS}
                WHERE event_id IS NOT NULL
                  AND event_slug IS NOT NULL
                  AND event_slug != ''
                GROUP BY event_id, event_slug
            )
            SELECT event_id, event_slug, last_synced
            FROM latest_events
            WHERE is_active = true
            ORDER BY last_synced ASC NULLS FIRST
            LIMIT $1
        """, limit)

    for row in rows:
        slug = row["event_slug"]
        if not slug:
            skipped += 1
            continue
        try:
            await extract_from_url(
                url=f"https://polymarket.com/event/{quote(str(slug))}",
                intervals=["1w"],
                bypass_cache=True,
            )
            refreshed += 1
        except Exception as e:
            failed += 1
            logger.warning(f"⚠ Active event refresh failed for {slug}: {e}")
        await asyncio.sleep(1)

    return {"refreshed": refreshed, "failed": failed, "skipped": skipped}


async def run_active_event_refresh_job():
    """Background task that keeps extracted active events synced with Polymarket."""
    logger.info(
        f"✓ Active event refresh job started (runs every {ACTIVE_REFRESH_INTERVAL_SECONDS // 60} minutes, batch size {ACTIVE_REFRESH_BATCH_SIZE})"
    )
    await asyncio.sleep(30)
    while True:
        try:
            counts = await refresh_active_events()
            if counts["refreshed"] or counts["failed"]:
                logger.info(
                    "✓ Active event sync complete: "
                    f"refreshed={counts['refreshed']}, failed={counts['failed']}, skipped={counts['skipped']}"
                )
        except Exception as e:
            logger.warning(f"⚠ Active event refresh job error: {e}")
        await asyncio.sleep(ACTIVE_REFRESH_INTERVAL_SECONDS)


async def run_daily_lifecycle_job():
    """Background task that runs the lifecycle manager once per day."""
    logger.info("✓ Lifecycle manager started (runs every 24 hours)")
    while True:
        try:
            counts = await update_lifecycle_status()
            logger.info(
                f"✓ Daily lifecycle job complete: "
                f"resolved={counts['resolved']}, "
                f"archived={counts['archived']}, "
                f"deleted={counts['deleted']}"
            )
        except Exception as e:
            logger.warning(f"⚠ Lifecycle job error: {e}")
        await asyncio.sleep(24 * 60 * 60)
