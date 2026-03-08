import { Calendar, Clock, Activity, DollarSign, Droplets, CheckCircle, XCircle, Clock3 } from 'lucide-react'
import { formatLargeNumber, formatDateTime } from '../utils/formatters'

function MarketMetaSidebar({ market }) {
  if (!market) return null

  const getStatusIcon = () => {
    if (market.closed) return <XCircle className="w-5 h-5 text-red-500" />
    if (market.active) return <Activity className="w-5 h-5 text-green-500" />
    return <Clock3 className="w-5 h-5 text-yellow-500" />
  }

  const getStatusText = () => {
    if (market.closed) return 'Closed'
    if (market.active) return 'Active'
    return 'Inactive'
  }

  const getStatusColor = () => {
    if (market.closed) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    if (market.active) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
  }

  return (
    <div className="space-y-4">
      {/* Market Status */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Market Status</h3>
          {getStatusIcon()}
        </div>
        
        <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg font-semibold ${getStatusColor()}`}>
          {getStatusText()}
        </div>
      </div>

      {/* Market Information */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Market Info</h3>
        
        <div className="space-y-3">
          {/* Market ID */}
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
              <span>Market ID</span>
            </div>
            <div className="text-xs font-mono text-gray-700 dark:text-gray-300 break-all">
              {market.market_id}
            </div>
          </div>

          {/* Category */}
          {market.category && (
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Category</div>
              <div className="inline-block px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-400 rounded-full font-medium">
                {market.category}
              </div>
            </div>
          )}

          {/* Created Date */}
          {market.snapshot_ts && (
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
                <Calendar className="w-4 h-4" />
                <span>Last Updated</span>
              </div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {formatDateTime(market.snapshot_ts)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Volume & Liquidity */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Trading Metrics</h3>
        
        <div className="space-y-4">
          {/* Total Volume */}
          {market.volume !== null && market.volume !== undefined && (
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
                <DollarSign className="w-4 h-4" />
                <span>Total Volume</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatLargeNumber(market.volume)}
              </div>
              {market.volume_clob !== null && market.volume_clob !== undefined && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  CLOB: {formatLargeNumber(market.volume_clob)}
                </div>
              )}
            </div>
          )}

          {/* Liquidity */}
          {market.liquidity !== null && market.liquidity !== undefined && (
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
                <Droplets className="w-4 h-4" />
                <span>Liquidity</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatLargeNumber(market.liquidity)}
              </div>
              {market.liquidity_clob !== null && market.liquidity_clob !== undefined && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  CLOB: {formatLargeNumber(market.liquidity_clob)}
                </div>
              )}
            </div>
          )}

          {/* Spread */}
          {market.spread !== null && market.spread !== undefined && (
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Bid-Ask Spread</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                ${market.spread.toFixed(4)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {(market.spread * 100).toFixed(2)}¢
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Token Information */}
      {(market.yes_token_id || market.no_token_id) && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Token IDs</h3>
          
          <div className="space-y-3">
            {market.yes_token_id && (
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">YES Token</div>
                <div className="text-xs font-mono text-green-700 dark:text-green-400 break-all">
                  {market.yes_token_id}
                </div>
              </div>
            )}
            
            {market.no_token_id && (
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">NO Token</div>
                <div className="text-xs font-mono text-red-700 dark:text-red-400 break-all">
                  {market.no_token_id}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Orderbook Prices */}
      {(market.best_bid_yes || market.best_ask_yes) && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Best Prices</h3>
          
          <div className="space-y-3">
            {/* YES Token Prices */}
            <div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">YES Token</div>
              <div className="grid grid-cols-2 gap-2">
                {market.best_bid_yes !== null && market.best_bid_yes !== undefined && (
                  <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded">
                    <div className="text-xs text-gray-500 dark:text-gray-400">Bid</div>
                    <div className="text-sm font-semibold text-green-700 dark:text-green-400">
                      ${market.best_bid_yes.toFixed(4)}
                    </div>
                  </div>
                )}
                {market.best_ask_yes !== null && market.best_ask_yes !== undefined && (
                  <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded">
                    <div className="text-xs text-gray-500 dark:text-gray-400">Ask</div>
                    <div className="text-sm font-semibold text-red-700 dark:text-red-400">
                      ${market.best_ask_yes.toFixed(4)}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* NO Token Prices */}
            {(market.best_bid_no !== null || market.best_ask_no !== null) && (
              <div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">NO Token</div>
                <div className="grid grid-cols-2 gap-2">
                  {market.best_bid_no !== null && market.best_bid_no !== undefined && (
                    <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded">
                      <div className="text-xs text-gray-500 dark:text-gray-400">Bid</div>
                      <div className="text-sm font-semibold text-green-700 dark:text-green-400">
                        ${market.best_bid_no.toFixed(4)}
                      </div>
                    </div>
                  )}
                  {market.best_ask_no !== null && market.best_ask_no !== undefined && (
                    <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded">
                      <div className="text-xs text-gray-500 dark:text-gray-400">Ask</div>
                      <div className="text-sm font-semibold text-red-700 dark:text-red-400">
                        ${market.best_ask_no.toFixed(4)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default MarketMetaSidebar
