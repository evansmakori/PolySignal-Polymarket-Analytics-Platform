import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trophy, TrendingUp, Filter } from 'lucide-react'
import { marketsApi } from '../services/api'
import RankedMarketsList from '../components/RankedMarketsList'
import AlertsPanel from '../components/AlertsPanel'

function Rankings() {
  const [view, setView] = useState('ranked') // 'ranked', 'opportunities', 'improving'
  const [filters, setFilters] = useState({
    category: '',
    min_liquidity: '',
  })

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: marketsApi.getCategories,
  })

  const { data: improving } = useQuery({
    queryKey: ['improving-markets'],
    queryFn: () => marketsApi.getImprovingMarkets(7, 10),
    enabled: view === 'improving',
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Trophy className="w-8 h-8 text-primary-600" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Market Rankings
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Markets ranked by predictive strength score
        </p>
      </div>

      {/* View Tabs */}
      <div className="card">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setView('ranked')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              view === 'ranked'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            All Markets
          </button>
          <button
            onClick={() => setView('opportunities')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              view === 'opportunities'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            Top Opportunities
          </button>
          <button
            onClick={() => setView('improving')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              view === 'improving'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Improving
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Filters</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category
            </label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="input w-full"
            >
              <option value="">All Categories</option>
              {categories?.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Min Liquidity
            </label>
            <input
              type="number"
              placeholder="e.g., 10000"
              value={filters.min_liquidity}
              onChange={(e) => setFilters({ ...filters, min_liquidity: e.target.value })}
              className="input w-full"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2">
          {view === 'ranked' && (
            <RankedMarketsList filters={filters} showFilters={true} />
          )}
          
          {view === 'opportunities' && (
            <RankedMarketsList 
              filters={filters} 
              showFilters={true} 
            />
          )}
          
          {view === 'improving' && (
            <div className="space-y-4">
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Top Improving Markets (Last 7 Days)
                </h3>
                {improving && improving.length > 0 ? (
                  <div className="space-y-3">
                    {improving.map((market, index) => (
                      <div
                        key={market.market_id}
                        className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900 dark:text-white mb-1">
                              {index + 1}. {market.title}
                            </div>
                            {market.category && (
                              <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                {market.category}
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                              +{market.score_change.toFixed(1)}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              points
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                          <span>Current: {market.current_score.toFixed(1)}</span>
                          <span>Change: {market.change_percent > 0 ? '+' : ''}{market.change_percent.toFixed(1)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No improving markets found
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Alerts Sidebar */}
        <div className="lg:col-span-1">
          <AlertsPanel />
        </div>
      </div>
    </div>
  )
}

export default Rankings
