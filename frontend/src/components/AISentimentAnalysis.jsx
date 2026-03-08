import React, { useState, useEffect } from 'react';
import { MessageSquare, ThumbsUp, ThumbsDown, Minus, AlertCircle } from 'lucide-react';
import { getSentimentAnalysis } from '../services/api';

const AISentimentAnalysis = ({ marketId }) => {
  const [sentiment, setSentiment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (marketId) {
      loadSentiment();
    }
  }, [marketId]);

  const loadSentiment = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getSentimentAnalysis(marketId);
      setSentiment(data.sentiment_analysis);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error) return null;
  if (!sentiment) return null;

  const getSentimentConfig = () => {
    const sent = sentiment.sentiment?.toLowerCase();
    switch (sent) {
      case 'bullish':
        return {
          icon: ThumbsUp,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          badgeBg: 'bg-green-100',
          badgeText: 'text-green-700'
        };
      case 'bearish':
        return {
          icon: ThumbsDown,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          badgeBg: 'bg-red-100',
          badgeText: 'text-red-700'
        };
      default:
        return {
          icon: Minus,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          badgeBg: 'bg-gray-100',
          badgeText: 'text-gray-700'
        };
    }
  };

  const config = getSentimentConfig();
  const SentimentIcon = config.icon;

  return (
    <div className={`${config.bgColor} p-6 rounded-lg shadow border ${config.borderColor}`}>
      <div className="flex items-center space-x-2 mb-4">
        <MessageSquare className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-800">AI Sentiment Analysis</h3>
      </div>

      <div className="space-y-4">
        {/* Sentiment Badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <SentimentIcon className={`w-6 h-6 ${config.color}`} />
            <div>
              <p className="text-sm text-gray-600">Sentiment</p>
              <p className={`text-lg font-bold ${config.badgeText}`}>
                {sentiment.sentiment?.toUpperCase()}
              </p>
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full font-semibold text-sm ${config.badgeBg} ${config.badgeText}`}>
            {sentiment.sentiment?.toUpperCase()}
          </div>
        </div>

        {/* Confidence Bar */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <p className="text-sm text-gray-600">Confidence</p>
            <p className="text-sm font-semibold">{(sentiment.confidence * 100).toFixed(0)}%</p>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="h-2.5 rounded-full bg-blue-500"
              style={{ width: `${sentiment.confidence * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Market Sentiment Score Gauge (-1 to 1) */}
        <div>
          <p className="text-sm text-gray-600 mb-2">Market Sentiment Score</p>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-red-600 font-semibold">Bearish</span>
            <div className="flex-1 bg-gradient-to-r from-red-200 via-gray-200 to-green-200 rounded-full h-2.5">
              <div
                className={`h-2.5 w-1 rounded-full ${
                  sentiment.market_sentiment_score > 0 ? 'bg-green-600' : 'bg-red-600'
                }`}
                style={{
                  left: `${((sentiment.market_sentiment_score + 1) / 2) * 100}%`,
                  marginLeft: '-4px'
                }}
              ></div>
            </div>
            <span className="text-xs text-green-600 font-semibold">Bullish</span>
          </div>
          <p className="text-xs text-gray-500 mt-1 text-center">
            Score: {sentiment.market_sentiment_score.toFixed(2)}
          </p>
        </div>

        {/* Topics as Chips */}
        {sentiment.topics && sentiment.topics.length > 0 && (
          <div>
            <p className="text-sm text-gray-600 mb-2">Topics</p>
            <div className="flex flex-wrap gap-2">
              {sentiment.topics.map((topic, idx) => (
                <span
                  key={idx}
                  className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium"
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Key Signals */}
        {sentiment.key_signals && sentiment.key_signals.length > 0 && (
          <div>
            <p className="text-sm text-gray-600 mb-2">Key Signals</p>
            <div className="flex flex-wrap gap-1.5">
              {sentiment.key_signals.slice(0, 5).map((signal, idx) => (
                <span
                  key={idx}
                  className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-medium"
                >
                  {signal}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Uncertainty Level */}
        <div className="flex items-center justify-between bg-white/50 p-3 rounded">
          <span className="text-sm text-gray-600">Uncertainty Level</span>
          <span
            className={`font-semibold text-sm ${
              sentiment.uncertainty_level === 'high'
                ? 'text-red-600'
                : sentiment.uncertainty_level === 'medium'
                ? 'text-yellow-600'
                : 'text-green-600'
            }`}
          >
            {sentiment.uncertainty_level?.toUpperCase()}
          </span>
        </div>

        {/* Reasoning */}
        {sentiment.reasoning && (
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 text-sm text-gray-700">
            <p className="font-semibold text-blue-900 mb-1">Analysis:</p>
            <p>{sentiment.reasoning}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AISentimentAnalysis;
