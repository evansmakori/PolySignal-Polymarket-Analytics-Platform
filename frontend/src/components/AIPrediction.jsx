import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, Brain, Zap } from 'lucide-react';
import { getPricePrediction } from '../services/api';

const AIPrediction = ({ marketId }) => {
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (marketId) {
      loadPrediction();
    }
  }, [marketId]);

  const loadPrediction = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPricePrediction(marketId);
      setPrediction(data.prediction);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 p-6 rounded-lg shadow">
        <div className="flex items-center space-x-2 mb-4">
          <Brain className="w-5 h-5 text-purple-600 animate-pulse" />
          <h3 className="text-lg font-semibold text-gray-800">AI Price Prediction</h3>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-6 rounded-lg shadow">
        <p className="text-red-600">Error loading prediction: {error}</p>
      </div>
    );
  }

  if (!prediction) return null;

  const predictedPrice = prediction.predicted_price || 0.5;
  const confidence = prediction.confidence || 0;
  const direction = prediction.direction || 'stable';
  const priceRange = prediction.price_range || { low: 0.4, high: 0.6 };

  const getDirectionIcon = () => {
    switch (direction) {
      case 'up':
        return <TrendingUp className="w-6 h-6 text-green-600" />;
      case 'down':
        return <TrendingDown className="w-6 h-6 text-red-600" />;
      default:
        return <Minus className="w-6 h-6 text-gray-600" />;
    }
  };

  const getDirectionColor = () => {
    switch (direction) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getDirectionLabel = () => {
    return direction.charAt(0).toUpperCase() + direction.slice(1);
  };

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 p-6 rounded-lg shadow-lg border border-purple-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Brain className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-800">AI Price Prediction</h3>
        </div>
        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
          Statistical Model
        </span>
      </div>

      <div className="space-y-4">
        {/* Predicted Price - Large Display */}
        <div className="text-center py-4 bg-white/70 rounded-lg">
          <p className="text-sm text-gray-600 mb-2">Predicted Price</p>
          <p className="text-4xl font-bold text-purple-600">
            {(predictedPrice * 100).toFixed(1)}%
          </p>
        </div>

        {/* Direction with Arrow */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={getDirectionColor()}>
              {getDirectionIcon()}
            </div>
            <div>
              <p className="text-sm text-gray-600">Direction</p>
              <p className={`text-lg font-bold ${getDirectionColor()}`}>
                {getDirectionLabel()}
              </p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-sm text-gray-600">Model Type</p>
            <p className="text-sm font-semibold text-gray-800">Statistical</p>
          </div>
        </div>

        {/* Confidence Bar */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <p className="text-sm text-gray-600">Confidence</p>
            <p className="text-sm font-semibold text-gray-800">
              {(confidence * 100).toFixed(0)}%
            </p>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${
                confidence > 0.7
                  ? 'bg-green-500'
                  : confidence > 0.5
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${confidence * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Price Range */}
        {priceRange && (
          <div className="bg-white/50 p-3 rounded text-xs space-y-2">
            <p className="font-semibold text-gray-700">Predicted Range</p>
            <div className="flex justify-between">
              <span className="text-gray-600">Low:</span>
              <span className="font-semibold">{(priceRange.low * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">High:</span>
              <span className="font-semibold">{(priceRange.high * 100).toFixed(1)}%</span>
            </div>
          </div>
        )}

        {/* Reasoning */}
        {prediction.reasoning && (
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 text-sm text-gray-700">
            <p className="font-semibold text-blue-900 mb-1">Reasoning:</p>
            <p>{prediction.reasoning}</p>
          </div>
        )}

        {/* Footer Badge */}
        <div className="flex items-center justify-center space-x-2 text-xs text-purple-600 bg-purple-100 py-2 rounded">
          <Zap className="w-3 h-3" />
          <span>Statistical Model - No GPU Required</span>
        </div>
      </div>
    </div>
  );
};

export default AIPrediction;
