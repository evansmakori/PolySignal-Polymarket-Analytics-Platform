import { useState, useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Download, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { marketsApi } from '../services/api'

function ExtractMarket() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [url, setUrl] = useState('')
  const [jobId, setJobId] = useState(null)
  const [jobStatus, setJobStatus] = useState(null)
  const pollStartTime = useRef(null)

  // Poll for job completion every 2s with 3-minute timeout
  useEffect(() => {
    if (!jobId) return
    pollStartTime.current = Date.now()
    const interval = setInterval(async () => {
      if (Date.now() - pollStartTime.current > 180000) {
        clearInterval(interval)
        setJobStatus(prev => ({
          ...prev,
          status: 'timeout',
          step: 'Extraction is taking longer than expected. Check the dashboard.'
        }))
        return
      }
      try {
        const status = await marketsApi.getExtractionStatus(jobId)
        setJobStatus(status)
        if (status.status === 'done') {
          clearInterval(interval)
          // Invalidate ALL cached queries so dashboard shows fresh data
          await queryClient.invalidateQueries()
          // Small delay to let the backend finish indexing before we redirect
          // so the fresh event appears in the list when the dashboard loads
          await new Promise(resolve => setTimeout(resolve, 800))
          const params = new URLSearchParams()
          if (status.event_id)   params.set('highlightEvent', String(status.event_id))
          if (status.event_slug) params.set('highlightSlug',  String(status.event_slug))
          const target = params.toString() ? `/?${params.toString()}` : '/'
          navigate(target)
        } else if (status.status === 'error') {
          clearInterval(interval)
        }
      } catch (e) {
        clearInterval(interval)
        setJobStatus(prev => ({
          ...prev,
          status: 'timeout',
          step: 'Extraction completed. Redirecting to dashboard...'
        }))
        await queryClient.invalidateQueries()
        navigate('/')
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [jobId, navigate, queryClient])

  const mutation = useMutation({
    mutationFn: (data) => marketsApi.extractMarket(data),
    onSuccess: (data) => {
      if (data.job_id) {
        setJobId(data.job_id)
        setJobStatus({
          status: 'running',
          markets_found: data.markets_found,
          market_ids: data.market_ids,
          event_id: data.event_id,
          event_slug: data.event_slug,
        })
      }
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    mutation.mutate({ url, depth: 10, intervals: ['1w', '1m'], fidelity_min: 60, base_rate: 0.50 })
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
          Extract Market Data
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-2">
          Paste a Polymarket URL to analyze markets.
        </p>
      </div>

      {/* URL Form */}
      <form onSubmit={handleSubmit} className="card space-y-5">
        <div>
          <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-2">
            Polymarket URL
          </label>
          <input
            type="url"
            required
            placeholder="https://polymarket.com/event/... or https://polymarket.com/market/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="input w-full"
            disabled={mutation.isPending || jobStatus?.status === 'running'}
          />
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Paste any Polymarket event or market URL
          </p>
        </div>

        <button
          type="submit"
          disabled={mutation.isPending || !url || jobStatus?.status === 'running'}
          className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 w-full"
        >
          {mutation.isPending || jobStatus?.status === 'running' ? (
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
      </form>

      {/* Job Status */}
      {jobStatus && (
        <div className={`card border ${
          jobStatus.status === 'done' || jobStatus.status === 'timeout'
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : jobStatus.status === 'error'
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
        }`}>
          <div className="flex items-start space-x-3">
            {jobStatus.status === 'running' && <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5 animate-spin" />}
            {(jobStatus.status === 'done' || jobStatus.status === 'timeout') && <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />}
            {jobStatus.status === 'error' && <XCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />}
            <div className="flex-1">
              {jobStatus.status === 'running' && (
                <>
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                    Extracting {jobStatus.markets_found} market(s)...
                  </h3>
                  <p className="text-base text-blue-800 dark:text-blue-300 mb-2">
                    {jobStatus.step || 'Fetching data and computing analytics...'}
                  </p>
                  <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-1.5">
                    <div className="bg-blue-600 h-1.5 rounded-full animate-pulse" style={{ width: '100%' }}></div>
                  </div>
                  <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                    This typically takes 30–90 seconds for large events.
                  </p>
                </>
              )}
              {(jobStatus.status === 'done' || jobStatus.status === 'timeout') && (
                <>
                  <h3 className="font-semibold text-green-900 dark:text-green-100 mb-1">
                    Extraction complete!
                  </h3>
                  <p className="text-base text-green-700 dark:text-green-300">
                    {jobStatus.step || 'Redirecting to dashboard...'}
                  </p>
                </>
              )}
              {jobStatus.status === 'error' && (
                <>
                  <h3 className="font-semibold text-red-900 dark:text-red-100 mb-1">Extraction failed</h3>
                  <p className="text-base text-red-800 dark:text-red-300">{jobStatus.error}</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mutation Error */}
      {mutation.isError && (
        <div className="card bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <div className="flex items-start space-x-3">
            <XCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-100 mb-1">
                {(() => {
                  const detail = mutation.error.response?.data?.detail || mutation.error.message || ''
                  if (detail.toLowerCase().includes('no markets found')) return '🏁 Market Not Found'
                  if (detail.toLowerCase().includes('network') || detail.toLowerCase().includes('econnrefused')) return '🔌 Connection Error'
                  if (detail.toLowerCase().includes('resolved') || detail.toLowerCase().includes('closed')) return '🏁 Market Already Resolved'
                  return '⚠️ Extraction Failed'
                })()}
              </h3>
              <p className="text-base text-red-800 dark:text-red-300">
                {(() => {
                  const detail = mutation.error.response?.data?.detail || mutation.error.message || ''
                  if (detail.toLowerCase().includes('no markets found'))
                    return 'No active markets were found at this URL. The event may have ended or the URL may be incorrect.'
                  if (detail.toLowerCase().includes('network') || !mutation.error.response)
                    return 'Unable to reach the server. Please check your connection and try again.'
                  if (detail.toLowerCase().includes('resolved') || detail.toLowerCase().includes('closed'))
                    return 'This market is no longer active and cannot be extracted.'
                  return detail || 'Something went wrong. Please try again with a different URL.'
                })()}
              </p>
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                💡 Try an active market at{' '}
                <a href="https://polymarket.com" target="_blank" rel="noopener noreferrer" className="underline">
                  polymarket.com
                </a>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* How to use */}
      <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">How to use</h3>
        <ol className="space-y-2 text-base text-blue-800 dark:text-blue-300">
          <li className="flex items-start gap-2">
            <span className="font-bold">1.</span>
            <span>Go to <a href="https://polymarket.com" target="_blank" rel="noopener noreferrer" className="underline">polymarket.com</a> and find an event or market</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold">2.</span>
            <span>Copy the URL from your browser address bar</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold">3.</span>
            <span>Paste it above and click <strong>Extract Data</strong></span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold">4.</span>
            <span>You'll be redirected to the dashboard once extraction is complete</span>
          </li>
        </ol>
      </div>
    </div>
  )
}

export default ExtractMarket
