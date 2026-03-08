import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Download, Loader2, CheckCircle, XCircle, Search, ExternalLink, TrendingUp } from 'lucide-react'
import { marketsApi } from '../services/api'

function ExtractMarket() {
  const [activeTab, setActiveTab] = useState('search')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [url, setUrl] = useState('')
  const [depth, setDepth] = useState(10)
  const [fidelity, setFidelity] = useState(60)
  const [baseRate, setBaseRate] = useState(0.50)

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 400)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Search markets query
  const searchResults = useQuery({
    queryKey: ['market-search', debouncedQuery],
    queryFn: () => marketsApi.searchMarkets(debouncedQuery, 20, true),
    enabled: debouncedQuery.length >= 2,
    staleTime: 60 * 1000,
  })

  const [jobId, setJobId] = useState(null)
  const [jobStatus, setJobStatus] = useState(null)

  // Poll for job completion every 2s
  useEffect(() => {
    if (!jobId) return
    const interval = setInterval(async () => {
      try {
        const status = await marketsApi.getExtractionStatus(jobId)
        setJobStatus(status)
        if (status.status === 'done' || status.status === 'error') {
          clearInterval(interval)
        }
      } catch (e) {
        clearInterval(interval)
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [jobId])

  // Extract market mutation
  const mutation = useMutation({
    mutationFn: (data) => marketsApi.extractMarket(data),
    onSuccess: (data) => {
      if (data.job_id) {
        setJobId(data.job_id)
        setJobStatus({ status: 'running', markets_found: data.markets_found, market_ids: data.market_ids })
      }
    },
  })

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    // Search is handled by the query above
  }

  const handleExtractFromSearch = (result) => {
    const polymarketUrl = result.url || (result.type === 'event'
      ? `https://polymarket.com/event/${result.slug}`
      : `https://polymarket.com/market/${result.slug || result.id}`)
    setUrl(polymarketUrl)
    setActiveTab('url')
  }

  const handleExtractSubmit = (e) => {
    e.preventDefault()
    mutation.mutate({
      url,
      depth,
      intervals: ['1w', '1m'],
      fidelity_min: fidelity,
      base_rate: baseRate,
    })
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Extract Market Data
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Search for markets or paste a Polymarket URL to analyze
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('search')}
          className={`px-4 py-3 font-medium transition-colors ${
            activeTab === 'search'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          🔍 Search Markets
        </button>
        <button
          onClick={() => setActiveTab('url')}
          className={`px-4 py-3 font-medium transition-colors ${
            activeTab === 'url'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          🔗 Paste URL
        </button>
      </div>

      {/* Search Tab */}
      {activeTab === 'search' && (
        <div className="space-y-6">
          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="card space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Search Markets
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search by keyword (e.g., 'Bitcoin', 'Election')"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input flex-1"
                />
                <button
                  type="submit"
                  disabled={searchQuery.length < 2}
                  className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <Search className="w-4 h-4" />
                  <span>Search</span>
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Enter at least 2 characters to search
              </p>
            </div>
          </form>

          {/* Search Results */}
          {searchResults.isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
            </div>
          )}

          {searchResults.isError && (
            <div className="card bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
              <p className="text-red-800 dark:text-red-300">
                Error searching markets: {searchResults.error.message}
              </p>
            </div>
          )}

          {searchResults.data && (
            <div className="space-y-3">
              {searchResults.data.length === 0 ? (
                <div className="card text-center py-8">
                  <p className="text-gray-600 dark:text-gray-400">
                    No markets found matching your search
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {searchResults.data.map((result) => (
                    <div
                      key={result.id}
                      className="card hover:shadow-lg transition-shadow"
                    >
                      <div className="space-y-3">
                        {/* Top Row: Type Badge + Title */}
                        <div className="flex items-start gap-3">
                          <span
                            className={`inline-block px-2 py-1 text-xs font-medium rounded text-white flex-shrink-0 ${
                              result.type === 'event'
                                ? 'bg-purple-600'
                                : 'bg-blue-600'
                            }`}
                          >
                            {result.type === 'event' ? 'Event' : 'Market'}
                          </span>
                          <h3 className="font-semibold text-gray-900 dark:text-white flex-1 line-clamp-2">
                            {result.title}
                          </h3>
                        </div>

                        {/* Middle Row: Category, Volume, Price */}
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          {result.category && (
                            <span className="inline-block px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                              {result.category}
                            </span>
                          )}
                          {result.volume_24h && (
                            <div className="text-sm">
                              <p className="text-gray-500 dark:text-gray-400">24h Volume</p>
                              <p className="font-semibold text-gray-900 dark:text-white">
                                ${(result.volume_24h / 1000).toFixed(1)}K
                              </p>
                            </div>
                          )}
                          {result.yes_price !== undefined && result.yes_price !== null && (
                            <div className="text-sm">
                              <p className="text-gray-500 dark:text-gray-400">YES Price</p>
                              <p className="font-semibold text-green-600 dark:text-green-400">
                                {(result.yes_price * 100).toFixed(1)}%
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Bottom Row: External Link + Extract Button */}
                        <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                          <a
                            href={result.url || (result.type === 'event' ? `https://polymarket.com/event/${result.slug}` : `https://polymarket.com/market/${result.slug || result.id}`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            View on Polymarket
                          </a>
                          <button
                            type="button"
                            onClick={() => handleExtractFromSearch(result)}
                            className="btn btn-primary text-sm py-2 px-3"
                          >
                            Extract This
                          </button>
                        </div>

                        {result.end_date && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Ends: {new Date(result.end_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!searchResults.isLoading && !searchResults.data && debouncedQuery.length >= 2 && (
            <div className="card text-center py-8 text-gray-600 dark:text-gray-400">
              Loading results...
            </div>
          )}

          {debouncedQuery.length < 2 && searchQuery.length > 0 && (
            <div className="card text-center py-8 text-gray-600 dark:text-gray-400">
              Enter at least 2 characters to search
            </div>
          )}
        </div>
      )}

      {/* URL Tab */}
      {activeTab === 'url' && (
        <div className="space-y-6">
          {/* URL Form */}
          <form onSubmit={handleExtractSubmit} className="card space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Polymarket URL *
              </label>
              <input
                type="url"
                required
                placeholder="https://polymarket.com/event/... or https://polymarket.com/market/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="input w-full"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Enter a Polymarket event or market URL
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Orderbook Depth
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={depth}
                  onChange={(e) => setDepth(parseInt(e.target.value))}
                  className="input w-full"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Levels per side (1-50)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Fidelity (minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  value={fidelity}
                  onChange={(e) => setFidelity(parseInt(e.target.value))}
                  className="input w-full"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Price history granularity
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Base Rate
                </label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={baseRate}
                  onChange={(e) => setBaseRate(parseFloat(e.target.value))}
                  className="input w-full"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Prior probability (0-1)
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                This will fetch orderbook, price history, and compute analytics
              </p>
              <button
                type="submit"
                disabled={mutation.isPending || !url}
                className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Extracting...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Extract Data</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Job Status */}
          {jobStatus && (
            <div className={`card border ${
              jobStatus.status === 'done'
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : jobStatus.status === 'error'
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
            }`}>
              <div className="flex items-start space-x-3">
                {jobStatus.status === 'running' && <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5 animate-spin" />}
                {jobStatus.status === 'done' && <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />}
                {jobStatus.status === 'error' && <XCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />}
                <div className="flex-1">
                  {jobStatus.status === 'running' && (
                    <>
                      <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                        Extracting {jobStatus.markets_found} market(s)...
                      </h3>
                      <p className="text-sm text-blue-800 dark:text-blue-300 mb-2">
                        {jobStatus.step || 'Initializing...'}
                      </p>
                      <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-1.5">
                        <div className="bg-blue-600 h-1.5 rounded-full animate-pulse" style={{width: '100%'}}></div>
                      </div>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        This typically takes 30–90 seconds for large events.
                      </p>
                    </>
                  )}
                  {jobStatus.status === 'done' && (
                    <>
                      <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                        Successfully extracted {jobStatus.markets_processed || jobStatus.markets_found} market(s)!
                      </h3>
                      {jobStatus.market_ids && jobStatus.market_ids.length > 0 && (
                        <div className="space-y-1 mt-2">
                          <p className="text-sm font-medium text-green-900 dark:text-green-100">View markets:</p>
                          {jobStatus.market_ids.map((id) => id && (
                            <Link key={id} to={`/market/${id}`}
                              className="block text-sm text-green-700 dark:text-green-300 hover:underline">
                              Market ID: {id}
                            </Link>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  {jobStatus.status === 'error' && (
                    <>
                      <h3 className="font-semibold text-red-900 dark:text-red-100 mb-1">Extraction failed</h3>
                      <p className="text-sm text-red-800 dark:text-red-300">{jobStatus.error}</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Error Result */}
          {mutation.isError && (
            <div className="card bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
              <div className="flex items-start space-x-3">
                <XCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-red-900 dark:text-red-100 mb-1">
                    Extraction failed
                  </h3>
                  <p className="text-sm text-red-800 dark:text-red-300">
                    {mutation.error.response?.data?.detail || mutation.error.message}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
              How to use
            </h3>
            <ol className="space-y-2 text-sm text-blue-800 dark:text-blue-300">
              <li className="flex items-start">
                <span className="font-bold mr-2">1.</span>
                <span>Copy a Polymarket event or market URL (e.g., https://polymarket.com/event/...)</span>
              </li>
              <li className="flex items-start">
                <span className="font-bold mr-2">2.</span>
                <span>Paste the URL in the field above</span>
              </li>
              <li className="flex items-start">
                <span className="font-bold mr-2">3.</span>
                <span>Adjust extraction parameters if needed</span>
              </li>
              <li className="flex items-start">
                <span className="font-bold mr-2">4.</span>
                <span>Click "Extract Data" to fetch and analyze the market(s)</span>
              </li>
              <li className="flex items-start">
                <span className="font-bold mr-2">5.</span>
                <span>View the extracted markets in the dashboard or click the links above</span>
              </li>
            </ol>
          </div>
        </div>
      )}
    </div>
  )
}

export default ExtractMarket
