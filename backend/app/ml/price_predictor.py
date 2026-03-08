"""
Statistical Price Predictor for Polymarket.

Uses statistical and heuristic methods to predict market prices.
No GPU/PyTorch required - works immediately with real market data.
"""

import numpy as np
from typing import Dict, List, Optional
import logging

logger = logging.getLogger(__name__)


class PricePredictor:
    """
    Statistical price prediction using real market data.
    
    Predicts market prices using:
    - Current price (40% weight)
    - Fair value estimation (25% weight)
    - EMA slope extrapolation (20% weight)
    - Mean reversion (15% weight)
    """
    
    def __init__(self):
        """Initialize the price predictor."""
        logger.info("PricePredictor initialized (statistical mode)")
    
    def predict(self, market_data: Dict) -> Dict:
        """
        Predict price movement for a market.
        
        Args:
            market_data: Market data dictionary with yes_price, liquidity, volatility, etc.
        
        Returns:
            Dictionary with:
            - predicted_price: float
            - direction: 'up'/'down'/'stable'
            - confidence: float 0-1
            - price_range: {'low': float, 'high': float}
            - reasoning: str
            - model_type: 'statistical'
        """
        try:
            # Extract market metrics — guard all against None
            current_price = float(market_data.get('yes_price') or 0.5)
            
            # Component 1: Current price (40% weight)
            component_current = current_price
            
            # Component 2: Fair value (25% weight)
            ev = float(market_data.get('expected_value') or current_price)
            component_fair = ev
            
            # Component 3: EMA slope extrapolation (20% weight)
            momentum = float(market_data.get('sentiment_momentum') or 0.0)
            volatility = float(market_data.get('volatility') or 0.1)
            
            # Use momentum to estimate trend
            ema_slope = np.tanh(momentum * 2) * 0.05
            component_ema = np.clip(current_price + ema_slope, 0.01, 0.99)
            
            # Component 4: Mean reversion toward 0.5 (15% weight)
            distance_from_mid = abs(current_price - 0.5)
            mean_reversion = 0.5 + (current_price - 0.5) * 0.85  # 15% reversion
            component_mean = mean_reversion
            
            # Weighted blend
            predicted_price = (
                component_current * 0.40 +
                component_fair * 0.25 +
                component_ema * 0.20 +
                component_mean * 0.15
            )
            
            predicted_price = np.clip(predicted_price, 0.01, 0.99)
            
            # Determine direction based on EMA slope
            direction = self._determine_direction(current_price, component_ema, momentum)
            
            # Calculate confidence based on data quality
            confidence = self._calculate_confidence(market_data, volatility)
            
            # Calculate price range (±1.5 * volatility)
            price_range = {
                'low': max(predicted_price - 1.5 * volatility, 0.01),
                'high': min(predicted_price + 1.5 * volatility, 0.99)
            }
            
            # Generate reasoning
            reasoning = self._generate_reasoning(
                current_price, predicted_price, confidence, direction, momentum
            )
            
            return {
                'predicted_price': float(predicted_price),
                'direction': direction,
                'confidence': float(confidence),
                'price_range': {
                    'low': float(price_range['low']),
                    'high': float(price_range['high'])
                },
                'reasoning': reasoning,
                'model_type': 'statistical'
            }
        
        except Exception as e:
            logger.error(f"Prediction error: {e}")
            return self._fallback_prediction(market_data)
    
    def _determine_direction(self, current: float, predicted: float, momentum: float) -> str:
        """Determine direction: up/down/stable."""
        if abs(predicted - current) < 0.02:
            return 'stable'
        elif predicted > current:
            return 'up'
        else:
            return 'down'
    
    def _calculate_confidence(self, market_data: Dict, volatility: float) -> float:
        """
        Calculate confidence based on data quality.
        
        - liquidity > 1000 → +0.3
        - volatility available → +0.2
        - no unusual spread → +0.3
        - EV available → +0.2
        """
        confidence = 0.0
        
        # Liquidity factor (0.3)
        liquidity = market_data.get('liquidity', 0)
        if liquidity > 1000:
            confidence += 0.3
        elif liquidity > 500:
            confidence += 0.2
        elif liquidity > 100:
            confidence += 0.1
        
        # Volatility factor (0.2)
        if volatility is not None and volatility > 0:
            confidence += 0.2
        
        # Spread factor (0.3)
        spread = market_data.get('spread', 0.1)
        if spread < 0.05:
            confidence += 0.3
        elif spread < 0.1:
            confidence += 0.2
        elif spread < 0.2:
            confidence += 0.1
        
        # Expected value factor (0.2)
        ev = market_data.get('expected_value')
        if ev is not None:
            confidence += 0.2
        
        return min(confidence, 0.95)
    
    def _generate_reasoning(
        self,
        current: float,
        predicted: float,
        confidence: float,
        direction: str,
        momentum: float
    ) -> str:
        """Generate human-readable reasoning."""
        change_pct = (predicted - current) * 100
        
        if direction == 'stable':
            reasoning = f"Price expected to remain stable (±2%). Current: {current*100:.1f}%, Predicted: {predicted*100:.1f}%"
        else:
            arrow = "↑" if direction == 'up' else "↓"
            reasoning = f"{arrow} {direction.upper()} signal: {abs(change_pct):.1f}% change expected. "
            reasoning += f"Current: {current*100:.1f}%, Predicted: {predicted*100:.1f}%"
        
        reasoning += f". Confidence: {confidence*100:.0f}%"
        
        if abs(momentum) > 0.3:
            reasoning += f". Strong momentum detected."
        
        return reasoning
    
    def _fallback_prediction(self, market_data: Dict) -> Dict:
        """Fallback prediction when model fails."""
        current_price = float(market_data.get('yes_price') or 0.5)
        return {
            'predicted_price': float(current_price),
            'direction': 'stable',
            'confidence': 0.3,
            'price_range': {
                'low': float(max(current_price - 0.1, 0.01)),
                'high': float(min(current_price + 0.1, 0.99))
            },
            'reasoning': 'Unable to generate prediction. Using current price as estimate.',
            'model_type': 'statistical'
        }
