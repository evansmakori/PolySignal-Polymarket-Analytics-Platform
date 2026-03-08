"""
Rule-Based Anomaly Detection for Polymarket.

Detects market anomalies using statistical thresholds - no sklearn required.
Works immediately with real market data.
"""

import numpy as np
from typing import Dict, List, Optional
import logging

logger = logging.getLogger(__name__)


class AnomalyDetector:
    """
    Rule-based anomaly detection for prediction markets.
    
    Detects:
    - extreme_price: yes_price < 0.03 or > 0.97
    - wide_spread: spread > 0.08
    - low_liquidity: liquidity < 500
    - volume_spike: volume_24h > 3x historical avg
    - orderbook_imbalance_extreme: abs(imbalance) > 0.7
    - slippage_high: slippage_bps > 200
    """
    
    def __init__(self):
        """Initialize the anomaly detector."""
        logger.info("AnomalyDetector initialized (rule-based mode)")
    
    def detect(self, market_data: Dict, history: Optional[List[Dict]] = None) -> Dict:
        """
        Detect anomalies in market data.
        
        Args:
            market_data: Current market data
            history: Optional historical data for comparison
        
        Returns:
            Dictionary with:
            - is_anomaly: bool
            - severity: 'low'/'medium'/'high'/'critical'
            - anomaly_score: float 0-1
            - anomaly_types: list of detected anomaly types
            - alerts: list of human-readable alert strings
            - reasoning: str
        """
        try:
            # Detect specific anomalies
            anomaly_types = []
            alerts = []
            anomaly_score = 0.0
            
            # 1. Extreme price
            yes_price = market_data.get('yes_price', 0.5)
            if yes_price < 0.03 or yes_price > 0.97:
                anomaly_types.append('extreme_price')
                alerts.append(f"Extreme price detected: {yes_price*100:.1f}%")
                anomaly_score += 0.3
            
            # 2. Wide spread
            spread = market_data.get('spread', 0.1)
            if spread > 0.08:
                anomaly_types.append('wide_spread')
                alerts.append(f"Very wide spread: {spread*100:.1f}%")
                anomaly_score += 0.25
            
            # 3. Low liquidity
            liquidity = market_data.get('liquidity', 0)
            if liquidity < 500:
                anomaly_types.append('low_liquidity')
                alerts.append(f"Low liquidity: ${liquidity:,.0f}")
                anomaly_score += 0.2
            
            # 4. Volume spike (requires history)
            volume_24h = market_data.get('volume_24h', 0)
            if history and len(history) > 0:
                avg_volume = np.mean([m.get('volume_24h', 0) for m in history])
                if volume_24h > avg_volume * 3 and avg_volume > 0:
                    anomaly_types.append('volume_spike')
                    alerts.append(f"Volume spike: {volume_24h:,.0f} ({volume_24h/avg_volume:.1f}x avg)")
                    anomaly_score += 0.25
            
            # 5. Extreme orderbook imbalance
            imbalance = market_data.get('orderbook_imbalance') or 0.0
            if abs(imbalance) > 0.7:
                anomaly_types.append('orderbook_imbalance_extreme')
                alerts.append(f"Extreme orderbook imbalance: {imbalance:.2f}")
                anomaly_score += 0.2
            
            # 6. High slippage
            slippage_bps = market_data.get('slippage_bps', 0)
            if slippage_bps and slippage_bps > 200:
                anomaly_types.append('slippage_high')
                alerts.append(f"High slippage: {slippage_bps} basis points")
                anomaly_score += 0.15
            
            # Normalize anomaly score
            anomaly_score = min(anomaly_score, 1.0)
            
            # Determine severity
            severity = self._calculate_severity(anomaly_score, len(anomaly_types))
            
            # Determine if it's an anomaly
            is_anomaly = len(anomaly_types) > 0 or anomaly_score > 0.3
            
            # Generate reasoning
            reasoning = self._generate_reasoning(anomaly_types, alerts, severity, is_anomaly)
            
            return {
                'is_anomaly': is_anomaly,
                'severity': severity,
                'anomaly_score': float(anomaly_score),
                'anomaly_types': anomaly_types,
                'alerts': alerts,
                'reasoning': reasoning
            }
        
        except Exception as e:
            logger.error(f"Anomaly detection error: {e}")
            return self._fallback_result()
    
    def _calculate_severity(self, anomaly_score: float, type_count: int) -> str:
        """
        Calculate severity based on score and number of anomaly types.
        
        - critical: score > 0.8 OR 4+ anomaly types
        - high: score > 0.6 OR 3 anomaly types
        - medium: score > 0.3 OR 2 anomaly types
        - low: otherwise
        """
        if anomaly_score > 0.8 or type_count >= 4:
            return 'critical'
        elif anomaly_score > 0.6 or type_count >= 3:
            return 'high'
        elif anomaly_score > 0.3 or type_count >= 2:
            return 'medium'
        else:
            return 'low'
    
    def _generate_reasoning(
        self,
        anomaly_types: List[str],
        alerts: List[str],
        severity: str,
        is_anomaly: bool
    ) -> str:
        """Generate human-readable explanation."""
        if not is_anomaly:
            return "No anomalies detected. Market behavior appears normal."
        
        reasoning = f"ANOMALY DETECTED ({severity.upper()}). "
        
        if anomaly_types:
            reasoning += f"Types: {', '.join(anomaly_types)}. "
        
        if alerts:
            reasoning += f"Details: {' | '.join(alerts)}"
        
        return reasoning
    
    def _fallback_result(self) -> Dict:
        """Return fallback result when detection fails."""
        return {
            'is_anomaly': False,
            'severity': 'low',
            'anomaly_score': 0.0,
            'anomaly_types': [],
            'alerts': [],
            'reasoning': 'Unable to perform anomaly detection.'
        }
