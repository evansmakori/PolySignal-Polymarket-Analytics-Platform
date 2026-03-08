import { AlertTriangle, AlertCircle, TrendingDown, TrendingUp, Zap } from 'lucide-react'

function RiskAlerts({ market }) {
  if (!market) return null

  const alerts = []

  // Check for late overconfidence
  if (market.late_overconfidence) {
    alerts.push({
      type: 'warning',
      icon: AlertTriangle,
      title: 'Late Overconfidence Detected',
      message: 'Market shows extreme confidence near resolution. Exercise caution with late positions.',
      color: 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800',
      textColor: 'text-orange-800 dark:text-orange-300',
      iconColor: 'text-orange-600 dark:text-orange-400',
    })
  }

  // Check for overreaction (high volatility with low liquidity)
  const hasHighVolatility = market.volatility_1w && market.volatility_1w > 0.05
  const hasLowLiquidity = market.liquidity && market.liquidity < 5000
  if (hasHighVolatility && hasLowLiquidity) {
    alerts.push({
      type: 'warning',
      icon: Zap,
      title: 'Potential Overreaction',
      message: 'High volatility combined with low liquidity may indicate market overreaction or manipulation risk.',
      color: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
      textColor: 'text-yellow-800 dark:text-yellow-300',
      iconColor: 'text-yellow-600 dark:text-yellow-400',
    })
  }

  // Check for extreme divergence (large difference between fair value and market price)
  if (market.expected_value && Math.abs(market.expected_value) > 0.15) {
    const isUndervalued = market.expected_value > 0
    alerts.push({
      type: isUndervalued ? 'opportunity' : 'caution',
      icon: isUndervalued ? TrendingUp : TrendingDown,
      title: `Extreme ${isUndervalued ? 'Undervaluation' : 'Overvaluation'}`,
      message: `Market price diverges significantly from fair value (${(Math.abs(market.expected_value) * 100).toFixed(1)}% edge). ${
        isUndervalued 
          ? 'Potential buying opportunity but verify fundamentals.' 
          : 'Market may be overpriced relative to true probability.'
      }`,
      color: isUndervalued 
        ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
        : 'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800',
      textColor: isUndervalued 
        ? 'text-blue-800 dark:text-blue-300'
        : 'text-purple-800 dark:text-purple-300',
      iconColor: isUndervalued 
        ? 'text-blue-600 dark:text-blue-400'
        : 'text-purple-600 dark:text-purple-400',
    })
  }

  // Check for high degen risk
  if (market.degen_risk && market.degen_risk > 0.7) {
    alerts.push({
      type: 'danger',
      icon: AlertCircle,
      title: 'High Speculation Risk',
      message: `Degen risk score: ${(market.degen_risk * 100).toFixed(0)}%. This market exhibits high speculative behavior. Trade with extreme caution.`,
      color: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800',
      textColor: 'text-red-800 dark:text-red-300',
      iconColor: 'text-red-600 dark:text-red-400',
    })
  }

  // Check for extreme orderbook imbalance
  if (market.orderbook_imbalance && Math.abs(market.orderbook_imbalance) > 0.8) {
    const direction = market.orderbook_imbalance > 0 ? 'buy' : 'sell'
    alerts.push({
      type: 'info',
      icon: AlertCircle,
      title: 'Extreme Orderbook Imbalance',
      message: `Strong ${direction}-side pressure (${(Math.abs(market.orderbook_imbalance) * 100).toFixed(0)}% imbalance). May indicate directional momentum or liquidity issues.`,
      color: 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800',
      textColor: 'text-indigo-800 dark:text-indigo-300',
      iconColor: 'text-indigo-600 dark:text-indigo-400',
    })
  }

  // Check for high slippage
  if (market.slippage_notional_1k && market.slippage_notional_1k > 500) {
    alerts.push({
      type: 'warning',
      icon: AlertTriangle,
      title: 'High Slippage Warning',
      message: `Large orders will experience significant slippage (${market.slippage_notional_1k.toFixed(0)} bps for $1k). Consider splitting orders.`,
      color: 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800',
      textColor: 'text-amber-800 dark:text-amber-300',
      iconColor: 'text-amber-600 dark:text-amber-400',
    })
  }

  // If no alerts, return null
  if (alerts.length === 0) {
    return (
      <div className="card bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-green-800 dark:text-green-300 mb-1">No Risk Alerts</h4>
            <p className="text-sm text-green-700 dark:text-green-400">
              This market shows no extreme risk indicators at this time.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert, index) => (
        <div key={index} className={`card border-2 ${alert.color}`}>
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-white/50 dark:bg-black/20 rounded-full flex items-center justify-center">
                <alert.icon className={`w-6 h-6 ${alert.iconColor}`} />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h4 className={`font-bold mb-1 ${alert.textColor}`}>
                {alert.title}
              </h4>
              <p className={`text-sm ${alert.textColor} opacity-90`}>
                {alert.message}
              </p>
              
              {/* Badge */}
              <div className="mt-2">
                <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${
                  alert.type === 'danger' ? 'bg-red-200 dark:bg-red-900/40 text-red-900 dark:text-red-200' :
                  alert.type === 'warning' ? 'bg-yellow-200 dark:bg-yellow-900/40 text-yellow-900 dark:text-yellow-200' :
                  alert.type === 'opportunity' ? 'bg-blue-200 dark:bg-blue-900/40 text-blue-900 dark:text-blue-200' :
                  'bg-gray-200 dark:bg-gray-900/40 text-gray-900 dark:text-gray-200'
                }`}>
                  {alert.type.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default RiskAlerts
