import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Filter, Loader2 } from 'lucide-react'
import { marketsApi } from '../services/api'
import MarketCard from '../components/MarketCard'

function Dashboard() {
  const [filters, setFilters] = useState({
    category: '',
    trade_signal: '',
    min_liquidity: '',
    active_only: true,
  })
  const [searchTerm, setSearchTerm] = useState('')

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: marketsApi.getCategories,
  })

  const { data: markets, isLoading, error } = useQuery({
    queryKey: ['markets', filters],
    queryFn: () => marketsApi.getMarkets({
      category: filters.category || undefined,
      trade_signal: filters.trade_signal || undefined,
      min_liquidity: filters.min_liquidity ? parseFloat(filters.min_liquidity) : undefined,
      active_only: filters.active_only,
      limit: 50,
    }),
  })

  const filteredMarkets = markets?.filter(market =>
    searchTerm === '' || market.title?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Market Explorer
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Browse and analyze Polymarket prediction markets
        </p>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search markets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input w-full pl-10"
            />
          </div>

          {/* Filter Controls */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                Trade Signal
              </label>
              <select
                value={filters.trade_signal}
                onChange={(e) => setFilters({ ...filters, trade_signal: e.target.value })}
                className="input w-full"
              >
                <option value="">All Signals</option>
                <option value="long">Long</option>
                <option value="short">Short</option>
                <option value="no-trade">No Trade</option>
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

            <div className="flex items-end">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.active_only}
                  onChange={(e) => setFilters({ ...filters, active_only: e.target.checked })}
                  className="w-4 h-4 text-primary-600 rounded"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Active only
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {filteredMarkets.length} Markets Found
          </h2>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="card bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
            <p className="text-red-800 dark:text-red-300">
              Error loading markets: {error.message}
            </p>
          </div>
        )}

        {/* Markets Grid */}
        {!isLoading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMarkets.map((market) => (
              <MarketCard key={market.market_id} market={market} />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredMarkets.length === 0 && (
          <div className="card text-center py-12">
            <Filter className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No markets found
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Try adjusting your filters or search term
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
