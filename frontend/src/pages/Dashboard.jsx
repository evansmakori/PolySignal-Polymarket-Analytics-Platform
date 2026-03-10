import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Search, TrendingUp, DollarSign, BarChart2, ChevronRight, Calendar } from 'lucide-react'
import { marketsApi } from '../services/api'
import ErrorBoundary from '../components/ErrorBoundary'
import { formatLargeNumber } from '../utils/formatters'

function EventCard({ event }) {
  return (
    <Link
      to={`/event/${event.event_id}`}
      className="card hover:shadow-lg transition-shadow cursor-pointer group block"
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 line-clamp-2 flex-1 mr-2">
          {event.event_title || 'Untitled Event'}
        </h3>
        <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-primary-600 flex-shrink-0 mt-0.5" />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-3">
        <div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-0.5">Markets</div>
          <div className="font-semibold text-gray-900 dark:text-white">{event.market_count}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-0.5">Best Score</div>
          <div className="font-semibold text-gray-900 dark:text-white">
            {event.best_score ? event.best_score.toFixed(1) : 'N/A'}
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-0.5">Volume</div>
          <div className="font-semibold text-gray-900 dark:text-white">{formatLargeNumber(event.total_volume)}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-0.5">Liquidity</div>
          <div className="font-semibold text-gray-900 dark:text-white">{formatLargeNumber(event.total_liquidity)}</div>
        </div>
      </div>

      {event.last_updated && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center text-sm text-gray-400">
          <Calendar className="w-3 h-3 mr-1" />
          Updated {new Date(event.last_updated).toLocaleDateString()}
        </div>
      )}
    </Link>
  )
}

function Dashboard() {
  const [search, setSearch] = useState('')

  const { data: events, isLoading, error } = useQuery({
    queryKey: ['events', search],
    queryFn: () => marketsApi.getEvents({ search: search || undefined, limit: 100 }),
    staleTime: 60_000,
  })

  const filtered = events?.filter(e =>
    !search || (e.event_title || '').toLowerCase().includes(search.toLowerCase())
  ) || []

  return (
    <ErrorBoundary>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">Market Events</h1>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">
            {filtered.length} event{filtered.length !== 1 ? 's' : ''} extracted
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search events..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm sm:text-base"
          />
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="card bg-red-50 dark:bg-red-900/20 text-center py-12">
            <p className="text-red-700 dark:text-red-300">Failed to load events. Please try again.</p>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && filtered.length === 0 && (
          <div className="card text-center py-16">
            <BarChart2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No events yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Extract your first Polymarket event to get started.
            </p>
            <Link
              to="/extract"
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Extract an Event
            </Link>
          </div>
        )}

        {/* Events Grid */}
        {!isLoading && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filtered.map(event => (
              <EventCard key={event.event_id} event={event} />
            ))}
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}

export default Dashboard
