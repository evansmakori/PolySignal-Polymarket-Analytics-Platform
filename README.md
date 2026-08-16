# PolySignal — Polymarket Analytics Platform

> **Live App:** 🚀 [https://polysignal-zp2r4.ondigitalocean.app/](https://polysignal-zp2r4.ondigitalocean.app/)

PolySignal is a real-time analytics and AI-powered trading intelligence platform for [Polymarket](https://polymarket.com) — the world's largest prediction market. It transforms raw market data into actionable insights using machine learning, live data feeds, and a proprietary scoring system.

---

## 🌐 Try the App

| | |
|---|---|
| **Video Demo** | [PolySignal Video Demo] (https://vimeo.com/1175286542?fl=pl&fe=vl) |
| **Live Platform** | [https://polysignal-zp2r4.ondigitalocean.app/](https://polysignal-zp2r4.ondigitalocean.app/) |
| **API Docs** | [https://polysignal-zp2r4.ondigitalocean.app/api/docs](https://polysignal-zp2r4.ondigitalocean.app/api/docs) |
| **API Health Check** | [https://polysignal-zp2r4.ondigitalocean.app/api/health](https://polysignal-zp2r4.ondigitalocean.app/api/health) |

---

## ✨ Features

- 📊 **Live Market Rankings** — Markets scored and ranked by a proprietary Unified Risk Score (URS) factoring in liquidity, volume, volatility, and sentiment
- 🤖 **AI Trading Signals** — ML-powered buy/sell/hold recommendations for every market
- 🧠 **Sentiment Analysis** — NLP-based analysis of market narratives and event descriptions
- 📈 **Price Predictions** — Confidence-interval price forecasts using trained ML models
- 🚨 **Anomaly Detection** — Flags unusual market behavior and suspicious price movements
- 🔴 **Real-Time Data** — Live trades ticker, order book visualization, and WebSocket-powered price feeds
- 🌡️ **Liquidity Heatmap** — Visual YES/NO orderbook depth with toggle, liquidity walls, and depth stats
- 📉 **Score History Charts** — Track how a market's risk profile evolves over time
- ⚖️ **Event Comparison** — Analyze multiple related markets side by side
- 🔔 **Risk Alerts** — Automated alerts when market conditions change significantly
- 🔗 **Market Extractor** — Paste any Polymarket URL to instantly analyze that market
- 🗄️ **Smart Lifecycle Management** — Active events auto-sync from Polymarket every 5 minutes; resolved events archived after 7 days

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 | UI framework |
| Vite | Build tool |
| Tailwind CSS | Styling |
| React Router v6 | Client-side routing |
| TanStack React Query | Data fetching & caching |
| Recharts | Charts and visualizations |
| Axios | HTTP client |
| Lucide React | Icons |
| date-fns | Date formatting |
| WebSockets | Real-time data feeds |

### Backend
| Technology | Purpose |
|---|---|
| Python 3.11 | Core language |
| FastAPI | REST API & WebSocket server |
| Uvicorn | ASGI server |
| Pydantic v2 | Data validation |
| asyncpg | Async PostgreSQL driver |
| Pandas & NumPy | Data processing |
| scikit-learn | ML models (price prediction, anomaly detection) |
| WebSockets | Real-time market streaming |
| aiofiles | Async file I/O |
| python-dotenv | Environment config |

### Infrastructure & Cloud (free deployment)
| Service | Purpose |
|---|---|
| Cloudflare Pages | Hosts the React frontend (SPA fallback via Functions `_middleware.js`) |
| Render (free web service) | Hosts the FastAPI backend (`render.yaml` Blueprint, Python 3.13.5) |
| Supabase (PostgreSQL) | Managed Postgres database (session pooler on port 5432, `sslmode=require`) |
| GitHub Actions | Keep-alive cron — pings the backend + DB every 10 min so free tiers don't sleep |
| GitHub Actions | Optional CI — build the frontend on push (Cloudflare Git integration) |

### External APIs
| API | Purpose |
|---|---|
| Polymarket Gamma API | Market data, events, categories |
| Polymarket CLOB API | Order book and trade data |

---

## 🏗️ Architecture

```
Users
  │
  ▼
Cloudflare Pages  (https://<project>.pages.dev)
  https://polysignal.pages.dev
  ├── /api/*  ─┐  VITE_API_BASE_URL (baked at build time)
  ├── /ws/*    ─┼─►  Render free web service  (https://polysignal-api.onrender.com)
  ▼             │   └── FastAPI + Uvicorn + in-process background jobs
                │           │  asyncpg (?sslmode=require)
                ▼           ▼
           Supabase Postgres (session pooler, port 5432)
                │
Keep-alive (every 10 min, GitHub Actions cron):
   GET <backend>/health → keeps Render awake → its background jobs keep Supabase active
```

### CI/CD Pipeline
Every push to `main` triggers:
1. **Cloudflare Pages** — Git integration rebuilds and publishes the frontend
2. **Render** — autoDeploy rebuilds and redeploys the backend from `render.yaml`
3. **GitHub Actions: Keep Free Tier Alive** — cron keeps the free stack awake

---

## 🗂️ Project Structure

```
PolySignal/
├── backend/
│   ├── app/
│   │   ├── api/              # REST API & WebSocket route handlers
│   │   │   ├── markets.py    # /api/markets endpoints
│   │   │   ├── ai.py         # /api/ai endpoints
│   │   │   └── websocket.py  # /ws endpoints
│   │   ├── core/             # Core business logic
│   │   │   ├── scoring.py    # Unified Risk Score engine
│   │   │   ├── polymarket.py # Polymarket API client
│   │   │   ├── analytics.py  # Analytics functions
│   │   │   ├── database.py   # PostgreSQL operations
│   │   │   ├── extractor.py  # Market URL extractor
│   │   │   ├── alerts.py     # Risk alerts system
│   │   │   ├── lifecycle.py  # Auto-sync & lifecycle management
│   │   │   └── score_history.py # Score history tracking
│   │   ├── ml/               # Machine learning models
│   │   │   ├── price_predictor.py    # Price forecasting
│   │   │   ├── sentiment_analyzer.py # NLP sentiment analysis
│   │   │   ├── anomaly_detector.py   # Anomaly detection
│   │   │   └── trading_agent.py      # Trading signal generator
│   │   ├── models/           # Pydantic data models
│   │   └── main.py           # FastAPI app entry point (/api + /ws routing)
│   ├── requirements.txt
│   └── run.py
├── frontend/
│   ├── functions/_middleware.js  # SPA fallback for Cloudflare Pages
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/            # Page-level components
│   │   ├── services/api.js   # API client (honors VITE_API_BASE_URL / VITE_WS_URL)
│   │   └── App.jsx
│   └── package.json
├── render.yaml               # Render Blueprint: free FastAPI backend (Python 3.13.5)
├── docs/FREE_DEPLOYMENT.md   # Step-by-step $0 deploy: Cloudflare + Render + Supabase
├── scripts/                  # Local helper shell scripts
└── .github/workflows/        # GitHub Actions
    └── keep-alive.yaml       # Keeps the free Render + Supabase stack awake
```

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL (or use a cloud instance)

### 1. Clone the repo
```bash
git clone https://github.com/evansmakori/PolySignal-Polymarket-Analytics-Platform.git
cd PolySignal-Polymarket-Analytics-Platform
```

### 2. Backend setup
```bash
cd backend
cp .env.example .env
# Edit .env with your database credentials and config
pip install -r requirements.txt
python run.py
```

Backend runs at: `http://localhost:8000`
API docs at: `http://localhost:8000/docs`

### 3. Frontend setup
```bash
cd frontend
cp .env.example .env
# Set VITE_API_BASE_URL=http://localhost:8000
npm install
npm run dev
```

Frontend runs at: `http://localhost:5173`

---

## 📡 API Endpoints

### Markets
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/markets/events` | List events with filters |
| `GET` | `/api/markets/events/{id}/markets` | Get event markets |
| `GET` | `/api/markets/{id}` | Get market details |
| `GET` | `/api/markets/{id}/orderbook` | Order book data |
| `GET` | `/api/markets/rankings` | Ranked markets by score |
| `POST` | `/api/markets/extract` | Extract market from Polymarket URL |
| `GET` | `/api/markets/extract/status/{job_id}` | Poll extraction status |

### AI / ML
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/ai/prediction/{id}` | Price prediction |
| `GET` | `/api/ai/sentiment/{id}` | Sentiment analysis |
| `GET` | `/api/ai/trading-signal/{id}` | Trading signal |
| `GET` | `/api/ai/anomalies/{id}` | Anomaly detection |

### WebSocket
| Endpoint | Description |
|---|---|
| `WS /ws/events` | Real-time dashboard event updates |
| `WS /ws/markets/{id}` | Real-time updates for a specific market |

---

## 🧠 The Unified Risk Score (URS)

The URS is PolySignal's proprietary scoring engine:

| Factor | Weight | Description |
|---|---|---|
| **Expected Value** | 30% | Edge in the trade |
| **Kelly Fraction** | 20% | Optimal bet size |
| **Liquidity** | 15% | Market depth |
| **Volatility** | 10% | Price stability |
| **Orderbook Imbalance** | 10% | Buy vs sell pressure |
| **Sentiment Momentum** | 10% | Price trend strength |
| **Spread** | 5% | Bid-ask gap |

Scores range **0–100**:
- `80–100` 🟢 Strong Buy
- `60–79` 🔵 Moderate Opportunity
- `40–59` 🟡 Neutral / Watchlist
- `0–39` 🔴 Weak / Avoid

---

## 🔄 CI/CD

Every push to `main` triggers:
1. **Cloudflare Pages** — rebuilds & publishes the React frontend (Git integration)
2. **Render** — autoDeploy rebuilds the FastAPI backend via `render.yaml`
3. **GitHub Actions: Keep Free Tier Alive** — cron keeps the free stack awake

## 💸 Free ($0) Deployment

PolySignal can also run **entirely free with no credit card** and without
sleeping, using Cloudflare Pages (frontend, Git integration) + Render
(backend) + Supabase (Postgres), kept awake by a scheduled GitHub Action:

- `render.yaml` — Render Blueprint for the FastAPI backend (free plan)
- `.github/workflows/keep-alive.yaml` — active keep-alive workflow (pings backend +
  database every 10 min so the free tiers don't sleep). The template is in
  `docs/workflows/keep-alive.yaml`.
- `frontend/functions/_middleware.js` — SPA fallback for Cloudflare Pages

Full step-by-step guide: **[docs/FREE_DEPLOYMENT.md](docs/FREE_DEPLOYMENT.md)**

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🙌 Built With ❤️ on the Free Stack

PolySignal is proudly deployed on:
- [Cloudflare Pages](https://pages.cloudflare.com/) — frontend (React), free tier
- [Render](https://render.com/) — FastAPI backend (free web service via `render.yaml`)
- [Supabase](https://supabase.com/) — managed Postgres database (free tier)
- [GitHub Actions](https://github.com/features/actions) — keep-alive cron
