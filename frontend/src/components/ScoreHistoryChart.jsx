import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LineChart, Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { marketsApi } from '../services/api'

function ScoreHistoryChart({ marketId }) {
  const [days, setDays] = useState(30)

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['score-history', marketId, days],
    queryFn: () => marketsApi.getScoreHistory(marketId, days, 24),
  })

  const { data: trend, isLoading: trendLoading } = useQuery({
    queryKey: ['score-trend', marketId, days],
    queryFn: () => marketsApi.getScoreTrend(marketId, Math.min(days, 30)),
  })

  const isLoading = historyLoading || trendLoading

  if (isLoading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
        </div>
      </div>
    )
  }

  if (!history || history.length === 0) {
    return (
      <div className="card">
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No historical data available
        </div>
      </div>
    )
  }

  const getTrendIcon = (trendData) => {
    if (!trendData) return <Minus className="w-4 h-4" />
    if (trendData.trend === 'up') return <TrendingUp className="w-4 h-4 text-green-600" />
    if (trendData.trend === 'down') return <TrendingDown className="w-4 h-4 text-red-600" />
    return <Minus className="w-4 h-4 text-gray-600" />
  }

  const getTrendColor = (trendData) => {
    if (!trendData) return 'text-gray-600'
    if (trendData.trend === 'up') return 'text-green-600 dark:text-green-400'
    if (trendData.trend === 'down') return 'text-red-600 dark:text-red-400'
    return 'text-gray-600 dark:text-gray-400'
  }

  // Simple ASCII-style chart
  const maxScore = Math.max(...history.map(h => h.score), 100)
  const minScore = Math.min(...history.map(h => h.score), 0)
  const scoreRange = maxScore - minScore || 1

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <LineChart className="w-5 h-5 text-primary-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Score History
          </h3>
        </div>

        {/* Time Range Selector */}
        <select
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value))}
          className="input text-sm"
        >
          <option value={7}>7 days</option>
          <option value={14}>14 days</option>
          <option value={30}>30 days</option>
          <option value={90}>90 days</option>
        </select>
      </div>

      {/* Trend Summary */}
      {trend && (
        <div className="mb-6 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Trend</div>
              <div className={`flex items-center gap-1 font-semibold ${getTrendColor(trend)}`}>
                {getTrendIcon(trend)}
                <span className="capitalize">{trend.direction}</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Change</div>
              <div className={`font-semibold ${getTrendColor(trend)}`}>
                {trend.change > 0 ? '+' : ''}{trend.change.toFixed(1)} pts
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Current</div>
              <div className="font-semibold text-gray-900 dark:text-white">
                {trend.last_score.toFixed(1)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Volatility</div>
              <div className="font-semibold text-gray-900 dark:text-white">
                {trend.volatility.toFixed(1)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="space-y-1">
        {/* Y-axis labels and chart area */}
        <div className="flex gap-2">
          {/* Y-axis */}
          <div className="flex flex-col justify-between text-xs text-gray-500 dark:text-gray-400 w-10 text-right">
            <span>{maxScore.toFixed(0)}</span>
            <span>{((maxScore + minScore) / 2).toFixed(0)}</span>
            <span>{minScore.toFixed(0)}</span>
          </div>

          {/* Chart area */}
          <div className="flex-1 relative" style={{ height: '200px' }}>
            <div className="absolute inset-0 border-l border-b border-gray-200 dark:border-gray-700">
              {/* Grid lines */}
              <div className="absolute inset-0">
                <div className="h-1/3 border-b border-gray-100 dark:border-gray-800" />
                <div className="h-1/3 border-b border-gray-100 dark:border-gray-800" />
              </div>

              {/* SVG Chart */}
              <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                <polyline
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-primary-600"
                  points={history
                    .map((point, i) => {
                      const x = (i / (history.length - 1)) * 100
                      const y = 100 - ((point.score - minScore) / scoreRange) * 100
                      return `${x},${y}`
                    })
                    .join(' ')}
                  vectorEffect="non-scaling-stroke"
                />
                
                {/* Area fill */}
                <polygon
                  fill="currentColor"
                  className="text-primary-600 opacity-10"
                  points={[
                    ...history.map((point, i) => {
                      const x = (i / (history.length - 1)) * 100
                      const y = 100 - ((point.score - minScore) / scoreRange) * 100
                      return `${x},${y}`
                    }),
                    '100,100',
                    '0,100'
                  ].join(' ')}
                />
              </svg>

              {/* Data points */}
              {history.map((point, i) => {
                const x = (i / (history.length - 1)) * 100
                const y = 100 - ((point.score - minScore) / scoreRange) * 100
                return (
                  <div
                    key={i}
                    className="absolute w-2 h-2 bg-primary-600 rounded-full -ml-1 -mt-1 cursor-pointer hover:scale-150 transition-transform"
                    style={{ left: `${x}%`, top: `${y}%` }}
                    title={`${new Date(point.timestamp).toLocaleDateString()}: ${point.score.toFixed(1)}`}
                  />
                )
              })}
            </div>
          </div>
        </div>

        {/* X-axis labels */}
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 ml-12">
          <span>{new Date(history[0].timestamp).toLocaleDateString()}</span>
          <span>{new Date(history[history.length - 1].timestamp).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-3 gap-4 text-center text-sm">
          <div>
            <div className="text-gray-500 dark:text-gray-400 mb-1">Highest</div>
            <div className="font-semibold text-gray-900 dark:text-white">
              {Math.max(...history.map(h => h.score)).toFixed(1)}
            </div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400 mb-1">Average</div>
            <div className="font-semibold text-gray-900 dark:text-white">
              {(history.reduce((sum, h) => sum + h.score, 0) / history.length).toFixed(1)}
            </div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400 mb-1">Lowest</div>
            <div className="font-semibold text-gray-900 dark:text-white">
              {Math.min(...history.map(h => h.score)).toFixed(1)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ScoreHistoryChart
