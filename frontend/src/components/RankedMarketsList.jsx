import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, Award, ChevronRight, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { marketsApi } from '../services/api'
import { formatPercent, formatLargeNumber } from '../utils/formatters'

function RankedMarketsList({ filters = {}, showFilters = false }) {
  const [minScore, setMinScore] = useState(60)
  const [limit, setLimit] = useState(20)

  const { data: markets, isLoading, error } = useQuery({
    queryKey: ['ranked-markets', { ...filters, limit, min_score: minScore }],
    queryFn: () => marketsApi.getRankedMarkets({ ...filters, limit }),
    refetchInterval: 60000, // Refresh every minute
  })

  const getScoreBadgeColor = (score) => {
    if (score >= 80) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    if (score >= 60) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
    if (score >= 40) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
    return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
  }

  const getCategoryIcon = (category) => {
    if (category === 'Strong Buy') return <Award className="w-4 h-4" />
    if (category === 'Moderate Opportunity') return <TrendingUp className="w-4 h-4" />
    return null
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="card bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
        <p className="text-red-800 dark:text-red-300">Error loading ranked markets: {error.message}</p>
      </div>
    )
  }

  const filteredMarkets = markets?.filter(m => m.predictive_strength_score >= minScore) || []

  return (
    <div className="space-y-4">
      {/* Filters */}
      {showFilters && (
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Minimum Score
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={minScore}
                onChange={(e) => setMinScore(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0</span>
                <span className="font-semibold text-primary-600">{minScore}</span>
                <span>100</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Results Limit
              </label>
              <select
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value))}
                className="input w-full"
              >
                <option value={10}>10 markets</option>
                <option value={20}>20 markets</option>
                <option value={50}>50 markets</option>
                <option value={100}>100 markets</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Results Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {filteredMarkets.length} Markets Ranked
        </h3>
      </div>

      {/* Markets List */}
      <div className="space-y-2">
        {filteredMarkets.map((market, index) => (
          <Link
            key={market.market_id}
            to={`/market/${market.market_id}`}
            className="card hover:shadow-lg transition-all cursor-pointer group"
          >
            <div className="flex items-start gap-4">
              {/* Rank Badge */}
              <div className="flex-shrink-0">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                  index < 3 
                    ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white' 
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}>
                  {market.rank || index + 1}
                </div>
              </div>

              {/* Market Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 dark:text-white line-clamp-2 group-hover:text-primary-600 transition-colors">
                      {market.title}
                    </h4>
                    {market.category && (
                      <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                        {market.category}
                      </span>
                    )}
                  </div>

                  {/* Score Badge */}
                  <div className="flex-shrink-0">
                    <div className={`px-3 py-2 rounded-lg ${getScoreBadgeColor(market.predictive_strength_score)}`}>
                      <div className="text-2xl font-bold text-center">
                        {market.predictive_strength_score?.toFixed(0)}
                      </div>
                      <div className="text-xs text-center opacity-75">score</div>
                    </div>
                  </div>
                </div>

                {/* Category & Metrics */}
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                  {/* Score Category */}
                  {market.score_category && (
                    <div className="flex items-center gap-1 font-medium text-gray-700 dark:text-gray-300">
                      {getCategoryIcon(market.score_category)}
                      <span>{market.score_category}</span>
                    </div>
                  )}

                  {/* Price */}
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 dark:text-gray-400">YES:</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      {formatPercent(market.yes_price)}
                    </span>
                  </div>

                  {/* Liquidity */}
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 dark:text-gray-400">Liq:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatLargeNumber(market.liquidity)}
                    </span>
                  </div>

                  {/* Expected Value */}
                  {market.expected_value !== null && market.expected_value !== undefined && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 dark:text-gray-400">EV:</span>
                      <span className={`font-semibold ${
                        market.expected_value > 0 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {(market.expected_value * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Arrow */}
              <div className="flex-shrink-0 self-center">
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-primary-600 transition-colors" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Empty State */}
      {filteredMarkets.length === 0 && (
        <div className="card text-center py-12">
          <TrendingDown className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No markets found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Try lowering the minimum score threshold
          </p>
        </div>
      )}
    </div>
  )
}

export default RankedMarketsList
