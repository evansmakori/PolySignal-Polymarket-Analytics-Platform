import { Link } from 'react-router-dom'
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import { formatPercent, formatLargeNumber, getSignalColor, getRiskColor } from '../utils/formatters'
import PriceChangeBadges from './PriceChangeBadges'

function MarketCard({ market }) {
  const getSignalIcon = (signal) => {
    switch (signal) {
      case 'long':
        return <TrendingUp className="w-4 h-4" />
      case 'short':
        return <TrendingDown className="w-4 h-4" />
      default:
        return null
    }
  }

  return (
    <Link
      to={`/market/${market.market_id}`}
      className="card hover:shadow-lg transition-shadow cursor-pointer"
    >
      <div className="space-y-3">
        {/* Title */}
        <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2">
          {market.title}
        </h3>

        {/* Category */}
        {market.category && (
          <span className="inline-block px-2 py-1 text-sm rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
            {market.category}
          </span>
        )}

        {/* Prices */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">YES</p>
            <p className="text-xl font-bold text-green-600 dark:text-green-400">
              {formatPercent(market.yes_price)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">NO</p>
            <p className="text-xl font-bold text-red-600 dark:text-red-400">
              {formatPercent(market.no_price)}
            </p>
          </div>
        </div>

        {/* Volume & Liquidity */}
        <div className="grid grid-cols-2 gap-4 text-base">
          <div>
            <p className="text-gray-500 dark:text-gray-400">Volume</p>
            <p className="font-semibold text-gray-900 dark:text-white">
              {formatLargeNumber(market.volume_24h ?? market.volume)}
            </p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400">Liquidity</p>
            <p className="font-semibold text-gray-900 dark:text-white">
              {formatLargeNumber(market.liquidity)}
            </p>
          </div>
        </div>

        {/* Trading Signal & Risk */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
          {/* Trading Signal */}
          {market.trade_signal && (
            <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-sm font-medium ${getSignalColor(market.trade_signal)}`}>
              {getSignalIcon(market.trade_signal)}
              <span className="capitalize">{market.trade_signal}</span>
            </div>
          )}

          {/* Degen Risk */}
          {market.degen_risk !== null && market.degen_risk !== undefined && (
            <div className="flex items-center space-x-1 text-sm">
              <AlertTriangle className={`w-3 h-3 ${getRiskColor(market.degen_risk)}`} />
              <span className={`font-medium ${getRiskColor(market.degen_risk)}`}>
                {(market.degen_risk * 100).toFixed(0)}% Risk
              </span>
            </div>
          )}
        </div>

        {/* Price Change Badges */}
        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
          <PriceChangeBadges market={market} />
        </div>
      </div>
    </Link>
  )
}

export default MarketCard
