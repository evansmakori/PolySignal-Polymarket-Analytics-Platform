import React, { useState, useEffect } from 'react';
import { ShoppingCart, TrendingDown, Pause, AlertTriangle, CheckCircle, Zap, Target } from 'lucide-react';
import { getTradingSignal } from '../services/api';

const AITradingSignal = ({ marketId }) => {
  const [signal, setSignal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (marketId) {
      loadSignal();
    }
  }, [marketId]);

  const loadSignal = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTradingSignal(marketId);
      setSignal(data.trading_signal);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-lg border-2 border-gray-200">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-50 p-6 rounded-lg shadow border border-gray-200">
        <div className="flex items-center space-x-3 mb-2">
          <Pause className="w-5 h-5 text-gray-400" />
          <h3 className="text-base font-semibold text-gray-600">Trading Signal Unavailable</h3>
        </div>
        <p className="text-sm text-gray-500">
          We weren't able to generate a trading signal for this market right now. This usually happens when there isn't enough data yet. Check back soon!
        </p>
      </div>
    );
  }

  if (!signal) return null;

  const action = signal.action || 'HOLD';
  const riskLevel = signal.risk_level || 'UNKNOWN';
  const positionSize = signal.position_size || '—';
  const confidence = signal.confidence || 0;

  const getSignalConfig = () => {
    switch (action) {
      case 'BUY':
        return {
          icon: ShoppingCart,
          bgColor: 'bg-green-50',
          borderColor: 'border-green-500',
          textColor: 'text-green-700',
          badgeBg: 'bg-green-100',
          badgeText: 'text-green-700'
        };
      case 'SELL':
        return {
          icon: TrendingDown,
          bgColor: 'bg-red-50',
          borderColor: 'border-red-500',
          textColor: 'text-red-700',
          badgeBg: 'bg-red-100',
          badgeText: 'text-red-700'
        };
      case 'HOLD':
      default:
        return {
          icon: Pause,
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-500',
          textColor: 'text-yellow-700',
          badgeBg: 'bg-yellow-100',
          badgeText: 'text-yellow-700'
        };
    }
  };

  const getRiskConfig = () => {
    switch (riskLevel) {
      case 'CRITICAL':
        return {
          badgeBg: 'bg-red-100',
          badgeText: 'text-red-700'
        };
      case 'HIGH':
        return {
          badgeBg: 'bg-orange-100',
          badgeText: 'text-orange-700'
        };
      case 'MEDIUM':
        return {
          badgeBg: 'bg-yellow-100',
          badgeText: 'text-yellow-700'
        };
      case 'LOW':
        return {
          badgeBg: 'bg-green-100',
          badgeText: 'text-green-700'
        };
      default:
        return {
          badgeBg: 'bg-gray-100',
          badgeText: 'text-gray-700'
        };
    }
  };

  const config = getSignalConfig();
  const riskConfig = getRiskConfig();
  const SignalIcon = config.icon;

  return (
    <div className={`${config.bgColor} p-6 rounded-lg shadow-lg border-2 ${config.borderColor}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-full ${config.badgeBg}`}>
            <SignalIcon className={`w-6 h-6 ${config.textColor}`} />
          </div>
          <div>
            <h3 className={`text-4xl font-bold ${config.textColor}`}>{action}</h3>
            <p className="text-sm text-gray-600">AI Trading Signal</p>
          </div>
        </div>
        <Zap className="w-5 h-5 text-purple-600" title="AI Powered" />
      </div>

      {/* Confidence & Risk Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {/* Confidence */}
        <div className="bg-white/70 p-3 rounded text-center">
          <p className="text-sm text-gray-600">Confidence</p>
          <p className="text-xl font-bold text-blue-600">
            {(confidence * 100).toFixed(0)}%
          </p>
          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
            <div
              className="h-1.5 rounded-full bg-blue-500"
              style={{ width: `${confidence * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Risk Level */}
        <div className="bg-white/70 p-3 rounded text-center">
          <p className="text-sm text-gray-600">Risk Level</p>
          <p
            className={`text-base font-bold ${riskConfig.badgeText}`}
          >
            {riskLevel}
          </p>
        </div>

        {/* Position Size */}
        <div className="bg-white/70 p-3 rounded text-center">
          <p className="text-sm text-gray-600">Position Size</p>
          <p className="text-base font-bold text-gray-700">{positionSize}</p>
        </div>
      </div>

      {/* Entry/Stop/Profit */}
      {signal.entry_price !== null && (
        <div className="bg-white/70 p-4 rounded-lg mb-4 space-y-2 text-base">
          <p className="font-semibold text-gray-800 mb-2">Price Targets</p>
          
          <div className="flex justify-between">
            <span className="text-gray-600">Entry Price:</span>
            <span className="font-semibold text-gray-800">
              {(signal.entry_price * 100).toFixed(1)}%
            </span>
          </div>

          {signal.stop_loss !== null && (
            <div className="flex justify-between">
              <span className="text-gray-600">Stop Loss:</span>
              <span className="font-semibold text-red-600">
                {(signal.stop_loss * 100).toFixed(1)}%
              </span>
            </div>
          )}

          {signal.take_profit !== null && (
            <div className="flex justify-between">
              <span className="text-gray-600">Take Profit:</span>
              <span className="font-semibold text-green-600">
                {(signal.take_profit * 100).toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* Reasoning Bullet Points */}
      {signal.reasoning && signal.reasoning.length > 0 && (
        <div className="mb-4">
          <p className="text-base font-semibold text-gray-800 mb-2">Analysis:</p>
          <ul className="space-y-1.5">
            {signal.reasoning.map((reason, idx) => (
              <li key={idx} className="flex items-start space-x-2 text-base text-gray-700">
                <CheckCircle className="w-4 h-4 mt-0.5 text-blue-500 flex-shrink-0" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-gray-300 flex items-center justify-between text-sm text-gray-500">
        <span>Statistical Model Analysis</span>
        <div className="flex items-center space-x-1">
          <Target className="w-3 h-3" />
          <span>Real-time</span>
        </div>
      </div>
    </div>
  );
};

export default AITradingSignal;
