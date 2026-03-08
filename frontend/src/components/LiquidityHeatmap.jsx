import { useMemo } from 'react'
import { Droplets } from 'lucide-react'

function LiquidityHeatmap({ orderbook }) {
  if (!orderbook || !orderbook.bids || !orderbook.asks) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Liquidity Heatmap
        </h3>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No orderbook data available
        </div>
      </div>
    )
  }

  const { bids, asks } = orderbook

  // Calculate depth aggregation
  const depthData = useMemo(() => {
    const allBids = [...bids].sort((a, b) => b.price - a.price)
    const allAsks = [...asks].sort((a, b) => a.price - b.price)

    // Get price range
    const minPrice = Math.min(...allBids.map(b => b.price), ...allAsks.map(a => a.price))
    const maxPrice = Math.max(...allBids.map(b => b.price), ...allAsks.map(a => a.price))
    
    // Create price buckets
    const bucketCount = 20
    const bucketSize = (maxPrice - minPrice) / bucketCount
    const buckets = []

    for (let i = 0; i < bucketCount; i++) {
      const bucketPrice = minPrice + (i * bucketSize)
      const bucketEnd = bucketPrice + bucketSize

      // Aggregate bids in this bucket
      const bidVolume = allBids
        .filter(b => b.price >= bucketPrice && b.price < bucketEnd)
        .reduce((sum, b) => sum + b.size, 0)

      // Aggregate asks in this bucket
      const askVolume = allAsks
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
  }, [bids, asks])

  // Find max volume for normalization
  const maxVolume = useMemo(() => {
    return Math.max(...depthData.map(d => Math.max(d.bidVolume, d.askVolume)))
  }, [depthData])

  // Get color intensity based on volume
  const getColorIntensity = (volume, isBid) => {
    if (volume === 0) return 'rgba(0,0,0,0)'
    
    const intensity = Math.min(volume / maxVolume, 1)
    
    if (isBid) {
      // Green for bids
      return `rgba(34, 197, 94, ${intensity * 0.8})`
    } else {
      // Red for asks
      return `rgba(239, 68, 68, ${intensity * 0.8})`
    }
  }

  // Calculate cumulative depth
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

  // Find liquidity walls (buckets with >30% of max volume)
  const liquidityWalls = useMemo(() => {
    return depthData
      .map((bucket, idx) => ({
        ...bucket,
        idx,
        isBidWall: bucket.bidVolume > maxVolume * 0.3,
        isAskWall: bucket.askVolume > maxVolume * 0.3,
      }))
      .filter(bucket => bucket.isBidWall || bucket.isAskWall)
  }, [depthData, maxVolume])

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <Droplets className="w-5 h-5 text-primary-600" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Liquidity Heatmap
        </h3>
      </div>

      {/* Liquidity Walls Alert */}
      {liquidityWalls.length > 0 && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-1">
            {liquidityWalls.length} Liquidity Wall{liquidityWalls.length > 1 ? 's' : ''} Detected
          </div>
          <div className="text-xs text-blue-700 dark:text-blue-400">
            Large volume concentrations at specific price levels may indicate support/resistance
          </div>
        </div>
      )}

      {/* Heatmap */}
      <div className="space-y-1">
        {depthData.slice().reverse().map((bucket, idx) => {
          const reverseIdx = depthData.length - 1 - idx
          const isWall = liquidityWalls.find(w => w.idx === reverseIdx)

          return (
            <div key={idx} className="group">
              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mb-1">
                <span className="w-16">
                  ${bucket.price.toFixed(3)}
                </span>
                {isWall && (
                  <span className="px-2 py-0.5 bg-blue-200 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 rounded text-xs font-semibold">
                    WALL
                  </span>
                )}
              </div>
              
              <div className="flex gap-1 h-8">
                {/* Bid side (left) */}
                <div className="flex-1 flex justify-end">
                  <div
                    className="rounded-l transition-all duration-300 group-hover:opacity-100 flex items-center justify-end px-2"
                    style={{
                      width: `${(bucket.bidVolume / maxVolume) * 100}%`,
                      backgroundColor: getColorIntensity(bucket.bidVolume, true),
                      minWidth: bucket.bidVolume > 0 ? '20px' : '0',
                    }}
                  >
                    {bucket.bidVolume > 0 && (
                      <span className="text-xs font-semibold text-green-900 dark:text-green-100">
                        {bucket.bidVolume.toFixed(0)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Center divider */}
                <div className="w-px bg-gray-300 dark:bg-gray-700" />

                {/* Ask side (right) */}
                <div className="flex-1">
                  <div
                    className="rounded-r transition-all duration-300 group-hover:opacity-100 flex items-center justify-start px-2"
                    style={{
                      width: `${(bucket.askVolume / maxVolume) * 100}%`,
                      backgroundColor: getColorIntensity(bucket.askVolume, false),
                      minWidth: bucket.askVolume > 0 ? '20px' : '0',
                    }}
                  >
                    {bucket.askVolume > 0 && (
                      <span className="text-xs font-semibold text-red-900 dark:text-red-100">
                        {bucket.askVolume.toFixed(0)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Tooltip on hover */}
              <div className="hidden group-hover:block text-xs text-gray-500 dark:text-gray-400 mt-1">
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

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span className="text-gray-700 dark:text-gray-300">Bids (Buy Orders)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-700 dark:text-gray-300">Asks (Sell Orders)</span>
            <div className="w-4 h-4 bg-red-500 rounded"></div>
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Color intensity represents volume concentration. Darker = more liquidity.
        </div>
      </div>

      {/* Cumulative Depth Stats */}
      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Total Bid Depth</div>
          <div className="text-lg font-bold text-green-700 dark:text-green-400">
            {cumulativeDepth[cumulativeDepth.length - 1]?.bidCumulative.toFixed(0) || 0}
          </div>
        </div>
        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Total Ask Depth</div>
          <div className="text-lg font-bold text-red-700 dark:text-red-400">
            {cumulativeDepth[cumulativeDepth.length - 1]?.askCumulative.toFixed(0) || 0}
          </div>
        </div>
      </div>

      {/* Slippage Warning */}
      {liquidityWalls.length === 0 && maxVolume < 100 && (
        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 mb-1">
            Low Liquidity Warning
          </div>
          <div className="text-xs text-yellow-700 dark:text-yellow-400">
            Limited orderbook depth may result in high slippage for larger trades
          </div>
        </div>
      )}
    </div>
  )
}

export default LiquidityHeatmap
