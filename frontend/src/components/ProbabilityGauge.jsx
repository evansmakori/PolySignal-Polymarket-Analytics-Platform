import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

function ProbabilityGauge({ probability, previousProbability = null, title = "YES Probability" }) {
  const [animatedProbability, setAnimatedProbability] = useState(0)

  // Animate probability change
  useEffect(() => {
    const targetProb = probability || 0
    const startProb = animatedProbability
    const duration = 1000 // 1 second animation
    const steps = 60
    const increment = (targetProb - startProb) / steps
    let currentStep = 0

    const timer = setInterval(() => {
      currentStep++
      if (currentStep <= steps) {
        setAnimatedProbability(startProb + (increment * currentStep))
      } else {
        setAnimatedProbability(targetProb)
        clearInterval(timer)
      }
    }, duration / steps)

    return () => clearInterval(timer)
  }, [probability])

  const displayProb = animatedProbability * 100

  // Calculate change
  const hasChange = previousProbability !== null && previousProbability !== probability
  const change = hasChange ? ((probability - previousProbability) * 100) : 0
  const isIncrease = change > 0

  // Color gradient based on probability
  const getGaugeColor = (prob) => {
    if (prob < 30) return { start: '#ef4444', end: '#dc2626', text: 'text-red-600' } // Red
    if (prob < 50) return { start: '#f59e0b', end: '#d97706', text: 'text-orange-600' } // Orange
    if (prob < 70) return { start: '#eab308', end: '#ca8a04', text: 'text-yellow-600' } // Yellow
    return { start: '#22c55e', end: '#16a34a', text: 'text-green-600' } // Green
  }

  const colors = getGaugeColor(displayProb)

  // SVG gauge parameters
  const size = 200
  const strokeWidth = 20
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (displayProb / 100) * circumference

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 text-center">
        {title}
      </h3>

      {/* Gauge Container */}
      <div className="relative flex items-center justify-center">
        {/* SVG Gauge */}
        <svg width={size} height={size} className="transform -rotate-90">
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={colors.start} />
              <stop offset="100%" stopColor={colors.end} />
            </linearGradient>
          </defs>
          
          {/* Background Circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-gray-200 dark:text-gray-700"
          />
          
          {/* Progress Circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Center Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className={`text-5xl font-bold ${colors.text} transition-colors duration-500`}>
            {displayProb.toFixed(1)}%
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Probability
          </div>
          
          {/* Change Indicator */}
          {hasChange && Math.abs(change) > 0.1 && (
            <div className={`flex items-center gap-1 mt-2 text-sm font-semibold ${
              isIncrease ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}>
              {isIncrease ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span>{isIncrease ? '+' : ''}{change.toFixed(2)}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Color Scale Legend */}
      <div className="mt-6">
        <div className="h-3 rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"></div>
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Interpretation */}
      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <div className="text-sm">
          <div className="font-semibold text-gray-900 dark:text-white mb-1">
            Market Sentiment:
          </div>
          <div className="text-gray-600 dark:text-gray-400">
            {displayProb < 30 && "Market is highly confident in NO outcome"}
            {displayProb >= 30 && displayProb < 50 && "Market leans toward NO, but with uncertainty"}
            {displayProb >= 50 && displayProb < 70 && "Market leans toward YES, but with uncertainty"}
            {displayProb >= 70 && "Market is highly confident in YES outcome"}
          </div>
        </div>
      </div>

      {/* Thermometer Style Alternative (Vertical) */}
      <div className="mt-6">
        <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Confidence Thermometer
        </div>
        <div className="flex items-center gap-3">
          {/* Thermometer */}
          <div className="relative w-12 h-48 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="absolute bottom-0 left-0 right-0 transition-all duration-1000 ease-out rounded-full"
              style={{
                height: `${displayProb}%`,
                background: `linear-gradient(to top, ${colors.start}, ${colors.end})`,
              }}
            />
            
            {/* Tick Marks */}
            <div className="absolute inset-0 flex flex-col justify-between py-2">
              {[100, 75, 50, 25, 0].map((tick) => (
                <div key={tick} className="flex items-center">
                  <div className="w-full h-px bg-white/30"></div>
                </div>
              ))}
            </div>
          </div>

          {/* Labels */}
          <div className="flex-1 flex flex-col justify-between h-48 text-xs text-gray-600 dark:text-gray-400">
            <span className="font-semibold text-green-600 dark:text-green-400">100% Certain</span>
            <span>75%</span>
            <span className="font-semibold">50% Toss-up</span>
            <span>25%</span>
            <span className="font-semibold text-red-600 dark:text-red-400">0% Unlikely</span>
          </div>
        </div>
      </div>

      {/* Probability Ranges */}
      <div className="mt-6 space-y-2">
        <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Probability Bands
        </div>
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div className={`p-2 rounded text-center font-medium ${
            displayProb >= 0 && displayProb < 25 
              ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 ring-2 ring-red-500' 
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
          }`}>
            <div>0-25%</div>
            <div className="text-xs opacity-75">Very Low</div>
          </div>
          <div className={`p-2 rounded text-center font-medium ${
            displayProb >= 25 && displayProb < 50 
              ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 ring-2 ring-orange-500' 
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
          }`}>
            <div>25-50%</div>
            <div className="text-xs opacity-75">Low</div>
          </div>
          <div className={`p-2 rounded text-center font-medium ${
            displayProb >= 50 && displayProb < 75 
              ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 ring-2 ring-yellow-500' 
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
          }`}>
            <div>50-75%</div>
            <div className="text-xs opacity-75">High</div>
          </div>
          <div className={`p-2 rounded text-center font-medium ${
            displayProb >= 75 
              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 ring-2 ring-green-500' 
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
          }`}>
            <div>75-100%</div>
            <div className="text-xs opacity-75">Very High</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProbabilityGauge
