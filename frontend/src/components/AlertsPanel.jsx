import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bell, BellOff, AlertCircle, TrendingUp, TrendingDown, Zap, Loader2, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { marketsApi } from '../services/api'

function AlertsPanel({ initialFilters = {} }) {
  const [filters, setFilters] = useState({
    min_score: 70,
    alert_type: '',
    priority: '',
    ...initialFilters,
  })
  const [isExpanded, setIsExpanded] = useState(true)

  const { data: alerts, isLoading, error, refetch } = useQuery({
    queryKey: ['alerts', filters],
    queryFn: () => marketsApi.getAlerts(filters),
    refetchInterval: 60000, // Refresh every minute
  })

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800'
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800'
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800'
    }
  }

  const getAlertIcon = (alertType) => {
    switch (alertType) {
      case 'high_score':
        return <Zap className="w-4 h-4" />
      case 'score_increase':
        return <TrendingUp className="w-4 h-4" />
      case 'score_decrease':
        return <TrendingDown className="w-4 h-4" />
      case 'new_opportunity':
        return <AlertCircle className="w-4 h-4" />
      default:
        return <Bell className="w-4 h-4" />
    }
  }

  const formatAlertType = (type) => {
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  if (!isExpanded) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsExpanded(true)}
          className="relative flex items-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-lg shadow-lg hover:bg-primary-700 transition-colors"
        >
          <Bell className="w-5 h-5" />
          <span className="font-medium">Alerts</span>
          {alerts && alerts.length > 0 && (
            <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {alerts.length}
            </span>
          )}
        </button>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Market Alerts
          </h3>
          {alerts && alerts.length > 0 && (
            <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-400 text-xs font-semibold rounded-full">
              {alerts.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setIsExpanded(false)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Min Score
          </label>
          <input
            type="number"
            min="0"
            max="100"
            value={filters.min_score}
            onChange={(e) => setFilters({ ...filters, min_score: parseFloat(e.target.value) })}
            className="input w-full text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Alert Type
          </label>
          <select
            value={filters.alert_type}
            onChange={(e) => setFilters({ ...filters, alert_type: e.target.value })}
            className="input w-full text-sm"
          >
            <option value="">All Types</option>
            <option value="high_score">High Score</option>
            <option value="score_increase">Score Increase</option>
            <option value="score_decrease">Score Decrease</option>
            <option value="new_opportunity">New Opportunity</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Priority
          </label>
          <select
            value={filters.priority}
            onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
            className="input w-full text-sm"
          >
            <option value="">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-300">
            Error loading alerts: {error.message}
          </p>
        </div>
      )}

      {/* Alerts List */}
      {!isLoading && !error && (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {alerts && alerts.length > 0 ? (
            alerts.map((alert, index) => (
              <Link
                key={index}
                to={`/market/${alert.market_id}`}
                className={`block p-3 rounded-lg border transition-all hover:shadow-md ${getPriorityColor(alert.priority)}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getAlertIcon(alert.alert_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="font-semibold text-sm line-clamp-1">
                        {alert.title}
                      </div>
                      <div className="flex-shrink-0 text-xs font-bold">
                        {alert.score.toFixed(0)}
                      </div>
                    </div>
                    <div className="text-sm opacity-90 mb-2">
                      {alert.message}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="px-2 py-0.5 bg-white/50 dark:bg-black/20 rounded">
                        {formatAlertType(alert.alert_type)}
                      </span>
                      <span className="px-2 py-0.5 bg-white/50 dark:bg-black/20 rounded capitalize">
                        {alert.priority}
                      </span>
                      {alert.metadata?.category && (
                        <span className="px-2 py-0.5 bg-white/50 dark:bg-black/20 rounded">
                          {alert.metadata.category}
                        </span>
                      )}
                      <span className="text-opacity-75">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="text-center py-8">
              <BellOff className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400">No alerts at this time</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                Try adjusting your filters
              </p>
            </div>
          )}
        </div>
      )}

      {/* Refresh Button */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={() => refetch()}
          className="w-full btn-secondary text-sm"
        >
          Refresh Alerts
        </button>
      </div>
    </div>
  )
}

export default AlertsPanel
