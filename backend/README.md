# Backend - Polymarket Trading Dashboard

FastAPI backend for the Polymarket Trading Dashboard.

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run the server
python run.py

# Or using uvicorn directly
uvicorn app.main:app --reload
```

## API Endpoints

### Markets

- `GET /api/markets/` - List markets with filters
- `GET /api/markets/{market_id}` - Get market details
- `GET /api/markets/{market_id}/stats` - Get market statistics
- `GET /api/markets/{market_id}/history` - Get price history
- `GET /api/markets/{market_id}/orderbook` - Get orderbook data
- `GET /api/markets/categories` - Get all categories
- `GET /api/markets/count` - Get market count
- `POST /api/markets/extract` - Extract data from Polymarket URL

### WebSocket

- `WS /ws/markets/{market_id}` - Real-time market updates
- `WS /ws/markets` - Real-time updates for all markets

## Project Structure

```
backend/
├── app/
│   ├── api/              # API route handlers
│   │   ├── markets.py    # Market endpoints
│   │   └── websocket.py  # WebSocket endpoints
│   ├── core/             # Core business logic
│   │   ├── analytics.py  # Analytics functions
│   │   ├── config.py     # Configuration
│   │   ├── database.py   # Database operations
│   │   ├── extractor.py  # Market extraction logic
│   │   └── polymarket.py # Polymarket API client
│   ├── models/           # Pydantic models
│   │   └── market.py     # Market data models
│   ├── services/         # Business logic services
│   │   └── market_service.py
│   └── main.py           # FastAPI application
├── requirements.txt      # Python dependencies
├── run.py               # Run script
└── .env                 # Environment variables
```

## Configuration

Environment variables (`.env`):

```env
DUCKDB_PATH=markets.duckdb
API_HOST=0.0.0.0
API_PORT=8000
CORS_ORIGINS=http://localhost:5173
GAMMA_BASE=https://gamma-api.polymarket.com
CLOB_BASE=https://clob.polymarket.com
BASE_RATE=0.50
```

## Database Schema

The application uses DuckDB with three main tables:

### polymarket_market_stats
Market-level statistics and analytics.

### polymarket_orderbook
Orderbook snapshots for YES/NO tokens.

### polymarket_prices_history
Historical price data.

## Development

```bash
# Run with auto-reload
uvicorn app.main:app --reload

# Run tests (if added)
pytest

# Check API docs
# Open http://localhost:8000/docs
```

## Analytics

The backend computes various metrics:

- **Volatility**: Rolling standard deviation of returns
- **Moving Averages**: Short-term and long-term MAs
- **Sentiment Momentum**: Regression slope of price
- **Fair Value**: Bayesian-adjusted price estimation
- **Expected Value**: Difference between fair value and current price
- **Kelly Fraction**: Optimal bet sizing
- **Trade Signals**: Long/Short/No-Trade recommendations
- **Risk Metrics**: Degen risk score, overconfidence flags
