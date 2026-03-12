import { useMemo, useState } from 'react'
import { Droplets, Info } from 'lucide-react'

function LiquidityHeatmap({ orderbook }) {
  const [selectedSide, setSelectedSide] = useState('yes')

  const yesBook = orderbook?.yes
  const noBook = orderbook?.no
  const activeBook = selectedSide === 'yes' ? yesBook : noBook
  const hasAnyData = !!(
    (yesBook?.bids?.length || yesBook?.asks?.length || noBook?.bids?.length || noBook?.asks?.length)
  )
  const hasSelectedData = !!(activeBook?.bids?.length || activeBook?.asks?.length)

  const depthData = useMemo(() => {
    if (!hasSelectedData) return []

    const bids = [...(activeBook?.bids || [])]
      .map(level => ({ ...level, price: Number(level.price), size: Number(level.size) }))
      .filter(level => Number.isFinite(level.price) && Number.isFinite(level.size))
      .sort((a, b) => b.price - a.price)

    const asks = [...(activeBook?.asks || [])]
      .map(level => ({ ...level, price: Number(level.price), size: Number(level.size) }))
      .filter(level => Number.isFinite(level.price) && Number.isFinite(level.size))
      .sort((a, b) => a.price - b.price)

    if (!bids.length && !asks.length) return []

    const allPrices = [...bids.map(b => b.price), ...asks.map(a => a.price)]
    const minPrice = Math.min(...allPrices)
    const maxPrice = Math.max(...allPrices)
    const bucketCount = 20
    const rawBucketSize = (maxPrice - minPrice) / bucketCount
    const bucketSize = rawBucketSize > 0 ? rawBucketSize : 0.01
    const buckets = []

    for (let i = 0; i < bucketCount; i++) {
      const bucketPrice = minPrice + i * bucketSize
      const bucketEnd = i === bucketCount - 1 ? maxPrice + bucketSize : bucketPrice + bucketSize

      const bidVolume = bids
        .filter(b => b.price >= bucketPrice && b.price < bucketEnd)
        .reduce((sum, b) => sum + b.size, 0)

      const askVolume = asks
        .filter(a => a.price >= bucketPrice && a.price < bucketEnd)
        .reduce((sum, a) => sum + a.size, 0)

      buckets.push({
        price: bucketPrice,
        priceEnd: bucketEnd,
        bidVolume,
        askVolume,
        totalVolume: bidVolume + askVolume,
      })
    }

    return buckets
  }, [activeBook, hasSelectedData])

  const maxVolume = useMemo(() => {
    if (!depthData.length) return 0
    return Math.max(...depthData.map(d => Math.max(d.bidVolume, d.askVolume)), 0)
  }, [depthData])

  const getColorIntensity = (volume, isBid) => {
    if (volume === 0 || maxVolume === 0) return 'rgba(0,0,0,0)'
    const intensity = Math.min(volume / maxVolume, 1)
    return isBid
      ? `rgba(34, 197, 94, ${intensity * 0.8})`
      : `rgba(239, 68, 68, ${intensity * 0.8})`
  }

  const cumulativeDepth = useMemo(() => {
    let bidCumulative = 0
    let askCumulative = 0

    return depthData.map(bucket => {
      bidCumulative += bucket.bidVolume
      askCumulative += bucket.askVolume
      return {
        ...bucket,
        bidCumulative,
        askCumulative,
      }
    })
  }, [depthData])

  const liquidityWalls = useMemo(() => {
    if (!depthData.length || maxVolume === 0) return []
    return depthData
      .map((bucket, idx) => ({
        ...bucket,
        idx,
        isBidWall: bucket.bidVolume > maxVolume * 0.3,
        isAskWall: bucket.askVolume > maxVolume * 0.3,
      }))
      .filter(bucket => bucket.isBidWall || bucket.isAskWall)
  }, [depthData, maxVolume])

  const emptyStateMessage = !hasAnyData
    ? 'No live orderbook is available for this market yet. Heatmaps only appear when Polymarket exposes active bid/ask depth.'
    : `No ${selectedSide.toUpperCase()}-side depth is available right now. Try the ${selectedSide === 'yes' ? 'NO' : 'YES'} side or check back once more liquidity appears.`

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Droplets className="w-5 h-5 text-primary-600" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Liquidity Heatmap
            </h3>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
            Visualizes where buy and sell liquidity is concentrated across price levels. Brighter zones indicate deeper liquidity and potential support/resistance.
          </p>
        </div>

        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shrink-0">
          <button
            type="button"
            onClick={() => setSelectedSide('yes')}
            className={`px-3 py-1.5 text-sm font-medium ${selectedSide === 'yes' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-white text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}
          >
            YES book
          </button>
          <button
            type="button"
            onClick={() => setSelectedSide('no')}
            className={`px-3 py-1.5 text-sm font-medium border-l border-gray-200 dark:border-gray-700 ${selectedSide === 'no' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' : 'bg-white text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}
          >
            NO book
          </button>
        </div>
      </div>

      {!hasSelectedData ? (
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-5 bg-gray-50 dark:bg-gray-900/30">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <div className="font-medium text-gray-700 dark:text-gray-200 mb-1">
                Heatmap unavailable for this side
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                {emptyStateMessage}
              </p>
              <div className="text-xs text-gray-500 dark:text-gray-500">
                Tip for judges: open a liquid active market to see liquidity walls, depth concentration, and slippage risk more clearly.
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {liquidityWalls.length > 0 && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="text-base font-semibold text-blue-800 dark:text-blue-300 mb-1">
                {liquidityWalls.length} Liquidity Wall{liquidityWalls.length > 1 ? 's' : ''} Detected
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-400">
                Large resting orders at specific price levels may act as support or resistance for the {selectedSide.toUpperCase()} token.
              </div>
            </div>
          )}

          <div className="space-y-1">
            {depthData.slice().reverse().map((bucket, idx) => {
              const reverseIdx = depthData.length - 1 - idx
              const isWall = liquidityWalls.find(w => w.idx === reverseIdx)

              return (
                <div key={idx} className="group">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <span className="w-16">${bucket.price.toFixed(3)}</span>
                    {isWall && (
                      <span className="px-2 py-0.5 bg-blue-200 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 rounded text-sm font-semibold">
                        WALL
                      </span>
                    )}
                  </div>

                  <div className="flex gap-1 h-8">
                    <div className="flex-1 flex justify-end">
                      <div
                        className="rounded-l transition-all duration-300 group-hover:opacity-100 flex items-center justify-end px-2"
                        style={{
                          width: maxVolume > 0 ? `${(bucket.bidVolume / maxVolume) * 100}%` : '0%',
                          backgroundColor: getColorIntensity(bucket.bidVolume, true),
                          minWidth: bucket.bidVolume > 0 ? '20px' : '0',
                        }}
                      >
                        {bucket.bidVolume > 0 && (
                          <span className="text-sm font-semibold text-green-900 dark:text-green-100">
                            {bucket.bidVolume.toFixed(0)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="w-px bg-gray-300 dark:bg-gray-700" />

                    <div className="flex-1">
                      <div
                        className="rounded-r transition-all duration-300 group-hover:opacity-100 flex items-center justify-start px-2"
                        style={{
                          width: maxVolume > 0 ? `${(bucket.askVolume / maxVolume) * 100}%` : '0%',
                          backgroundColor: getColorIntensity(bucket.askVolume, false),
                          minWidth: bucket.askVolume > 0 ? '20px' : '0',
                        }}
                      >
                        {bucket.askVolume > 0 && (
                          <span className="text-sm font-semibold text-red-900 dark:text-red-100">
                            {bucket.askVolume.toFixed(0)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="hidden group-hover:block text-sm text-gray-500 dark:text-gray-400 mt-1">
                    <span className="text-green-600 dark:text-green-400">Bid: {bucket.bidVolume.toFixed(0)}</span>
                    {' | '}
                    <span className="text-red-600 dark:text-red-400">Ask: {bucket.askVolume.toFixed(0)}</span>
                    {' | '}
                    <span>Total: {bucket.totalVolume.toFixed(0)}</span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between text-base flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span className="text-gray-700 dark:text-gray-300">Bids (Buy Orders)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-700 dark:text-gray-300">Asks (Sell Orders)</span>
                <div className="w-4 h-4 bg-red-500 rounded"></div>
              </div>
            </div>
            <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Viewing the {selectedSide.toUpperCase()} token book. Darker intensity means more liquidity concentrated at that price level.
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-4 text-sm sm:text-base">
            <div className="p-2 sm:p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">Total Bid Depth</div>
              <div className="text-base sm:text-xl font-bold text-green-700 dark:text-green-400">
                {cumulativeDepth[cumulativeDepth.length - 1]?.bidCumulative.toFixed(0) || 0}
              </div>
            </div>
            <div className="p-2 sm:p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">Total Ask Depth</div>
              <div className="text-base sm:text-xl font-bold text-red-700 dark:text-red-400">
                {cumulativeDepth[cumulativeDepth.length - 1]?.askCumulative.toFixed(0) || 0}
              </div>
            </div>
          </div>

          {liquidityWalls.length === 0 && maxVolume < 100 && (
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="text-base font-semibold text-yellow-800 dark:text-yellow-300 mb-1">
                Low Liquidity Warning
              </div>
              <div className="text-sm text-yellow-700 dark:text-yellow-400">
                This orderbook is thin, so larger trades may experience noticeable slippage and the heatmap may appear sparse.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default LiquidityHeatmap
