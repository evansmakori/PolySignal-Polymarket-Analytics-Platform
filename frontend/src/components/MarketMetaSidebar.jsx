import { Calendar, Activity, XCircle, Clock3, DollarSign, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { formatLargeNumber, formatDateTime, formatPercent } from '../utils/formatters'

function MarketMetaSidebar({ market }) {
  if (!market) return null

  const [betAmount, setBetAmount] = useState('')
  const [isWidgetVisible, setIsWidgetVisible] = useState(false)

  const getStatusIcon = () => {
    if (market.closed) return <XCircle className="w-5 h-5 text-red-500" />
    if (market.active !== false) return <Activity className="w-5 h-5 text-green-500" />
    return <Clock3 className="w-5 h-5 text-yellow-500" />
  }

  const getStatusText = () => {
    if (market.closed) return 'Closed'
    if (market.active === false) return 'Inactive'
    return 'Active'
  }

  const getStatusColor = () => {
    if (market.closed) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    if (market.active !== false) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
  }

  // Calculate expected returns
  const calculateExpectedReturns = () => {
    if (!betAmount || isNaN(betAmount) || parseFloat(betAmount) <= 0) return null
    
    const amount = parseFloat(betAmount)
    const expectedValue = market.expected_value || 0
    
    // Calculate expected return for YES position
    const yesExpectedReturn = amount * (1 - expectedValue)
    const yesProfit = yesExpectedReturn - amount
    const yesExpectedProfit = amount * expectedValue // Can be negative
    
    // Calculate expected return for NO position
    const noExpectedReturn = amount * (1 + expectedValue)
    const noProfit = noExpectedReturn - amount
    
    return {
      amount,
      expectedValue,
      yesExpectedReturn,
      yesProfit,
      yesExpectedProfit,
      noExpectedReturn,
      noProfit,
    }
  }

  const expectedReturns = calculateExpectedReturns()
  const riskCategory = market.score_category || 'Weak / Avoid'
  const tradeSignal = market.trade_signal || 'no-trade'
  const getRiskColor = (risk) => {
    if (risk.includes('Strong Buy')) return 'text-green-600 bg-green-50 dark:bg-green-900/30'
    if (risk.includes('Moderate')) return 'text-blue-600 bg-blue-50 dark:bg-blue-900/30'
    if (risk.includes('Neutral')) return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/30'
    return 'text-red-600 bg-red-50 dark:bg-red-900/30'
  }

  return (
    <div className="space-y-4">
      {/* Risk Assessment */}
      <div className="card">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Risk Assessment</h3>
        <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg font-semibold ${getRiskColor(riskCategory)}`}
          {riskCategory}
        </div>
        {tradeSignal && (
          <div className="mt-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Signal: {tradeSignal.replace('-', ' ')}</span>
          </div>
        )}
      </div>

      {/* Expected Value */}
      <div className="card">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Expected Value</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">EV</span>
            <span className={`font-semibold ${market.expected_value > 0 ? 'text-green-600' : market.expected_value < 0 ? 'text-red-600' : 'text-gray-600'}`}
              {(market.expected_value || 0) > 0 ? '+' : ''}{(market.expected_value || 0).toFixed(4)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">Fair Value</span>
            <span className="font-semibold text-gray-900 dark:text-white">{(market.fair_value || 0).toFixed(4)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">Market Price (YES)</span>
            <span className="font-semibold text-gray-900 dark:text-white">{(market.ui_yes_price || market.yes_price || 0).toFixed(4)}</span>
          </div>
        </div>
      </div>

      {/* Market Information */}
      <div className="card">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Market Info</h3>
        
        <div className="space-y-3">
          {/* Market ID */}
          <div>
            <div className="flex items-center gap-2 text-base text-gray-500 dark:text-gray-400 mb-1">
              <span>Market ID</span>
            </div>
            <div className="text-sm font-mono text-gray-700 dark:text-gray-300 break-all">
              {market.market_id}
            </div>
          </div>

          {/* Category */}
          {market.category && (
            <div>
              <div className="text-base text-gray-500 dark:text-gray-400 mb-1">Category</div>
              <div className="inline-block px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-400 rounded-full font-medium">
                {market.category}
              </div>
            </div>
          )}

          {/* Created Date */}
          {market.snapshot_ts && (
            <div>
              <div className="flex items-center gap-2 text-base text-gray-500 dark:text-gray-400 mb-1">
                <Calendar className="w-4 h-4" />
                <span>Last synced</span>
              </div>
              <div className="text-base font-medium text-gray-900 dark:text-white">
                {formatDateTime(market.snapshot_ts)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Token Information */}
      {(market.yes_token_id || market.no_token_id) && (
        <div className="card">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Token IDs</h3>
          
          <div className="space-y-3">
            {market.yes_token_id && (
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">YES Token</div>
                <div className="text-sm font-mono text-green-700 dark:text-green-400 break-all">
                  {market.yes_token_id}
                </div>
              </div>
            )}
            
            {market.no_token_id && (
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">NO Token</div>
                <div className="text-sm font-mono text-red-700 dark:text-red-400 break-all">
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
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Best Prices</h3>
          
          <div className="space-y-3">
            {/* YES Token Prices */}
            <div>
              <div className="text-base font-medium text-gray-700 dark:text-gray-300 mb-2">YES Token</div>
              <div className="grid grid-cols-2 gap-2">
                {market.best_bid_yes !== null && market.best_bid_yes !== undefined && (
                  <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Bid</div>
                    <div className="text-base font-semibold text-green-700 dark:text-green-400">
                      ${market.best_bid_yes.toFixed(4)}
                    </div>
                  </div>
                )}
                {market.best_ask_yes !== null && market.best_ask_yes !== undefined && (
                  <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Ask</div>
                    <div className="text-base font-semibold text-red-700 dark:text-red-400">
                      ${market.best_ask_yes.toFixed(4)}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* NO Token Prices */}
            {(market.best_bid_no !== null || market.best_ask_no !== null) && (
              <div>
                <div className="text-base font-medium text-gray-700 dark:text-gray-300 mb-2">NO Token</div>
                <div className="grid grid-cols-2 gap-2">
                  {market.best_bid_no !== null && market.best_bid_no !== undefined && (
                    <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded">
                      <div className="text-sm text-gray-500 dark:text-gray-400">Bid</div>
                      <div className="text-base font-semibold text-green-700 dark:text-green-400">
                        ${market.best_bid_no.toFixed(4)}
                      </div>
                    </div>
                  )}
                  {market.best_ask_no !== null && market.best_ask_no !== undefined && (
                    <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded">
                      <div className="text-sm text-gray-500 dark:text-gray-400">Ask</div>
                      <div className="text-base font-semibold text-red-700 dark:text-red-400">
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
          {getStatusText()}
        </div>
      </div>

      {/* Market Information */}
      <div className="card">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Market Info</h3>
        
        <div className="space-y-3">
          {/* Market ID */}
          <div>
            <div className="flex items-center gap-2 text-base text-gray-500 dark:text-gray-400 mb-1">
              <span>Market ID</span>
            </div>
            <div className="text-sm font-mono text-gray-700 dark:text-gray-300 break-all">
              {market.market_id}
            </div>
          </div>

          {/* Category */}
          {market.category && (
            <div>
              <div className="text-base text-gray-500 dark:text-gray-400 mb-1">Category</div>
              <div className="inline-block px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-400 rounded-full font-medium">
                {market.category}
              </div>
            </div>
          )}

          {/* Created Date */}
          {market.snapshot_ts && (
            <div>
              <div className="flex items-center gap-2 text-base text-gray-500 dark:text-gray-400 mb-1">
                <Calendar className="w-4 h-4" />
                <span>Last synced</span>
              </div>
              <div className="text-base font-medium text-gray-900 dark:text-white">
                {formatDateTime(market.snapshot_ts)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Token Information */}
      {(market.yes_token_id || market.no_token_id) && (
        <div className="card">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Token IDs</h3>
          
          <div className="space-y-3">
            {market.yes_token_id && (
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">YES Token</div>
                <div className="text-sm font-mono text-green-700 dark:text-green-400 break-all">
                  {market.yes_token_id}
                </div>
              </div>
            )}
            
            {market.no_token_id && (
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">NO Token</div>
                <div className="text-sm font-mono text-red-700 dark:text-red-400 break-all">
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
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Best Prices</h3>
          
          <div className="space-y-3">
            {/* YES Token Prices */}
            <div>
              <div className="text-base font-medium text-gray-700 dark:text-gray-300 mb-2">YES Token</div>
              <div className="grid grid-cols-2 gap-2">
                {market.best_bid_yes !== null && market.best_bid_yes !== undefined && (
                  <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Bid</div>
                    <div className="text-base font-semibold text-green-700 dark:text-green-400">
                      ${market.best_bid_yes.toFixed(4)}
                    </div>
                  </div>
                )}
                {market.best_ask_yes !== null && market.best_ask_yes !== undefined && (
                  <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Ask</div>
                    <div className="text-base font-semibold text-red-700 dark:text-red-400">
                      ${market.best_ask_yes.toFixed(4)}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* NO Token Prices */}
            {(market.best_bid_no !== null || market.best_ask_no !== null) && (
              <div>
                <div className="text-base font-medium text-gray-700 dark:text-gray-300 mb-2">NO Token</div>
                <div className="grid grid-cols-2 gap-2">
                  {market.best_bid_no !== null && market.best_bid_no !== undefined && (
                    <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded">
                      <div className="text-sm text-gray-500 dark:text-gray-400">Bid</div>
                      <div className="text-base font-semibold text-green-700 dark:text-green-400">
                        ${market.best_bid_no.toFixed(4)}
                      </div>
                    </div>
                  )}
                  {market.best_ask_no !== null && market.best_ask_no !== undefined && (
                    <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded">
                      <div className="text-sm text-gray-500 dark:text-gray-400">Ask</div>
                      <div className="text-base font-semibold text-red-700 dark:text-red-400">
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
