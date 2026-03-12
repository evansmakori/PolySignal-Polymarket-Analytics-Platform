import { useState, useRef, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, TrendingUp, DollarSign, BarChart2, ChevronDown, EyeOff, Eye } from 'lucide-react'
import { marketsApi } from '../services/api'
import MarketCard from '../components/MarketCard'
import ErrorBoundary from '../components/ErrorBoundary'
import { formatLargeNumber } from '../utils/formatters'

function isResolvedMarket(market) {
  return !!(
    market?.closed ||
    market?.resolved ||
    market?.automatically_resolved ||
    market?.lifecycle_status === 'resolved' ||
    market?.lifecycle_status === 'archived'
  )
}

function EventDetail() {
  const { eventId } = useParams()
  const [signalFilter, setSignalFilter] = useState('all')
  const [liquidityFilter, setLiquidityFilter] = useState('all')
  const [showResolvedMarkets, setShowResolvedMarkets] = useState(false)
  const [signalDropdownOpen, setSignalDropdownOpen] = useState(false)
  const [liquidityDropdownOpen, setLiquidityDropdownOpen] = useState(false)
  const signalDropdownRef = useRef(null)
  const liquidityDropdownRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (signalDropdownRef.current && !signalDropdownRef.current.contains(e.target)) {
        setSignalDropdownOpen(false)
      }
      if (liquidityDropdownRef.current && !liquidityDropdownRef.current.contains(e.target)) {
        setLiquidityDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const { data: markets, isLoading, error } = useQuery({
    queryKey: ['event-markets', eventId],
    queryFn: () => marketsApi.getEventMarkets(eventId),
    staleTime: 60_000,
  })

  const event = markets?.[0]
  const activeMarkets = markets?.filter(m => !isResolvedMarket(m)) || []
  const resolvedMarkets = markets?.filter(m => isResolvedMarket(m)) || []
  const sourceMarkets = showResolvedMarkets ? resolvedMarkets : activeMarkets

  const filteredMarkets = sourceMarkets.filter(m => {
    if (signalFilter !== 'all') {
      if (signalFilter === 'none' && m.trade_signal && m.trade_signal !== 'no_trade') return false
      if (signalFilter !== 'none' && m.trade_signal !== signalFilter) return false
    }

    const liq = m.liquidity || 0
    if (liquidityFilter === 'high' && liq < 100000) return false
    if (liquidityFilter === 'medium' && (liq < 10000 || liq >= 100000)) return false
    if (liquidityFilter === 'low' && liq >= 10000) return false
    return true
  })

  const signalLabels = {
    all: 'Signal: All',
    long: 'Long',
    short: 'Short',
    none: 'No Trade',
  }

  const liquidityLabels = {
    all: 'Liquidity: All',
    high: 'High (>$100K)',
    medium: 'Medium ($10K-$100K)',
    low: 'Low (<$10K)',
  }

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
        <div>
          <Link to="/" className="inline-flex items-center text-base text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-4">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Events
          </Link>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
            {event?.event_title || 'Event Markets'}
          </h1>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">
            {showResolvedMarkets
              ? `${resolvedMarkets.length} resolved market${resolvedMarkets.length !== 1 ? 's' : ''}`
              : `${activeMarkets.length} active market${activeMarkets.length !== 1 ? 's' : ''}`}
            {resolvedMarkets.length > 0 && !showResolvedMarkets && ` · ${resolvedMarkets.length} resolved market${resolvedMarkets.length !== 1 ? 's' : ''} hidden by default`}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
          <div className="card text-center">
            <DollarSign className="w-5 h-5 text-blue-600 mx-auto mb-1" />
            <div className="text-base sm:text-xl font-bold text-gray-900 dark:text-white">
              {formatLargeNumber(markets?.reduce((s, m) => s + (m.volume_total || 0), 0))}
            </div>
            <div className="text-xs sm:text-sm text-gray-500">Total Volume</div>
          </div>
          <div className="card text-center">
            <BarChart2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 mx-auto mb-1" />
            <div className="text-base sm:text-xl font-bold text-gray-900 dark:text-white">
              {formatLargeNumber(markets?.reduce((s, m) => s + (m.liquidity || 0), 0))}
            </div>
            <div className="text-xs sm:text-sm text-gray-500">Total Liquidity</div>
          </div>
          <div className="card text-center">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 mx-auto mb-1" />
            <div className="text-base sm:text-xl font-bold text-gray-900 dark:text-white">
              {activeMarkets.length}
            </div>
            <div className="text-xs sm:text-sm text-gray-500">Active Markets</div>
          </div>
        </div>

        {resolvedMarkets.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-900/10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-sm text-amber-800 dark:text-amber-300">
                {showResolvedMarkets
                  ? `Showing ${resolvedMarkets.length} resolved market${resolvedMarkets.length !== 1 ? 's' : ''} only.`
                  : `Showing ${activeMarkets.length} active market${activeMarkets.length !== 1 ? 's' : ''}. ${resolvedMarkets.length} resolved market${resolvedMarkets.length !== 1 ? 's are' : ' is'} hidden by default.`}
              </div>
              <button
                type="button"
                onClick={() => setShowResolvedMarkets(prev => !prev)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 bg-white/70 dark:bg-amber-950/30 hover:bg-white dark:hover:bg-amber-950/50"
              >
                {showResolvedMarkets ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showResolvedMarkets ? 'Hide resolved markets' : 'Show resolved markets'}
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 sm:gap-3 items-center w-full">
          <div className="relative" ref={signalDropdownRef}>
            <button
              onClick={() => setSignalDropdownOpen(!signalDropdownOpen)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-base font-medium border transition-colors ${
                signalFilter !== 'all'
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {signalLabels[signalFilter]}
              <ChevronDown className="w-4 h-4" />
            </button>
            {signalDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-44 max-w-[90vw] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
                {Object.entries(signalLabels).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => { setSignalFilter(key); setSignalDropdownOpen(false) }}
                    className={`w-full text-left px-4 py-2.5 text-base hover:bg-gray-50 dark:hover:bg-gray-700 flex justify-between items-center first:rounded-t-lg last:rounded-b-lg ${
                      signalFilter === key ? 'text-primary-600 font-medium' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {label}
                    <span className="text-sm text-gray-400">
                      ({key === 'all' ? sourceMarkets.length :
                        sourceMarkets.filter(m => key === 'none'
                          ? !m.trade_signal || m.trade_signal === 'no_trade'
                          : m.trade_signal === key
                        ).length || 0})
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative" ref={liquidityDropdownRef}>
            <button
              onClick={() => setLiquidityDropdownOpen(!liquidityDropdownOpen)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-base font-medium border transition-colors ${
                liquidityFilter !== 'all'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {liquidityLabels[liquidityFilter]}
              <ChevronDown className="w-4 h-4" />
            </button>
            {liquidityDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-52 max-w-[90vw] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
                {Object.entries(liquidityLabels).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => { setLiquidityFilter(key); setLiquidityDropdownOpen(false) }}
                    className={`w-full text-left px-4 py-2.5 text-base hover:bg-gray-50 dark:hover:bg-gray-700 flex justify-between items-center first:rounded-t-lg last:rounded-b-lg ${
                      liquidityFilter === key ? 'text-blue-600 font-medium' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className="text-base text-gray-500 dark:text-gray-400 ml-auto">
            Showing {filteredMarkets.length} of {sourceMarkets.length} {showResolvedMarkets ? 'resolved' : 'active'} markets
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filteredMarkets.map(market => (
            <MarketCard key={market.market_id} market={market} />
          ))}
          {filteredMarkets.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">
              {showResolvedMarkets
                ? 'No resolved markets match the current filters.'
                : 'No active markets match the current filters.'}
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  )
}

export default EventDetail
