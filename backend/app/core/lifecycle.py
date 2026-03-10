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
from datetime import datetime, timezone

from .database import get_pool, TBL_STATS

logger = logging.getLogger(__name__)

ARCHIVE_AFTER_DAYS = 30    # resolved → archived after 30 days
DELETE_AFTER_DAYS  = 180   # archived → deleted after 180 days


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
        # 1. Mark markets as resolved if closed/resolved=true and no resolved_at yet
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

        # 2. Archive resolved events older than ARCHIVE_AFTER_DAYS
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

        # 3. Delete archived events older than DELETE_AFTER_DAYS
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
        # Sleep 24 hours
        await asyncio.sleep(24 * 60 * 60)
