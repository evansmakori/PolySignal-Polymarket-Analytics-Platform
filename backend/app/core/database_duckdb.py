"""
DuckDB database layer — drop-in replacement for the asyncpg PostgreSQL layer.
Uses a single persistent DuckDB file. All public functions are async-compatible
so callers don't need to change.
"""
import os
import duckdb
import datetime
from typing import Optional, List, Dict, Any

# ---------------------------------------------------------------------------
# Table name constants (same as database.py)
# ---------------------------------------------------------------------------
TBL_OB     = "polymarket_orderbook"
TBL_HIST   = "polymarket_prices_history"
TBL_STATS  = "polymarket_market_stats_compat"  # normalised view over the raw table
TBL_TRADES = "polymarket_trades"
# Raw table name (used for upserts)
TBL_STATS_RAW = "polymarket_market_stats"

# ---------------------------------------------------------------------------
# DuckDB file path — use the markets.duckdb at the repo root
# ---------------------------------------------------------------------------
_DB_PATH = os.environ.get(
    "DUCKDB_PATH",
    os.path.join(os.path.dirname(__file__), "..", "..", "markets.duckdb"),
)

import threading
import asyncio
_tl = threading.local()  # Thread-local storage for per-thread connections and caches
_db_write_lock = asyncio.Lock()  # Serialize concurrent async DB writes


def _get_conn() -> duckdb.DuckDBPyConnection:
    """Return a thread-local DuckDB connection (one connection per thread).
    
    Each thread gets its own connection to the same DuckDB file.
    Retries connection if the DB file is temporarily locked by a reloading process.
    """
    import time
    if not hasattr(_tl, 'conn') or _tl.conn is None:
        # Retry loop: DuckDB may be briefly locked during uvicorn --reload restarts
        for attempt in range(5):
            try:
                conn = duckdb.connect(_DB_PATH)
                tables = [r[0] for r in conn.execute("SHOW TABLES").fetchall()]
                if 'polymarket_market_stats' in tables:
                    _tl.conn = conn
                    break
                else:
                    conn.close()
                    print(f"DB connect attempt {attempt+1}: polymarket_market_stats not visible yet, retrying...")
                    time.sleep(1)
            except Exception as e:
                print(f"DB connect attempt {attempt+1} failed: {e}, retrying...")
                time.sleep(1)
        else:
            # Last resort: connect without checking
            _tl.conn = duckdb.connect(_DB_PATH)
            print("WARNING: Could not verify polymarket_market_stats after 5 attempts")
    return _tl.conn


def _get_stats_columns() -> List[str]:
    """Return thread-local cached column list for polymarket_market_stats table."""
    if not hasattr(_tl, 'stats_columns') or _tl.stats_columns is None:
        con = _get_conn()
        try:
            # Use DESCRIBE — most reliable way to get columns in DuckDB
            rows = con.execute("DESCRIBE polymarket_market_stats").fetchall()
            _tl.stats_columns = [r[0] for r in rows]  # column 0 is the name
        except Exception as e:
            print(f"Warning: could not fetch column list via PRAGMA: {e}")
            try:
                # Fallback: SELECT * LIMIT 0 and read column names
                result = con.execute("SELECT * FROM polymarket_market_stats LIMIT 0")
                _tl.stats_columns = [desc[0] for desc in result.description]
            except Exception as e2:
                print(f"Warning: fallback also failed: {e2}")
                _tl.stats_columns = []
    return _tl.stats_columns


# ---------------------------------------------------------------------------
# DDL
# ---------------------------------------------------------------------------
DDL_ORDERBOOK = f"""
CREATE TABLE IF NOT EXISTS {TBL_OB} (
    token_id     TEXT        NOT NULL,
    snapshot_ts  TIMESTAMPTZ NOT NULL,
    side         TEXT        NOT NULL,
    level        INTEGER     NOT NULL,
    price        DOUBLE      NOT NULL,
    size         DOUBLE      NOT NULL,
    PRIMARY KEY (token_id, snapshot_ts, side, level)
);
"""

DDL_HISTORY = f"""
CREATE TABLE IF NOT EXISTS {TBL_HIST} (
    token_id     TEXT        NOT NULL,
    t            TIMESTAMPTZ NOT NULL,
    interval     TEXT,
    fidelity_min INTEGER,
    price        DOUBLE,
    PRIMARY KEY (token_id, t)
);
"""

DDL_TRADES = f"""
CREATE TABLE IF NOT EXISTS {TBL_TRADES} (
    trade_id     TEXT        PRIMARY KEY,
    market_id    TEXT        NOT NULL,
    token_id     TEXT        NOT NULL,
    side         TEXT,
    price        DOUBLE,
    size         DOUBLE,
    trade_ts     TIMESTAMPTZ,
    maker_addr   TEXT,
    taker_addr   TEXT,
    fetched_at   TIMESTAMPTZ DEFAULT NOW()
);
"""

DDL_STATS = f"""
CREATE TABLE IF NOT EXISTS {TBL_STATS} (
    market_id            TEXT        NOT NULL,
    token_id_yes         TEXT,
    token_id_no          TEXT,
    snapshot_ts          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    title                TEXT,
    category             TEXT,
    end_date             TIMESTAMPTZ,
    description          TEXT,
    yes_price            DOUBLE,
    no_price             DOUBLE,
    best_bid             DOUBLE,
    best_ask             DOUBLE,
    spread               DOUBLE,
    mid_price            DOUBLE,
    last_trade_price     DOUBLE,
    last_trade_size      DOUBLE,
    last_trade_ts        TIMESTAMPTZ,
    volume_24h           DOUBLE,
    volume_total         DOUBLE,
    liquidity            DOUBLE,
    open_interest        DOUBLE,
    volatility           DOUBLE,
    ma_short             DOUBLE,
    ma_long              DOUBLE,
    ema_slope            DOUBLE,
    overreaction_z       DOUBLE,
    orderbook_imbalance  DOUBLE,
    depth_liquidity      DOUBLE,
    slippage_bps         DOUBLE,
    fair_value           DOUBLE,
    expected_value       DOUBLE,
    kelly_fraction       DOUBLE,
    trade_signal         TEXT,
    sentiment_momentum   DOUBLE,
    late_overconfidence  BOOLEAN,
    predictive_score     DOUBLE,
    score_category       TEXT,
    price_change_1h      DOUBLE,
    price_change_1d      DOUBLE,
    price_change_1wk     DOUBLE,
    price_change_1mo     DOUBLE,
    price_change_1yr     DOUBLE,
    volume_1wk           DOUBLE,
    volume_1mo           DOUBLE,
    volume_1yr           DOUBLE,
    comment_count        INTEGER,
    competitive          BOOLEAN,
    resolution_source    TEXT,
    creation_date        TIMESTAMPTZ,
    start_date           TIMESTAMPTZ,
    tags                 TEXT,
    PRIMARY KEY (market_id, snapshot_ts)
);
"""


# ---------------------------------------------------------------------------
# Startup / shutdown (called from main.py lifespan)
# ---------------------------------------------------------------------------
async def create_pool():
    """Open DuckDB connection (replaces asyncpg create_pool)."""
    _get_conn()
    return True


async def get_pool():
    """Return DuckDB connection (interface compatibility)."""
    return _get_conn()


async def close_pool():
    """Close thread-local DuckDB connection."""
    if hasattr(_tl, 'conn') and _tl.conn:
        _tl.conn.close()
        _tl.conn = None


async def ensure_tables():
    """Create all tables if they don't already exist."""
    con = _get_conn()
    con.execute(DDL_ORDERBOOK)
    con.execute(DDL_HISTORY)
    con.execute(DDL_TRADES)
    # Only create the compat table DDL if polymarket_market_stats doesn't exist yet
    tables = [r[0] for r in con.execute("SHOW TABLES").fetchall()]
    if 'polymarket_market_stats' not in tables:
        con.execute(DDL_STATS)
    # Warm up the column cache now while we have a clean connection
    _tl.stats_columns = None  # Force refresh
    _get_stats_columns()
    print(f"✓ Stats table columns cached: {len(_get_stats_columns())} cols")
    # Create a compatibility view that aliases the extractor schema columns
    # to the names expected by market_service.py queries.
    # Drop any old compat TABLE (from previous runs) so the VIEW can be created
    try:
        con.execute("DROP TABLE IF EXISTS polymarket_market_stats_compat")
    except Exception:
        pass

    # Detect which schema the existing table uses and build a normalised view
    # that always exposes the column names expected by market_service.py.
    try:
        existing_cols = [
            r[0] for r in con.execute(
                "DESCRIBE polymarket_market_stats"
            ).fetchall()
        ]

        def _col(preferred, fallback, default="NULL"):
            if preferred in existing_cols:
                return f"{preferred}"
            elif fallback and fallback in existing_cols:
                return f"{fallback} AS {preferred}"
            else:
                return f"{default} AS {preferred}"

        # Build a unified SELECT that always has the service-expected names
        select_parts = [
            "market_id",
            "snapshot_ts",
            "title",
            "category",
            _col("token_id_yes", "yes_token_id"),
            _col("token_id_no",  "no_token_id"),
            "yes_price",
            "no_price",
            _col("volume_24h",  "volume"),
            _col("volume_total","volume_clob"),
            "volume_1wk",
            "volume_1mo",
            "liquidity",
            "spread",
            "last_trade_price",
            "trade_signal",
            "fair_value",
            "expected_value",
            "kelly_fraction",
            "sentiment_momentum",
            "orderbook_imbalance",
            _col("volatility",  "volatility_1w"),
            "ma_short",
            "ma_long",
            "ema_slope",
            _col("predictive_score",  None, "NULL"),
            _col("score_category",    None, "NULL"),
            _col("price_change_1h",   None, "NULL"),
            "price_change_1d",
            "price_change_1wk",
            "price_change_1mo",
            "price_change_1yr",
            _col("open_interest",     None, "0.0"),
            _col("comment_count",     None, "0"),
            _col("competitive",       None, "NULL"),
            _col("resolution_source", None, "NULL"),
            _col("creation_date",     "created_at"),
            "start_date",
            "end_date",
            _col("tags",              None, "NULL"),
            _col("description",       None, "NULL"),
            _col("best_bid",          "best_bid_yes"),
            _col("best_ask",          "best_ask_yes"),
            _col("mid_price",         "yes_midpoint"),
            _col("late_overconfidence", None, "NULL"),
        ]

        view_sql = (
            "CREATE OR REPLACE VIEW polymarket_market_stats_compat AS SELECT "
            + ", ".join(select_parts)
            + " FROM polymarket_market_stats"
        )
        con.execute(view_sql)
    except Exception as e:
        print(f"Warning: could not create compat view: {e}")


# ---------------------------------------------------------------------------
# Helper: convert asyncpg-style rows to plain dicts
# ---------------------------------------------------------------------------
def _rows_to_dicts(cursor) -> List[Dict[str, Any]]:
    cols = [d[0] for d in cursor.description]
    return [dict(zip(cols, row)) for row in cursor.fetchall()]


def _row_to_dict(cursor) -> Optional[Dict[str, Any]]:
    cols = [d[0] for d in cursor.description]
    row = cursor.fetchone()
    return dict(zip(cols, row)) if row else None


# ---------------------------------------------------------------------------
# Thin "connection" wrapper so MarketService can call conn.fetch / conn.fetchrow
# without changes, using DuckDB under the hood.
# ---------------------------------------------------------------------------
class _FakeConn:
    """Mimics asyncpg connection interface for SELECT queries."""

    def __init__(self, con: duckdb.DuckDBPyConnection):
        self._con = con

    def _adapt_query(self, query: str, args) -> tuple:
        """Convert $1,$2,... placeholders to ? placeholders for DuckDB."""
        import re
        result = re.sub(r'\$\d+', '?', query)
        return result, list(args)

    async def fetch(self, query: str, *args) -> List[Dict[str, Any]]:
        q, params = self._adapt_query(query, args)
        cur = self._con.execute(q, params)
        return _rows_to_dicts(cur)

    async def fetchrow(self, query: str, *args) -> Optional[Dict[str, Any]]:
        q, params = self._adapt_query(query, args)
        cur = self._con.execute(q, params)
        return _row_to_dict(cur)

    async def execute(self, query: str, *args) -> None:
        q, params = self._adapt_query(query, args)
        self._con.execute(q, params)

    async def executemany(self, query: str, args_list) -> None:
        q, _ = self._adapt_query(query, [])
        for params in args_list:
            self._con.execute(q, list(params))

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass


class _FakePool:
    """Mimics asyncpg pool interface."""

    def __init__(self, con: duckdb.DuckDBPyConnection):
        self._con = con

    def acquire(self):
        return _FakeConn(self._con)

    async def fetch(self, query: str, *args):
        return await _FakeConn(self._con).fetch(query, *args)

    async def fetchrow(self, query: str, *args):
        return await _FakeConn(self._con).fetchrow(query, *args)

    async def execute(self, query: str, *args):
        return await _FakeConn(self._con).execute(query, *args)


# Override get_pool to return the FakePool so MarketService works unchanged
async def get_pool() -> _FakePool:  # noqa: F811
    return _FakePool(_get_conn())


# ---------------------------------------------------------------------------
# Upsert helpers (same signatures as database.py)
# ---------------------------------------------------------------------------
async def upsert_orderbook(token_id: str, snapshot_ts, rows: list) -> None:
    async with _db_write_lock:
        con = _get_conn()
        if isinstance(snapshot_ts, datetime.datetime):
            snapshot_ts = snapshot_ts.isoformat()
        con.execute(
            f"DELETE FROM {TBL_OB} WHERE token_id = ? AND snapshot_ts = ?",
            [token_id, snapshot_ts],
        )
        for r in rows:
            con.execute(
                f"""
                INSERT OR REPLACE INTO {TBL_OB}
                    (token_id, snapshot_ts, side, level, price, size)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                [token_id, snapshot_ts, r["side"], r["level"], r["price"], r["size"]],
            )


async def upsert_history(token_id: str, bars: list) -> None:
    if not bars:
        return
    async with _db_write_lock:
        con = _get_conn()
        for b in bars:
            ts = b.get("t") or b.get("ts") or b.get("timestamp")
            con.execute(
                f"""
                INSERT OR REPLACE INTO {TBL_HIST} (token_id, t, interval, fidelity_min, price)
                VALUES (?, ?, ?, ?, ?)
                """,
                [token_id, ts, b.get("interval"), b.get("fidelity_min") or b.get("fidelity"), b.get("price")],
            )


def _to_ts(val):
    if val is None:
        return None
    if isinstance(val, datetime.datetime):
        return val
    try:
        return datetime.datetime.fromisoformat(str(val))
    except Exception:
        return None


async def upsert_market_stats(stats: dict) -> None:
    """
    Upsert market stats using the real extractor column schema.
    Uses INSERT OR REPLACE with only the columns that exist in the real DB.
    """
    con = _get_conn()
    actual_cols = _get_stats_columns()

    # Build the row from extractor field names matching actual DB columns
    row = {
        "market_id":               stats.get("market_id"),
        "yes_token_id":            stats.get("yes_token_id") or stats.get("token_id_yes"),
        "no_token_id":             stats.get("no_token_id") or stats.get("token_id_no"),
        "snapshot_ts":             _to_ts(stats.get("snapshot_ts")),
        "title":                   stats.get("title"),
        "category":                stats.get("category"),
        "end_date":                _to_ts(stats.get("end_date")),
        "yes_price":               stats.get("yes_price"),
        "no_price":                stats.get("no_price"),
        "best_bid_yes":            stats.get("best_bid_yes") or stats.get("best_bid"),
        "best_ask_yes":            stats.get("best_ask_yes") or stats.get("best_ask"),
        "best_bid_no":             stats.get("best_bid_no"),
        "best_ask_no":             stats.get("best_ask_no"),
        "yes_midpoint":            stats.get("yes_midpoint") or stats.get("mid_price"),
        "spread":                  stats.get("spread"),
        "last_trade_price":        stats.get("last_trade_price"),
        "volume":                  stats.get("volume") or stats.get("volume_24h"),
        "volume_clob":             stats.get("volume_clob") or stats.get("volume_total"),
        "volume_1wk":              stats.get("volume_1wk"),
        "volume_1mo":              stats.get("volume_1mo"),
        "volume_1yr":              stats.get("volume_1yr"),
        "liquidity":               stats.get("liquidity"),
        "liquidity_clob":          stats.get("liquidity_clob"),
        "open_interest":           stats.get("open_interest"),
        "volatility_1w":           stats.get("volatility_1w") or stats.get("volatility"),
        "ma_short":                stats.get("ma_short"),
        "ma_long":                 stats.get("ma_long"),
        "ema_slope":               stats.get("ema_slope"),
        "overreaction_flag":       stats.get("overreaction_flag"),
        "orderbook_imbalance":     stats.get("orderbook_imbalance"),
        "slippage_notional_1k":    stats.get("slippage_notional_1k") or stats.get("slippage_bps"),
        "slippage_notional_10k":   stats.get("slippage_notional_10k"),
        "fair_value":              stats.get("fair_value"),
        "expected_value":          stats.get("expected_value"),
        "kelly_fraction":          stats.get("kelly_fraction"),
        "trade_signal":            stats.get("trade_signal"),
        "sentiment_momentum":      stats.get("sentiment_momentum"),
        "late_overconfidence":     stats.get("late_overconfidence"),
        "base_rate":               stats.get("base_rate"),
        "base_rate_deviation":     stats.get("base_rate_deviation"),
        "liquidity_score":         stats.get("liquidity_score"),
        "degen_risk":              stats.get("degen_risk"),
        "price_change_1h":         stats.get("price_change_1h"),
        "price_change_1d":         stats.get("price_change_1d"),
        "price_change_1wk":        stats.get("price_change_1wk"),
        "price_change_1mo":        stats.get("price_change_1mo"),
        "price_change_1yr":        stats.get("price_change_1yr"),
        "open_interest":           stats.get("open_interest"),
        "comment_count":           stats.get("comment_count"),
        "competitive":             stats.get("competitive"),
        "resolution_source":       stats.get("resolution_source"),
        "start_date":              _to_ts(stats.get("start_date")),
        "created_at":              _to_ts(stats.get("created_at") or stats.get("creation_date")),
        "active":                  stats.get("active"),
        "closed":                  stats.get("closed"),
        "funded":                  stats.get("funded"),
        "neg_risk":                stats.get("neg_risk"),
        "neg_risk_other":          stats.get("neg_risk_other"),
        "min_tick":                stats.get("min_tick"),
        "clob_last_trade_anomaly": stats.get("clob_last_trade_anomaly"),
        "accepting_orders_since":  _to_ts(stats.get("accepting_orders_since")),
        "automatically_resolved":  stats.get("automatically_resolved"),
        "uma_resolution_status":   stats.get("uma_resolution_status"),
    }

    # If cache is empty, force a refresh before filtering
    if not actual_cols:
        _tl.stats_columns = None
        actual_cols = _get_stats_columns()

    # Filter to only columns that actually exist in the table
    if actual_cols:
        row = {k: v for k, v in row.items() if k in actual_cols}

    # Remove None values for cleaner inserts (optional columns)
    cols = list(row.keys())
    vals = list(row.values())

    placeholders = ",".join(["?" for _ in cols])
    col_str = ",".join(cols)

    async with _db_write_lock:
        try:
            con.execute(
                f"INSERT OR REPLACE INTO {TBL_STATS_RAW} ({col_str}) VALUES ({placeholders})",
                vals,
            )
        except Exception as e:
            print(f"ERROR in upsert_market_stats for {stats.get('market_id')}: {e}")
            print(f"  cols attempted: {cols}")
            raise


async def upsert_trades(token_id: str, market_id: str, trades: list) -> None:
    if not trades:
        return
    async with _db_write_lock:
        con = _get_conn()
        for t in trades:
            con.execute(
                f"""
                INSERT OR IGNORE INTO {TBL_TRADES}
                    (trade_id, market_id, token_id, side, price, size, trade_ts, maker_addr, taker_addr)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    t.get("trade_id"),
                    market_id,
                    token_id,
                    t.get("side"),
                    t.get("price"),
                    t.get("size"),
                    t.get("trade_ts"),
                    t.get("maker_addr"),
                    t.get("taker_addr"),
                ],
            )
