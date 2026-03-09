import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatPercent } from '../utils/formatters'

function PriceChart({ data, title = 'Price History' }) {
  if (!data || data.length === 0) {
    return (
      <div className="card">
        <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">{title}</h3>
        <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
          No data available
        </div>
      </div>
    )
  }

  // Format data for recharts
  const chartData = data.map(point => ({
    time: new Date(point.ts || point.t).toLocaleDateString(),
    price: point.price,
  })).reverse() // Reverse to show chronological order

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload
      const price = payload[0].value
      
      // Calculate implied probability for NO
      const noPrice = 1 - price
      
      // Find previous point for change calculation
      const currentIndex = chartData.findIndex(d => d.time === label)
      const previousPoint = currentIndex > 0 ? chartData[currentIndex - 1] : null
      const priceChange = previousPoint && previousPoint.price !== 0 ? ((price - previousPoint.price) / previousPoint.price) * 100 : null

      return (
        <div className="bg-white dark:bg-gray-800 border-2 border-primary-500 dark:border-primary-400 rounded-lg shadow-xl p-4 min-w-[200px]">
          {/* Date/Time */}
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-2 font-medium">
            {point.time}
          </div>
          
          {/* YES Price */}
          <div className="mb-2">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">YES Price</div>
            <div className="text-4xl font-bold text-green-600 dark:text-green-400">
              {formatPercent(price)}
            </div>
          </div>

          {/* NO Price */}
          <div className="mb-2">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">NO Price</div>
            <div className="text-xl font-semibold text-red-600 dark:text-red-400">
              {formatPercent(noPrice)}
            </div>
          </div>

          {/* Price Change */}
          {priceChange !== null && (
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Change from Previous</div>
              <div className={`text-base font-semibold ${
                priceChange > 0 
                  ? 'text-green-600 dark:text-green-400' 
                  : priceChange < 0 
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-600 dark:text-gray-400'
              }`}>
                {priceChange > 0 ? '+' : ''}{priceChange.toFixed(2)}%
              </div>
            </div>
          )}

          {/* Decimal Value */}
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Decimal: {price.toFixed(4)}
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="card">
      <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="time" 
            stroke="#9CA3AF"
            tick={{ fill: '#9CA3AF' }}
          />
          <YAxis 
            stroke="#9CA3AF"
            tick={{ fill: '#9CA3AF' }}
            tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="price" 
            stroke="#0ea5e9" 
            strokeWidth={2}
            dot={{ r: 3, fill: '#0ea5e9' }}
            activeDot={{ r: 6, fill: '#0ea5e9', stroke: '#fff', strokeWidth: 2 }}
            name="YES Price"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default PriceChart
