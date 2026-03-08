"""
Scoring and ranking system for prediction markets based on predictive strength.

This module implements a comprehensive scoring model that evaluates markets based on:
- Expected Value (30%)
- Kelly Fraction (20%)
- Liquidity Score (15%)
- Volatility (10%)
- Orderbook Imbalance (10%)
- Spread (5%)
- Sentiment Momentum (10%)

Scores are normalized to 0-100 scale and categorized into:
- Strong Buy (80-100)
- Moderate Opportunity (60-79)
- Neutral/Watchlist (40-59)
- Weak/Avoid (<40)
"""
from typing import Dict, Any, Optional, List
import math


# Weights for each metric (must sum to 1.0)
WEIGHTS = {
    "expected_value": 0.30,
    "kelly_fraction": 0.20,
    "liquidity_score": 0.15,
    "volatility": 0.10,
    "orderbook_imbalance": 0.10,
    "spread": 0.05,
    "sentiment_momentum": 0.10,
}

# Score categories
SCORE_CATEGORIES = [
    (80, 100, "Strong Buy"),
    (60, 79, "Moderate Opportunity"),
    (40, 59, "Neutral / Watchlist"),
    (0, 39, "Weak / Avoid"),
]


def normalize_expected_value(ev: Optional[float]) -> float:
    """
    Normalize expected value from [-1, 1] to [0, 1].
    
    Expected value represents the edge in a trade:
    - Positive EV means the market price undervalues the outcome
    - Negative EV means the market price overvalues the outcome
    
    Args:
        ev: Expected value, typically in range [-1, 1]
        
    Returns:
        Normalized score in [0, 1]
    """
    if ev is None:
        return 0.0
    
    # Clamp to reasonable range [-1, 1]
    ev_clamped = max(-1.0, min(1.0, ev))
    
    # Linear normalization: -1 -> 0, 0 -> 0.5, 1 -> 1
    normalized = (ev_clamped + 1.0) / 2.0
    
    return normalized


def normalize_kelly_fraction(kelly: Optional[float], max_kelly: float = 0.25) -> float:
    """
    Normalize Kelly fraction relative to maximum observed value.
    
    Kelly fraction represents optimal bet sizing:
    - Higher values indicate stronger edge
    - Typically ranges from 0 to 0.5 (we use 0.25 as practical max)
    
    Args:
        kelly: Kelly fraction value
        max_kelly: Maximum expected Kelly fraction for normalization
        
    Returns:
        Normalized score in [0, 1]
    """
    if kelly is None or kelly <= 0:
        return 0.0
    
    # Normalize to max_kelly
    normalized = min(1.0, kelly / max_kelly)
    
    return normalized


def normalize_liquidity(liquidity: Optional[float], max_liquidity: float = 100000.0) -> float:
    """
    Normalize liquidity score using logarithmic scaling.
    
    Liquidity measures market depth and ease of execution:
    - Higher liquidity reduces slippage
    - Log scale because liquidity returns diminish at high values
    
    Args:
        liquidity: Liquidity value (notional USD)
        max_liquidity: Reference maximum for normalization
        
    Returns:
        Normalized score in [0, 1]
    """
    if liquidity is None or liquidity <= 0:
        return 0.0
    
    # Log scale normalization with floor of $100
    min_liquidity = 100.0
    liquidity_clamped = max(min_liquidity, min(liquidity, max_liquidity))
    
    # Log normalization
    log_min = math.log10(min_liquidity)
    log_max = math.log10(max_liquidity)
    log_val = math.log10(liquidity_clamped)
    
    normalized = (log_val - log_min) / (log_max - log_min)
    
    return normalized


def normalize_volatility(volatility: Optional[float], optimal_vol: float = 0.02) -> float:
    """
    Normalize volatility with inverse preference for extremes.
    
    Volatility scoring:
    - Moderate volatility (around 2%) scores highest (indicates active market)
    - Very low volatility scores lower (stale market)
    - Very high volatility scores lower (too risky)
    
    Args:
        volatility: Volatility measure (standard deviation of returns)
        optimal_vol: Optimal volatility level (peak score)
        
    Returns:
        Normalized score in [0, 1]
    """
    if volatility is None or volatility < 0:
        return 0.0
    
    # Use a bell curve centered at optimal_vol
    # Score = exp(-((vol - optimal) / sigma)^2)
    sigma = optimal_vol * 2  # Controls width of bell curve
    
    deviation = abs(volatility - optimal_vol)
    normalized = math.exp(-(deviation / sigma) ** 2)
    
    return normalized


def normalize_orderbook_imbalance(imbalance: Optional[float]) -> float:
    """
    Normalize orderbook imbalance using absolute value.
    
    Imbalance measures bid/ask volume asymmetry:
    - Large imbalance (either direction) indicates strong directional pressure
    - Absolute value because both positive and negative imbalance are signals
    
    Args:
        imbalance: Orderbook imbalance in [-1, 1]
        
    Returns:
        Normalized score in [0, 1]
    """
    if imbalance is None:
        return 0.0
    
    # Take absolute value and clamp to [0, 1]
    normalized = min(1.0, abs(imbalance))
    
    return normalized


def normalize_spread(spread: Optional[float], max_spread: float = 0.10) -> float:
    """
    Normalize spread with inverse preference (narrower is better).
    
    Spread measures transaction cost:
    - Narrow spread (close to 0) scores highest
    - Wide spread scores lowest
    
    Args:
        spread: Bid-ask spread
        max_spread: Maximum spread for normalization (10 cents = $0.10)
        
    Returns:
        Normalized score in [0, 1]
    """
    if spread is None or spread < 0:
        return 0.0
    
    # Clamp to max_spread
    spread_clamped = min(spread, max_spread)
    
    # Inverse normalization: lower spread = higher score
    normalized = 1.0 - (spread_clamped / max_spread)
    
    return normalized


def normalize_sentiment_momentum(momentum: Optional[float], max_momentum: float = 1e-4) -> float:
    """
    Normalize sentiment momentum using absolute value.
    
    Momentum measures price trend strength:
    - Strong momentum (either direction) indicates conviction
    - Scaled by typical observed values (around 1e-5)
    
    Args:
        momentum: Sentiment momentum (regression slope)
        max_momentum: Maximum momentum for normalization
        
    Returns:
        Normalized score in [0, 1]
    """
    if momentum is None:
        return 0.0
    
    # Use absolute value for momentum strength
    abs_momentum = abs(momentum)
    
    # Normalize to max_momentum
    normalized = min(1.0, abs_momentum / max_momentum)
    
    return normalized


def calculate_predictive_strength_score(
    expected_value: Optional[float] = None,
    kelly_fraction: Optional[float] = None,
    liquidity: Optional[float] = None,
    volatility: Optional[float] = None,
    orderbook_imbalance: Optional[float] = None,
    spread: Optional[float] = None,
    sentiment_momentum: Optional[float] = None,
    max_kelly: float = 0.25,
    max_liquidity: float = 100000.0,
    optimal_vol: float = 0.02,
    max_spread: float = 0.10,
    max_momentum: float = 1e-4,
) -> Dict[str, Any]:
    """
    Calculate comprehensive predictive strength score for a market.
    
    This function:
    1. Normalizes each metric to [0, 1] scale
    2. Applies weighted combination
    3. Scales to 0-100
    4. Categorizes the score
    
    Args:
        expected_value: Expected value of the trade
        kelly_fraction: Kelly criterion bet sizing
        liquidity: Market liquidity (USD)
        volatility: Price volatility (std dev)
        orderbook_imbalance: Bid/ask volume imbalance
        spread: Bid-ask spread
        sentiment_momentum: Price momentum
        max_kelly: Maximum Kelly fraction for normalization
        max_liquidity: Maximum liquidity for normalization
        optimal_vol: Optimal volatility level
        max_spread: Maximum spread for normalization
        max_momentum: Maximum momentum for normalization
        
    Returns:
        Dictionary containing:
        - score: Final score (0-100)
        - category: Score category (Strong Buy, etc.)
        - normalized_components: Individual normalized scores
        - weighted_components: Weighted contributions
    """
    # Normalize each component
    normalized = {
        "expected_value": normalize_expected_value(expected_value),
        "kelly_fraction": normalize_kelly_fraction(kelly_fraction, max_kelly),
        "liquidity_score": normalize_liquidity(liquidity, max_liquidity),
        "volatility": normalize_volatility(volatility, optimal_vol),
        "orderbook_imbalance": normalize_orderbook_imbalance(orderbook_imbalance),
        "spread": normalize_spread(spread, max_spread),
        "sentiment_momentum": normalize_sentiment_momentum(sentiment_momentum, max_momentum),
    }
    
    # Apply weights
    weighted = {
        key: normalized[key] * WEIGHTS[key]
        for key in WEIGHTS.keys()
    }
    
    # Calculate final score (0-1 scale)
    final_score_normalized = sum(weighted.values())
    
    # Scale to 0-100
    final_score = final_score_normalized * 100.0
    
    # Determine category
    category = get_score_category(final_score)
    
    return {
        "score": round(final_score, 2),
        "category": category,
        "normalized_components": {k: round(v, 4) for k, v in normalized.items()},
        "weighted_components": {k: round(v, 4) for k, v in weighted.items()},
    }


def get_score_category(score: float) -> str:
    """
    Categorize a predictive strength score.
    
    Args:
        score: Score value (0-100)
        
    Returns:
        Category string
    """
    for min_score, max_score, category in SCORE_CATEGORIES:
        if min_score <= score <= max_score:
            return category
    return "Unknown"


def calculate_market_score(market: Dict[str, Any], normalization_params: Optional[Dict[str, float]] = None) -> Dict[str, Any]:
    """
    Calculate predictive strength score for a market using its stats.
    
    Args:
        market: Market dictionary with statistics
        normalization_params: Optional custom normalization parameters
        
    Returns:
        Scoring result dictionary
    """
    # Extract metrics from market
    params = {
        "expected_value": market.get("expected_value"),
        "kelly_fraction": market.get("kelly_fraction"),
        "liquidity": market.get("liquidity") or market.get("liquidity_clob"),
        "volatility": market.get("volatility_1w"),
        "orderbook_imbalance": market.get("orderbook_imbalance"),
        "spread": market.get("spread"),
        "sentiment_momentum": market.get("sentiment_momentum"),
    }
    
    # Apply custom normalization parameters if provided
    if normalization_params:
        params.update(normalization_params)
    
    return calculate_predictive_strength_score(**params)


def rank_markets(markets: List[Dict[str, Any]], normalization_params: Optional[Dict[str, float]] = None) -> List[Dict[str, Any]]:
    """
    Rank a list of markets by predictive strength score.
    
    Args:
        markets: List of market dictionaries
        normalization_params: Optional custom normalization parameters
        
    Returns:
        List of markets with scores, sorted by score (highest first)
    """
    scored_markets = []
    
    for market in markets:
        score_result = calculate_market_score(market, normalization_params)
        
        # Create enhanced market dict with scoring
        scored_market = {
            **market,
            "predictive_strength_score": score_result["score"],
            "score_category": score_result["category"],
            "score_breakdown": score_result,
        }
        
        scored_markets.append(scored_market)
    
    # Sort by score descending
    scored_markets.sort(key=lambda x: x["predictive_strength_score"], reverse=True)
    
    # Add rank
    for rank, market in enumerate(scored_markets, start=1):
        market["rank"] = rank
    
    return scored_markets
