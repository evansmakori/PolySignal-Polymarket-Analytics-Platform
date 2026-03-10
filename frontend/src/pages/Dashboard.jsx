import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Search, BarChart2, ChevronRight, Calendar, Archive, Clock, CheckCircle, Activity } from 'lucide-react'
import { marketsApi } from '../services/api'
import ErrorBoundary from '../components/ErrorBoundary'
import { formatLargeNumber } from '../utils/formatters'

function getLifecycleInfo(event) {
  const status = event.lifecycle_status || 'active'
  const resolvedAt = event.resolved_at ? new Date(event.resolved_at) : null
  const now = new Date()

  if (status === 'resolved' && resolvedAt) {
    const daysResolved = Math.floor((now - resolvedAt) / (1000 * 60 * 60 * 24))
    const daysUntilArchive = 30 - daysResolved
    return {
      status: 'resolved',
      badge: { label: 'Resolved', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: <CheckCircle className="w-3 h-3" /> },
      warning: daysUntilArchive <= 5 && daysUntilArchive > 0
        ? { text: `Archives in ${daysUntilArchive} day${daysUntilArchive !== 1 ? 's' : ''}`, color: 'text-orange-500 dark:text-orange-400' }
        : daysUntilArchive <= 0
        ? { text: 'Archiving soon', color: 'text-red-500 dark:text-red-400' }
        : null
    }
  }

  return {
    status: 'active',
    badge: { label: 'Active', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: <Activity className="w-3 h-3" /> },
    warning: null
  }
}

function EventCard({ event }) {
  const lifecycle = getLifecycleInfo(event)

  return (
    <Link
      to={`/event/${event.event_id}`}
      className="card hover:shadow-lg transition-shadow cursor-pointer group block"
    >
      {/* Title + arrow */}
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 line-clamp-2 flex-1 mr-2">
          {event.event_title || 'Untitled Event'}
        </h3>
        <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-primary-600 flex-shrink-0 mt-0.5" />
      </div>

      {/* Status badge + expiry warning */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${lifecycle.badge.color}`}>
          {lifecycle.badge.icon}
          {lifecycle.badge.label}
        </span>
        {lifecycle.warning && (
          <span className={`inline-flex items-center gap-1 text-xs font-medium ${lifecycle.warning.color}`}>
            <Clock className="w-3 h-3" />
            {lifecycle.warning.text}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-0.5">Markets</div>
          <div className="font-semibold text-gray-900 dark:text-white">{event.market_count}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-0.5">Best Score</div>
          <div className="font-semibold text-gray-900 dark:text-white">
            {event.best_score != null ? parseFloat(event.best_score).toFixed(1) : 'N/A'}
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

      {/* Footer */}
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
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">Market Events</h1>
            <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">
              {filtered.length} event{filtered.length !== 1 ? 's' : ''} · active & recently resolved
            </p>
          </div>
          <Link
            to="/archived"
            className="inline-flex items-center gap-2 px-3 py-2 text-base text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Archive className="w-4 h-4" />
            Archived Events
          </Link>
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
