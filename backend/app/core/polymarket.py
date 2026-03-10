"""
Polymarket Data Extractor - Core Logic from Notebook
Adapted for FastAPI backend usage
"""
from __future__ import annotations
from typing import Dict, Any, List, Optional, Tuple
from urllib.parse import urlparse
import time
import math
import numpy as np
import requests
import pandas as pd
from datetime import datetime, timezone

from .config import settings


# -------------------------
# Utilities
# -------------------------
def _utc_now() -> datetime:
    """Return current UTC datetime."""
    return datetime.now(timezone.utc)


def _retry_get(url: str, params: Optional[Dict[str, Any]] = None) -> requests.Response:
    """GET with retry & backoff."""
    last_exc = None
    for attempt in range(1, settings.MAX_RETRIES + 1):
        try:
            r = requests.get(url, params=params, timeout=settings.REQUEST_TIMEOUT)
            r.raise_for_status()
            return r
        except Exception as e:
            last_exc = e
            if attempt < settings.MAX_RETRIES:
                time.sleep(settings.RETRY_BACKOFF_SEC * attempt)
            else:
                raise
    raise last_exc


# -------------------------
# URL Parsing
# -------------------------
def parse_polymarket_url(url: str) -> Dict[str, str]:
    """
    Returns dict: { 'kind': 'event'|'market', 'slug': '<slug>' }
    Supports https://polymarket.com/event/<slug> and /market/<slug>
    """
    p = urlparse(url)
    parts = [s for s in p.path.split("/") if s]
    if not parts:
        raise ValueError("Unrecognized Polymarket URL path")

    if parts[0] in ("event", "events"):
        if len(parts) < 2:
            raise ValueError("Event URL missing slug segment")
        return {"kind": "event", "slug": parts[1]}
    if parts[0] in ("market", "markets"):
        if len(parts) < 2:
            raise ValueError("Market URL missing slug segment")
        return {"kind": "market", "slug": parts[1]}

    # Fallback: treat first segment as slug; prefer event
    return {"kind": "event", "slug": parts[0]}


# -------------------------
# Gamma API Resolvers
# -------------------------
def get_event_by_slug(slug: str) -> Dict[str, Any]:
    return _retry_get(f"{settings.GAMMA_BASE}/events/slug/{slug}").json()


def get_event_by_id(eid: str | int) -> Dict[str, Any]:
    return _retry_get(f"{settings.GAMMA_BASE}/events/{eid}").json()


def get_market_by_slug(slug: str) -> Dict[str, Any]:
    return _retry_get(f"{settings.GAMMA_BASE}/markets/slug/{slug}").json()


def get_market_by_id(mid: str | int) -> Dict[str, Any]:
    return _retry_get(f"{settings.GAMMA_BASE}/markets/{mid}").json()


def _normalize_clob_token_ids(raw) -> List[str]:
    """Normalize `clobTokenIds` into a list of token-id strings."""
    if raw is None:
        return []

    # Already a list
    if isinstance(raw, list):
        return [str(x) for x in raw if x is not None]

    # Sometimes stored as a JSON-ish string
    if isinstance(raw, str):
        s = raw.strip()
        if not s:
            return []
        if s.startswith('[') and s.endswith(']'):
            try:
                import json as _json
                arr = _json.loads(s)
                if isinstance(arr, list):
                    return [str(x) for x in arr if x is not None]
            except Exception:
                pass
        # delimiter split
        parts = [t.strip() for t in s.replace(';', ',').split(',') if t.strip()]
        return parts

    # Unknown type
    try:
        return [str(raw)]
    except Exception:
        return []


def get_yes_no_token_ids(market: Dict[str, Any]) -> Tuple[Optional[str], Optional[str], Dict[str, Any]]:
    """Resolve YES/NO token IDs robustly using Gamma `outcomes` when available."""
    meta: Dict[str, Any] = {
        "mapping_source": None,
        "outcomes": None,
        "yes_index": None,
        "no_index": None,
        "mapping_ok": False,
        "mapping_warning": None,
    }

    raw_ids = _normalize_clob_token_ids(market.get("clobTokenIds")) or []
    clob_ids = [t for t in raw_ids if t]

    outcomes = market.get("outcomes")

    # Normalize outcomes into list[str] if possible
    if isinstance(outcomes, str):
        s = outcomes.strip()
        if s.startswith('[') and s.endswith(']'):
            try:
                import json as _json
                outcomes = _json.loads(s)
            except Exception:
                outcomes = None
        else:
            outcomes = None

    if isinstance(outcomes, list) and len(outcomes) >= 2 and len(clob_ids) >= 2:
        meta["mapping_source"] = "outcomes"
        meta["outcomes"] = outcomes
        norm = [str(o).strip().lower() for o in outcomes]
        yi = norm.index("yes") if "yes" in norm else None
        ni = norm.index("no") if "no" in norm else None
        meta["yes_index"], meta["no_index"] = yi, ni
        if yi is not None and ni is not None and yi != ni and yi < len(clob_ids) and ni < len(clob_ids):
            meta["mapping_ok"] = True
            return clob_ids[yi], clob_ids[ni], meta
        meta["mapping_warning"] = "outcomes_present_but_yes_no_not_found_or_misaligned"

    # Fallback assumption
    meta["mapping_source"] = "fallback_first_two"
    yes = clob_ids[0] if len(clob_ids) > 0 else None
    no = clob_ids[1] if len(clob_ids) > 1 else None
    meta["mapping_ok"] = bool(yes and no)
    if not meta["mapping_ok"]:
        meta["mapping_warning"] = "missing_clob_token_ids"
    return yes, no, meta


def resolve_markets_from_url(url: str) -> Tuple[List[Dict[str, Any]], Optional[Dict[str, Any]]]:
    """
    Given a Polymarket event/market URL, return (markets, event_if_available).
    Ensures clobTokenIds are present by fetching market-by-id if needed.
    """
    info = parse_polymarket_url(url)
    kind, slug = info["kind"], info["slug"]

    markets: List[Dict[str, Any]] = []
    event_obj: Optional[Dict[str, Any]] = None

    if kind == "event":
        event_obj = get_event_by_slug(slug)
        raw_markets = list(event_obj.get("markets") or [])
        for m in raw_markets:
            m_full = m
            clob_ids = _normalize_clob_token_ids(m_full.get("clobTokenIds"))
            if not clob_ids:
                mid = m_full.get("id") or m_full.get("marketId") or m_full.get("conditionId")
                if mid is not None:
                    try:
                        mid_int = int(mid) if str(mid).isdigit() else mid
                        m_full = get_market_by_id(mid_int)
                    except Exception:
                        pass
            m_full = enrich_market_from_event(m_full, event_obj)
            markets.append(m_full)
    else:
        # kind == "market"
        try:
            m = get_market_by_slug(slug)
        except Exception:
            if slug.isdigit():
                m = get_market_by_id(slug)
            else:
                raise
        markets.append(m)

        # Try to fetch parent event to enrich category/liquidity
        ev_id = m.get("eventId") or m.get("event_id") or m.get("event") or m.get("eventSlug")
        if ev_id:
            try:
                if isinstance(ev_id, str) and not str(ev_id).isdigit():
                    event_obj = get_event_by_slug(ev_id)
                else:
                    event_obj = get_event_by_id(ev_id)
            except Exception:
                event_obj = None

    return markets, event_obj


# -------------------------
# CLOB API Functions
# -------------------------
def fetch_orderbook(token_id: str, depth: int = None) -> Dict[str, Any]:
    if depth is None:
        depth = settings.DEFAULT_DEPTH
    try:
        r = _retry_get(f"{settings.CLOB_BASE}/book", params={"token_id": token_id})
    except Exception:
        # Market resolved/closed — CLOB returns 404, return empty orderbook
        return {"bids": [], "asks": [], "market": token_id}
    data = r.json() if r.content else {}

    bids = data.get("bids") or []
    asks = data.get("asks") or []

    def _norm(entries, side: str):
        out = []
        for i, e in enumerate(entries[:depth]):
            price = e.get("price", e.get("px"))
            size = e.get("size", e.get("qty"))
            if price is None or size is None:
                continue
            out.append({
                "token_id": token_id,
                "side": side,
                "level": i + 1,
                "price": float(price),
                "size": float(size),
            })
        return out

    return {
        "bids": _norm(bids, "bid"),
        "asks": _norm(asks, "ask"),
        "last_trade_price": float(data["last_trade_price"]) if (data.get("last_trade_price") not in (None, '')) else None,
        "tick_size": float(data["tick_size"]) if (data.get("tick_size") not in (None, '')) else None,
        "min_order_size": float(data["min_order_size"]) if (data.get("min_order_size") not in (None, '')) else None,
    }


def fetch_prices_history(token_id: str, interval: str, fidelity_min: int = None) -> List[Dict[str, Any]]:
    """Return list of rows {token_id, t (UTC), interval, fidelity_min, price}"""
    if fidelity_min is None:
        fidelity_min = settings.DEFAULT_FIDELITY
    try:
        r = requests.get(
            f"{settings.CLOB_BASE}/prices-history",
            params={"market": token_id, "interval": interval, "fidelity": fidelity_min},
            timeout=settings.REQUEST_TIMEOUT,
        )
        if r.status_code in (403, 404):
            return []
        r.raise_for_status()
    except requests.exceptions.HTTPError:
        return []
    except Exception:
        return []
    payload = r.json() if r.content else {}
    rows = []
    for z in payload.get("history", []):
        ts = z.get("t")
        price = z.get("p")
        if ts is None or price is None:
            continue
        try:
            dt = datetime.fromtimestamp(int(ts), tz=timezone.utc)
            rows.append(
                {
                    "token_id": token_id,
                    "t": dt,
                    "interval": interval,
                    "fidelity_min": int(fidelity_min),
                    "price": float(price),
                }
            )
        except Exception:
            continue
    return rows


def fetch_full_history(token_id: str, fidelity_min: int = 60) -> List[Dict[str, Any]]:
    """
    Fetch maximum available price history since market launch.
    Uses interval='max' to get all available data.
    
    Args:
        token_id: The token ID to fetch history for
        fidelity_min: Fidelity in minutes (default: 60)
    
    Returns:
        List of price history rows ordered chronologically
    """
    try:
        r = requests.get(
            f"{settings.CLOB_BASE}/prices-history",
            params={"market": token_id, "interval": "6m", "fidelity": fidelity_min},
            timeout=settings.REQUEST_TIMEOUT,
        )
        if r.status_code in (403, 404):
            return []
        r.raise_for_status()
    except Exception:
        return []
    payload = r.json() if r.content else {}
    rows = []
    for z in payload.get("history", []):
        ts = z.get("t")
        price = z.get("p")
        if ts is None or price is None:
            continue
        try:
            dt = datetime.fromtimestamp(int(ts), tz=timezone.utc)
            rows.append(
                {
                    "token_id": token_id,
                    "t": dt,
                    "interval": "max",
                    "fidelity_min": int(fidelity_min),
                    "price": float(price),
                }
            )
        except Exception:
            continue
    return rows


def enrich_market_from_event(market: Dict[str, Any], event: Dict[str, Any]) -> Dict[str, Any]:
    """Enrich market dict with event-level fields not present on market."""
    if not event:
        return market
    enriched = dict(market)
    # Price changes - prefer market-level, fall back to event
    for field in ["oneDayPriceChange", "oneHourPriceChange", "oneWeekPriceChange", "oneMonthPriceChange"]:
        if enriched.get(field) is None:
            enriched[field] = event.get(field)
    # Volume multi-period
    for field in ["volume1wk", "volume1mo", "volume1yr"]:
        if not enriched.get(field):
            enriched[field] = event.get(field)
    # Event metadata
    enriched.setdefault("openInterest", event.get("openInterest"))
    enriched.setdefault("commentCount", event.get("commentCount"))
    enriched.setdefault("resolutionSource", event.get("resolutionSource"))
    enriched.setdefault("competitive", event.get("competitive"))
    enriched.setdefault("startDateIso", event.get("startDate"))
    enriched.setdefault("creationDate", event.get("creationDate"))
    # Tags
    tags = event.get("tags") or market.get("tags")
    if isinstance(tags, list):
        enriched["tags"] = ",".join([str(t.get("label", t) if isinstance(t, dict) else t) for t in tags])
    elif isinstance(tags, str):
        enriched["tags"] = tags
    return enriched


def search_markets(query: str, limit: int = 20) -> List[Dict[str, Any]]:
    """Search markets by keyword using Gamma API."""
    # Try multiple search parameters since Gamma API is inconsistent
    for param in ["question", "slug"]:
        try:
            r = _retry_get(
                f"{settings.GAMMA_BASE}/markets",
                params={param: query, "limit": limit, "active": "true", "closed": "false", "order": "volume24hr", "ascending": "false"}
            )
            results = r.json() if r.content else []
            if results:
                return results
        except Exception:
            continue
    return []


def search_events(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """Search events by keyword using Gamma API."""
    for param in ["title", "slug"]:
        try:
            r = _retry_get(
                f"{settings.GAMMA_BASE}/events",
                params={param: query, "limit": limit, "active": "true", "closed": "false", "order": "volume24hr", "ascending": "false"}
            )
            results = r.json() if r.content else []
            if results:
                return results
        except Exception:
            continue
    return []


def fetch_recent_trades(token_id: str, limit: int = 20) -> List[Dict[str, Any]]:
    """Fetch recent trades for a token using public CLOB last-trades-prices endpoint."""
    try:
        r = requests.get(
            f"{settings.CLOB_BASE}/last-trades-prices",
            params={"token_id": token_id},
            timeout=settings.REQUEST_TIMEOUT,
        )
        if r.status_code in (401, 403, 404):
            return []
        r.raise_for_status()
        data = r.json() if r.content else []
        trades = data if isinstance(data, list) else data.get("data", [])
        result = []
        for t in trades[:limit]:
            ts = t.get("timestamp") or t.get("match_time") or t.get("created_at")
            try:
                if ts and str(ts).replace('.','').isdigit():
                    dt = datetime.fromtimestamp(float(ts), tz=timezone.utc)
                elif ts:
                    dt = datetime.fromisoformat(str(ts).replace('Z', '+00:00'))
                else:
                    dt = _utc_now()
            except Exception:
                dt = _utc_now()
            side = t.get("side") or t.get("outcome") or "BUY"
            result.append({
                "trade_id": t.get("id") or t.get("trade_id") or str(hash(str(t))),
                "token_id": token_id,
                "side": side,
                "price": float(t.get("price", 0) or 0),
                "size": float(t.get("size", 0) or 0),
                "trade_ts": dt,
                "maker_addr": t.get("maker_address") or t.get("proxyWallet"),
                "taker_addr": t.get("taker_address"),
            })
        return result
    except Exception:
        return []
