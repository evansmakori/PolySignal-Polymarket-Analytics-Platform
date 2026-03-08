# Predictive Strength Scoring - Quick Start Guide

## 🎯 What is it?

A comprehensive ranking system that scores prediction markets from 0-100 based on 7 key metrics to identify the best trading opportunities.

## 📊 Score Interpretation

| Score | Category | Meaning |
|-------|----------|---------|
| **80-100** | 🟢 **Strong Buy** | Excellent opportunity with strong fundamentals |
| **60-79** | 🟡 **Moderate Opportunity** | Good setup worth considering |
| **40-59** | 🟠 **Neutral / Watchlist** | Mixed signals, monitor closely |
| **0-39** | 🔴 **Weak / Avoid** | Poor fundamentals, avoid |

## 🔧 Quick Usage

### 1. Get Top Opportunities (Easiest)

**Python:**
```python
from app.services.market_service import MarketService

# Get top 20 markets with score ≥ 60
opportunities = MarketService.get_top_opportunities(limit=20, min_score=60)

for market in opportunities:
    print(f"{market['rank']}. {market['title']}")
    print(f"   Score: {market['predictive_strength_score']:.1f}")
    print(f"   Category: {market['score_category']}")
```

**API:**
```bash
curl "http://localhost:8000/api/markets/opportunities?limit=20&min_score=60"
```

### 2. Get All Ranked Markets

**Python:**
```python
from app.services.market_service import MarketService
from app.models.market import MarketFilter

filters = MarketFilter(
    active_only=True,
    limit=50
)
ranked = MarketService.get_ranked_markets(filters)
```

**API:**
```bash
curl "http://localhost:8000/api/markets/ranked?limit=50&active_only=true"
```

### 3. Get Score Details for Specific Market

**Python:**
```python
score_data = MarketService.get_market_score("market_id_here")

print(f"Score: {score_data['score']}")
print(f"Category: {score_data['category']}")
print("\nBreakdown:")
for metric, value in score_data['metrics'].items():
    print(f"  {metric}: {value}")
```

**API:**
```bash
curl "http://localhost:8000/api/markets/0x123abc.../score"
```

## 🎨 Example Response

```json
{
  "market_id": "0x123...",
  "title": "Will Bitcoin reach $100k by end of 2026?",
  "rank": 1,
  "predictive_strength_score": 85.5,
  "score_category": "Strong Buy",
  "expected_value": 0.15,
  "kelly_fraction": 0.12,
  "liquidity": 50000,
  "volatility_1w": 0.02,
  "orderbook_imbalance": 0.6,
  "spread": 0.01,
  "sentiment_momentum": 0.00008,
  "score_breakdown": {
    "normalized_components": {
      "expected_value": 0.575,
      "kelly_fraction": 0.48,
      "liquidity_score": 0.90,
      "volatility": 1.0,
      "orderbook_imbalance": 0.6,
      "spread": 0.9,
      "sentiment_momentum": 0.8
    },
    "weighted_components": {
      "expected_value": 0.1725,
      "kelly_fraction": 0.096,
      "liquidity_score": 0.135,
      "volatility": 0.1,
      "orderbook_imbalance": 0.06,
      "spread": 0.045,
      "sentiment_momentum": 0.08
    }
  }
}
```

## 💡 Understanding the Metrics

### What Makes a High Score?

1. **Positive Expected Value** (30% weight)
   - Market price lower than fair value = opportunity
   
2. **Strong Kelly Fraction** (20% weight)
   - Higher = larger optimal position size
   
3. **Good Liquidity** (15% weight)
   - Can execute trades without slippage
   
4. **Moderate Volatility** (10% weight)
   - Around 2% is ideal (active but stable)
   
5. **Orderbook Imbalance** (10% weight)
   - Strong directional pressure
   
6. **Tight Spread** (5% weight)
   - Low transaction costs
   
7. **Momentum** (10% weight)
   - Strong price trends

## ⚡ Common Filters

### Get Strong Buy Markets Only
```python
filters = MarketFilter(active_only=True, limit=100)
ranked = MarketService.get_ranked_markets(filters)
strong_buys = [m for m in ranked if m['predictive_strength_score'] >= 80]
```

### Filter by Category and Score
```python
filters = MarketFilter(
    category="Politics",
    min_liquidity=5000,
    active_only=True,
    limit=50
)
ranked = MarketService.get_ranked_markets(filters)
```

### Get Moderate+ Opportunities
```python
opportunities = MarketService.get_top_opportunities(
    limit=50,
    min_score=60.0  # Moderate and Strong Buy only
)
```

## 🚨 Important Notes

- **Scores are dynamic** - They change as market conditions change
- **Missing data** - Markets with incomplete data score lower
- **Use with research** - Scores complement (don't replace) fundamental analysis
- **Risk management** - Higher scores indicate better risk/reward, not guaranteed profit

## 📈 Integration Ideas

### Dashboard Display
```python
# Get top 10 for dashboard
top_10 = MarketService.get_top_opportunities(limit=10, min_score=70)

for market in top_10:
    display_card(
        title=market['title'],
        score=market['predictive_strength_score'],
        category=market['score_category'],
        badge_color=get_badge_color(market['score_category'])
    )
```

### Alert System
```python
# Alert on new Strong Buy opportunities
opportunities = MarketService.get_top_opportunities(limit=100, min_score=80)

for market in opportunities:
    if is_new_market(market['market_id']):
        send_alert(
            f"🚨 New Strong Buy: {market['title']}\n"
            f"Score: {market['predictive_strength_score']:.1f}"
        )
```

### Portfolio Optimizer
```python
# Build portfolio from top opportunities
opportunities = MarketService.get_top_opportunities(limit=20, min_score=70)

portfolio = []
total_allocation = 100  # $100 to allocate

for market in opportunities:
    # Allocate based on Kelly fraction and score
    allocation = (
        market['kelly_fraction'] * 
        (market['predictive_strength_score'] / 100) * 
        total_allocation
    )
    portfolio.append({
        'market': market['title'],
        'allocation': allocation
    })
```

## 🔗 See Also

- Full documentation: `backend/SCORING_SYSTEM.md`
- Scoring module: `backend/app/core/scoring.py`
- API endpoints: `backend/app/api/markets.py`

---

**Questions?** Check the full documentation or review the test cases in the scoring module.
