"""
PostgreSQL database connection and schema management.
Uses asyncpg connection pool for async FastAPI compatibility.
"""
import asyncpg
from typing import Optional
from .config import settings

# ---------------------------------------------------------------------------
# Table name constants
# ---------------------------------------------------------------------------
TBL_OB     = "polymarket_orderbook"
TBL_HIST   = "polymarket_prices_history"
TBL_STATS  = "polymarket_market_stats"
TBL_TRADES = "polymarket_trades"

# ---------------------------------------------------------------------------
# DDL — tables are created once on startup
# ---------------------------------------------------------------------------
DDL_ORDERBOOK = f"""
CREATE TABLE IF NOT EXISTS {TBL_OB} (
    token_id     TEXT        NOT NULL,
    snapshot_ts  TIMESTAMPTZ NOT NULL,
    side         TEXT        NOT NULL,
    level        INTEGER     NOT NULL,
    price        DOUBLE PRECISION NOT NULL,
    size         DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (token_id, snapshot_ts, side, level)
);
"""

DDL_HISTORY = f"""
CREATE TABLE IF NOT EXISTS {TBL_HIST} (
    token_id   TEXT        NOT NULL,
    ts         TIMESTAMPTZ NOT NULL,
    interval   TEXT,
    fidelity   INTEGER,
    price      DOUBLE PRECISION,
    PRIMARY KEY (token_id, ts)
);
"""

DDL_TRADES = f"""
CREATE TABLE IF NOT EXISTS {TBL_TRADES} (
    trade_id     TEXT        PRIMARY KEY,
    market_id    TEXT        NOT NULL,
    token_id     TEXT        NOT NULL,
    side         TEXT,
    price        DOUBLE PRECISION,
    size         DOUBLE PRECISION,
    trade_ts     TIMESTAMPTZ,
    maker_addr   TEXT,
    taker_addr   TEXT,
    fetched_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trades_market_id ON {TBL_TRADES} (market_id);
CREATE INDEX IF NOT EXISTS idx_trades_trade_ts  ON {TBL_TRADES} (trade_ts DESC);
"""

DDL_STATS = f"""
CREATE TABLE IF NOT EXISTS {TBL_STATS} (
    -- identity
    market_id            TEXT        NOT NULL,
    token_id_yes         TEXT,
    token_id_no          TEXT,
    snapshot_ts          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- market metadata
    title                TEXT,
    category             TEXT,
    end_date             TIMESTAMPTZ,
    description          TEXT,

    -- pricing
    yes_price            DOUBLE PRECISION,
    no_price             DOUBLE PRECISION,
    best_bid             DOUBLE PRECISION,
    best_ask             DOUBLE PRECISION,
    spread               DOUBLE PRECISION,
    mid_price            DOUBLE PRECISION,

    -- trade data
    last_trade_price     DOUBLE PRECISION,
    last_trade_size      DOUBLE PRECISION,
    last_trade_ts        TIMESTAMPTZ,

    -- volume / liquidity
    volume_24h           DOUBLE PRECISION,
    volume_total         DOUBLE PRECISION,
    liquidity            DOUBLE PRECISION,
    open_interest        DOUBLE PRECISION,

    -- technical indicators
    volatility           DOUBLE PRECISION,
    ma_short             DOUBLE PRECISION,
    ma_long              DOUBLE PRECISION,
    ema_slope            DOUBLE PRECISION,
    overreaction_z       DOUBLE PRECISION,

    -- orderbook metrics
    orderbook_imbalance  DOUBLE PRECISION,
    depth_liquidity      DOUBLE PRECISION,
    slippage_bps         DOUBLE PRECISION,

    -- fair value / EV
    fair_value           DOUBLE PRECISION,
    expected_value       DOUBLE PRECISION,
    kelly_fraction       DOUBLE PRECISION,
    trade_signal         TEXT,

    -- sentiment / momentum
    sentiment_momentum   DOUBLE PRECISION,
    late_overconfidence  BOOLEAN,

    -- scoring
    predictive_score     DOUBLE PRECISION,
    score_category       TEXT,

    -- New Tier 1 fields
    price_change_1h      DOUBLE PRECISION,
    price_change_1d      DOUBLE PRECISION,
    price_change_1wk     DOUBLE PRECISION,
    price_change_1mo     DOUBLE PRECISION,
    price_change_1yr     DOUBLE PRECISION,
    volume_1wk           DOUBLE PRECISION,
    volume_1mo           DOUBLE PRECISION,
    volume_1yr           DOUBLE PRECISION,
    comment_count        INTEGER,
    competitive          BOOLEAN,
    resolution_source    TEXT,
    creation_date        TIMESTAMPTZ,
    start_date           TIMESTAMPTZ,
    tags                 TEXT,

    PRIMARY KEY (market_id, snapshot_ts)
);
"""

DDL_STATS_IDX = f"""
CREATE INDEX IF NOT EXISTS idx_stats_market_id   ON {TBL_STATS} (market_id);
CREATE INDEX IF NOT EXISTS idx_stats_snapshot_ts ON {TBL_STATS} (snapshot_ts DESC);
CREATE INDEX IF NOT EXISTS idx_stats_category    ON {TBL_STATS} (category);
CREATE INDEX IF NOT EXISTS idx_stats_price_change_1d ON {TBL_STATS} (price_change_1d DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_stats_volume_1wk ON {TBL_STATS} (volume_1wk DESC NULLS LAST);
"""

# ---------------------------------------------------------------------------
# Connection pool (initialised in main.py startup)
# ---------------------------------------------------------------------------
_pool: Optional[asyncpg.Pool] = None


async def create_pool() -> asyncpg.Pool:
    """Create and store the global asyncpg connection pool."""
    global _pool
    _pool = await asyncpg.create_pool(
        dsn=settings.DATABASE_URL,
        min_size=2,
        max_size=10,
        command_timeout=60,
    )
    return _pool


async def get_pool() -> asyncpg.Pool:
    """Return the active pool (raises if not initialised)."""
    if _pool is None:
        raise RuntimeError("Database pool not initialised. Call create_pool() first.")
    return _pool


async def close_pool() -> None:
    """Gracefully close the connection pool."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


# ---------------------------------------------------------------------------
# Schema initialisation
# ---------------------------------------------------------------------------
async def ensure_tables() -> None:
    """Create all tables and indexes if they do not already exist."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(DDL_ORDERBOOK)
            await conn.execute(DDL_HISTORY)
            await conn.execute(DDL_TRADES)
            await conn.execute(DDL_STATS)
            for stmt in DDL_STATS_IDX.strip().split("\n"):
                stmt = stmt.strip()
                if stmt:
                    await conn.execute(stmt)


# ---------------------------------------------------------------------------
# Upsert helpers
# ---------------------------------------------------------------------------
async def upsert_orderbook(token_id: str, snapshot_ts, rows: list[dict]) -> None:
    """
    Replace the orderbook snapshot for a token.
    Deletes old snapshot rows then inserts the new ones.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                f"DELETE FROM {TBL_OB} WHERE token_id = $1 AND snapshot_ts = $2",
                token_id, snapshot_ts,
            )
            if rows:
                await conn.executemany(
                    f"""
                    INSERT INTO {TBL_OB}
                        (token_id, snapshot_ts, side, level, price, size)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (token_id, snapshot_ts, side, level) DO UPDATE
                        SET price = EXCLUDED.price,
                            size  = EXCLUDED.size
                    """,
                    [
                        (token_id, snapshot_ts, r["side"], r["level"], r["price"], r["size"])
                        for r in rows
                    ],
                )


async def upsert_history(token_id: str, bars: list[dict]) -> None:
    """Insert or update price history bars."""
    if not bars:
        return
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.executemany(
            f"""
            INSERT INTO {TBL_HIST} (token_id, ts, interval, fidelity, price)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (token_id, ts) DO UPDATE
                SET interval = EXCLUDED.interval,
                    fidelity = EXCLUDED.fidelity,
                    price    = EXCLUDED.price
            """,
            [
                (
                    token_id,
                    b.get("ts") or b.get("timestamp"),
                    b.get("interval"),
                    b.get("fidelity"),
                    b.get("price"),
                )
                for b in bars
            ],
        )


async def upsert_market_stats(stats: dict) -> None:
    """Insert or update a market stats snapshot."""
    import datetime

    def _to_ts(val):
        if val is None:
            return None
        if isinstance(val, datetime.datetime):
            return val
        try:
            return datetime.datetime.fromisoformat(str(val))
        except Exception:
            return None

    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            f"""
            INSERT INTO {TBL_STATS} (
                market_id, token_id_yes, token_id_no, snapshot_ts,
                title, category, end_date, description,
                yes_price, no_price, best_bid, best_ask, spread, mid_price,
                last_trade_price, last_trade_size, last_trade_ts,
                volume_24h, volume_total, liquidity, open_interest,
                volatility, ma_short, ma_long, ema_slope, overreaction_z,
                orderbook_imbalance, depth_liquidity, slippage_bps,
                fair_value, expected_value, kelly_fraction, trade_signal,
                sentiment_momentum, late_overconfidence,
                predictive_score, score_category,
                price_change_1h, price_change_1d, price_change_1wk, price_change_1mo, price_change_1yr,
                volume_1wk, volume_1mo, volume_1yr,
                comment_count, competitive, resolution_source,
                creation_date, start_date, tags
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
                $15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,
                $27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,
                $39,$40,$41,$42,$43,$44,$45,$46,$47,$48,$49,$50,$51,$52
            )
            ON CONFLICT (market_id, snapshot_ts) DO UPDATE SET
                token_id_yes        = EXCLUDED.token_id_yes,
                token_id_no         = EXCLUDED.token_id_no,
                title               = EXCLUDED.title,
                category            = EXCLUDED.category,
                end_date            = EXCLUDED.end_date,
                description         = EXCLUDED.description,
                yes_price           = EXCLUDED.yes_price,
                no_price            = EXCLUDED.no_price,
                best_bid            = EXCLUDED.best_bid,
                best_ask            = EXCLUDED.best_ask,
                spread              = EXCLUDED.spread,
                mid_price           = EXCLUDED.mid_price,
                last_trade_price    = EXCLUDED.last_trade_price,
                last_trade_size     = EXCLUDED.last_trade_size,
                last_trade_ts       = EXCLUDED.last_trade_ts,
                volume_24h          = EXCLUDED.volume_24h,
                volume_total        = EXCLUDED.volume_total,
                liquidity           = EXCLUDED.liquidity,
                open_interest       = EXCLUDED.open_interest,
                volatility          = EXCLUDED.volatility,
                ma_short            = EXCLUDED.ma_short,
                ma_long             = EXCLUDED.ma_long,
                ema_slope           = EXCLUDED.ema_slope,
                overreaction_z      = EXCLUDED.overreaction_z,
                orderbook_imbalance = EXCLUDED.orderbook_imbalance,
                depth_liquidity     = EXCLUDED.depth_liquidity,
                slippage_bps        = EXCLUDED.slippage_bps,
                fair_value          = EXCLUDED.fair_value,
                expected_value      = EXCLUDED.expected_value,
                kelly_fraction      = EXCLUDED.kelly_fraction,
                trade_signal        = EXCLUDED.trade_signal,
                sentiment_momentum  = EXCLUDED.sentiment_momentum,
                late_overconfidence = EXCLUDED.late_overconfidence,
                predictive_score    = EXCLUDED.predictive_score,
                score_category      = EXCLUDED.score_category,
                price_change_1h     = EXCLUDED.price_change_1h,
                price_change_1d     = EXCLUDED.price_change_1d,
                price_change_1wk    = EXCLUDED.price_change_1wk,
                price_change_1mo    = EXCLUDED.price_change_1mo,
                price_change_1yr    = EXCLUDED.price_change_1yr,
                volume_1wk          = EXCLUDED.volume_1wk,
                volume_1mo          = EXCLUDED.volume_1mo,
                volume_1yr          = EXCLUDED.volume_1yr,
                comment_count       = EXCLUDED.comment_count,
                competitive         = EXCLUDED.competitive,
                resolution_source   = EXCLUDED.resolution_source,
                creation_date       = EXCLUDED.creation_date,
                start_date          = EXCLUDED.start_date,
                tags                = EXCLUDED.tags
            """,
            stats.get("market_id"),
            stats.get("token_id_yes"),
            stats.get("token_id_no"),
            _to_ts(stats.get("snapshot_ts")),
            stats.get("title"),
            stats.get("category"),
            _to_ts(stats.get("end_date")),
            stats.get("description"),
            stats.get("yes_price"),
            stats.get("no_price"),
            stats.get("best_bid"),
            stats.get("best_ask"),
            stats.get("spread"),
            stats.get("mid_price"),
            stats.get("last_trade_price"),
            stats.get("last_trade_size"),
            _to_ts(stats.get("last_trade_ts")),
            stats.get("volume_24h"),
            stats.get("volume_total"),
            stats.get("liquidity"),
            stats.get("open_interest"),
            stats.get("volatility"),
            stats.get("ma_short"),
            stats.get("ma_long"),
            stats.get("ema_slope"),
            stats.get("overreaction_z"),
            stats.get("orderbook_imbalance"),
            stats.get("depth_liquidity"),
            stats.get("slippage_bps"),
            stats.get("fair_value"),
            stats.get("expected_value"),
            stats.get("kelly_fraction"),
            stats.get("trade_signal"),
            stats.get("sentiment_momentum"),
            stats.get("late_overconfidence"),
            stats.get("predictive_score"),
            stats.get("score_category"),
            stats.get("price_change_1h"),
            stats.get("price_change_1d"),
            stats.get("price_change_1wk"),
            stats.get("price_change_1mo"),
            stats.get("price_change_1yr"),
            stats.get("volume_1wk"),
            stats.get("volume_1mo"),
            stats.get("volume_1yr"),
            stats.get("comment_count"),
            stats.get("competitive"),
            stats.get("resolution_source"),
            _to_ts(stats.get("creation_date")),
            _to_ts(stats.get("start_date")),
            stats.get("tags"),
        )


async def upsert_trades(token_id: str, market_id: str, trades: list[dict]) -> None:
    """Insert or ignore trades (no updates on conflict)."""
    if not trades:
        return
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.executemany(
            f"""
            INSERT INTO {TBL_TRADES} (trade_id, market_id, token_id, side, price, size, trade_ts, maker_addr, taker_addr)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (trade_id) DO NOTHING
            """,
            [
                (
                    t.get("trade_id"),
                    market_id,
                    token_id,
                    t.get("side"),
                    t.get("price"),
                    t.get("size"),
                    t.get("trade_ts"),
                    t.get("maker_addr"),
                    t.get("taker_addr"),
                )
                for t in trades
            ],
        )
