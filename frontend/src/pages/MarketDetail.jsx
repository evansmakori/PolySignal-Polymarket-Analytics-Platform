import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Loader2, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import { marketsApi, createWebSocket } from '../services/api'
import { formatPercent, formatDateTime, getSignalColor } from '../utils/formatters'
import StatsGrid from '../components/StatsGrid'
import SinceLaunchChart from '../components/SinceLaunchChart'
import PriceChart from '../components/PriceChart'
import OrderbookView from '../components/OrderbookView'
import TradesTicker from '../components/TradesTicker'
import ScoreBreakdownChart from '../components/ScoreBreakdownChart'
import ScoreHistoryChart from '../components/ScoreHistoryChart'
import MarketMetaSidebar from '../components/MarketMetaSidebar'
import RiskAlerts from '../components/RiskAlerts'
import LiquidityHeatmap from '../components/LiquidityHeatmap'
import UnifiedRiskScore from '../components/UnifiedRiskScore'
import ProbabilityGauge from '../components/ProbabilityGauge'
import AIPrediction from '../components/AIPrediction'
import AITradingSignal from '../components/AITradingSignal'
import AISentimentAnalysis from '../components/AISentimentAnalysis'
import ErrorBoundary from '../components/ErrorBoundary'

function MarketDetail() {
  const { marketId } = useParams()
  const [liveData, setLiveData] = useState(null)

  // Fetch market data
  const { data: market, isLoading, error } = useQuery({
    queryKey: ['market', marketId],
    queryFn: () => marketsApi.getMarket(marketId),
  })

  // Fetch price history
  const { data: history } = useQuery({
    queryKey: ['market-history', marketId],
    queryFn: () => marketsApi.getMarketHistory(marketId, '1w', 1000),
    enabled: !!market,
  })

  // Fetch orderbook
  const { data: orderbook } = useQuery({
    queryKey: ['market-orderbook', marketId],
    queryFn: () => marketsApi.getMarketOrderbook(marketId),
    enabled: !!market,
  })

  // WebSocket for live updates
  useEffect(() => {
    if (!marketId) return

    let ws
    try {
      ws = createWebSocket(marketId)

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          if ((message.type === 'initial' || message.type === 'update') && message.data) {
            // Only update live price fields, don't replace full market object
            setLiveData(prev => ({ ...prev, ...message.data }))
          }
        } catch (e) {
          console.warn('WebSocket message parse error:', e)
        }
      }

      ws.onerror = (error) => {
        console.warn('WebSocket error (non-critical):', error)
      }
    } catch (e) {
      console.warn('WebSocket connection failed (non-critical):', e)
    }

    return () => {
      if (ws) ws.close()
    }
  }, [marketId])

  // Merge live data on top of fetched data — never replace entirely
  const displayData = market ? { ...market, ...(liveData || {}) } : null

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="card bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
        <p className="text-red-800 dark:text-red-300">
          Error loading market: {error.message}
        </p>
      </div>
    )
  }

  if (!displayData) {
    return (
      <div className="card text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Market not found
        </h3>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link to="/" className="inline-flex items-center text-primary-600 hover:text-primary-700">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Dashboard
      </Link>

      {/* Header */}
      <div className="card">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {displayData.title}
              </h1>
              {displayData.category && (
                <span className="inline-block px-3 py-1 text-sm rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  {displayData.category}
                </span>
              )}
            </div>

            {/* Live Indicator */}
            {liveData && (
              <div className="flex items-center space-x-2 px-3 py-1 bg-green-100 dark:bg-green-900 rounded-full">
                <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
                <span className="text-xs font-medium text-green-800 dark:text-green-300">LIVE</span>
              </div>
            )}
          </div>

          {/* Timestamps */}
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Last updated: {formatDateTime(displayData.snapshot_ts)}
          </div>
        </div>
      </div>

      {/* Main Grid Layout: Content + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-3 space-y-6">
          {/* Risk Alerts */}
          <ErrorBoundary label="Risk Alerts">
            <RiskAlerts market={displayData} />
          </ErrorBoundary>

          {/* Probability Gauge */}
          <ErrorBoundary label="Probability Gauge">
            <ProbabilityGauge 
              probability={displayData.ui_yes_price || displayData.yes_price || 0.5}
              previousProbability={history && history.length > 1 ? history[history.length - 2].price : null}
            />
          </ErrorBoundary>

          {/* Stats Grid */}
          <ErrorBoundary label="Stats Grid">
            <StatsGrid market={displayData} />
          </ErrorBoundary>

          {/* Unified Risk Score */}
          <ErrorBoundary label="Unified Risk Score">
            <UnifiedRiskScore market={displayData} />
          </ErrorBoundary>

          {/* AI-Powered Features Section */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-lg border-2 border-purple-200">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center space-x-2">
              <span>🤖 AI-Powered Analysis</span>
              <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded">DigitalOcean GPU</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <ErrorBoundary label="AI Prediction"><AIPrediction marketId={marketId} /></ErrorBoundary>
              <ErrorBoundary label="AI Sentiment"><AISentimentAnalysis marketId={marketId} /></ErrorBoundary>
              <ErrorBoundary label="AI Trading Signal"><AITradingSignal marketId={marketId} /></ErrorBoundary>
            </div>
          </div>

          {/* Predictive Strength Score Section */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <ErrorBoundary label="Score Breakdown"><ScoreBreakdownChart marketId={marketId} /></ErrorBoundary>
            <ErrorBoundary label="Score History"><ScoreHistoryChart marketId={marketId} /></ErrorBoundary>
          </div>

          {/* Analytics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Fair Value & Expected Value */}
            <ErrorBoundary label="Valuation">
              <div className="card">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Valuation</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Fair Value</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatPercent(displayData.fair_value)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Expected Value</span>
                    <span className={`font-semibold ${displayData.expected_value > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {displayData.expected_value !== null ? `${(displayData.expected_value * 10000).toFixed(0)} bps` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Kelly Fraction</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {displayData.kelly_fraction !== null ? formatPercent(displayData.kelly_fraction) : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </ErrorBoundary>

            {/* Risk Metrics */}
            <ErrorBoundary label="Risk Metrics">
              <div className="card">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Risk Metrics</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Volatility (1w)</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {displayData.volatility_1w !== null ? formatPercent(displayData.volatility_1w) : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Orderbook Imbalance</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {displayData.orderbook_imbalance !== null ? formatPercent(displayData.orderbook_imbalance) : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Slippage ($1k)</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {displayData.slippage_notional_1k !== null ? `${displayData.slippage_notional_1k.toFixed(0)} bps` : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </ErrorBoundary>
          </div>

          {/* Full Market Timeline (Since Launch) */}
          <ErrorBoundary label="Since Launch Chart">
            <SinceLaunchChart marketId={marketId} />
          </ErrorBoundary>

          {/* Price Chart with Enhanced Tooltips */}
          <ErrorBoundary label="Price Chart">
            {history && <PriceChart data={history} />}
          </ErrorBoundary>

          {/* Liquidity Heatmap */}
          <ErrorBoundary label="Liquidity Heatmap">
            {orderbook && <LiquidityHeatmap orderbook={orderbook} />}
          </ErrorBoundary>

          {/* Orderbook */}
          <ErrorBoundary label="Orderbook">
            {orderbook && <OrderbookView orderbook={orderbook} />}
          </ErrorBoundary>

          {/* Trades Ticker */}
          <ErrorBoundary label="Trades Ticker">
            <TradesTicker marketId={marketId} />
          </ErrorBoundary>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-6 space-y-6">
            <ErrorBoundary label="Market Sidebar">
              <MarketMetaSidebar market={displayData} />
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MarketDetail
