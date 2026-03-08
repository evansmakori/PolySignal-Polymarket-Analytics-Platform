# Frontend - Polymarket Trading Dashboard

React frontend for the Polymarket Trading Dashboard.

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Features

- **Market Explorer**: Browse and filter markets
- **Market Detail View**: Comprehensive market analysis
- **Real-time Updates**: WebSocket integration for live data
- **Price Charts**: Interactive historical price visualization
- **Orderbook View**: Live bid/ask depth
- **Trading Signals**: Visual indicators for opportunities
- **Risk Analysis**: Degen risk scores and alerts

## Project Structure

```
frontend/
├── src/
│   ├── components/       # Reusable React components
│   │   ├── Layout.jsx
│   │   ├── MarketCard.jsx
│   │   ├── PriceChart.jsx
│   │   ├── OrderbookView.jsx
│   │   └── StatsGrid.jsx
│   ├── pages/           # Page components
│   │   ├── Dashboard.jsx
│   │   ├── MarketDetail.jsx
│   │   └── ExtractMarket.jsx
│   ├── services/        # API client
│   │   └── api.js
│   ├── utils/          # Utility functions
│   │   └── formatters.js
│   ├── App.jsx         # Main app component
│   ├── main.jsx        # Entry point
│   └── index.css       # Global styles
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## Technology Stack

- **React 18**: UI library
- **React Router**: Client-side routing
- **TanStack Query**: Data fetching and caching
- **Recharts**: Chart visualization
- **TailwindCSS**: Styling
- **Vite**: Build tool
- **Lucide React**: Icon library

## Configuration

Environment variables (`.env`):

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_BASE_URL=ws://localhost:8000
```

## Components

### Layout
Main layout with navigation and footer.

### MarketCard
Displays market summary in grid view.

### PriceChart
Interactive line chart for price history.

### OrderbookView
Shows bid/ask levels for YES/NO tokens.

### StatsGrid
Grid of key market statistics.

## Pages

### Dashboard
Main page with market explorer and filters.

### MarketDetail
Detailed view of a single market with charts and analytics.

### ExtractMarket
Form to extract new markets from Polymarket URLs.

## Development

```bash
# Run dev server with hot reload
npm run dev

# Type checking (if TypeScript)
npm run type-check

# Linting
npm run lint

# Build for production
npm run build

# Preview production build
npm run preview
```

## Styling

The app uses TailwindCSS with a custom theme. Key features:

- Dark mode support
- Responsive design
- Custom color palette
- Utility-first approach

## State Management

- **TanStack Query** for server state (API data)
- **React useState** for local component state
- **WebSocket** for real-time updates
