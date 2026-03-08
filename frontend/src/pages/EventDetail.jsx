import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, TrendingUp, DollarSign, BarChart2 } from 'lucide-react'
import { marketsApi } from '../services/api'
import MarketCard from '../components/MarketCard'
import ErrorBoundary from '../components/ErrorBoundary'
import { formatLargeNumber } from '../utils/formatters'

function EventDetail() {
  const { eventId } = useParams()

  const { data: markets, isLoading, error } = useQuery({
    queryKey: ['event-markets', eventId],
    queryFn: () => marketsApi.getEventMarkets(eventId),
    staleTime: 60_000,
  })

  const event = markets?.[0]

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
    </div>
  )

  if (error) return (
    <div className="card bg-red-50 dark:bg-red-900/20 text-center py-12">
      <p className="text-red-700 dark:text-red-300">Failed to load event markets.</p>
      <Link to="/" className="text-primary-600 mt-4 inline-block">← Back to Dashboard</Link>
    </div>
  )

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <Link to="/" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-4">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Events
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {event?.event_title || 'Event Markets'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {markets?.length || 0} markets in this event
          </p>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-4">
          <div className="card text-center">
            <DollarSign className="w-5 h-5 text-blue-600 mx-auto mb-1" />
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {formatLargeNumber(markets?.reduce((s, m) => s + (m.volume_total || 0), 0))}
            </div>
            <div className="text-xs text-gray-500">Total Volume</div>
          </div>
          <div className="card text-center">
            <BarChart2 className="w-5 h-5 text-green-600 mx-auto mb-1" />
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {formatLargeNumber(markets?.reduce((s, m) => s + (m.liquidity || 0), 0))}
            </div>
            <div className="text-xs text-gray-500">Total Liquidity</div>
          </div>
          <div className="card text-center">
            <TrendingUp className="w-5 h-5 text-purple-600 mx-auto mb-1" />
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {markets?.length || 0}
            </div>
            <div className="text-xs text-gray-500">Markets</div>
          </div>
        </div>

        {/* Markets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {markets?.map(market => (
            <MarketCard key={market.market_id} market={market} />
          ))}
        </div>
      </div>
    </ErrorBoundary>
  )
}

export default EventDetail
