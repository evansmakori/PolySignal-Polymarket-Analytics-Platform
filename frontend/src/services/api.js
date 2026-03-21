import axios from 'axios'

// Use relative URL so it works on any domain (production + dev with proxy)
const API_BASE_URL = import.meta.env.DEV 
  ? (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000')
  : ''

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Markets API
export const marketsApi = {
  // Get list of markets with filters
  getMarkets: async (filters = {}) => {
    const cleanFilters = Object.fromEntries(
      Object.entries(filters).filter(([_, v]) => v !== '' && v !== null && v !== undefined)
    )
    const response = await api.get('/api/markets/', { params: cleanFilters })
    return response.data
  },

  // Get market by ID
  getMarket: async (marketId) => {
    const response = await api.get(`/api/markets/${marketId}`)
    return response.data
  },

  // Get market statistics
  getMarketStats: async (marketId) => {
    const response = await api.get(`/api/markets/${marketId}/stats`)
    return response.data
  },

  // Get market price history
  getMarketHistory: async (marketId, interval = '1w', limit = 1000) => {
    const response = await api.get(`/api/markets/${marketId}/history`, {
      params: { interval, limit }
    })
    return response.data
  },

  // Get market orderbook
  getMarketOrderbook: async (marketId) => {
    const response = await api.get(`/api/markets/${marketId}/orderbook`)
    return response.data
  },

  // Get categories
  getCategories: async () => {
    const response = await api.get('/api/markets/categories')
    return response.data
  },

  // Get market count
  getMarketCount: async () => {
    const response = await api.get('/api/markets/count')
    return response.data
  },

  // Extract market data from URL (returns job_id immediately)
  extractMarket: async (data) => {
    const response = await api.post('/api/markets/extract', data)
    return response.data
  },

  // Poll extraction job status
  getExtractionStatus: async (jobId) => {
    const response = await api.get(`/api/markets/extract/status/${jobId}`)
    return response.data
  },

  // Get ranked markets by predictive strength score
  getRankedMarkets: async (filters = {}) => {
    const cleanFilters = Object.fromEntries(
      Object.entries(filters).filter(([_, v]) => v !== '' && v !== null && v !== undefined)
    )
    const response = await api.get('/api/markets/ranked', { params: cleanFilters })
    return response.data
  },

  // Get top opportunities
  getOpportunities: async (limit = 20, minScore = 60) => {
    const response = await api.get('/api/markets/opportunities', {
      params: { limit, min_score: minScore }
    })
    return response.data
  },

  // Get market score details
  getMarketScoreDetails: async (marketId) => {
    const response = await api.get(`/api/markets/${marketId}/score`)
    return response.data
  },

  // Get score history
  getScoreHistory: async (marketId, days = 30, intervalHours = 24) => {
    const response = await api.get(`/api/markets/${marketId}/score-history`, {
      params: { days, interval_hours: intervalHours }
    })
    return response.data
  },

  // Get score trend
  getScoreTrend: async (marketId, days = 7) => {
    const response = await api.get(`/api/markets/${marketId}/score-trend`, {
      params: { days }
    })
    return response.data
  },

  // Get improving markets
  getImprovingMarkets: async (days = 7, limit = 10) => {
    const response = await api.get('/api/markets/analytics/improving', {
      params: { days, limit }
    })
    return response.data
  },

  // Get alerts
  getAlerts: async (filters = {}) => {
    const response = await api.get('/api/markets/alerts', { params: filters })
    return response.data
  },

  // Get market since launch (full history)
  getMarketSinceLaunch: async (marketId) => {
    const response = await api.get(`/api/markets/${marketId}/since-launch`)
    return response.data
  },

  // Compare multiple markets from same event
  compareMarkets: (marketIds) => api.get(`/api/markets/event/compare?market_ids=${marketIds.join(',')}`).then(res => res.data),

  // Get event summary
  getEventSummary: (marketIds) => api.get(`/api/markets/event/summary?market_ids=${marketIds.join(',')}`).then(res => res.data),

  // Search markets and events by keyword
  searchMarkets: async (query, limit = 20, includeEvents = true) => {
    const response = await api.get('/api/markets/search', {
      params: { q: query, limit, include_events: includeEvents }
    })
    return response.data
  },

  // Get recent trades for a market
  getMarketTrades: async (marketId, limit = 20, live = false) => {
    const response = await api.get(`/api/markets/trades/${marketId}`, {
      params: { limit, live }
    })
    return response.data
  },

  // Get events
  getEvents: (params = {}) => {
    const query = new URLSearchParams()
    if (params.search) query.append('search', params.search)
    if (params.limit) query.append('limit', params.limit)
    return api.get(`/api/markets/events?${query}`).then(r => r.data)
  },

  // Get markets for an event
  getEventMarkets: (eventId) => api.get(`/api/markets/events/${eventId}/markets`).then(r => r.data),
  getArchivedEvents: (limit = 50) => api.get(`/api/markets/events/archived?limit=${limit}`).then(r => r.data),
  triggerLifecycle: () => api.post('/api/markets/events/lifecycle').then(r => r.data),
}

// AI Features API
export const aiApi = {
  // Get AI status
  getStatus: async () => {
    const response = await api.get('/api/ai/status')
    return response.data
  },

  // Get price prediction
  getPricePrediction: async (marketId) => {
    const response = await api.get(`/api/ai/predict/${marketId}`)
    return response.data
  },

  // Get sentiment analysis
  getSentimentAnalysis: async (marketId) => {
    const response = await api.get(`/api/ai/sentiment/${marketId}`)
    return response.data
  },

  // Get anomaly detection
  getAnomalyDetection: async (marketId) => {
    const response = await api.get(`/api/ai/anomaly/${marketId}`)
    return response.data
  },

  // Get all anomalies
  getAllAnomalies: async (limit = 50) => {
    const response = await api.get('/api/ai/anomalies', { params: { limit } })
    return response.data
  },

  // Get trading signal
  getTradingSignal: async (marketId) => {
    const response = await api.get(`/api/ai/trading-signal/${marketId}`)
    return response.data
  },

  // Get all trading signals
  getAllTradingSignals: async (limit = 20) => {
    const response = await api.get('/api/ai/trading-signals', { params: { limit } })
    return response.data
  },

  // Get top opportunities
  getTopOpportunities: async (limit = 10, minConfidence = 0.5) => {
    const response = await api.get('/api/ai/opportunities', {
      params: { limit, min_confidence: minConfidence }
    })
    return response.data
  },

  // Get model info
  getModelInfo: async () => {
    const response = await api.get('/api/ai/model-info')
    return response.data
  },
}

// Export individual AI functions for convenience
export const getPricePrediction = aiApi.getPricePrediction
export const getSentimentAnalysis = aiApi.getSentimentAnalysis
export const getAnomalyDetection = aiApi.getAnomalyDetection
export const getTradingSignal = aiApi.getTradingSignal

// WebSocket connection helper
// WebSocket must connect to the Droplet Load Balancer directly
// because App Platform's ingress blocks WebSocket upgrades
// In dev, use env var or localhost. In production, keep the hardcoded droplet WS URL
// (App Platform blocks WebSocket upgrades, so we must connect directly to the Droplet).
// Falls back to current domain if the env var VITE_WS_URL is set.
const WS_BASE_URL = import.meta.env.DEV
  ? (import.meta.env.VITE_API_BASE_URL || 'ws://localhost:8000').replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://')
  : (import.meta.env.VITE_WS_URL || 'ws://138.197.231.111')

const getWsBaseUrl = () => WS_BASE_URL

export const createWebSocket = (marketId) => {
  return new WebSocket(`${getWsBaseUrl()}/ws/markets/${marketId}`)
}

export const createAllMarketsWebSocket = () => {
  return new WebSocket(`${getWsBaseUrl()}/ws/markets`)
}

export const createEventsWebSocket = () => {
  return new WebSocket(`${getWsBaseUrl()}/ws/events`)
}

export default api
