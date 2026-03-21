import { useQuery } from '@tanstack/react-query'
import { BarChart3, Loader2, TrendingUp } from 'lucide-react'
import { marketsApi } from '../services/api'

function ScoreBreakdownChart({ marketId }) {
  const { data: scoreData, isLoading, error } = useQuery({
    queryKey: ['market-score', marketId],
    queryFn: () => marketsApi.getMarketScoreDetails(marketId),
  })

  if (isLoading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
        </div>
      </div>
    )
  }

  if (error || !scoreData) {
    return null
  }

  const { score, category, breakdown, metrics } = scoreData

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400'
    if (score >= 60) return 'text-blue-600 dark:text-blue-400'
    if (score >= 40) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-gray-600 dark:text-gray-400'
  }

  const getBarColor = (score) => {
    if (score >= 80) return 'bg-green-500'
    if (score >= 60) return 'bg-blue-500'
    if (score >= 40) return 'bg-yellow-500'
    return 'bg-gray-500'
  }

  const components = [
    { 
      name: 'Expected Value', 
      key: 'expected_value',
      weight: 30,
      normalized: breakdown.normalized_components?.expected_value,
      weighted: breakdown.weighted_components?.expected_value,
      value: metrics?.expected_value,
      format: (v) => v !== null && v !== undefined ? `${(v * 100).toFixed(1)}%` : 'N/A'
    },
    { 
      name: 'Kelly Fraction', 
      key: 'kelly_fraction',
      weight: 20,
      normalized: breakdown.normalized_components?.kelly_fraction,
      weighted: breakdown.weighted_components?.kelly_fraction,
      value: metrics?.kelly_fraction,
      format: (v) => v !== null && v !== undefined ? v.toFixed(3) : 'N/A'
    },
    { 
      name: 'Liquidity', 
      key: 'liquidity_score',
      weight: 15,
      normalized: breakdown.normalized_components?.liquidity_score,
      weighted: breakdown.weighted_components?.liquidity_score,
      value: metrics?.liquidity,
      format: (v) => v !== null && v !== undefined ? `$${(v/1000).toFixed(1)}k` : 'N/A'
    },
    { 
      name: 'Volatility', 
      key: 'volatility',
      weight: 10,
      normalized: breakdown.normalized_components?.volatility,
      weighted: breakdown.weighted_components?.volatility,
      value: metrics?.volatility_1w,
      format: (v) => v !== null && v !== undefined ? `${(v * 100).toFixed(1)}%` : 'N/A'
    },
    { 
      name: 'Orderbook Imbalance', 
      key: 'orderbook_imbalance',
      weight: 10,
      normalized: breakdown.normalized_components?.orderbook_imbalance,
      weighted: breakdown.weighted_components?.orderbook_imbalance,
      value: metrics?.orderbook_imbalance,
      format: (v) => v !== null && v !== undefined ? v.toFixed(3) : 'N/A'
    },
    { 
      name: 'Spread', 
      key: 'spread',
      weight: 5,
      normalized: breakdown.normalized_components?.spread,
      weighted: breakdown.weighted_components?.spread,
      value: metrics?.spread,
      format: (v) => v !== null && v !== undefined ? `$${v.toFixed(3)}` : 'N/A'
    },
    { 
      name: 'Momentum', 
      key: 'sentiment_momentum',
      weight: 10,
      normalized: breakdown.normalized_components?.sentiment_momentum,
      weighted: breakdown.weighted_components?.sentiment_momentum,
      value: metrics?.sentiment_momentum,
      format: (v) => {
        if (v === null || v === undefined) return 'N/A'
        const abs = Math.abs(v)
        if (abs === 0) return '0.000'
        if (abs < 0.0001) return (v * 1e6).toFixed(2) + 'e-6'
        if (abs < 0.01) return v.toFixed(6)
        return v.toFixed(4)
      }
    },
  ]

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="w-5 h-5 text-primary-600" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
          Score Breakdown
        </h3>
      </div>

      {/* Overall Score */}
      <div className="mb-6 p-4 rounded-lg bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base text-gray-600 dark:text-gray-400 mb-1">
              Predictive Strength Score
            </div>
            <div className={`text-6xl font-bold ${getScoreColor(score)}`}>
              {score.toFixed(1)}
              <span className="text-2xl opacity-75">/100</span>
            </div>
          </div>
          <div className="text-right">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold ${
              score >= 80 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
              score >= 60 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
              score >= 40 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
              'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
            }`}>
              {category}
            </div>
          </div>
        </div>
      </div>

      {/* Component Breakdown */}
      <div className="space-y-4">
        {components.map((component) => (
          <div key={component.key} className="space-y-2">
            <div className="flex items-center justify-between text-base">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 dark:text-white">
                  {component.name}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  ({component.weight}% weight)
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-gray-600 dark:text-gray-400">
                  {component.format(component.value)}
                </span>
                <span className="font-semibold text-gray-900 dark:text-white min-w-[60px] text-right">
                  +{((component.weighted || 0) * 100).toFixed(1)} pts
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 ${getBarColor(score)} transition-all duration-500`}
                style={{ width: `${Math.min(100, (component.normalized || 0) * 100)}%` }}
              />
            </div>

            <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>Normalized: {((component.normalized || 0) * 100).toFixed(1)}%</span>
              <span>Contribution: {score > 0 ? (((component.weighted || 0) / score) * 100).toFixed(1) : '0.0'}% of total</span>
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
          <p><strong>Normalized:</strong> Each metric scaled to 0-100%</p>
          <p><strong>Contribution:</strong> Normalized × Weight = Points added to total score</p>
        </div>
      </div>
    </div>
  )
}

export default ScoreBreakdownChart
