import { useQuery } from '@tanstack/react-query'
import { Loader2, Calendar, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { marketsApi } from '../services/api'

export default function SinceLaunchChart({ marketId }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['market-since-launch', marketId],
    queryFn: () => marketsApi.getMarketSinceLaunch(marketId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  if (isLoading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900 dark:text-red-300">Error loading history</h3>
            <p className="text-sm text-red-800 dark:text-red-400 mt-1">
              {error.message || 'Failed to fetch market history since launch'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!data || !data.history || data.history.length === 0) {
    return (
      <div className="card">
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No history available
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            This market does not have enough historical data yet.
          </p>
        </div>
      </div>
    )
  }

  const { history, stats, current_price, launch_date } = data

  // Format data for chart
  const chartData = history.map((bar) => ({
    ts: new Date(bar.ts).getTime(),
    tsFormatted: new Date(bar.ts).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: '2-digit',
    }),
    yes: Math.round(bar.price * 10000) / 100, // Convert to percentage
    no: Math.round((1 - bar.price) * 10000) / 100,
  }))

  // Calculate price change percentage
  const launchPrice = history[0]?.price || 0.5
  const priceChangePercent = ((current_price - launchPrice) / launchPrice) * 100
  const isPositive = priceChangePercent >= 0

  // Custom tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      const changeFromLaunch = (
        ((payload[0].value / 100 - launchPrice) / launchPrice) * 100
      ).toFixed(2)
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {data.tsFormatted}
          </p>
          <p className="text-sm text-green-600 dark:text-green-400 font-semibold">
            YES: {payload[0].value?.toFixed(2)}%
          </p>
          {payload[1] && (
            <p className="text-sm text-red-600 dark:text-red-400 font-semibold">
              NO: {payload[1].value?.toFixed(2)}%
            </p>
          )}
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
            Change from launch: {changeFromLaunch > 0 ? '+' : ''}{changeFromLaunch}%
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="card space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center space-x-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          <span>Full Market Timeline (Since Launch)</span>
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Complete price history since market creation
        </p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Launch Date */}
        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-400 font-medium uppercase tracking-wide">
            Launch Date
          </p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
            {new Date(launch_date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>

        {/* Days Active */}
        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-400 font-medium uppercase tracking-wide">
            Days Active
          </p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
            {Math.floor(stats.days_since_launch)}
          </p>
        </div>

        {/* Launch Price */}
        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-400 font-medium uppercase tracking-wide">
            Launch Price
          </p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
            {(launchPrice * 100).toFixed(2)}%
          </p>
        </div>

        {/* Current Price */}
        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-400 font-medium uppercase tracking-wide">
            Current Price
          </p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
            {(current_price * 100).toFixed(2)}%
          </p>
        </div>

        {/* Change Since Launch */}
        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-400 font-medium uppercase tracking-wide">
            Change Since Launch
          </p>
          <div className="flex items-center space-x-1 mt-1">
            {isPositive ? (
              <TrendingUp className="w-4 h-4 text-green-600" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-600" />
            )}
            <p
              className={`text-sm font-semibold ${
                isPositive
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {isPositive ? '+' : ''}{priceChangePercent.toFixed(2)}%
            </p>
          </div>
        </div>

        {/* All-time High */}
        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-400 font-medium uppercase tracking-wide">
            All-time High
          </p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
            {(stats.max_price * 100).toFixed(2)}%
          </p>
        </div>

        {/* All-time Low */}
        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-400 font-medium uppercase tracking-wide">
            All-time Low
          </p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
            {(stats.min_price * 100).toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="w-full h-96 -mx-6 -mb-6 px-6 pb-6">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="tsFormatted"
              tick={{ fontSize: 12 }}
              stroke="#9ca3af"
              style={{ color: '#9ca3af' }}
            />
            <YAxis
              domain={[0, 100]}
              label={{ value: 'Price (%)', angle: -90, position: 'insideLeft' }}
              tick={{ fontSize: 12 }}
              stroke="#9ca3af"
              style={{ color: '#9ca3af' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              formatter={(value) => (value === 'yes' ? 'YES' : 'NO')}
            />
            <ReferenceLine
              y={50}
              stroke="#d1d5db"
              strokeDasharray="5 5"
              label={{ value: '50%', fill: '#9ca3af', fontSize: 12 }}
            />
            <Line
              type="monotone"
              dataKey="yes"
              stroke="#10b981"
              dot={false}
              strokeWidth={2}
              isAnimationActive={false}
              name="yes"
            />
            <Line
              type="monotone"
              dataKey="no"
              stroke="#ef4444"
              strokeDasharray="5 5"
              dot={false}
              strokeWidth={2}
              isAnimationActive={false}
              name="no"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Footer Stats */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          <span className="font-medium">Total data points:</span> {stats.total_bars} |{' '}
          <span className="font-medium">Volatility (all-time):</span> {stats.volatility_all_time != null ? stats.volatility_all_time.toFixed(6) : 'N/A'}
        </p>
      </div>
    </div>
  )
}
