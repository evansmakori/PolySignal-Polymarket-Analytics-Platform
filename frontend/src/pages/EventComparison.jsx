import { useState } from 'react'
import { BarChart2, AlertCircle } from 'lucide-react'
import EventComparison from '../components/EventComparison'

function EventComparisonPage() {
  const [input, setInput] = useState('')
  const [marketIds, setMarketIds] = useState([])
  const [isUrl, setIsUrl] = useState(false)

  const handleSubmit = () => {
    if (!input.trim()) {
      return
    }

    // Check if input is a URL
    if (input.includes('polymarket') || input.startsWith('http')) {
      setIsUrl(true)
      setMarketIds([])
    } else {
      // Parse comma-separated market IDs
      const ids = input
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0)

      if (ids.length > 0) {
        setMarketIds(ids)
        setIsUrl(false)
      }
    }
  }

  const handleClear = () => {
    setInput('')
    setMarketIds([])
    setIsUrl(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSubmit()
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 sm:gap-3 mb-2">
          <BarChart2 className="w-6 h-6 sm:w-8 sm:h-8 text-primary-600 flex-shrink-0" />
          <h1 className="text-2xl sm:text-3xl lg:text-5xl font-bold text-gray-900 dark:text-white">
            Compare Markets
          </h1>
        </div>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          Compare multiple outcome markets from the same event side-by-side
        </p>
      </div>

      {/* Input Section */}
      <div className="card">
        <div className="mb-4">
          <label className="block text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300 mb-2">
            Enter Market IDs or Polymarket URL
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., 0x1234abcd,0x5678efgh or https://polymarket.com/..."
              className="input flex-1"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                className="btn btn-primary flex-1 sm:flex-none px-4 sm:px-6"
              >
                Compare
              </button>
              {input && (
                <button
                  onClick={handleClear}
                  className="btn flex-1 sm:flex-none px-4 sm:px-6 bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Helper Text */}
        <div className="flex gap-2 text-base text-gray-600 dark:text-gray-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="mb-1">
              <strong>Market IDs:</strong> Paste comma-separated market IDs from the Extract Market page
            </p>
            <p>
              <strong>URLs:</strong> Polymarket event URLs are not directly supported. Please extract market IDs first using the Extract Market page.
            </p>
          </div>
        </div>
      </div>

      {/* URL Warning */}
      {isUrl && (
        <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-1">
                Event URL Detected
              </h4>
              <p className="text-blue-800 dark:text-blue-400 text-base">
                To compare markets from an event URL, please:
              </p>
              <ol className="text-blue-800 dark:text-blue-400 text-base list-decimal list-inside mt-2">
                <li>Go to the <strong>Extract Market</strong> page</li>
                <li>Paste the event URL</li>
                <li>Extract the markets to get their IDs</li>
                <li>Copy the market IDs and paste them here</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Comparison Results */}
      {marketIds.length > 0 && !isUrl && (
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            Comparing {marketIds.length} Market{marketIds.length !== 1 ? 's' : ''}
          </h2>
          <EventComparison marketIds={marketIds} />
        </div>
      )}

      {/* Empty State */}
      {marketIds.length === 0 && !isUrl && input === '' && (
        <div className="card text-center py-12">
          <BarChart2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
            No markets selected
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Enter market IDs above to start comparing outcomes
          </p>
        </div>
      )}
    </div>
  )
}

export default EventComparisonPage
