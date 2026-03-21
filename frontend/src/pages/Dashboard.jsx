import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, BarChart2, ChevronRight, Calendar, Archive, Clock, CheckCircle, Activity, Sparkles } from 'lucide-react'
import { createEventsWebSocket, marketsApi } from '../services/api'
import ErrorBoundary from '../components/ErrorBoundary'
import { formatLargeNumber } from '../utils/formatters'

function getLifecycleInfo(event) {
  const status = event.lifecycle_status || 'active'
  const resolvedAt = event.resolved_at ? new Date(event.resolved_at) : null
  const now = new Date()

  if (status === 'resolved' && resolvedAt) {
    const daysResolved = Math.floor((now - resolvedAt) / (1000 * 60 * 60 * 24))
    const daysUntilArchive = 7 - daysResolved
    return {
      status: 'resolved',
      badge: { label: 'Resolved', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: <CheckCircle className="w-3 h-3" /> },
      warning: daysUntilArchive <= 2 && daysUntilArchive > 0
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

function EventCard({ event, highlighted = false }) {
  const lifecycle = getLifecycleInfo(event)

  return (
    <Link
      id={`event-card-${event.event_id}`}
      to={`/event/${event.event_id}`}
      className={`card cursor-pointer group block ${
        highlighted
          ? 'highlight-glow scroll-mt-24'
          : 'hover:shadow-lg transition-all duration-500'
      }`}
    >
      <div className="flex items-start justify-between mb-2 gap-2">
        <h3 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 line-clamp-2 flex-1 mr-2">
          {event.event_title || 'Untitled Event'}
        </h3>
        {highlighted && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 shrink-0">
            <Sparkles className="w-3 h-3" />
            New extract
          </span>
        )}
        <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-primary-600 flex-shrink-0 mt-0.5" />
      </div>

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

      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-0.5">Markets</div>
          <div className="font-semibold text-gray-900 dark:text-white">{event.market_count}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-0.5">Best Score</div>
          <div className="font-semibold text-gray-900 dark:text-white">
            {event.best_score != null
              ? parseFloat(event.best_score).toFixed(1)
              : <span className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 font-normal">
                  <svg className="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                  </svg>
                  Calculating…
                </span>
            }
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
          Last synced {new Date(event.last_updated).toLocaleDateString()}
        </div>
      )}
    </Link>
  )
}

function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [liveEvents, setLiveEvents] = useState([])

  // Read highlight targets from URL params once on mount — kept stable in refs
  // so that re-renders from query data arriving don't reset them.
  const highlightIdParam   = searchParams.get('highlightEvent') || null
  const highlightSlugParam = searchParams.get('highlightSlug')  || null
  const [highlightedEventId,   setHighlightedEventId]   = useState(highlightIdParam)
  const [highlightedEventSlug, setHighlightedEventSlug] = useState(highlightSlugParam)

  // True while the highlight window is active — used to suppress list rewrites
  const isHighlightActive = useRef(!!(highlightIdParam || highlightSlugParam))
  // Whether we've already triggered the scroll + timer for this highlight session
  const highlightTimerSet = useRef(false)

  const { data: events, isLoading, error } = useQuery({
    queryKey: ['events', search],
    queryFn: () => marketsApi.getEvents({ search: search || undefined, limit: 100 }),
    staleTime: 30_000,
    refetchInterval: 60_000,
    // Keep showing previous data while new data loads — prevents blank flash on navigation
    placeholderData: keepPreviousData,
  })

  // Sync REST query data → liveEvents, but never overwrite while highlight is active
  useEffect(() => {
    if (Array.isArray(events) && !isHighlightActive.current) {
      setLiveEvents(events)
    } else if (Array.isArray(events) && isHighlightActive.current) {
      // Merge: keep list but ensure highlighted event is present if it arrived
      setLiveEvents(prev => {
        const already = prev.some(e =>
          String(e.event_id) === String(highlightedEventId) || e.event_slug === highlightedEventSlug
        )
        if (already) return prev
        // Highlighted event now in fresh data — add it to our live list
        const newEvent = events.find(e =>
          String(e.event_id) === String(highlightedEventId) || e.event_slug === highlightedEventSlug
        )
        return newEvent ? [newEvent, ...prev] : events
      })
    }
  }, [events, highlightedEventId, highlightedEventSlug])

  // WebSocket for live dashboard updates — now supported via Droplet + Load Balancer
  useEffect(() => {
    let socket
    let reconnectTimer
    let isMounted = true

    const connect = () => {
      socket = createEventsWebSocket()

      socket.onmessage = (message) => {
        if (!isMounted) return
        try {
          const payload = JSON.parse(message.data)
          if ((payload.type === 'events_initial' || payload.type === 'events_update') && Array.isArray(payload.data)) {
            // Don't overwrite while highlight is active — would break pinned order
            if (!isHighlightActive.current) {
              setLiveEvents(payload.data)
            } else {
              // Still check if highlighted event arrived via WS
              setLiveEvents(prev => {
                const already = prev.some(e =>
                  String(e.event_id) === String(highlightedEventId) || e.event_slug === highlightedEventSlug
                )
                if (already) return prev
                const newEvent = payload.data.find(e =>
                  String(e.event_id) === String(highlightedEventId) || e.event_slug === highlightedEventSlug
                )
                return newEvent ? [newEvent, ...prev] : prev
              })
            }
          }
        } catch {
          // Ignore malformed websocket payloads
        }
      }

      socket.onclose = () => {
        if (!isMounted) return
        reconnectTimer = setTimeout(connect, 5000)
      }

      socket.onerror = () => {
        socket?.close()
      }
    }

    connect()

    return () => {
      isMounted = false
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        socket.close()
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const sourceEvents = liveEvents.length > 0 ? liveEvents : (events || [])

  const filtered = useMemo(() => {
    const filteredEvents = sourceEvents.filter(e =>
      !search || (e.event_title || '').toLowerCase().includes(search.toLowerCase())
    )

    if (!highlightedEventId && !highlightedEventSlug) return filteredEvents

    // Always pin the extracted event at position 0
    const highlighted = filteredEvents.find(e =>
      String(e.event_id) === String(highlightedEventId) || e.event_slug === highlightedEventSlug
    )
    if (!highlighted) return filteredEvents
    const rest = filteredEvents.filter(e => e !== highlighted)
    return [highlighted, ...rest]
  }, [sourceEvents, search, highlightedEventId, highlightedEventSlug])

  // Scroll to top and start clear timer once highlighted card appears in the list
  useEffect(() => {
    if ((!highlightedEventId && !highlightedEventSlug) || highlightTimerSet.current) return

    const highlightedEvent = filtered.find(e =>
      String(e.event_id) === String(highlightedEventId) || e.event_slug === highlightedEventSlug
    )
    if (!highlightedEvent) return   // event not in list yet — wait for next render

    // Card is always pinned first — scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' })
    highlightTimerSet.current = true
    isHighlightActive.current = true

    const clearTimer = setTimeout(() => {
      isHighlightActive.current = false
      highlightTimerSet.current = false
      setHighlightedEventId(null)
      setHighlightedEventSlug(null)
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('highlightEvent')
      nextParams.delete('highlightSlug')
      setSearchParams(nextParams, { replace: true })
    }, 12000)

    return () => {
      clearTimeout(clearTimer)
    }
  }, [highlightedEventId, highlightedEventSlug, filtered, searchParams, setSearchParams])

  return (
    <ErrorBoundary>
      <div className="space-y-4 sm:space-y-6">
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

        {(highlightedEventId || highlightedEventSlug) && (
          <div className="rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-700 dark:border-primary-900/40 dark:bg-primary-900/20 dark:text-primary-300">
            ✨ Your newly extracted event is pinned at the top and highlighted below.
          </div>
        )}

        {/* Initial loading — only show spinner when we have no data at all yet */}
        {isLoading && sourceEvents.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
          </div>
        )}

        {/* Error — only show when we truly have nothing to display */}
        {error && sourceEvents.length === 0 && (
          <div className="card bg-red-50 dark:bg-red-900/20 text-center py-12">
            <p className="text-red-700 dark:text-red-300">Failed to load events. Please try again.</p>
          </div>
        )}

        {/* Empty state — only when done loading and genuinely no events */}
        {!isLoading && !error && sourceEvents.length === 0 && filtered.length === 0 && (
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

        {/* Events grid — show whenever we have data, regardless of loading/refetch state */}
        {filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filtered.map(event => (
              <EventCard
                key={event.event_id}
                event={event}
                highlighted={
                  String(event.event_id) === String(highlightedEventId) || event.event_slug === highlightedEventSlug
                }
              />
            ))}
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}

export default Dashboard
