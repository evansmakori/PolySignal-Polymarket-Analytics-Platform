"""
Analytics functions from the notebook
"""
import math
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional


def _first_or_none(seq):
    return seq[0] if seq else None


def _get_category(market: Dict[str, Any], event: Optional[Dict[str, Any]]) -> Optional[str]:
    """Find a category from market or event (supports 'category' or 'categories')."""
    for obj in (market, event or {}):
        if not obj:
            continue
        if obj.get("category"):
            return obj.get("category")
        cats = obj.get("categories")
        if isinstance(cats, list) and cats:
            return cats[0]
        if isinstance(cats, str) and cats.strip():
            return cats.strip()
    return None


def _best_ask(ob: Optional[Dict[str, Any]]) -> Optional[float]:
    asks = ob.get("asks") if ob else None
    return float(asks[0]["price"]) if asks else None


def _best_bid(ob: Optional[Dict[str, Any]]) -> Optional[float]:
    bids = ob.get("bids") if ob else None
    return float(bids[0]["price"]) if bids else None


def _display_price(ob: Optional[Dict[str, Any]]) -> Optional[float]:
    if not ob:
        return None
    bb, ba = _best_bid(ob), _best_ask(ob)
    last = ob.get("last_trade_price")
    if bb is not None and ba is not None:
        spread = float(ba) - float(bb)
        # UI fallback when spread > $0.10
        if spread > 0.10 and last is not None:
            return float(last)
        return (float(bb) + float(ba)) / 2.0
    # If one side missing, fall back to the other or last trade
    return (bb or ba or last)


def _compute_depth_liquidity(ob: Optional[Dict[str, Any]], levels: int = 5) -> float:
    """Rough notional liquidity proxy over top N levels for both sides: sum(price * size)."""
    if not ob:
        return 0.0
    total = 0.0
    for side in ("bids", "asks"):
        for e in (ob.get(side) or [])[:levels]:
            try:
                p = float(e.get("price", 0.0))
                q = float(e.get("size", 0.0))
                total += p * q
            except Exception:
                continue
    return total


def _round_to_tick(x: Optional[float], tick: Optional[float]) -> Optional[float]:
    if x is None or tick is None or tick <= 0:
        return x
    # round to nearest tick, then to 4 d.p. to avoid float noise
    return round(round(x / tick) * tick, 4)


def _latest_hist_price(hist: List[Dict[str, Any]]) -> Optional[float]:
    if not hist:
        return None
    hist_sorted = sorted(hist, key=lambda x: x["t"])
    return float(hist_sorted[-1]["price"])


def regression_slope(history: List[Dict[str, Any]]) -> float:
    """
    Price-based regression slope over last week.
    OLS slope of price ~ time; normalized by the time span to stabilize scale.
    """
    if not history or len(history) < 3:
        return 0.0

    df = pd.DataFrame(history).sort_values("t").dropna(subset=["t", "price"])
    if df.empty or df["t"].nunique() < 2:
        return 0.0

    # Convert to epoch seconds
    ts_ns = df["t"].astype("int64")
    if (ts_ns == ts_ns.iloc[0]).all():
        return 0.0

    x = (ts_ns // 10**9).to_numpy(dtype="int64")
    y = df["price"].to_numpy(dtype="float64")

    # Remove any NaNs/inf
    mask = np.isfinite(x) & np.isfinite(y)
    x, y = x[mask], y[mask]
    if x.size < 3 or np.unique(x).size < 2:
        return 0.0

    # Center
    x_c = x - x.mean()
    y_c = y - y.mean()

    var_x = np.var(x_c)
    if var_x == 0:
        return 0.0

    slope = np.cov(x_c, y_c, bias=True)[0, 1] / var_x

    # Normalize by total time span
    span = float(np.ptp(x))
    if span <= 0:
        return 0.0

    slope_normalized = float(slope) / span
    return slope_normalized


# -------------------------
# Advanced Analytics
# -------------------------
def compute_volatility(series):
    if series is None or len(series) < 30:
        return None
    r = series.pct_change().dropna()
    if len(r) < 20:
        return None
    return float(r.rolling(20).std().iloc[-1])


def compute_moving_averages(series):
    if series is None or len(series) < 96:
        return None, None
    ma_short = float(series.rolling(24).mean().iloc[-1])
    ma_long = float(series.rolling(96).mean().iloc[-1])
    return ma_short, ma_long


def compute_ema_slope(series):
    if series is None or len(series) < 25:
        return None
    ema = series.ewm(span=48, adjust=False).mean()
    tail = ema.iloc[-20:]
    x = np.arange(len(tail))
    y = tail.values
    x_c = x - x.mean()
    y_c = y - y.mean()
    var_x = (x_c**2).mean()
    if var_x == 0:
        return None
    slope = (x_c * y_c).mean() / var_x
    return float(slope)


def detect_overreaction(series, z=2.5):
    if series is None or len(series) < 60:
        return False
    r = series.pct_change().dropna()
    mu = r.rolling(40).mean().iloc[-1]
    std = r.rolling(40).std().iloc[-1]
    if std is None or std == 0:
        return False
    zscore = (r.iloc[-1] - mu) / std
    return abs(zscore) >= z


def compute_orderbook_imbalance(ob):
    if not ob:
        return None
    b = ob.get("bids", [])[:5]
    a = ob.get("asks", [])[:5]
    bq = sum(x["size"] for x in b)
    aq = sum(x["size"] for x in a)
    total = bq + aq
    if total == 0:
        return None
    return float((bq - aq) / total)


def compute_slippage(ob, notional):
    if not ob:
        return None
    best_bids = ob.get("bids", [])
    best_asks = ob.get("asks", [])
    if not best_bids or not best_asks:
        return None

    mid = (best_bids[0]["price"] + best_asks[0]["price"]) / 2

    asks = best_asks
    remaining = notional
    spent = 0
    shares = 0
    for lvl in asks:
        px = lvl["price"]
        qty = lvl["size"]
        cap = px * qty
        take = min(remaining, cap)
        sh = take / px
        spent += sh * px
        shares += sh
        remaining -= take
        if remaining <= 0:
            break
    if shares == 0:
        return None
    avg = spent / shares
    return float((avg - mid) / mid * 10000)


def compute_fair_value(yes_price, base_rate, momentum, vol):
    if yes_price is None:
        return base_rate
    shrink = 1 / (1 + 10*(vol or 0))
    tilt = math.tanh((momentum or 0)*1e5)
    fv = shrink*base_rate + (1-shrink)*yes_price + 0.02*tilt
    return float(min(max(fv, 0.01), 0.99))


def compute_ev(fv, px):
    if fv is None or px is None:
        return None
    return float(fv - px)


def compute_kelly(fv, px):
    if fv is None or px is None or px <= 0 or px >= 1:
        return None
    p = fv
    q = 1 - p
    b = (1/px) - 1
    if b <= 0:
        return None
    f = (b*p - q)/b
    return float(max(0, min(1, f))) * 0.5


def compute_trade_signal(ev, vol):
    if ev is None:
        return "no-trade"
    ev_bp = ev * 10000
    if ev_bp > 10 and (vol is None or vol < 0.05):
        return "long"
    if ev_bp < -10 and (vol is None or vol < 0.05):
        return "short"
    return "no-trade"


def detect_late_overconfidence(yes, imbalance, best_bid_no):
    if yes is None:
        return False
    if yes < 0.90:
        return False
    if imbalance and imbalance > 0.50:
        return True
    if best_bid_no is not None and best_bid_no < 0.05:
        return True
    return False
