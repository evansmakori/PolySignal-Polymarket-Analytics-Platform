# About the Project: PolySignal — Polymarket Analytics Platform

## Inspiration

Prediction markets like Polymarket sit at a rare intersection of finance, psychology, and collective intelligence. The premise is compelling: when real money backs a belief, the crowd becomes one of the most accurate forecasting mechanisms in existence.

Yet most traders navigate these markets with little more than gut instinct and raw probability numbers. There is no analytical layer between the data and the decision. That gap inspired PolySignal.

> *What if the signal hidden in the noise could be surfaced, quantified, and delivered in real time?*

---

## What it does

**PolySignal** is a real-time analytics and AI-powered trading intelligence platform for Polymarket. It transforms raw market data into actionable insights through a combination of machine learning, live data feeds, and a proprietary scoring system.

Key capabilities:

- **Unified Risk Score (URS)** — Markets are continuously ranked using a multi-factor composite score covering liquidity, volume, volatility, sentiment momentum, expected value, and orderbook imbalance
- **AI Trading Signals** — ML-powered buy, sell, or hold recommendations generated per market
- **Sentiment Analysis** — NLP-based scoring of market narratives and event descriptions
- **Price Predictions** — Statistical forecasts with confidence intervals
- **Anomaly Detection** — Flags unusual market behavior and suspicious price movements in real time
- **Live Order Book & Trades Ticker** — WebSocket-powered real-time market depth visualization
- **Liquidity Heatmap** — YES/NO orderbook depth with toggle, liquidity walls, and slippage estimates
- **Score History Charts** — Track how a market's risk profile evolves over time
- **Smart Lifecycle Management** — Active events auto-sync from Polymarket every 5 minutes; resolved events are automatically archived after 7 days and purged after 3 months
- **One-URL Extraction** — Paste any Polymarket event or market URL to instantly analyze it

---

## How we built it

PolySignal is a full-stack, cloud-native application built for performance and reliability.

### Frontend

React 18 + Vite + Tailwind CSS, with WebSocket connections for live event updates, TanStack React Query for data caching, and Recharts for all chart visualizations.

### Backend

FastAPI (Python) with full async support, serving both REST API and WebSocket endpoints. The backend runs on a DigitalOcean Droplet behind a managed Load Balancer — a deliberate architectural choice to support WebSocket upgrades, which DigitalOcean App Platform's ingress layer does not permit.

### ML Pipeline

scikit-learn models handle price prediction, anomaly detection, and sentiment analysis. The price prediction model uses lagged features:

$$\hat{P}_t = f\left(X_{t-1},\, X_{t-2},\, \dots,\, X_{t-n}\right)$$

where $X_{t-i}$ represents historical price, volume, and liquidity features at lag $i$.

### Unified Risk Score

The core scoring engine weights seven market factors into a single 0–100 score:

$$
\text{URS} = 0.30 \cdot \text{EV} + 0.20 \cdot \text{Kelly} + 0.15 \cdot \text{Liquidity} + 0.10 \cdot \text{Volatility} + 0.10 \cdot \text{Imbalance} + 0.10 \cdot \text{Sentiment} + 0.05 \cdot \text{Spread}
$$

| Component | Weight | Description |
|---|---|---|
| Expected Value (EV) | 30% | Edge in the trade |
| Kelly Fraction | 20% | Optimal bet size based on edge and odds |
| Liquidity | 15% | Market depth, log-scaled up to \$100k |
| Volatility | 10% | Price stability — optimal around 2% swing |
| Orderbook Imbalance | 10% | Buy vs sell pressure asymmetry |
| Sentiment Momentum | 10% | Price trend strength and direction |
| Spread | 5% | Bid-ask gap transaction cost |

Score bands:

$$
\text{Category} = \begin{cases} \text{Strong Buy} & \text{if } \text{URS} \geq 80 \\ \text{Moderate Opportunity} & \text{if } 60 \leq \text{URS} < 80 \\ \text{Neutral / Watchlist} & \text{if } 40 \leq \text{URS} < 60 \\ \text{Weak / Avoid} & \text{if } \text{URS} < 40 \end{cases}
$$

### Data Layer

Live data is pulled from the Polymarket Gamma and CLOB APIs. A PostgreSQL materialized view (`latest_market_stats`) pre-computes the most recent snapshot per market:

```sql
CREATE MATERIALIZED VIEW latest_market_stats AS
    SELECT DISTINCT ON (market_id) *
    FROM polymarket_market_stats
    ORDER BY market_id, snapshot_ts DESC;
```

This reduced Events API response time from **16 seconds** to under **800ms** — a 15–20x improvement.

### Deployment Architecture

```
Users
  │
  ▼
DigitalOcean App Platform
  https://polysignal-zp2r4.ondigitalocean.app
  └── React + Nginx (frontend)
  └── FastAPI (secondary API, no background jobs)
          │
          │ WebSocket + API calls
          ▼
DigitalOcean Load Balancer (138.197.231.111)
  └── Health checks, traffic routing
          │
          ▼
DigitalOcean Droplet (2vCPU/2GB, nyc1)
  └── Nginx (reverse proxy + WebSocket forwarding)
      └── FastAPI + Uvicorn (1 worker)
          └── Background jobs: auto-sync, backfill, lifecycle
                  │
                  ▼
DigitalOcean Managed PostgreSQL (nyc1)
  └── 346,000+ market snapshots
```

**CI/CD:** Every push to `main` triggers two GitHub Actions workflows — one deploys the frontend via App Platform, the other SSH-deploys the backend to the Droplet.

**ML Training:** Models trained on DigitalOcean GPU Droplets (H100/A100) via Gradient™ AI.

---

## Challenges we ran into

### WebSocket Support on App Platform

DigitalOcean App Platform's ingress layer permanently blocks WebSocket upgrade requests. We discovered this after building the full real-time dashboard. The solution was to move the primary backend to a Droplet with Nginx configured to properly forward WebSocket connections:

```nginx
location /ws/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400;
}
```

### Database Connection Exhaustion

Running two backend instances against a single managed PostgreSQL cluster on the smallest plan quickly hit the connection limit. We resolved this by:

- Disabling background jobs on the App Platform instance
- Reducing pool sizes to 3 connections per instance: $3 \times 2 = 6$ total, well within the plan limit
- Making startup non-blocking so the app starts cleanly even when connections are temporarily unavailable

### Events API Latency

The original query used `DISTINCT ON` CTEs that scanned all historical snapshots on every request, taking 11–16 seconds. The materialized view approach reduced this to sub-second responses.

### Cold Start Scoring

New markets lack the historical data needed for full ML scoring. We built a multi-tier fallback:

$$
\text{FallbackScore} = 0.60 \cdot \frac{\log_{10}(\max(\text{Liquidity}, 1))}{\log_{10}(10^6)} \cdot 100 + 0.40 \cdot \frac{\log_{10}(\max(\text{Volume}, 1))}{\log_{10}(10^7)} \cdot 100
$$

This ensures no market ever displays N/A — there is always a meaningful score.

---

## Accomplishments that we're proud of

- A fully deployed, production-grade analytics platform running live on DigitalOcean
- **15–20x** performance improvement on the core data API through database query optimization
- End-to-end WebSocket infrastructure delivering live event updates to the dashboard in real time
- A **Unified Risk Score** that meaningfully differentiates markets across seven weighted factors
- A complete ML pipeline from raw Polymarket data to actionable trading signals in under 600ms
- Smart lifecycle management that keeps the dashboard clean — resolved markets archive automatically
- A clean, responsive UI that makes complex market structure approachable without oversimplifying it

---

## What we learned

- Prediction markets are a goldmine of structured, real-money-weighted human beliefs — building on top of them is both technically challenging and genuinely interesting
- Infrastructure constraints shape architecture in real ways. The WebSocket limitation on App Platform forced a hybrid deployment that ultimately gave us more control and better performance
- Database query design matters enormously at scale. A single materialized view eliminated our biggest performance bottleneck
- Presenting uncertainty well is a UX problem as much as a technical one — confidence intervals, fallback states, and friendly error messages matter as much as the underlying data
- Async Python (FastAPI + asyncio) is extremely well-suited to I/O-bound, real-time applications at this scale

---

## What's next for PolySignal — Polymarket Analytics Platform

- **Portfolio tracking** — Let users follow markets and track simulated or real positions with P&L visualization
- **Push alerts** — Notify users when a market's score crosses a threshold or an anomaly is detected
- **LLM-powered sentiment** — Fine-tuned language models for richer narrative analysis and event-driven forecasting
- **PDF report exports** — Generate and share downloadable market analysis reports via DigitalOcean Object Storage
- **Mobile companion app** — Lightweight app for on-the-go market monitoring and alerts
- **Social layer** — Allow traders to annotate markets, share signals, and follow top performers
- **Backtesting engine** — Test trading strategies against historical Polymarket data

---

*Built with ❤️ on DigitalOcean — App Platform · Droplets · Managed PostgreSQL · Load Balancer · Gradient™ AI*
