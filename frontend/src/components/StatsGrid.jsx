import { Activity, DollarSign, TrendingUp, AlertCircle } from 'lucide-react'
import { formatLargeNumber, formatPercent, getRiskColor } from '../utils/formatters'

function StatsGrid({ market }) {
  const stats = [
    {
      label: 'Volume',
      value: formatLargeNumber(market.volume),
      icon: DollarSign,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900',
    },
    {
      label: 'Liquidity',
      value: formatLargeNumber(market.liquidity),
      icon: Activity,
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900',
    },
    {
      label: 'Spread',
      value: formatPercent(market.spread, 3),
      icon: TrendingUp,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900',
    },
    {
      label: 'Degen Risk',
      value: market.degen_risk != null ? `${(market.degen_risk * 100).toFixed(0)}%` : 'N/A',
      icon: AlertCircle,
      color: getRiskColor(market.degen_risk),
      bgColor: market.degen_risk == null || market.degen_risk < 0.3
        ? 'bg-green-100 dark:bg-green-900' 
        : market.degen_risk < 0.6 
        ? 'bg-yellow-100 dark:bg-yellow-900' 
        : 'bg-red-100 dark:bg-red-900',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <div key={index} className="card">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${stat.bgColor}`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
              <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default StatsGrid
