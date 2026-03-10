# PolySignal — Polymarket Analytics Platform

> **Live App:** 🚀 [https://polysignal-zp2r4.ondigitalocean.app/](https://polysignal-zp2r4.ondigitalocean.app/)

PolySignal is a real-time analytics and AI-powered trading intelligence platform for [Polymarket](https://polymarket.com) — the world's largest prediction market. It transforms raw market data into actionable insights using machine learning, live data feeds, and a proprietary scoring system.

---

## 🌐 Try the App

| | |
|---|---|
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
- 🌡️ **Liquidity Heatmap** — Visual representation of market depth and liquidity distribution
- 📉 **Score History Charts** — Track how a market's risk profile evolves over time
- ⚖️ **Event Comparison** — Analyze multiple related markets side by side
- 🔔 **Risk Alerts** — Automated alerts when market conditions change significantly
- 🔗 **Market Extractor** — Paste any Polymarket URL to instantly analyze that market

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

### Infrastructure & Cloud
| Service | Purpose |
|---|---|
| DigitalOcean App Platform | Hosting backend + frontend (Docker-based) |
| DigitalOcean Managed PostgreSQL | Cloud database (nyc1 region, SSL enforced) |
| DigitalOcean GPU Droplets | ML model training (H100/A100 via Gradient™ AI) |
| Docker | Containerization |
| Nginx | Frontend static file serving & reverse proxy |
| GitHub Actions | CI/CD pipeline — auto-deploy on push |

### External APIs
| API | Purpose |
|---|---|
| Polymarket Gamma API | Market data, events, categories |
| Polymarket CLOB API | Order book and trade data |

---

## 🗂️ Project Structure

```
PolySignal/
├── backend/
│   ├── app/
│   │   ├── api/              # REST API & WebSocket route handlers
│   │   │   ├── markets.py    # Market endpoints
│   │   │   ├── ai.py         # AI/ML endpoints
│   │   │   └── websocket.py  # WebSocket endpoints
│   │   ├── core/             # Core business logic
│   │   │   ├── scoring.py    # Unified Risk Score engine
│   │   │   ├── polymarket.py # Polymarket API client
│   │   │   ├── analytics.py  # Analytics functions
│   │   │   ├── database.py   # PostgreSQL operations
│   │   │   ├── extractor.py  # Market URL extractor
│   │   │   ├── alerts.py     # Risk alerts system
│   │   │   └── score_history.py # Score history tracking
│   │   ├── ml/               # Machine learning models
│   │   │   ├── price_predictor.py    # Price forecasting
│   │   │   ├── sentiment_analyzer.py # NLP sentiment analysis
│   │   │   ├── anomaly_detector.py   # Anomaly detection
│   │   │   └── trading_agent.py      # Trading signal generator
│   │   ├── models/           # Pydantic data models
│   │   └── main.py           # FastAPI app entry point
│   ├── requirements.txt
│   ├── Dockerfile
│   └── run.py
├── frontend/
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   │   ├── AIPrediction.jsx
│   │   │   ├── AITradingSignal.jsx
│   │   │   ├── AISentimentAnalysis.jsx
│   │   │   ├── UnifiedRiskScore.jsx
│   │   │   ├── PriceChart.jsx
│   │   │   ├── OrderbookView.jsx
│   │   │   ├── TradesTicker.jsx
│   │   │   ├── LiquidityHeatmap.jsx
│   │   │   ├── ScoreHistoryChart.jsx
│   │   │   ├── RiskAlerts.jsx
│   │   │   └── ...
│   │   ├── pages/            # Page-level components
│   │   │   ├── Dashboard.jsx
│   │   │   ├── MarketDetail.jsx
│   │   │   ├── Rankings.jsx
│   │   │   ├── EventDetail.jsx
│   │   │   ├── EventComparison.jsx
│   │   │   ├── ArchivedEvents.jsx
│   │   │   └── ExtractMarket.jsx
│   │   ├── services/api.js   # API client
│   │   └── App.jsx
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── .do/app.yaml              # DigitalOcean App Platform spec
└── .github/workflows/        # GitHub Actions CI/CD
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
| `GET` | `/api/markets/` | List markets with filters |
| `GET` | `/api/markets/{id}` | Get market details |
| `GET` | `/api/markets/{id}/stats` | Market statistics |
| `GET` | `/api/markets/{id}/history` | Price history |
| `GET` | `/api/markets/{id}/orderbook` | Order book data |
| `GET` | `/api/markets/categories` | All categories |
| `POST` | `/api/markets/extract` | Extract market from Polymarket URL |

### AI / ML
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/ai/{id}/prediction` | Price prediction |
| `GET` | `/api/ai/{id}/sentiment` | Sentiment analysis |
| `GET` | `/api/ai/{id}/trading-signal` | Trading signal |
| `GET` | `/api/ai/{id}/anomalies` | Anomaly detection |

### WebSocket
| Endpoint | Description |
|---|---|
| `WS /ws/markets/{id}` | Real-time updates for a specific market |
| `WS /ws/markets` | Real-time updates for all markets |

---

## 🧠 The Unified Risk Score (URS)

The URS is PolySignal's proprietary scoring engine that evaluates every market across multiple dimensions:

| Factor | Description |
|---|---|
| **Liquidity** | Bid-ask spread, order book depth |
| **Volume** | 24h trading volume relative to market size |
| **Volatility** | Price swing magnitude and frequency |
| **Sentiment** | NLP score from market description analysis |
| **Anomaly** | Deviation from expected market behavior |

Scores range from **0–100**, where higher scores indicate higher risk/opportunity. Markets are ranked and updated continuously.

---

## 🐳 Docker Deployment

Both services are fully Dockerized:

```bash
# Backend
cd backend && docker build -t polysignal-backend .

# Frontend
cd frontend && docker build -t polysignal-frontend .
```

Or deploy the full stack to DigitalOcean App Platform using the included `app.yaml`:

```bash
doctl apps create --spec .do/app.yaml
```

---

## 🔄 CI/CD

Every push to `main` automatically triggers a deployment to DigitalOcean App Platform via GitHub Actions. Preview deployments are also created for pull requests.

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🙌 Built With ❤️ on DigitalOcean

PolySignal is proudly deployed on [DigitalOcean App Platform](https://www.digitalocean.com/products/app-platform/) with [DigitalOcean Managed PostgreSQL](https://www.digitalocean.com/products/managed-databases-postgresql/) and ML models trained on [DigitalOcean Gradient™ AI](https://www.digitalocean.com/products/gradient) GPU infrastructure.
