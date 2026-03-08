"""
PostgreSQL database connection and schema management.
Uses asyncpg connection pool for async FastAPI compatibility.
"""
import asyncpg
import datetime
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
"""

DDL_TRADES_IDX = f"""
CREATE INDEX IF NOT EXISTS idx_trades_market_id ON {TBL_TRADES} (market_id);
CREATE INDEX IF NOT EXISTS idx_trades_trade_ts  ON {TBL_TRADES} (trade_ts DESC);
"""

DDL_STATS = f"""
CREATE TABLE IF NOT EXISTS {TBL_STATS} (
    -- identity
    market_id            TEXT        NOT NULL,
    snapshot_ts          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- tokens
    token_id_yes         TEXT,
    token_id_no          TEXT,

    -- market metadata
    title                TEXT,
    category             TEXT,
    end_date             TIMESTAMPTZ,
    start_date           TIMESTAMPTZ,
    creation_date        TIMESTAMPTZ,
    description          TEXT,
    tags                 TEXT,
    resolution_source    TEXT,
    comment_count        INTEGER,
    competitive          BOOLEAN,

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
    volume_1wk           DOUBLE PRECISION,
    volume_1mo           DOUBLE PRECISION,
    volume_1yr           DOUBLE PRECISION,
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

    -- price changes
    price_change_1h      DOUBLE PRECISION,
    price_change_1d      DOUBLE PRECISION,
    price_change_1wk     DOUBLE PRECISION,
    price_change_1mo     DOUBLE PRECISION,
    price_change_1yr     DOUBLE PRECISION,

    PRIMARY KEY (market_id, snapshot_ts)
);
"""

DDL_STATS_IDX = f"""
CREATE INDEX IF NOT EXISTS idx_stats_market_id   ON {TBL_STATS} (market_id);
CREATE INDEX IF NOT EXISTS idx_stats_snapshot_ts ON {TBL_STATS} (snapshot_ts DESC);
CREATE INDEX IF NOT EXISTS idx_stats_category    ON {TBL_STATS} (category);
CREATE INDEX IF NOT EXISTS idx_stats_score       ON {TBL_STATS} (predictive_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_stats_liquidity   ON {TBL_STATS} (liquidity DESC NULLS LAST);
"""

# ---------------------------------------------------------------------------
# Connection pool (initialised in main.py startup)
# ---------------------------------------------------------------------------
_pool: Optional[asyncpg.Pool] = None


async def _set_search_path(conn):
    """Set search_path to current user's schema + public on every new connection."""
    current_user = await conn.fetchval("SELECT current_user")
    await conn.execute(f'CREATE SCHEMA IF NOT EXISTS "{current_user}"')
    await conn.execute(f'SET search_path TO "{current_user}", public')


async def create_pool() -> asyncpg.Pool:
    """Create and store the global asyncpg connection pool."""
    global _pool
    _pool = await asyncpg.create_pool(
        dsn=settings.DATABASE_URL,
        min_size=2,
        max_size=10,
        command_timeout=60,
        init=_set_search_path,
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
    try:
        conn = await asyncpg.connect(dsn=settings.DATABASE_URL)
        try:
            # Get current user and create their own schema if needed
            current_user = await conn.fetchval("SELECT current_user")
            print(f"✓ Connected as: {current_user}")

            # Create a schema named after the current user (always allowed)
            await conn.execute(f'CREATE SCHEMA IF NOT EXISTS "{current_user}"')
            await conn.execute(f'SET search_path TO "{current_user}", public')
            print(f"✓ Using schema: {current_user}")

            for ddl_name, ddl in [
                ("orderbook", DDL_ORDERBOOK),
                ("history", DDL_HISTORY),
                ("trades", DDL_TRADES),
                ("stats", DDL_STATS),
            ]:
                try:
                    await conn.execute(ddl)
                    print(f"✓ Table {ddl_name} ready")
                except Exception as e:
                    print(f"⚠ Table {ddl_name} failed: {e}")

            for stmt in (DDL_TRADES_IDX + DDL_STATS_IDX).strip().split("\n"):
                stmt = stmt.strip()
                if stmt:
                    try:
                        await conn.execute(stmt)
                    except Exception:
                        pass
        finally:
            await conn.close()
    except Exception as e:
        print(f"⚠ Could not create tables: {e}")


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------
def _to_ts(val):
    """Coerce a value to datetime or None."""
    if val is None:
        return None
    if isinstance(val, datetime.datetime):
        return val
    try:
        return datetime.datetime.fromisoformat(str(val))
    except Exception:
        return None


def _safe_float(val, default=None):
    if val is None:
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


def _safe_int(val, default=None):
    if val is None:
        return default
    try:
        return int(val)
    except (ValueError, TypeError):
        return default


def _safe_bool(val, default=None):
    if val is None:
        return default
    return bool(val)


# ---------------------------------------------------------------------------
# Upsert helpers
# ---------------------------------------------------------------------------
async def upsert_orderbook(token_id: str, snapshot_ts, rows: list) -> None:
    """Replace the orderbook snapshot for a token."""
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


async def upsert_history(token_id: str, bars: list) -> None:
    """Insert or update price history bars.
    
    Accepts bars with either 'ts'/'t'/'timestamp' key for the timestamp,
    and 'fidelity'/'fidelity_min' for the fidelity field.
    """
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
                    b.get("ts") or b.get("t") or b.get("timestamp"),
                    b.get("interval"),
                    b.get("fidelity") or b.get("fidelity_min"),
                    b.get("price"),
                )
                for b in bars
            ],
        )


async def upsert_market_stats(stats: dict) -> None:
    """Insert or update a market stats snapshot.

    Accepts both the extractor-native field names (e.g. yes_token_id,
    volume, volatility_1w) and the canonical DB column names
    (token_id_yes, volume_24h, volatility).  Either form is fine.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            f"""
            INSERT INTO {TBL_STATS} (
                market_id, snapshot_ts,
                token_id_yes, token_id_no,
                title, category, end_date, start_date, creation_date,
                description, tags, resolution_source, comment_count, competitive,
                yes_price, no_price, best_bid, best_ask, spread, mid_price,
                last_trade_price, last_trade_size, last_trade_ts,
                volume_24h, volume_total, volume_1wk, volume_1mo, volume_1yr,
                liquidity, open_interest,
                volatility, ma_short, ma_long, ema_slope, overreaction_z,
                orderbook_imbalance, depth_liquidity, slippage_bps,
                fair_value, expected_value, kelly_fraction, trade_signal,
                sentiment_momentum, late_overconfidence,
                predictive_score, score_category,
                price_change_1h, price_change_1d, price_change_1wk,
                price_change_1mo, price_change_1yr
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
                $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
                $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,
                $31,$32,$33,$34,$35,$36,$37,$38,$39,$40,
                $41,$42,$43,$44,$45,$46,$47,$48,$49,$50,
                $51
            )
            ON CONFLICT (market_id, snapshot_ts) DO UPDATE SET
                token_id_yes        = EXCLUDED.token_id_yes,
                token_id_no         = EXCLUDED.token_id_no,
                title               = EXCLUDED.title,
                category            = EXCLUDED.category,
                end_date            = EXCLUDED.end_date,
                start_date          = EXCLUDED.start_date,
                creation_date       = EXCLUDED.creation_date,
                description         = EXCLUDED.description,
                tags                = EXCLUDED.tags,
                resolution_source   = EXCLUDED.resolution_source,
                comment_count       = EXCLUDED.comment_count,
                competitive         = EXCLUDED.competitive,
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
                volume_1wk          = EXCLUDED.volume_1wk,
                volume_1mo          = EXCLUDED.volume_1mo,
                volume_1yr          = EXCLUDED.volume_1yr,
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
                price_change_1yr    = EXCLUDED.price_change_1yr
            """,
            # --- $1 .. $51 ---
            stats.get("market_id"),
            _to_ts(stats.get("snapshot_ts")),
            # tokens: accept both naming conventions
            stats.get("token_id_yes") or stats.get("yes_token_id"),
            stats.get("token_id_no")  or stats.get("no_token_id"),
            # metadata
            stats.get("title"),
            stats.get("category"),
            _to_ts(stats.get("end_date")),
            _to_ts(stats.get("start_date")),
            _to_ts(stats.get("creation_date") or stats.get("created_at")),
            stats.get("description"),
            # tags stored as JSON string if it's a list
            (str(stats["tags"]) if isinstance(stats.get("tags"), list) else stats.get("tags")),
            stats.get("resolution_source"),
            _safe_int(stats.get("comment_count")),
            _safe_bool(stats.get("competitive")),
            # pricing
            _safe_float(stats.get("yes_price")),
            _safe_float(stats.get("no_price")),
            _safe_float(stats.get("best_bid") or stats.get("best_bid_yes")),
            _safe_float(stats.get("best_ask") or stats.get("best_ask_yes")),
            _safe_float(stats.get("spread")),
            _safe_float(stats.get("mid_price") or stats.get("yes_midpoint")),
            # trades
            _safe_float(stats.get("last_trade_price")),
            _safe_float(stats.get("last_trade_size")),
            _to_ts(stats.get("last_trade_ts")),
            # volume / liquidity — accept both naming conventions
            _safe_float(stats.get("volume_24h") or stats.get("volume")),
            _safe_float(stats.get("volume_total") or stats.get("volume_clob")),
            _safe_float(stats.get("volume_1wk")),
            _safe_float(stats.get("volume_1mo")),
            _safe_float(stats.get("volume_1yr")),
            _safe_float(stats.get("liquidity")),
            _safe_float(stats.get("open_interest")),
            # technical indicators — accept both naming conventions
            _safe_float(stats.get("volatility") or stats.get("volatility_1w")),
            _safe_float(stats.get("ma_short")),
            _safe_float(stats.get("ma_long")),
            _safe_float(stats.get("ema_slope")),
            _safe_float(stats.get("overreaction_z")),
            # orderbook
            _safe_float(stats.get("orderbook_imbalance")),
            _safe_float(stats.get("depth_liquidity")),
            _safe_float(stats.get("slippage_bps") or stats.get("slippage_notional_1k")),
            # fair value / EV
            _safe_float(stats.get("fair_value")),
            _safe_float(stats.get("expected_value")),
            _safe_float(stats.get("kelly_fraction")),
            stats.get("trade_signal"),
            # sentiment
            _safe_float(stats.get("sentiment_momentum")),
            _safe_bool(stats.get("late_overconfidence")),
            # scoring
            _safe_float(stats.get("predictive_score")),
            stats.get("score_category"),
            # price changes
            _safe_float(stats.get("price_change_1h")),
            _safe_float(stats.get("price_change_1d")),
            _safe_float(stats.get("price_change_1wk")),
            _safe_float(stats.get("price_change_1mo")),
            _safe_float(stats.get("price_change_1yr")),
        )


async def upsert_trades(token_id: str, market_id: str, trades: list) -> None:
    """Insert or ignore trades (no updates on conflict)."""
    if not trades:
        return
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.executemany(
            f"""
            INSERT INTO {TBL_TRADES}
                (trade_id, market_id, token_id, side, price, size,
                 trade_ts, maker_addr, taker_addr)
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
