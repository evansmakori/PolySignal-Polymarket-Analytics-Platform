"""
Main extraction logic - assembles market stats from all data sources
"""
import math
import asyncio
import time
from concurrent.futures import ThreadPoolExecutor
import pandas as pd
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone

# ─── In-memory TTL cache ───────────────────────────────────────────────────────
# Key: normalized URL string, Value: (result_dict, timestamp)
_extraction_cache: Dict[str, tuple] = {}
_CACHE_TTL_SECONDS = 300  # 5 minutes


def _cache_key(url: str) -> str:
    """Normalize URL to a consistent cache key."""
    return url.strip().rstrip("/").lower()


def _cache_get(url: str):
    """Return cached result if fresh, else None."""
    key = _cache_key(url)
    if key in _extraction_cache:
        result, ts = _extraction_cache[key]
        if time.time() - ts < _CACHE_TTL_SECONDS:
            print(f"✓ Cache hit for {key} (age: {int(time.time()-ts)}s)")
            return result
        else:
            del _extraction_cache[key]
    return None


def _cache_set(url: str, result: dict):
    """Store result in in-memory cache."""
    key = _cache_key(url)
    _extraction_cache[key] = (result, time.time())
    print(f"✓ Cached extraction for {key}")
# ──────────────────────────────────────────────────────────────────────────────

from .polymarket import (
    resolve_markets_from_url,
    get_yes_no_token_ids,
    fetch_orderbook,
    fetch_prices_history,
    _utc_now,
)
from .analytics import (
    _get_category,
    _best_ask,
    _best_bid,
    _compute_depth_liquidity,
    _round_to_tick,
    _latest_hist_price,
    regression_slope,
    compute_volatility,
    compute_moving_averages,
    compute_ema_slope,
    detect_overreaction,
    compute_orderbook_imbalance,
    compute_slippage,
    compute_fair_value,
    compute_ev,
    compute_kelly,
    compute_trade_signal,
    detect_late_overconfidence,
)
from .database import (
    upsert_orderbook,
    upsert_history,
    upsert_market_stats,
)
from .config import settings


def _safe_float(v, default: float = 0.0) -> float:
    """Safely convert any value to float, returning default on failure."""
    if v is None:
        return default
    try:
        return float(v)
    except (ValueError, TypeError):
        return default


def assemble_market_stats(
    market: Dict[str, Any],
    event: Optional[Dict[str, Any]],
    ob_map: Dict[str, Dict[str, Any]],
    hist_map: Dict[Tuple[str, str], List[Dict[str, Any]]],
    asof: datetime,
    base_rate: float = None,
) -> Dict[str, Any]:
    """
    Build a single market stats row using Polymarket's display conventions.
    """
    if base_rate is None:
        base_rate = settings.BASE_RATE

    # Helper functions
    def _display_price_from_ob(ob: Optional[Dict[str, Any]], last_trade_fallback: Optional[float]) -> Optional[float]:
        if not ob:
            return last_trade_fallback
        bb, ba = _best_bid(ob), _best_ask(ob)
        last = last_trade_fallback
        if last is None:
            last = ob.get("last_trade_price", None)

        if bb is not None and ba is not None:
            spread = float(ba) - float(bb)
            if spread > 0.10 and last is not None:
                return float(last)
            return (float(bb) + float(ba)) / 2.0
        return last or bb or ba

    # Identity & metadata
    market_id = market.get("id") or market.get("marketId") or market.get("conditionId")
    title = market.get("question") or market.get("title")
    category = _get_category(market, event)
    yes_token_id, no_token_id, mapping_meta = get_yes_no_token_ids(market)

    ob_yes = ob_map.get(yes_token_id) if yes_token_id else None
    ob_no = ob_map.get(no_token_id) if no_token_id else None

    # Best quotes, spread, tick
    yes_best_ask = _best_ask(ob_yes)
    yes_best_bid = _best_bid(ob_yes)
    no_best_ask = _best_ask(ob_no)
    no_best_bid = _best_bid(ob_no)

    yes_midpoint = (yes_best_bid + yes_best_ask) / 2.0 if (yes_best_bid is not None and yes_best_ask is not None) else None
    no_midpoint = (no_best_bid + no_best_ask) / 2.0 if (no_best_bid is not None and no_best_ask is not None) else None

    spread = market.get("spread")
    if spread is None and (yes_best_ask is not None) and (yes_best_bid is not None):
        spread = max(0.0, float(yes_best_ask) - float(yes_best_bid))

    tick_size = (ob_yes or {}).get("tick_size") or market.get("orderPriceMinTickSize") or 0.01
    min_order_size = (ob_yes or {}).get("min_order_size") or market.get("orderMinSize")

    # History & last trade
    hist_yes_1w = hist_map.get((yes_token_id, "1w"), []) if yes_token_id else []
    hist_yes_1m = hist_map.get((yes_token_id, "1m"), []) if yes_token_id else []
    last_trade_from_hist = _latest_hist_price(hist_yes_1w) or _latest_hist_price(hist_yes_1m)

    last_trade_price = last_trade_from_hist or (ob_yes or {}).get("last_trade_price")

    # Display prices
    neg_risk = bool(market.get("negRisk", False))

    clob_last_trade_anomaly = False
    if yes_token_id and no_token_id:
        lt_yes = (ob_yes or {}).get("last_trade_price")
        lt_no = (ob_no or {}).get("last_trade_price")
        if neg_risk and (lt_yes is not None) and (lt_no is not None) and float(lt_yes) == float(lt_no):
            clob_last_trade_anomaly = True

    yes_display = _display_price_from_ob(ob_yes, last_trade_fallback=last_trade_price)

    hist_no_1w = hist_map.get((no_token_id, "1w"), []) if no_token_id else []
    hist_no_1m = hist_map.get((no_token_id, "1m"), []) if no_token_id else []
    last_trade_no_hist = _latest_hist_price(hist_no_1w) or _latest_hist_price(hist_no_1m)
    last_trade_no = last_trade_no_hist or (ob_no or {}).get("last_trade_price")
    no_display = _display_price_from_ob(ob_no, last_trade_fallback=last_trade_no)

    is_binary = (yes_token_id is not None) and (no_token_id is not None)

    yes_display_price = _round_to_tick(yes_display, tick_size)
    no_display_price = _round_to_tick(no_display, tick_size)

    ui_yes_price = yes_display_price
    if is_binary and (ui_yes_price is not None) and (not neg_risk):
        ui_no_price = _round_to_tick(1.0 - ui_yes_price, tick_size)
    else:
        ui_no_price = no_display_price

    yes_display = ui_yes_price
    no_display = ui_no_price

    # YES series for analytics
    yes_series = None
    if hist_yes_1w:
        df_tmp = pd.DataFrame(hist_yes_1w).sort_values("t")
        yes_series = df_tmp["price"].astype(float)
        yes_series.index = pd.to_datetime(df_tmp["t"], utc=True)

    # Analytics
    volatility = compute_volatility(yes_series)
    ma_short, ma_long = compute_moving_averages(yes_series)
    ema_sl = compute_ema_slope(yes_series)
    overreaction = detect_overreaction(yes_series)
    imbalance = compute_orderbook_imbalance(ob_yes)
    slip_1k = compute_slippage(ob_yes, 1000)
    slip_10k = compute_slippage(ob_yes, 10000)

    fair_value = compute_fair_value(yes_display, base_rate, ema_sl, volatility)
    ev = compute_ev(fair_value, yes_display)
    kelly = compute_kelly(fair_value, yes_display)
    signal = compute_trade_signal(ev, volatility)
    overconf = detect_late_overconfidence(yes_display, imbalance, no_best_bid)

    # Custom metrics
    slope = regression_slope(hist_yes_1w) if hist_yes_1w else 0.0
    depth_liq = _compute_depth_liquidity(ob_yes)
    ev_liq = (event or {}).get("liquidity", 0)
    ev_liq_clob = (event or {}).get("liquidityClob", 0)

    base_rate_deviation = (yes_display - base_rate) if yes_display is not None else None
    liq_score = math.log1p(max(depth_liq + float(ev_liq or 0) + float(ev_liq_clob or 0), 0)) / (1+float(spread or 0))
    spread_norm = min(max(float(spread or 0), 0), 0.5)/0.5
    mom_norm = min(abs(slope)*10, 1)
    liq_inv = 1 - (liq_score / (1+liq_score))
    degen_risk = 0.45*spread_norm + 0.35*mom_norm + 0.20*liq_inv

    return {
        "market_id": str(market_id),
        "snapshot_ts": asof,
        "title": title,
        "category": category,

        "yes_token_id": yes_token_id,
        "no_token_id": no_token_id,

        "clob_last_trade_anomaly": clob_last_trade_anomaly,

        "yes_price": ui_yes_price,
        "no_price": ui_no_price,

        "best_ask_yes": yes_best_ask,
        "best_bid_yes": yes_best_bid,
        "best_ask_no": no_best_ask,
        "best_bid_no": no_best_bid,

        "yes_midpoint": _round_to_tick(yes_midpoint, tick_size),
        "no_midpoint": _round_to_tick(no_midpoint, tick_size),
        "yes_last_trade": _round_to_tick(last_trade_from_hist, tick_size),
        "no_last_trade": _round_to_tick(last_trade_no_hist, tick_size),
        "yes_display_price": yes_display_price,
        "no_display_price": no_display_price,
        "ui_yes_price": ui_yes_price,
        "ui_no_price": ui_no_price,

        "token_mapping_source": mapping_meta.get("mapping_source"),
        "token_mapping_ok": bool(mapping_meta.get("mapping_ok")),
        "token_mapping_warning": mapping_meta.get("mapping_warning"),
        "token_mapping_anomaly": bool(mapping_meta.get("outcomes")) and (not bool(mapping_meta.get("mapping_ok"))),

        "last_trade_price": last_trade_price,

        "volume": market.get("volumeNum", 0),
        "volume_clob": market.get("volumeClob", 0),
        "volume_1wk": float(market.get("volume1wk") or 0),
        "volume_1mo": float(market.get("volume1mo") or 0),
        "volume_1yr": float(market.get("volume1yr") or 0),
        "liquidity": ev_liq,
        "liquidity_clob": ev_liq_clob,

        "spread": spread,
        "order_min_size": min_order_size,
        "min_tick": tick_size,

        "price_change_1h": market.get("oneHourPriceChange"),
        "price_change_1d": market.get("oneDayPriceChange"),
        "price_change_1wk": market.get("oneWeekPriceChange"),
        "price_change_1mo": market.get("oneMonthPriceChange"),
        "price_change_1yr": market.get("oneYearPriceChange"),

        "open_interest": _safe_float(market.get("openInterest") or (event.get("openInterest") if event else None)),
        "comment_count": int(market.get("commentCount") or 0),
        "competitive": bool(market.get("competitive", False)),
        "resolution_source": market.get("resolutionSource"),
        "creation_date": market.get("creationDate"),
        "start_date": market.get("startDateIso"),
        "tags": market.get("tags"),

        "end_date": market.get("endDateIso"),
        "accepting_orders_since": market.get("acceptingOrdersTimestamp"),

        "active": market.get("active", False),
        "closed": market.get("closed", False),
        "funded": market.get("funded"),
        "ready": market.get("ready"),

        "neg_risk": neg_risk,
        "neg_risk_other": market.get("negRiskOther"),
        "uma_resolution_status": market.get("umaResolutionStatus"),
        "automatically_resolved": market.get("automaticallyResolved"),

        "created_at": market.get("createdAt"),
        "updated_at": market.get("updatedAt"),

        "volatility_1w": volatility,
        "ma_short": ma_short,
        "ma_long": ma_long,
        "ema_slope": ema_sl,
        "overreaction_flag": bool(overreaction),
        "orderbook_imbalance": imbalance,
        "slippage_notional_1k": slip_1k,
        "slippage_notional_10k": slip_10k,
        "fair_value": fair_value,
        "expected_value": ev,
        "kelly_fraction": kelly,
        "trade_signal": signal,
        "late_overconfidence": overconf,

        "base_rate": base_rate,
        "base_rate_deviation": base_rate_deviation,
        "sentiment_momentum": slope,
        "liquidity_score": liq_score,
        "degen_risk": degen_risk
    }


async def extract_from_url(
    url: str,
    depth: int = None,
    intervals: List[str] = None,
    fidelity_min: int = None,
    base_rate: float = None,
    progress_callback=None,
) -> Dict[str, Any]:
    """
    One-shot extraction for a single URL.
    Returns summary dict with market_ids processed.
    """
    if depth is None:
        depth = settings.DEFAULT_DEPTH
    if intervals is None:
        intervals = ["1w"]  # Only fetch 1w history by default to keep extraction fast
    if fidelity_min is None:
        fidelity_min = settings.DEFAULT_FIDELITY
    if base_rate is None:
        base_rate = settings.BASE_RATE

    # ── Check in-memory cache first (fastest) ──────────────────────────────
    original_url = url if isinstance(url, str) else None
    if original_url:
        cached = _cache_get(original_url)
        if cached:
            if progress_callback:
                progress_callback("Loaded from cache (instant)!")
            return {**cached, "from_cache": True, "cache_type": "memory"}

    if isinstance(url, tuple):
        # Pre-resolved markets passed directly (url, event_obj) tuple
        markets, event_obj = url
    else:
        markets, event_obj = resolve_markets_from_url(url)
    asof = _utc_now() if settings.USE_UTC else datetime.now()

    # ── Check DB cache (fresh data < 5 min old) ────────────────────────────
    if original_url and markets:
        from .database import get_pool
        try:
            pool = await get_pool()
            async with pool.acquire() as conn:
                market_ids = [
                    str(m.get("id") or m.get("marketId") or m.get("conditionId"))
                    for m in markets
                ]
                # Check if all markets have fresh data in DB (< 5 min old)
                fresh_count = await conn.fetchval(
                    """SELECT COUNT(*) FROM polymarket_market_stats
                       WHERE market_id = ANY($1::text[])
                       AND snapshot_ts > NOW() - INTERVAL '5 minutes'""",
                    market_ids
                )
                if fresh_count and fresh_count >= len(markets):
                    print(f"✓ DB cache hit: {fresh_count} fresh markets found")
                    if progress_callback:
                        progress_callback("Loaded from database cache (fast)!")
                    result = {
                        "success": True,
                        "markets_processed": len(markets),
                        "message": f"Loaded {len(markets)} market(s) from cache",
                        "market_ids": market_ids,
                        "from_cache": True,
                        "cache_type": "database",
                    }
                    if original_url:
                        _cache_set(original_url, result)
                    return result
        except Exception as e:
            print(f"⚠ DB cache check failed: {e}")
    # ──────────────────────────────────────────────────────────────────────

    # Collect all token IDs needed across all markets
    token_meta = {}  # token_id -> (market, side)
    for market in markets:
        yes_token_id, no_token_id, _ = get_yes_no_token_ids(market)
        if yes_token_id:
            token_meta[yes_token_id] = "yes"
        if no_token_id:
            token_meta[no_token_id] = "no"

    all_token_ids = list(token_meta.keys())

    # Fetch all orderbooks and histories in parallel using a thread pool
    # Use a semaphore to avoid rate-limiting from Polymarket
    loop = asyncio.get_running_loop()  # Correct for Python 3.10+ (get_event_loop deprecated)
    executor = ThreadPoolExecutor(max_workers=8)
    semaphore = asyncio.Semaphore(6)  # Max 6 concurrent requests to Polymarket

    async def fetch_ob_async(token_id):
        async with semaphore:
            ob = await loop.run_in_executor(executor, fetch_orderbook, token_id, depth)
        return token_id, ob

    async def fetch_hist_async(token_id, interval):
        async with semaphore:
            rows = await loop.run_in_executor(executor, fetch_prices_history, token_id, interval, fidelity_min)
        return (token_id, interval), rows

    def _progress(msg):
        if progress_callback:
            progress_callback(msg)

    # Run all fetches concurrently (with semaphore throttling)
    _progress(f"Fetching orderbooks & price history for {len(all_token_ids)} tokens in parallel...")
    ob_tasks = [fetch_ob_async(tid) for tid in all_token_ids]
    hist_tasks = [fetch_hist_async(tid, iv) for tid in all_token_ids for iv in intervals]

    ob_results, hist_results = await asyncio.gather(
        asyncio.gather(*ob_tasks),
        asyncio.gather(*hist_tasks),
    )

    # Build maps
    ob_map = {tid: ob for tid, ob in ob_results}
    hist_map = {key: rows for key, rows in hist_results}

    _progress("Saving orderbooks & price history to database...")
    # Persist orderbooks and histories concurrently
    persist_tasks = []
    for tid, ob in ob_map.items():
        persist_tasks.append(upsert_orderbook(tid, asof, ob.get("bids", []) + ob.get("asks", [])))
    for (tid, iv), rows in hist_map.items():
        persist_tasks.append(upsert_history(tid, rows))
    await asyncio.gather(*persist_tasks)

    _progress("Computing analytics & scoring...")
    # Assemble stats for all markets (CPU-bound, in-memory)
    all_stats_rows: List[Dict[str, Any]] = []
    for market in markets:
        stats_row = assemble_market_stats(market, event_obj, ob_map, hist_map, asof, base_rate)
        all_stats_rows.append(stats_row)

    _progress("Saving market stats to database...")
    # Persist all market stats concurrently
    await asyncio.gather(*[upsert_market_stats(row) for row in all_stats_rows])

    _progress("Fetching recent trades...")
    # Fetch recent trades for all markets in parallel (non-critical)
    from .polymarket import fetch_recent_trades
    from .database import upsert_trades

    async def fetch_and_store_trades(market, stats_row):
        yes_token_id, _, _ = get_yes_no_token_ids(market)
        if yes_token_id:
            try:
                trades = await loop.run_in_executor(executor, lambda t=yes_token_id: fetch_recent_trades(t, limit=50))
                if trades:
                    await upsert_trades(yes_token_id, stats_row["market_id"], trades)
            except Exception:
                pass

    await asyncio.gather(*[fetch_and_store_trades(m, s) for m, s in zip(markets, all_stats_rows)])

    executor.shutdown(wait=False)
    market_ids = [stats["market_id"] for stats in all_stats_rows]

    result = {
        "success": True,
        "markets_processed": len(markets),
        "message": f"Extracted {len(markets)} market(s)",
        "market_ids": market_ids,
        "from_cache": False,
    }

    # Store in memory cache for next time
    if original_url:
        _cache_set(original_url, result)

    return result
