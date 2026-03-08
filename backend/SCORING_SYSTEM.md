# Predictive Strength Scoring System

## Overview

The Predictive Strength Scoring System is a comprehensive ranking model for prediction markets that evaluates market opportunities based on multiple quantitative factors. Markets are scored on a 0-100 scale and categorized into actionable tiers.

## Scoring Components

The system evaluates 7 key metrics with weighted importance:

| Metric | Weight | Description |
|--------|--------|-------------|
| **Expected Value** | 30% | Edge in the trade (fair value - market price) |
| **Kelly Fraction** | 20% | Optimal bet sizing based on edge and odds |
| **Liquidity Score** | 15% | Market depth and ease of execution |
| **Volatility** | 10% | Price stability (moderate volatility preferred) |
| **Orderbook Imbalance** | 10% | Directional pressure from bid/ask volumes |
| **Spread** | 5% | Transaction cost (narrower is better) |
| **Sentiment Momentum** | 10% | Price trend strength |

**Total:** 100%

## Normalization Methods

Each metric is normalized to a 0-1 scale using appropriate techniques:

### 1. Expected Value (EV)
- **Range:** -1 to +1 (typically -0.2 to +0.2)
- **Normalization:** Linear scaling
- **Formula:** `(EV + 1) / 2`
- **Logic:** Positive EV indicates undervalued market; negative EV indicates overvalued

### 2. Kelly Fraction
- **Range:** 0 to 0.5 (capped at 0.25 for normalization)
- **Normalization:** Linear scaling to max
- **Formula:** `min(1.0, kelly / 0.25)`
- **Logic:** Higher Kelly suggests stronger edge and optimal position sizing

### 3. Liquidity
- **Range:** $100 to $100,000+
- **Normalization:** Logarithmic scaling
- **Formula:** `(log10(liquidity) - log10(100)) / (log10(100000) - log10(100))`
- **Logic:** Diminishing returns at high liquidity; log scale captures this

### 4. Volatility
- **Range:** 0 to 0.20+ (std deviation of returns)
- **Normalization:** Bell curve centered at optimal (0.02)
- **Formula:** `exp(-((vol - 0.02) / 0.04)²)`
- **Logic:** 
  - Too low = stale market
  - Optimal (~2%) = active, healthy market
  - Too high = excessive risk

### 5. Orderbook Imbalance
- **Range:** -1 to +1
- **Normalization:** Absolute value
- **Formula:** `abs(imbalance)`
- **Logic:** Strong imbalance in either direction indicates conviction

### 6. Spread
- **Range:** $0.00 to $0.10+
- **Normalization:** Inverse linear (narrower is better)
- **Formula:** `1 - (spread / 0.10)`
- **Logic:** Tight spreads reduce transaction costs

### 7. Sentiment Momentum
- **Range:** -1e-4 to +1e-4 (regression slope)
- **Normalization:** Absolute value scaled to max
- **Formula:** `min(1.0, abs(momentum) / 1e-4)`
- **Logic:** Strong momentum in either direction indicates trend

## Scoring Formula

```
PredictiveStrengthScore = 
  0.30 × EV_normalized +
  0.20 × Kelly_normalized +
  0.15 × Liquidity_normalized +
  0.10 × Volatility_normalized +
  0.10 × Imbalance_normalized +
  0.05 × Spread_normalized +
  0.10 × Momentum_normalized

Final Score = PredictiveStrengthScore × 100
```

## Score Categories

Markets are categorized based on their final score:

| Score Range | Category | Interpretation | Action |
|-------------|----------|----------------|--------|
| **80-100** | 🟢 Strong Buy | Excellent fundamentals, high confidence | Consider significant position |
| **60-79** | 🟡 Moderate Opportunity | Good setup, some risk | Consider moderate position |
| **40-59** | 🟠 Neutral / Watchlist | Mixed signals, uncertain | Monitor, small position only |
| **0-39** | 🔴 Weak / Avoid | Poor fundamentals, high risk | Avoid or exit position |

## API Endpoints

### 1. Get Ranked Markets
```
GET /api/markets/ranked
```

Returns markets sorted by predictive strength score with optional filters.

**Query Parameters:**
- `category` (optional): Filter by market category
- `min_liquidity`, `max_liquidity` (optional): Liquidity range
- `min_volume`, `max_volume` (optional): Volume range
- `trade_signal` (optional): Filter by signal (long/short/no-trade)
- `active_only` (default: true): Only show active markets
- `limit` (default: 50, max: 500): Number of results
- `offset` (default: 0): Pagination offset

**Response:**
```json
[
  {
    "market_id": "0x123...",
    "title": "Market Title",
    "rank": 1,
    "predictive_strength_score": 85.5,
    "score_category": "Strong Buy",
    "expected_value": 0.15,
    "kelly_fraction": 0.12,
    "liquidity": 50000,
    "score_breakdown": {
      "score": 85.5,
      "category": "Strong Buy",
      "normalized_components": {...},
      "weighted_components": {...}
    },
    ...
  }
]
```

### 2. Get Top Opportunities
```
GET /api/markets/opportunities
```

Convenience endpoint for finding the best market opportunities.

**Query Parameters:**
- `limit` (default: 20, max: 100): Number of results
- `min_score` (default: 60.0): Minimum score threshold
- `active_only` (default: true): Only show active markets

**Response:** Same as ranked markets endpoint

### 3. Get Market Score Details
```
GET /api/markets/{market_id}/score
```

Get detailed scoring breakdown for a specific market.

**Response:**
```json
{
  "market_id": "0x123...",
  "title": "Market Title",
  "score": 85.5,
  "category": "Strong Buy",
  "breakdown": {
    "score": 85.5,
    "category": "Strong Buy",
    "normalized_components": {
      "expected_value": 0.575,
      "kelly_fraction": 0.48,
      "liquidity_score": 0.8997,
      "volatility": 1.0,
      "orderbook_imbalance": 0.6,
      "spread": 0.9,
      "sentiment_momentum": 0.8
    },
    "weighted_components": {
      "expected_value": 0.1725,
      "kelly_fraction": 0.096,
      "liquidity_score": 0.1349,
      "volatility": 0.1,
      "orderbook_imbalance": 0.06,
      "spread": 0.045,
      "sentiment_momentum": 0.08
    }
  },
  "metrics": {
    "expected_value": 0.15,
    "kelly_fraction": 0.12,
    "liquidity": 50000,
    "volatility_1w": 0.02,
    "orderbook_imbalance": 0.6,
    "spread": 0.01,
    "sentiment_momentum": 0.00008
  }
}
```

## Usage Examples

### Python Service Layer
```python
from app.services.market_service import MarketService
from app.models.market import MarketFilter

# Get top 10 ranked markets
filters = MarketFilter(active_only=True, limit=10)
ranked = MarketService.get_ranked_markets(filters)

# Get top opportunities
opportunities = MarketService.get_top_opportunities(
    limit=20,
    min_score=60.0
)

# Get score for specific market
score = MarketService.get_market_score("market_id")
```

### Direct API Calls
```bash
# Get ranked markets
curl "http://localhost:8000/api/markets/ranked?limit=20&active_only=true"

# Get opportunities
curl "http://localhost:8000/api/markets/opportunities?min_score=70"

# Get market score
curl "http://localhost:8000/api/markets/0x123.../score"
```

## Interpretation Guide

### High Score (80+)
- Strong positive expected value (>10 basis points edge)
- Significant Kelly fraction (suggests optimal position sizing)
- Good liquidity (low slippage risk)
- Healthy volatility (active but not chaotic)
- Directional pressure in orderbook
- Tight spreads (low transaction costs)
- Strong price momentum

### Moderate Score (60-79)
- Positive but modest expected value
- Moderate Kelly signal
- Adequate liquidity
- Some combination of strong and weak metrics
- Warrants consideration with risk management

### Low Score (<40)
- Negative or minimal expected value
- Weak Kelly signal
- Poor liquidity or excessive volatility
- Wide spreads
- Generally unfavorable conditions

## Customization

The scoring system supports custom normalization parameters:

```python
custom_params = {
    "max_kelly": 0.30,        # Adjust Kelly ceiling
    "max_liquidity": 200000,  # Higher liquidity ceiling
    "optimal_vol": 0.03,      # Different volatility target
    "max_spread": 0.15,       # Different spread ceiling
    "max_momentum": 2e-4,     # Different momentum scale
}

ranked = MarketService.get_ranked_markets(filters, custom_params)
```

## Limitations and Considerations

1. **Missing Data:** Markets with missing metrics receive 0 for those components, lowering their score
2. **Time Sensitivity:** Scores are based on latest snapshot; markets change continuously
3. **Risk-Adjusted:** Higher scores don't guarantee profit; they indicate better risk/reward
4. **Complementary:** Use alongside other analysis (fundamental research, event context)
5. **Backtesting:** Historical performance should be validated through backtesting

## Future Enhancements

Potential improvements:
- Machine learning-based weight optimization
- Dynamic weighting based on market conditions
- Confidence intervals for scores
- Historical score tracking and trends
- Category-specific scoring models
- Integration with portfolio optimization

---

**Version:** 1.0  
**Last Updated:** 2026-02-26  
**Module:** `backend/app/core/scoring.py`
