"""
API endpoints for AI-powered features.

Provides access to:
- Statistical price predictions
- Sentiment analysis
- Anomaly detection
- Trading signals
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Optional, Any
import logging

from ..ml.price_predictor import PricePredictor
from ..ml.sentiment_analyzer import SentimentAnalyzer
from ..ml.anomaly_detector import AnomalyDetector
from ..ml.trading_agent import TradingAgent
from ..services.market_service import MarketService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI Features"])

# Initialize AI models (singleton instances)
price_predictor = PricePredictor()
sentiment_analyzer = SentimentAnalyzer()
anomaly_detector = AnomalyDetector()
trading_agent = TradingAgent()
market_service = MarketService()


@router.get("/status")
async def get_ai_status():
    """
    Get status of AI features.
    
    Returns information about:
    - Model type (statistical)
    - GPU availability (none required)
    - Available features
    """
    return {
        "status": "operational",
        "model_type": "statistical",
        "gpu": False,
        "features": [
            "price_prediction",
            "sentiment_analysis",
            "anomaly_detection",
            "trading_signals"
        ]
    }


@router.get("/predict/{market_id}")
async def predict_market_price(market_id: str):
    """
    Predict future price movement for a specific market.
    
    Uses statistical analysis to predict:
    - Price direction (up/down/stable)
    - Predicted price level
    - Confidence level
    - Price range estimate
    """
    try:
        # Get market data
        market_data = await market_service.get_market_by_id(market_id)
        
        if not market_data:
            raise HTTPException(status_code=404, detail="Market not found")
        
        # Make prediction
        prediction = price_predictor.predict(market_data)
        
        return {
            "market_id": market_id,
            "market_question": market_data.get("title", "Unknown"),
            "prediction": prediction
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Prediction error for market {market_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/predict/batch")
async def predict_batch_markets(market_ids: List[str]):
    """
    Batch prediction for multiple markets.
    """
    try:
        predictions = []
        
        for market_id in market_ids:
            market_data = await market_service.get_market_by_id(market_id)
            if market_data:
                prediction = price_predictor.predict(market_data)
                predictions.append({
                    "market_id": market_id,
                    "prediction": prediction
                })
        
        return {
            "predictions": predictions,
            "total": len(predictions)
        }
    
    except Exception as e:
        logger.error(f"Batch prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sentiment/{market_id}")
async def analyze_market_sentiment(market_id: str):
    """
    Analyze market sentiment using rule-based NLP.
    
    Analyzes:
    - Text sentiment (bullish/bearish/neutral)
    - Market sentiment score from data
    - Key topics and signals
    - Uncertainty levels
    """
    try:
        market_data = await market_service.get_market_by_id(market_id)
        
        if not market_data:
            raise HTTPException(status_code=404, detail="Market not found")
        
        # Use market title for text analysis
        text = market_data.get('title', '')
        
        # Analyze sentiment
        sentiment = sentiment_analyzer.analyze(text, market_data)
        
        return {
            "market_id": market_id,
            "market_question": market_data.get("title", "Unknown"),
            "sentiment_analysis": sentiment
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Sentiment analysis error for market {market_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/anomaly/{market_id}")
async def detect_market_anomaly(market_id: str):
    """
    Detect anomalies in market behavior.
    
    Detects:
    - Extreme prices
    - Wide spreads
    - Low liquidity
    - Volume spikes
    - Orderbook imbalances
    - High slippage
    """
    try:
        market_data = await market_service.get_market_by_id(market_id)
        
        if not market_data:
            raise HTTPException(status_code=404, detail="Market not found")
        
        # Detect anomalies
        anomaly = anomaly_detector.detect(market_data)
        
        return {
            "market_id": market_id,
            "market_question": market_data.get("title", "Unknown"),
            "anomaly_detection": anomaly
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Anomaly detection error for market {market_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/anomalies")
async def detect_all_anomalies(limit: int = Query(50, ge=1, le=500)):
    """
    Scan all markets for anomalies.
    
    Returns markets with detected anomalies sorted by severity.
    """
    try:
        markets = await market_service.get_markets(
            MarketFilter(limit=limit)
        )
        
        anomalies = []
        for market in markets:
            anomaly = anomaly_detector.detect(market)
            if anomaly.get('is_anomaly'):
                anomaly['market_id'] = market.get('market_id')
                anomaly['market_question'] = market.get('title')
                anomalies.append(anomaly)
        
        # Sort by severity
        severity_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
        anomalies.sort(key=lambda x: severity_order.get(x.get('severity', 'low'), 4))
        
        return {
            "anomalies": anomalies,
            "total_scanned": len(markets),
            "anomalies_detected": len(anomalies)
        }
    
    except Exception as e:
        logger.error(f"Batch anomaly detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/trading-signal/{market_id}")
async def get_trading_signal(market_id: str):
    """
    Generate AI-powered trading signal for a market.
    
    Combines:
    - Price prediction
    - Sentiment analysis
    - Anomaly detection
    - Risk assessment
    
    Returns: BUY, SELL, or HOLD recommendation with confidence and reasoning.
    """
    try:
        market_data = await market_service.get_market_by_id(market_id)
        
        if not market_data:
            raise HTTPException(status_code=404, detail="Market not found")
        
        # Generate signal
        signal = trading_agent.generate_signal(market_data)
        
        return {
            "market_id": market_id,
            "market_question": market_data.get("title", "Unknown"),
            "trading_signal": signal
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Trading signal error for market {market_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/trading-signals")
async def get_all_trading_signals(limit: int = Query(20, ge=1, le=100)):
    """
    Generate trading signals for multiple markets.
    
    Returns signals sorted by confidence.
    """
    try:
        markets = await market_service.get_markets(
            MarketFilter(limit=limit)
        )
        signals = []
        
        for market in markets:
            signal = trading_agent.generate_signal(market)
            signal['market_id'] = market.get('market_id')
            signal['market_question'] = market.get('title')
            signals.append(signal)
        
        # Sort by confidence
        signals.sort(key=lambda x: x.get('confidence', 0), reverse=True)
        
        return {
            "signals": signals,
            "total": len(signals)
        }
    
    except Exception as e:
        logger.error(f"Batch trading signals error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/opportunities")
async def get_top_opportunities(
    limit: int = Query(10, ge=1, le=50),
    min_confidence: float = Query(0.5, ge=0.0, le=1.0)
):
    """
    Find top trading opportunities using AI analysis.
    
    Filters and ranks markets by:
    - High confidence signals
    - Acceptable risk levels
    
    Returns the best opportunities for trading.
    """
    try:
        # Get larger pool of markets
        markets = await market_service.get_markets(
            MarketFilter(limit=limit * 5)
        )
        
        signals = []
        for market in markets:
            signal = trading_agent.generate_signal(market)
            signal['market_id'] = market.get('market_id')
            signal['market_question'] = market.get('title')
            signals.append(signal)
        
        # Filter by minimum confidence and non-critical risk
        filtered = [
            s for s in signals
            if s.get('confidence', 0) >= min_confidence and s.get('risk_level') != 'CRITICAL'
        ]
        
        # Sort by confidence
        filtered.sort(key=lambda x: x.get('confidence', 0), reverse=True)
        
        return {
            "opportunities": filtered[:limit],
            "total_analyzed": len(markets),
            "opportunities_found": len(filtered)
        }
    
    except Exception as e:
        logger.error(f"Opportunities detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/model-info")
async def get_model_info():
    """
    Get information about AI models.
    
    Returns model type and configuration details.
    """
    return {
        "status": "operational",
        "model_type": "statistical",
        "gpu": False,
        "features": {
            "price_predictor": {
                "type": "statistical",
                "method": "weighted blend of current price, fair value, EMA slope, and mean reversion",
                "training": "Not required - works immediately"
            },
            "sentiment_analyzer": {
                "type": "rule-based NLP",
                "method": "keyword matching with market data integration",
                "training": "Not required"
            },
            "anomaly_detector": {
                "type": "rule-based thresholds",
                "method": "statistical anomaly detection",
                "training": "Not required"
            },
            "trading_agent": {
                "type": "composite",
                "method": "combines all three models with weighted scoring",
                "training": "Not required"
            }
        }
    }


# Import MarketFilter for the endpoints
from ..models.market import MarketFilter
