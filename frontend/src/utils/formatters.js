/**
 * Format a number as currency
 */
export const formatCurrency = (value, decimals = 2) => {
  if (value === null || value === undefined) return 'N/A'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/**
 * Format a number as percentage
 */
export const formatPercent = (value, decimals = 1) => {
  if (value === null || value === undefined) return 'N/A'
  return `${(value * 100).toFixed(decimals)}%`
}

/**
 * Format a large number with K/M/B suffix
 */
export const formatLargeNumber = (value) => {
  if (value === null || value === undefined) return 'N/A'
  
  if (value >= 1000000000) {
    return `$${(value / 1000000000).toFixed(2)}B`
  }
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(2)}K`
  }
  return formatCurrency(value)
}

/**
 * Format date/time
 */
export const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export const formatRelativeTime = (dateString) => {
  if (!dateString) return 'N/A'
  
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now - date
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  
  if (diffDays > 0) return `${diffDays}d ago`
  if (diffHours > 0) return `${diffHours}h ago`
  if (diffMins > 0) return `${diffMins}m ago`
  return 'just now'
}

/**
 * Get color class for trade signal
 */
export const getSignalColor = (signal) => {
  switch (signal) {
    case 'long':
      return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300'
    case 'short':
      return 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300'
    case 'no-trade':
    default:
      return 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-300'
  }
}

/**
 * Get color class for risk level
 */
export const getRiskColor = (risk) => {
  if (risk === null || risk === undefined) return 'text-gray-600'
  
  if (risk < 0.3) return 'text-green-600'
  if (risk < 0.6) return 'text-yellow-600'
  return 'text-red-600'
}

/**
 * Format price with proper precision
 */
export const formatPrice = (price, decimals = 2) => {
  if (price === null || price === undefined) return 'N/A'
  return `$${price.toFixed(decimals)}`
}
