import { formatPrice } from '../utils/formatters'

function OrderbookView({ orderbook }) {
  if (!orderbook || (!orderbook.yes && !orderbook.no)) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Orderbook</h3>
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          No orderbook data available
        </div>
      </div>
    )
  }

  const renderOrderbookSide = (title, data, isYes = true) => {
    if (!data || (!data.bids?.length && !data.asks?.length)) {
      return (
        <div>
          <h4 className="font-medium mb-2 text-gray-900 dark:text-white">{title}</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">No data</p>
        </div>
      )
    }

    return (
      <div>
        <h4 className="font-medium mb-3 text-gray-900 dark:text-white">{title}</h4>
        
        <div className="grid grid-cols-2 gap-4">
          {/* Asks */}
          <div>
            <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2">ASKS</p>
            <div className="space-y-1">
              {data.asks?.slice(0, 5).map((ask, idx) => (
                <div key={idx} className="flex justify-between text-xs">
                  <span className="text-red-600 dark:text-red-400">{formatPrice(ask.price)}</span>
                  <span className="text-gray-600 dark:text-gray-400">{ask.size.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bids */}
          <div>
            <p className="text-xs font-semibold text-green-600 dark:text-green-400 mb-2">BIDS</p>
            <div className="space-y-1">
              {data.bids?.slice(0, 5).map((bid, idx) => (
                <div key={idx} className="flex justify-between text-xs">
                  <span className="text-green-600 dark:text-green-400">{formatPrice(bid.price)}</span>
                  <span className="text-gray-600 dark:text-gray-400">{bid.size.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Orderbook</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {renderOrderbookSide('YES Token', orderbook.yes, true)}
        {renderOrderbookSide('NO Token', orderbook.no, false)}
      </div>
    </div>
  )
}

export default OrderbookView
