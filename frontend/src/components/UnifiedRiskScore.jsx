import { useState } from 'react'
import { Shield, ChevronDown, ChevronUp, AlertTriangle, Activity, TrendingDown } from 'lucide-react'

function UnifiedRiskScore({ market }) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!market) return null

  // Calculate individual risk components (0-100 scale, higher = more risk)
  const calculateVolatilityRisk = () => {
    if (!market.volatility_1w) return 0
    // Normalize volatility: 0-10% vol maps to 0-100 risk
    return Math.min((market.volatility_1w / 0.10) * 100, 100)
  }

  const calculateSlippageRisk = () => {
    if (!market.slippage_notional_1k) return 0
    // Normalize slippage: 0-1000 bps maps to 0-100 risk
    return Math.min((market.slippage_notional_1k / 1000) * 100, 100)
  }

  const calculateImbalanceRisk = () => {
    if (!market.orderbook_imbalance) return 0
    // Normalize imbalance: higher absolute value = more risk
    return Math.abs(market.orderbook_imbalance) * 100
  }

  const calculateLiquidityRisk = () => {
    if (!market.liquidity) return 100
    // Inverse: lower liquidity = higher risk
    // $100k liquidity = 0 risk, $0 = 100 risk
    const maxLiquidity = 100000
    return Math.max(0, 100 - (market.liquidity / maxLiquidity) * 100)
  }

  const calculateSpreadRisk = () => {
    if (!market.spread) return 0
    // Normalize spread: $0.10 spread = 100 risk
    return Math.min((market.spread / 0.10) * 100, 100)
  }

  // Component weights
  const weights = {
    volatility: 0.30,
    slippage: 0.25,
    imbalance: 0.20,
    liquidity: 0.15,
    spread: 0.10,
  }

  // Calculate weighted components
  const components = {
    volatility: {
      name: 'Volatility Risk',
      risk: calculateVolatilityRisk(),
      weight: weights.volatility,
      value: market.volatility_1w,
      format: (v) => v ? `${(v * 100).toFixed(2)}%` : 'N/A',
      description: 'Price stability over the last week',
      icon: Activity,
    },
    slippage: {
      name: 'Slippage Risk',
      risk: calculateSlippageRisk(),
      weight: weights.slippage,
      value: market.slippage_notional_1k,
      format: (v) => v ? `${v.toFixed(0)} bps` : 'N/A',
      description: 'Expected slippage on $1k order',
      icon: TrendingDown,
    },
    imbalance: {
      name: 'Orderbook Imbalance',
      risk: calculateImbalanceRisk(),
      weight: weights.imbalance,
      value: market.orderbook_imbalance,
      format: (v) => v ? `${(Math.abs(v) * 100).toFixed(1)}%` : 'N/A',
      description: 'Bid/Ask volume asymmetry',
      icon: Activity,
    },
    liquidity: {
      name: 'Liquidity Risk',
      risk: calculateLiquidityRisk(),
      weight: weights.liquidity,
      value: market.liquidity,
      format: (v) => v ? `$${(v / 1000).toFixed(1)}k` : 'N/A',
      description: 'Market depth and available liquidity',
      icon: TrendingDown,
    },
    spread: {
      name: 'Spread Risk',
      risk: calculateSpreadRisk(),
      weight: weights.spread,
      value: market.spread,
      format: (v) => v ? `$${v.toFixed(4)}` : 'N/A',
      description: 'Bid-ask spread transaction cost',
      icon: TrendingDown,
    },
  }

  // Calculate unified risk score
  const unifiedRiskScore = Object.values(components).reduce(
    (total, component) => total + (component.risk * component.weight),
    0
  )

  // Determine risk band
  const getRiskBand = (score) => {
    if (score < 30) return { label: 'Low Risk', color: 'green', bgColor: 'bg-green-500' }
    if (score < 60) return { label: 'Medium Risk', color: 'yellow', bgColor: 'bg-yellow-500' }
    return { label: 'High Risk', color: 'red', bgColor: 'bg-red-500' }
  }

  const riskBand = getRiskBand(unifiedRiskScore)

  const getGradientColor = (score) => {
    if (score < 30) return 'from-green-400 to-green-600'
    if (score < 60) return 'from-yellow-400 to-yellow-600'
    return 'from-red-400 to-red-600'
  }

  const getRiskColor = (risk) => {
    if (risk < 30) return 'text-green-600 dark:text-green-400'
    if (risk < 60) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  const getBarColor = (risk) => {
    if (risk < 30) return 'bg-green-500'
    if (risk < 60) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-primary-600" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Unified Risk Score
        </h3>
      </div>

      {/* Main Risk Score Display */}
      <div className={`p-6 rounded-xl bg-gradient-to-br ${getGradientColor(unifiedRiskScore)} mb-4`}>
        <div className="text-center">
          <div className="text-white text-sm font-medium mb-2 opacity-90">
            Overall Risk Level
          </div>
          <div className="text-6xl font-bold text-white mb-2">
            {unifiedRiskScore.toFixed(0)}
          </div>
          <div className="text-white text-lg font-semibold mb-3">
            {riskBand.label}
          </div>
          
          {/* Risk Score Bar */}
          <div className="relative h-3 bg-white/30 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-white transition-all duration-500"
              style={{ width: `${unifiedRiskScore}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-white/80 mt-1">
            <span>0 (Safe)</span>
            <span>100 (Risky)</span>
          </div>
        </div>
      </div>

      {/* Risk Band Indicator */}
      <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${riskBand.bgColor}`}></div>
          <span className="font-semibold text-gray-900 dark:text-white">
            {riskBand.label}
          </span>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
        >
          {isExpanded ? 'Hide' : 'Show'} Breakdown
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expandable Breakdown */}
      {isExpanded && (
        <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Risk Component Breakdown
          </div>

          {Object.entries(components).map(([key, component]) => (
            <div key={key} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <component.icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  <span className="font-medium text-gray-900 dark:text-white">
                    {component.name}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ({(component.weight * 100).toFixed(0)}% weight)
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {component.format(component.value)}
                  </span>
                  <span className={`font-semibold min-w-[60px] text-right ${getRiskColor(component.risk)}`}>
                    {component.risk.toFixed(0)} risk
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 ${getBarColor(component.risk)} transition-all duration-500`}
                  style={{ width: `${component.risk}%` }}
                />
              </div>

              <div className="text-xs text-gray-500 dark:text-gray-400">
                {component.description}
              </div>
            </div>
          ))}

          {/* Contribution Summary */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Weighted Contributions to Total Risk:
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(components).map(([key, component]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">{component.name}:</span>
                  <span className={`font-semibold ${getRiskColor(component.risk)}`}>
                    +{(component.risk * component.weight).toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Risk Interpretation Guide */}
      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="text-xs text-blue-800 dark:text-blue-300">
          <div className="font-semibold mb-1">Risk Score Guide:</div>
          <div className="space-y-1">
            <div>• <span className="font-medium text-green-700 dark:text-green-400">0-30:</span> Low risk, stable market conditions</div>
            <div>• <span className="font-medium text-yellow-700 dark:text-yellow-400">30-60:</span> Medium risk, some volatility or liquidity concerns</div>
            <div>• <span className="font-medium text-red-700 dark:text-red-400">60-100:</span> High risk, significant execution or volatility risks</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UnifiedRiskScore
