"""
AI Trading Signals Agent.

Generates trading recommendations by combining:
- Price prediction
- Sentiment analysis
- Anomaly detection
"""

import logging
from typing import Dict, List, Optional
import numpy as np

from .price_predictor import PricePredictor
from .sentiment_analyzer import SentimentAnalyzer
from .anomaly_detector import AnomalyDetector

logger = logging.getLogger(__name__)


class TradingAgent:
    """
    Trading signal generator combining price prediction, sentiment, and anomaly detection.
    """
    
    def __init__(self):
        """Initialize the trading agent with all AI models."""
        self.price_predictor = PricePredictor()
        self.sentiment_analyzer = SentimentAnalyzer()
        self.anomaly_detector = AnomalyDetector()
        
        logger.info("TradingAgent initialized (statistical mode)")
    
    def generate_signal(self, market_data: Dict, history: Optional[List[Dict]] = None) -> Dict:
        """
        Generate comprehensive trading signal for a market.
        
        Args:
            market_data: Current market data
            history: Optional historical data
        
        Returns:
            Dictionary with:
            - action: 'BUY'/'SELL'/'HOLD'
            - confidence: float 0-1
            - risk_level: 'LOW'/'MEDIUM'/'HIGH'/'CRITICAL'
            - position_size: 'LARGE'/'MEDIUM'/'SMALL'/'VERY_SMALL'
            - entry_price: float
            - stop_loss: float
            - take_profit: float
            - reasoning: list of str
            - components: dict with prediction, sentiment, anomaly
        """
        try:
            # 1. Price Prediction
            prediction = self.price_predictor.predict(market_data)
            
            # 2. Sentiment Analysis
            market_title = market_data.get('title', '')
            sentiment = self.sentiment_analyzer.analyze(market_title, market_data)
            
            # 3. Anomaly Detection
            anomaly = self.anomaly_detector.detect(market_data, history)
            
            # 4. Calculate signal score
            signal_score = self._calculate_signal_score(prediction, sentiment, anomaly, market_data)
            
            # 5. Determine action
            action = self._determine_action(signal_score, anomaly)
            
            # 6. Assess risk
            risk_level = self._assess_risk(market_data, anomaly, sentiment)
            
            # 7. Calculate position size
            position_size = self._calculate_position_size(prediction.get('confidence', 0), risk_level)
            
            # 8. Calculate entry/stop/profit levels
            yes_price = market_data.get('yes_price', 0.5)
            volatility = market_data.get('volatility', 0.1)
            entry_price = yes_price
            stop_loss = max(entry_price - 2 * volatility, 0.01)
            take_profit = min(entry_price + 3 * (sentiment.get('market_sentiment_score', 0) * 0.3 + 0.1), 0.99)
            
            # 9. Calculate confidence
            confidence = self._calculate_confidence(prediction, sentiment, anomaly, market_data)
            
            # 10. Generate reasoning
            reasoning = self._generate_reasoning(
                action, prediction, sentiment, anomaly, market_data, signal_score
            )
            
            return {
                'action': action,
                'confidence': float(confidence),
                'risk_level': risk_level,
                'position_size': position_size,
                'entry_price': float(entry_price),
                'stop_loss': float(stop_loss),
                'take_profit': float(take_profit),
                'reasoning': reasoning,
                'components': {
                    'prediction': prediction,
                    'sentiment': sentiment,
                    'anomaly': anomaly
                }
            }
        
        except Exception as e:
            logger.error(f"Error generating trading signal: {e}")
            return self._fallback_signal(market_data)
    
    def _calculate_signal_score(
        self,
        prediction: Dict,
        sentiment: Dict,
        anomaly: Dict,
        market_data: Dict
    ) -> float:
        """
        Calculate composite signal score.
        
        Components:
        - prediction direction up → +0.4, down → -0.4
        - EV > 0 → +0.3
        - sentiment bullish → +0.2
        - no anomaly → +0.1
        """
        score = 0.0
        
        # Prediction direction (0.4)
        direction = prediction.get('direction', 'stable')
        if direction == 'up':
            score += 0.4
        elif direction == 'down':
            score -= 0.4
        
        # Expected value (0.3)
        ev = market_data.get('expected_value', 0.5)
        if ev > 0.5:
            score += 0.3 * (ev - 0.5) * 2  # Scale by distance from 0.5
        elif ev < 0.5:
            score -= 0.3 * (0.5 - ev) * 2
        
        # Sentiment (0.2)
        sentiment_val = sentiment.get('sentiment', 'neutral')
        if sentiment_val == 'bullish':
            score += 0.2
        elif sentiment_val == 'bearish':
            score -= 0.2
        
        # Anomaly (0.1 penalty)
        if not anomaly.get('is_anomaly', False):
            score += 0.1
        else:
            # Penalize based on severity
            severity = anomaly.get('severity', 'low')
            if severity == 'critical':
                score -= 0.3
            elif severity == 'high':
                score -= 0.2
            elif severity == 'medium':
                score -= 0.1
        
        return float(np.clip(score, -1.0, 1.0))
    
    def _determine_action(self, signal_score: float, anomaly: Dict) -> str:
        """
        Determine action: BUY/SELL/HOLD.
        
        - BUY if score > 0.3
        - SELL if score < -0.3
        - HOLD otherwise
        """
        # Don't recommend action if critical anomaly
        if anomaly.get('severity') == 'critical':
            return 'HOLD'
        
        if signal_score > 0.3:
            return 'BUY'
        elif signal_score < -0.3:
            return 'SELL'
        else:
            return 'HOLD'
    
    def _assess_risk(self, market_data: Dict, anomaly: Dict, sentiment: Dict) -> str:
        """
        Assess risk level: LOW/MEDIUM/HIGH/CRITICAL.
        
        Factors:
        - CRITICAL: anomaly critical OR liquidity < 500
        - HIGH: anomaly high OR liquidity < 1000 OR spread > 0.05
        - MEDIUM: spread > 0.02
        - LOW: otherwise
        """
        # Anomaly risk
        severity = anomaly.get('severity', 'low')
        if severity == 'critical':
            return 'CRITICAL'
        
        # Liquidity risk
        liquidity = market_data.get('liquidity', 0)
        if liquidity < 500:
            return 'CRITICAL'
        if liquidity < 1000:
            return 'HIGH'
        
        # Spread risk
        spread = market_data.get('spread', 0.1)
        if severity == 'high' or spread > 0.05:
            return 'HIGH'
        if spread > 0.02:
            return 'MEDIUM'
        
        return 'LOW'
    
    def _calculate_position_size(self, confidence: float, risk_level: str) -> str:
        """
        Calculate position size recommendation.
        
        - LARGE if confidence > 0.7 and LOW risk
        - MEDIUM if confidence > 0.5
        - SMALL if confidence > 0.3
        - VERY_SMALL otherwise
        """
        # Risk penalty
        risk_penalties = {
            'LOW': 0,
            'MEDIUM': -0.1,
            'HIGH': -0.2,
            'CRITICAL': -0.3
        }
        
        adj_confidence = confidence + risk_penalties.get(risk_level, 0)
        
        if adj_confidence > 0.7:
            return 'LARGE'
        elif adj_confidence > 0.5:
            return 'MEDIUM'
        elif adj_confidence > 0.3:
            return 'SMALL'
        else:
            return 'VERY_SMALL'
    
    def _calculate_confidence(
        self,
        prediction: Dict,
        sentiment: Dict,
        anomaly: Dict,
        market_data: Dict
    ) -> float:
        """Calculate overall confidence in the signal."""
        factors = []
        
        # Prediction confidence
        factors.append(prediction.get('confidence', 0.5))
        
        # Sentiment confidence
        factors.append(sentiment.get('confidence', 0.5))
        
        # Data quality
        liquidity = market_data.get('liquidity', 0)
        if liquidity > 1000:
            factors.append(0.8)
        elif liquidity > 500:
            factors.append(0.6)
        else:
            factors.append(0.4)
        
        # Anomaly reduces confidence
        if anomaly.get('is_anomaly', False):
            anomaly_penalty = 1.0 - (anomaly.get('anomaly_score', 0) * 0.3)
            factors.append(anomaly_penalty)
        else:
            factors.append(1.0)
        
        confidence = np.mean(factors)
        return float(np.clip(confidence, 0.1, 0.95))
    
    def _generate_reasoning(
        self,
        action: str,
        prediction: Dict,
        sentiment: Dict,
        anomaly: Dict,
        market_data: Dict,
        signal_score: float
    ) -> List[str]:
        """Generate bullet-point reasoning."""
        reasoning = []
        
        # Action reason
        if action == 'BUY':
            reasoning.append(f"✓ BUY signal (score: {signal_score:.2f}) - Positive indicators outweigh risks")
        elif action == 'SELL':
            reasoning.append(f"✗ SELL signal (score: {signal_score:.2f}) - Negative indicators suggest caution")
        else:
            reasoning.append(f"= HOLD signal (score: {signal_score:.2f}) - Mixed or insufficient signals")
        
        # Price prediction
        direction = prediction.get('direction', 'stable')
        if direction == 'up':
            reasoning.append(f"↑ Price predicted to increase ({prediction.get('confidence', 0)*100:.0f}% confidence)")
        elif direction == 'down':
            reasoning.append(f"↓ Price predicted to decrease ({prediction.get('confidence', 0)*100:.0f}% confidence)")
        else:
            reasoning.append(f"→ Price expected to remain stable")
        
        # Sentiment
        sentiment_val = sentiment.get('sentiment', 'neutral')
        if sentiment_val == 'bullish':
            reasoning.append(f"📈 Market sentiment is BULLISH")
        elif sentiment_val == 'bearish':
            reasoning.append(f"📉 Market sentiment is BEARISH")
        else:
            reasoning.append(f"→ Market sentiment is NEUTRAL")
        
        # Liquidity
        liquidity = market_data.get('liquidity', 0)
        if liquidity > 10000:
            reasoning.append(f"✓ Strong liquidity (${liquidity:,.0f})")
        elif liquidity > 1000:
            reasoning.append(f"→ Moderate liquidity (${liquidity:,.0f})")
        else:
            reasoning.append(f"⚠ Low liquidity (${liquidity:,.0f}) - execution risk")
        
        # Anomalies
        if anomaly.get('is_anomaly', False):
            severity = anomaly.get('severity', 'low')
            anomaly_types = anomaly.get('anomaly_types', [])
            reasoning.append(f"⚠ {severity.upper()} anomaly detected: {', '.join(anomaly_types)}")
        else:
            reasoning.append(f"✓ No anomalies detected - normal market behavior")
        
        return reasoning
    
    def _fallback_signal(self, market_data: Dict) -> Dict:
        """Generate fallback signal when generation fails."""
        return {
            'action': 'HOLD',
            'confidence': 0.2,
            'risk_level': 'HIGH',
            'position_size': 'VERY_SMALL',
            'entry_price': float(market_data.get('yes_price', 0.5)),
            'stop_loss': 0.01,
            'take_profit': 0.99,
            'reasoning': ['Unable to generate AI-powered analysis. Recommend waiting for better market conditions.'],
            'components': {
                'prediction': {'model_type': 'statistical', 'confidence': 0.0},
                'sentiment': {'sentiment': 'neutral', 'confidence': 0.0},
                'anomaly': {'is_anomaly': False}
            }
        }
