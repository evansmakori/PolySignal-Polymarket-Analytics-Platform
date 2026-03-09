import { useQuery } from '@tanstack/react-query'
import { Loader2, Activity, TrendingUp, TrendingDown } from 'lucide-react'
import { marketsApi } from '../services/api'

export default function TradesTicker({ marketId }) {
  const { data: trades, isLoading } = useQuery({
    queryKey: ['market-trades', marketId],
    queryFn: () => marketsApi.getMarketTrades(marketId, 20, true),
    refetchInterval: 15000, // refresh every 15 seconds
    staleTime: 10000,
  })

  const formatTime = (ts) => {
    if (!ts) return '—'
    const diff = (Date.now() - new Date(ts).getTime()) / 1000
    if (diff < 60) return `${Math.floor(diff)}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    return `${Math.floor(diff / 3600)}h ago`
  }

  const getSideColor = (side) => {
    const sideStr = side?.toLowerCase()
    if (sideStr === 'buy') return 'text-green-600 dark:text-green-400'
    if (sideStr === 'sell') return 'text-red-600 dark:text-red-400'
    return 'text-gray-600 dark:text-gray-400'
  }

  const getSideIcon = (side) => {
    const sideStr = side?.toLowerCase()
    if (sideStr === 'buy') return <TrendingUp className="w-4 h-4" />
    if (sideStr === 'sell') return <TrendingDown className="w-4 h-4" />
    return null
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
          <Activity className="w-4 h-4 text-blue-600" />
          <span>Recent Trades</span>
        </h3>
        <span className="flex items-center space-x-1 text-sm text-green-600 dark:text-green-400">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span>Live</span>
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
        </div>
      ) : !trades || !trades.trades || trades.trades.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-600 dark:text-gray-400">No trades available</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-base">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                  Time
                </th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                  Side
                </th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                  Price
                </th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                  Size
                </th>
              </tr>
            </thead>
            <tbody>
              {trades.trades.slice(0, 15).map((trade, idx) => (
                <tr
                  key={idx}
                  className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50"
                >
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                    {formatTime(trade.timestamp)}
                  </td>
                  <td className="py-3 px-4">
                    <div className={`flex items-center gap-1 font-medium ${getSideColor(trade.side)}`}>
                      {getSideIcon(trade.side)}
                      <span className="capitalize">{trade.side}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right text-gray-900 dark:text-white font-semibold">
                    {(trade.price * 100).toFixed(2)}%
                  </td>
                  <td className="py-3 px-4 text-right text-gray-900 dark:text-white font-semibold">
                    ${trade.size ? (trade.size / 1000).toFixed(1) : '0'}K
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 text-sm text-gray-500 dark:text-gray-400 text-center">
        Updates every 15s
      </div>
    </div>
  )
}
