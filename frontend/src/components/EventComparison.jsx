import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Loader2, Trophy, TrendingUp, BarChart3 } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { marketsApi } from '../services/api'
import { formatPercent, formatLargeNumber } from '../utils/formatters'

function EventComparison({ marketIds = [] }) {
  const navigate = useNavigate()

  // Fetch comparison data
  const { data: compareData, isLoading: isCompareLoading } = useQuery({
    queryKey: ['event-compare', marketIds],
    queryFn: () => marketsApi.compareMarkets(marketIds),
    enabled: marketIds.length > 0,
  })

  // Fetch summary data
  const { data: summaryData, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['event-summary', marketIds],
    queryFn: () => marketsApi.getEventSummary(marketIds),
    enabled: marketIds.length > 0,
  })

  const isLoading = isCompareLoading || isSummaryLoading

  const getScoreColor = (score) => {
    if (score >= 70) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    if (score >= 50) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
    return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
  }

  const getSignalColor = (signal) => {
    if (signal === 'long') return 'text-green-600 dark:text-green-400'
    if (signal === 'short') return 'text-red-600 dark:text-red-400'
    return 'text-gray-600 dark:text-gray-400'
  }

  const truncateTitle = (title, maxLength = 30) => {
    if (title && title.length > maxLength) {
      return title.substring(0, maxLength) + '...'
    }
    return title
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    )
  }

  if (!compareData || compareData.length === 0) {
    return (
      <div className="card text-center py-12">
        <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No markets found
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Enter market IDs to compare outcomes
        </p>
      </div>
    )
  }

  // Prepare chart data for YES prices
  const chartData = compareData.map((m) => ({
    name: truncateTitle(m.title, 25),
    yes_price: parseFloat((m.yes_price || 0).toFixed(3)),
    market_id: m.market_id,
  }))

  const handleRowClick = (marketId) => {
    navigate(`/market/${marketId}`)
  }

  return (
    <div className="space-y-6">
      {/* Summary Bar */}
      {summaryData && (
        <div className="card">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Total Markets
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {summaryData.total_markets}
              </div>
            </div>

            {summaryData.best_opportunity && (
              <div className="text-center">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Best Opportunity
                </div>
                <div className="text-lg font-bold text-gray-900 dark:text-white truncate">
                  {truncateTitle(summaryData.best_opportunity.title, 20)}
                </div>
                <div className="text-sm text-primary-600 dark:text-primary-400">
                  {summaryData.best_opportunity.score.toFixed(1)}
                </div>
              </div>
            )}

            <div className="text-center">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Total Liquidity
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatLargeNumber(summaryData.total_liquidity)}
              </div>
            </div>

            <div className="text-center">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Avg Score
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {summaryData.avg_score.toFixed(1)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comparison Table */}
      <div className="card overflow-x-auto">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Market Comparison
        </h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                Rank
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                Title
              </th>
              <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                YES%
              </th>
              <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                NO%
              </th>
              <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                Score
              </th>
              <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                Category
              </th>
              <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                Signal
              </th>
              <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                EV (bps)
              </th>
              <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                Kelly%
              </th>
              <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                Liquidity
              </th>
              <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                Spread
              </th>
            </tr>
          </thead>
          <tbody>
            {compareData.map((market, index) => (
              <tr
                key={market.market_id}
                onClick={() => handleRowClick(market.market_id)}
                className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              >
                <td className="py-3 px-4 text-gray-900 dark:text-white font-semibold">
                  {index + 1}
                </td>
                <td className="py-3 px-4 text-gray-900 dark:text-white font-medium max-w-xs truncate">
                  {market.title}
                </td>
                <td className="py-3 px-4 text-center font-semibold text-green-600 dark:text-green-400">
                  {formatPercent(market.yes_price)}
                </td>
                <td className="py-3 px-4 text-center font-semibold text-red-600 dark:text-red-400">
                  {formatPercent(market.no_price)}
                </td>
                <td className="py-3 px-4 text-center">
                  <span className={`px-3 py-1 rounded-full font-bold ${getScoreColor(market.predictive_score)}`}>
                    {market.predictive_score.toFixed(0)}
                  </span>
                </td>
                <td className="py-3 px-4 text-center text-gray-700 dark:text-gray-300 text-xs">
                  {market.score_category}
                </td>
                <td className={`py-3 px-4 text-center font-semibold ${getSignalColor(market.trade_signal)}`}>
                  {market.trade_signal ? market.trade_signal.toUpperCase() : '-'}
                </td>
                <td className="py-3 px-4 text-center text-gray-900 dark:text-white">
                  {market.expected_value !== null && market.expected_value !== undefined
                    ? (market.expected_value * 10000).toFixed(0)
                    : '-'}
                </td>
                <td className="py-3 px-4 text-center text-gray-900 dark:text-white">
                  {market.kelly_fraction !== null && market.kelly_fraction !== undefined
                    ? (market.kelly_fraction * 100).toFixed(2)
                    : '-'}
                </td>
                <td className="py-3 px-4 text-center text-gray-900 dark:text-white">
                  {formatLargeNumber(market.liquidity)}
                </td>
                <td className="py-3 px-4 text-center text-gray-900 dark:text-white">
                  {market.spread !== null && market.spread !== undefined
                    ? (market.spread).toFixed(3)
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* YES Price Chart */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          YES Price Comparison
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <XAxis
              dataKey="name"
              angle={-45}
              textAnchor="end"
              height={100}
              interval={0}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              domain={[0, 1]}
              label={{ value: 'Price', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              formatter={(value) => formatPercent(value)}
              labelFormatter={(label) => `Market: ${label}`}
            />
            <Bar dataKey="yes_price" fill="#10b981">
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.yes_price >= 0.5 ? '#10b981' : '#3b82f6'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default EventComparison
