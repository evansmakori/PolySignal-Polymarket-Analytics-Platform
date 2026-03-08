#!/usr/bin/env python3
"""
Test script for AI/ML features.

Tests all AI components to ensure they're working correctly:
- Price Predictor
- Sentiment Analyzer
- Anomaly Detector
- Trading Agent
"""

import sys
import json
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from app.ml.price_predictor import PricePredictor
from app.ml.sentiment_analyzer import SentimentAnalyzer
from app.ml.anomaly_detector import AnomalyDetector
from app.ml.trading_agent import TradingAgent

# ANSI color codes
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
BOLD = '\033[1m'
RESET = '\033[0m'

def print_header(text):
    """Print formatted header."""
    print(f"\n{BOLD}{BLUE}{'='*60}{RESET}")
    print(f"{BOLD}{BLUE}{text}{RESET}")
    print(f"{BOLD}{BLUE}{'='*60}{RESET}\n")

def print_success(text):
    """Print success message."""
    print(f"{GREEN}✓ {text}{RESET}")

def print_error(text):
    """Print error message."""
    print(f"{RED}✗ {text}{RESET}")

def print_info(text):
    """Print info message."""
    print(f"{YELLOW}ℹ {text}{RESET}")

def print_result(title, data):
    """Print formatted result."""
    print(f"\n{BOLD}{title}:{RESET}")
    print(json.dumps(data, indent=2))

# Sample market data for testing
SAMPLE_MARKET = {
    "id": "test_market_123",
    "question": "Will Bitcoin reach $100,000 by end of 2024?",
    "description": "This market resolves to YES if Bitcoin (BTC) trades at or above $100,000 USD on any major exchange before December 31, 2024, 23:59:59 UTC.",
    "probability": 0.65,
    "volume_24h": 125000,
    "liquidity": 250000,
    "spread": 0.02,
    "num_trades": 450,
    "volatility": 0.15,
    "created_at": "2024-01-01T00:00:00Z",
    "end_date": "2024-12-31T23:59:59Z"
}

def test_price_predictor():
    """Test ML Price Predictor."""
    print_header("Testing ML Price Predictor")
    
    try:
        predictor = PricePredictor()
        print_info("Price predictor initialized")
        
        # Get model info
        model_info = predictor.get_model_info()
        print_result("Model Info", model_info)
        
        # Make prediction
        prediction = predictor.predict(SAMPLE_MARKET)
        print_result("Prediction Result", prediction)
        
        # Validate prediction
        assert 'predicted_change' in prediction, "Missing predicted_change"
        assert 'confidence' in prediction, "Missing confidence"
        assert 'predicted_probability' in prediction, "Missing predicted_probability"
        
        print_success("Price Predictor: ALL TESTS PASSED")
        return True
        
    except Exception as e:
        print_error(f"Price Predictor Failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_sentiment_analyzer():
    """Test AI Sentiment Analyzer."""
    print_header("Testing AI Sentiment Analyzer")
    
    try:
        analyzer = SentimentAnalyzer()
        print_info("Sentiment analyzer initialized")
        
        # Get model info
        model_info = analyzer.get_model_info()
        print_result("Model Info", model_info)
        
        # Analyze market text
        market_text = SAMPLE_MARKET['question'] + ' ' + SAMPLE_MARKET['description']
        sentiment = analyzer.analyze(market_text, SAMPLE_MARKET)
        print_result("Sentiment Analysis", sentiment)
        
        # Validate sentiment
        assert 'sentiment' in sentiment, "Missing sentiment"
        assert 'sentiment_score' in sentiment, "Missing sentiment_score"
        assert 'confidence' in sentiment, "Missing confidence"
        assert 'key_topics' in sentiment, "Missing key_topics"
        
        print_success("Sentiment Analyzer: ALL TESTS PASSED")
        return True
        
    except Exception as e:
        print_error(f"Sentiment Analyzer Failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_anomaly_detector():
    """Test Anomaly Detector."""
    print_header("Testing Anomaly Detector")
    
    try:
        detector = AnomalyDetector()
        print_info("Anomaly detector initialized")
        
        # Get statistics
        stats = detector.get_statistics()
        print_result("Detector Stats", stats)
        
        # Detect anomalies
        anomaly = detector.detect(SAMPLE_MARKET)
        print_result("Anomaly Detection", anomaly)
        
        # Validate anomaly detection
        assert 'is_anomaly' in anomaly, "Missing is_anomaly"
        assert 'anomaly_score' in anomaly, "Missing anomaly_score"
        assert 'anomaly_types' in anomaly, "Missing anomaly_types"
        assert 'severity' in anomaly, "Missing severity"
        
        # Test with extreme values (should detect anomaly)
        extreme_market = SAMPLE_MARKET.copy()
        extreme_market['probability'] = 0.99
        extreme_market['spread'] = 0.25
        extreme_market['liquidity'] = 500
        
        extreme_anomaly = detector.detect(extreme_market)
        print_result("Extreme Market Anomaly", extreme_anomaly)
        
        print_success("Anomaly Detector: ALL TESTS PASSED")
        return True
        
    except Exception as e:
        print_error(f"Anomaly Detector Failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_trading_agent():
    """Test AI Trading Agent."""
    print_header("Testing AI Trading Agent")
    
    try:
        agent = TradingAgent()
        print_info("Trading agent initialized")
        
        # Get agent status
        status = agent.get_agent_status()
        print_result("Agent Status", status)
        
        # Generate trading signal
        signal = agent.generate_signal(SAMPLE_MARKET)
        print_result("Trading Signal", signal)
        
        # Validate signal
        assert 'signal' in signal, "Missing signal"
        assert signal['signal'] in ['BUY', 'SELL', 'HOLD'], "Invalid signal value"
        assert 'confidence' in signal, "Missing confidence"
        assert 'risk_level' in signal, "Missing risk_level"
        assert 'recommendation' in signal, "Missing recommendation"
        assert 'reasoning' in signal, "Missing reasoning"
        
        # Test batch generation
        markets = [SAMPLE_MARKET] * 3
        batch_signals = agent.batch_generate_signals(markets)
        print_result("Batch Signals", {"count": len(batch_signals), "signals": batch_signals[0]})
        
        print_success("Trading Agent: ALL TESTS PASSED")
        return True
        
    except Exception as e:
        print_error(f"Trading Agent Failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_integration():
    """Test integration of all components."""
    print_header("Testing Full Integration")
    
    try:
        print_info("Creating all components...")
        
        predictor = PricePredictor()
        analyzer = SentimentAnalyzer()
        detector = AnomalyDetector()
        agent = TradingAgent()
        
        print_success("All components initialized")
        
        # Test complete workflow
        print_info("Running complete analysis workflow...")
        
        # 1. Price prediction
        prediction = predictor.predict(SAMPLE_MARKET)
        print(f"  → Predicted change: {prediction['predicted_change']:.4f}")
        
        # 2. Sentiment analysis
        text = SAMPLE_MARKET['question'] + ' ' + SAMPLE_MARKET['description']
        sentiment = analyzer.analyze(text, SAMPLE_MARKET)
        print(f"  → Sentiment: {sentiment['sentiment']} ({sentiment['sentiment_score']:.2f})")
        
        # 3. Anomaly detection
        anomaly = detector.detect(SAMPLE_MARKET)
        print(f"  → Anomaly: {anomaly['is_anomaly']} (severity: {anomaly['severity']})")
        
        # 4. Trading signal
        signal = agent.generate_signal(SAMPLE_MARKET)
        print(f"  → Signal: {signal['signal']} (confidence: {signal['confidence']:.2f})")
        print(f"  → Risk: {signal['risk_level']}")
        print(f"  → Reasoning: {signal['reasoning'][0] if signal['reasoning'] else 'N/A'}")
        
        print_success("Full Integration: ALL TESTS PASSED")
        return True
        
    except Exception as e:
        print_error(f"Integration Test Failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_gpu_availability():
    """Test GPU availability."""
    print_header("Testing GPU Availability")
    
    try:
        import torch
        
        cuda_available = torch.cuda.is_available()
        device = torch.device("cuda" if cuda_available else "cpu")
        
        if cuda_available:
            gpu_count = torch.cuda.device_count()
            gpu_name = torch.cuda.get_device_name(0)
            print_success(f"GPU Available: {gpu_name}")
            print_info(f"GPU Count: {gpu_count}")
            print_info(f"Current Device: {device}")
            
            # Test GPU memory
            total_memory = torch.cuda.get_device_properties(0).total_memory / 1e9
            print_info(f"GPU Memory: {total_memory:.2f} GB")
        else:
            print_info("GPU Not Available - Running on CPU")
            print_info(f"Current Device: {device}")
        
        print_success("GPU Check: COMPLETED")
        return True
        
    except ImportError:
        print_error("PyTorch not installed")
        return False
    except Exception as e:
        print_error(f"GPU Check Failed: {e}")
        return False

def main():
    """Run all tests."""
    print(f"\n{BOLD}🤖 AI Features Test Suite{RESET}")
    print(f"{BOLD}DigitalOcean Gradient™ AI Hackathon{RESET}")
    print(f"{BOLD}Polymarket AI Predictor{RESET}\n")
    
    results = {
        "GPU Availability": test_gpu_availability(),
        "Price Predictor": test_price_predictor(),
        "Sentiment Analyzer": test_sentiment_analyzer(),
        "Anomaly Detector": test_anomaly_detector(),
        "Trading Agent": test_trading_agent(),
        "Integration Test": test_integration()
    }
    
    # Print summary
    print_header("Test Summary")
    
    passed = sum(1 for result in results.values() if result)
    total = len(results)
    
    for test_name, result in results.items():
        if result:
            print_success(f"{test_name}: PASSED")
        else:
            print_error(f"{test_name}: FAILED")
    
    print(f"\n{BOLD}Results: {passed}/{total} tests passed{RESET}")
    
    if passed == total:
        print(f"\n{GREEN}{BOLD}🎉 ALL TESTS PASSED! 🎉{RESET}")
        print(f"{GREEN}Your AI features are ready for deployment!{RESET}\n")
        return 0
    else:
        print(f"\n{RED}{BOLD}⚠️  SOME TESTS FAILED{RESET}")
        print(f"{RED}Please review the errors above{RESET}\n")
        return 1

if __name__ == "__main__":
    sys.exit(main())
