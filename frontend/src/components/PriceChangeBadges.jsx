export default function PriceChangeBadges({ market }) {
  const changes = [
    { label: '1H', value: market?.price_change_1h },
    { label: '1D', value: market?.price_change_1d },
    { label: '1W', value: market?.price_change_1wk },
    { label: '1M', value: market?.price_change_1mo },
  ]

  const validChanges = changes.filter((change) => change.value !== null && change.value !== undefined)

  if (validChanges.length === 0) {
    return null
  }

  return (
    <div className="flex gap-2 flex-wrap">
      {validChanges.map((change) => (
        <div
          key={change.label}
          className="flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700"
        >
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
            {change.label}
          </span>
          <span
            className={`text-xs font-semibold ${
              change.value > 0
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {change.value > 0 ? '+' : ''}{(change.value * 100).toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  )
}
