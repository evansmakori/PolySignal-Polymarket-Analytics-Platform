"""
Rule-Based Sentiment Analyzer for Market Descriptions.

Uses keyword matching and heuristics - no transformers or GPU required.
Analyzes text sentiment and market data for comprehensive sentiment score.
"""

import logging
from typing import Dict, List, Optional
import re

logger = logging.getLogger(__name__)


class SentimentAnalyzer:
    """
    Rule-based sentiment analysis for market descriptions.
    
    Analyzes:
    - Text sentiment (bullish/bearish/neutral)
    - Market sentiment score from data
    - Topics and key signals
    - Uncertainty levels
    """
    
    def __init__(self):
        """Initialize the sentiment analyzer."""
        # Sentiment keywords
        self.bullish_keywords = {
            'win', 'surge', 'confirm', 'likely', 'strong', 'rise', 'beat',
            'positive', 'gains', 'success', 'approve', 'victory', 'upside',
            'strengthen', 'improve', 'exceed', 'outperform', 'growth'
        }
        
        self.bearish_keywords = {
            'lose', 'crash', 'fail', 'unlikely', 'weak', 'drop', 'miss',
            'negative', 'losses', 'reject', 'defeat', 'downside',
            'weaken', 'decline', 'underperform', 'concerns', 'risk'
        }
        
        # Topic keywords
        self.topic_keywords = {
            'politics': ['election', 'vote', 'president', 'senate', 'congress', 'political', 'campaign', 'senate race'],
            'crypto': ['bitcoin', 'ethereum', 'crypto', 'blockchain', 'token', 'defi', 'nft', 'cryptocurrency'],
            'sports': ['game', 'match', 'team', 'player', 'championship', 'win', 'score', 'nfl', 'nba', 'nhl', 'mlb'],
            'economics': ['gdp', 'inflation', 'economy', 'market', 'stock', 'recession', 'growth', 'rate'],
            'technology': ['ai', 'tech', 'software', 'launch', 'release', 'innovation', 'app', 'platform']
        }
        
        logger.info("SentimentAnalyzer initialized (rule-based mode)")
    
    def analyze(self, text: str, market_data: Optional[Dict] = None) -> Dict:
        """
        Analyze sentiment from text and market data.
        
        Args:
            text: Market description/title
            market_data: Optional market data for sentiment score
        
        Returns:
            Dictionary with:
            - sentiment: 'bullish'/'bearish'/'neutral'
            - confidence: float 0-1
            - uncertainty_level: 'high'/'medium'/'low'
            - topics: list of detected topics
            - key_signals: list of signal words found
            - market_sentiment_score: float -1 to 1
            - reasoning: str
        """
        if not text:
            return self._empty_result()
        
        text_lower = text.lower()
        
        # Rule-based text sentiment
        text_sentiment, text_signals = self._analyze_text_sentiment(text_lower)
        
        # Market data sentiment
        market_sentiment_score = self._calculate_market_sentiment_score(market_data)
        
        # Detect topics
        topics = self._detect_topics(text_lower)
        
        # Detect uncertainty
        uncertainty = self._detect_uncertainty(text_lower)
        
        # Combine sentiment: 60% text, 40% market data
        if market_data:
            combined_sentiment = self._combine_sentiments(text_sentiment, market_sentiment_score)
        else:
            combined_sentiment = text_sentiment
        
        # Calculate confidence
        confidence = self._calculate_confidence(len(text.split()), len(text_signals), market_data)
        
        # Generate reasoning
        reasoning = self._generate_reasoning(
            combined_sentiment, confidence, uncertainty, topics, text_signals
        )
        
        return {
            'sentiment': combined_sentiment,
            'confidence': float(confidence),
            'uncertainty_level': uncertainty,
            'topics': topics,
            'key_signals': text_signals,
            'market_sentiment_score': float(market_sentiment_score),
            'reasoning': reasoning
        }
    
    def _analyze_text_sentiment(self, text: str) -> tuple:
        """
        Analyze text sentiment using keyword matching.
        
        Returns:
            (sentiment: str, signals: list)
        """
        bullish_count = sum(1 for word in self.bullish_keywords if word in text)
        bearish_count = sum(1 for word in self.bearish_keywords if word in text)
        
        # Find actual signal words in text
        signals = []
        for word in self.bullish_keywords:
            if word in text:
                signals.append(word)
        for word in self.bearish_keywords:
            if word in text:
                signals.append(word)
        
        # Determine sentiment
        if bullish_count > bearish_count:
            sentiment = 'bullish'
        elif bearish_count > bullish_count:
            sentiment = 'bearish'
        else:
            sentiment = 'neutral'
        
        return sentiment, signals
    
    def _calculate_market_sentiment_score(self, market_data: Optional[Dict]) -> float:
        """
        Calculate market sentiment score from market data (-1 to 1).
        
        Uses:
        - expected_value (EV): positive if > 0.5
        - sentiment_momentum: direct
        - orderbook_imbalance: positive if imbalance > 0
        """
        if not market_data:
            return 0.0
        
        score = 0.0
        
        # Expected value component
        ev = market_data.get('expected_value', 0.5)
        if ev is not None:
            # Normalize EV around 0.5 to -1..1 range
            ev_contribution = (ev - 0.5) * 2  # Now -1..1
            score += ev_contribution * 0.4
        
        # Sentiment momentum component
        momentum = market_data.get('sentiment_momentum', 0.0)
        if momentum is not None:
            score += momentum * 0.4
        
        # Orderbook imbalance component
        imbalance = market_data.get('orderbook_imbalance', 0.0)
        if imbalance is not None:
            score += np.clip(imbalance, -1, 1) * 0.2
        
        return float(np.clip(score, -1.0, 1.0))
    
    def _combine_sentiments(self, text_sentiment: str, market_score: float) -> str:
        """Combine text and market sentiments."""
        # Map market score to sentiment
        if market_score > 0.2:
            market_sentiment = 'bullish'
        elif market_score < -0.2:
            market_sentiment = 'bearish'
        else:
            market_sentiment = 'neutral'
        
        # Simple combination: if either is strong, use it
        if text_sentiment == 'bullish' or market_sentiment == 'bullish':
            if text_sentiment != 'bearish' and market_sentiment != 'bearish':
                return 'bullish'
        
        if text_sentiment == 'bearish' or market_sentiment == 'bearish':
            if text_sentiment != 'bullish' and market_sentiment != 'bullish':
                return 'bearish'
        
        return 'neutral'
    
    def _detect_topics(self, text: str) -> List[str]:
        """Detect main topics in text."""
        topics = []
        
        for category, keywords in self.topic_keywords.items():
            if any(kw in text for kw in keywords):
                topics.append(category)
        
        return topics if topics else ['general']
    
    def _detect_uncertainty(self, text: str) -> str:
        """
        Detect uncertainty level from language patterns.
        
        - high: 'might', 'maybe', 'possibly', 'uncertain', 'unclear'
        - medium: 'likely', 'probably', 'expected', 'should'
        - low: 'will', 'definitely', 'certainly', 'confirmed'
        """
        high_uncertainty_words = ['might', 'maybe', 'possibly', 'uncertain', 'unclear', 'could', 'may']
        medium_uncertainty_words = ['likely', 'probably', 'expected', 'anticipated', 'should', 'appears']
        low_uncertainty_words = ['will', 'definitely', 'certainly', 'confirmed', 'guaranteed', 'must']
        
        high_count = sum(1 for w in high_uncertainty_words if w in text)
        medium_count = sum(1 for w in medium_uncertainty_words if w in text)
        low_count = sum(1 for w in low_uncertainty_words if w in text)
        
        if high_count > medium_count and high_count > low_count:
            return 'high'
        elif low_count > medium_count and low_count > high_count:
            return 'low'
        else:
            return 'medium'
    
    def _calculate_confidence(self, word_count: int, signal_count: int, market_data: Optional[Dict]) -> float:
        """Calculate confidence in sentiment analysis."""
        confidence = 0.3  # Base
        
        # Text length factor
        if word_count > 50:
            confidence += 0.2
        elif word_count > 20:
            confidence += 0.1
        
        # Signal presence factor
        if signal_count > 3:
            confidence += 0.2
        elif signal_count > 0:
            confidence += 0.1
        
        # Market data quality
        if market_data:
            if market_data.get('liquidity', 0) > 1000:
                confidence += 0.15
            if market_data.get('volume_24h', 0) > 1000:
                confidence += 0.1
        
        return min(confidence, 0.95)
    
    def _generate_reasoning(
        self,
        sentiment: str,
        confidence: float,
        uncertainty: str,
        topics: List[str],
        signals: List[str]
    ) -> str:
        """Generate human-readable explanation."""
        reasoning = f"Sentiment: {sentiment.upper()} (confidence: {confidence*100:.0f}%). "
        
        if signals:
            reasoning += f"Key signals: {', '.join(signals[:3])}. "
        
        reasoning += f"Topics: {', '.join(topics)}. "
        reasoning += f"Uncertainty: {uncertainty}."
        
        return reasoning
    
    def _empty_result(self) -> Dict:
        """Return empty result structure."""
        return {
            'sentiment': 'neutral',
            'confidence': 0.0,
            'uncertainty_level': 'high',
            'topics': [],
            'key_signals': [],
            'market_sentiment_score': 0.0,
            'reasoning': 'No text provided for analysis.'
        }


# Add numpy import for clipping
import numpy as np
