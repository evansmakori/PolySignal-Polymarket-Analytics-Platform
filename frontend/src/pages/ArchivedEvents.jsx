import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowLeft, Archive, Calendar, DollarSign, BarChart2, ChevronRight } from 'lucide-react'
import { marketsApi } from '../services/api'
import ErrorBoundary from '../components/ErrorBoundary'
import { formatLargeNumber } from '../utils/formatters'

function ArchivedEvents() {
  const { data: events, isLoading, error } = useQuery({
    queryKey: ['archived-events'],
    queryFn: () => marketsApi.getArchivedEvents(),
    staleTime: 300_000, // 5 min cache
  })

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <Link to="/" className="inline-flex items-center text-base text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-4">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <Archive className="w-6 h-6 text-gray-500" />
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Archived Events</h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Resolved events older than 30 days. Kept for historical review until 180 days after resolution.
          </p>
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
            <p className="text-red-700 dark:text-red-300">Failed to load archived events.</p>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && (!events || events.length === 0) && (
          <div className="card text-center py-16">
            <Archive className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No archived events yet</h3>
            <p className="text-gray-500 dark:text-gray-400">
              Events resolved more than 30 days ago will appear here.
            </p>
          </div>
        )}

        {/* Events Grid */}
        {!isLoading && events && events.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map(event => (
              <Link
                key={event.event_id}
                to={`/event/${event.event_id}`}
                className="card hover:shadow-lg transition-shadow cursor-pointer group block opacity-80 hover:opacity-100"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 line-clamp-2 flex-1 mr-2">
                    {event.event_title || 'Untitled Event'}
                  </h3>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-primary-600 flex-shrink-0 mt-0.5" />
                </div>

                {/* Archived badge */}
                <span className="inline-block px-2 py-0.5 text-sm rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 mb-3">
                  Archived
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-0.5">Markets</div>
                    <div className="font-semibold text-gray-900 dark:text-white">{event.market_count}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-0.5">Volume</div>
                    <div className="font-semibold text-gray-900 dark:text-white">{formatLargeNumber(event.total_volume)}</div>
                  </div>
                </div>

                {event.resolved_at && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center text-sm text-gray-400">
                    <Calendar className="w-3 h-3 mr-1" />
                    Resolved {new Date(event.resolved_at).toLocaleDateString()}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}

export default ArchivedEvents
