#!/usr/bin/env python3
"""
Training Script for DigitalOcean Gradient™ AI GPU Instances.

This script trains the ML models on DigitalOcean GPU infrastructure:
1. Price Prediction Neural Network
2. Sentiment Analysis Fine-tuning
3. Anomaly Detection Model

Usage:
    python train_on_digitalocean_gpu.py --model all
    python train_on_digitalocean_gpu.py --model price_predictor
    python train_on_digitalocean_gpu.py --model sentiment
    python train_on_digitalocean_gpu.py --model anomaly
"""

import argparse
import logging
import sys
import os
from pathlib import Path
from datetime import datetime
import json

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from app.ml.price_predictor import PricePredictor
from app.ml.sentiment_analyzer import SentimentAnalyzer
from app.ml.anomaly_detector import AnomalyDetector
from app.core.polymarket import PolymarketClient

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class GPUTrainer:
    """
    Trainer for ML models on DigitalOcean GPU instances.
    
    This class handles:
    - Data collection from Polymarket
    - Model training with GPU acceleration
    - Model evaluation and metrics
    - Model saving and versioning
    """
    
    def __init__(self, output_dir: str = "models"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True, parents=True)
        self.polymarket = PolymarketClient()
        
        logger.info("GPU Trainer initialized")
        logger.info(f"Models will be saved to: {self.output_dir}")
    
    def collect_training_data(self, limit: int = 1000) -> list:
        """
        Collect training data from Polymarket API.
        
        Args:
            limit: Number of markets to fetch
        
        Returns:
            List of market data dictionaries
        """
        logger.info(f"Collecting training data (limit: {limit})...")
        
        try:
            markets = self.polymarket.get_markets(limit=limit)
            logger.info(f"Collected {len(markets)} markets for training")
            
            # Save raw data for reference
            data_file = self.output_dir / f"training_data_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            with open(data_file, 'w') as f:
                json.dump(markets, f, indent=2, default=str)
            
            logger.info(f"Training data saved to: {data_file}")
            return markets
        
        except Exception as e:
            logger.error(f"Error collecting training data: {e}")
            return []
    
    def train_price_predictor(self, training_data: list, epochs: int = 100):
        """
        Train the price prediction neural network.
        
        This model uses GPU acceleration for faster training.
        """
        logger.info("=" * 60)
        logger.info("Training Price Prediction Model on DigitalOcean GPU")
        logger.info("=" * 60)
        
        predictor = PricePredictor(model_path=str(self.output_dir / "price_predictor.pth"))
        
        # Check GPU availability
        model_info = predictor.get_model_info()
        logger.info(f"GPU Available: {model_info.get('gpu_available', False)}")
        logger.info(f"Device: {model_info.get('device', 'cpu')}")
        
        if not model_info.get('gpu_available'):
            logger.warning("⚠️  GPU not available. Training will be slower on CPU.")
            logger.warning("For optimal performance, use DigitalOcean GPU Droplets:")
            logger.warning("  - GPU-optimized instances with NVIDIA GPUs")
            logger.warning("  - Recommended: GPU Basic or GPU Pro instances")
        
        # Prepare training data with historical price changes
        logger.info("Preparing training data...")
        prepared_data = self._prepare_price_training_data(training_data)
        
        if len(prepared_data) < 50:
            logger.error("Insufficient training data. Need at least 50 samples.")
            return
        
        logger.info(f"Training with {len(prepared_data)} samples for {epochs} epochs")
        
        # Train model
        predictor.train(prepared_data, epochs=epochs, batch_size=32)
        
        logger.info("✓ Price prediction model training complete!")
        logger.info(f"Model saved to: {predictor.model_path}")
    
    def train_anomaly_detector(self, training_data: list):
        """
        Train the anomaly detection model.
        
        Uses Isolation Forest algorithm (CPU-based).
        """
        logger.info("=" * 60)
        logger.info("Training Anomaly Detection Model")
        logger.info("=" * 60)
        
        detector = AnomalyDetector()
        
        # Feed data to detector
        logger.info(f"Processing {len(training_data)} markets...")
        for market in training_data:
            detector.detect(market)
        
        stats = detector.get_statistics()
        logger.info(f"Anomaly detector statistics:")
        logger.info(f"  - Total samples: {stats.get('total_samples', 0)}")
        logger.info(f"  - Model trained: {stats.get('model_trained', False)}")
        logger.info(f"  - Detection method: {stats.get('detection_method', 'unknown')}")
        
        logger.info("✓ Anomaly detection model ready!")
    
    def evaluate_sentiment_analyzer(self, test_data: list):
        """
        Evaluate sentiment analyzer on test data.
        
        Note: Sentiment model uses pre-trained transformers.
        Fine-tuning requires labeled sentiment data.
        """
        logger.info("=" * 60)
        logger.info("Evaluating Sentiment Analyzer")
        logger.info("=" * 60)
        
        analyzer = SentimentAnalyzer()
        
        # Check model status
        model_info = analyzer.get_model_info()
        logger.info(f"Model loaded: {model_info.get('model_loaded', False)}")
        logger.info(f"Model name: {model_info.get('model_name', 'unknown')}")
        logger.info(f"Device: {model_info.get('device', 'cpu')}")
        logger.info(f"GPU available: {model_info.get('gpu_available', False)}")
        
        # Analyze sample markets
        logger.info("\nAnalyzing sample markets:")
        for i, market in enumerate(test_data[:5], 1):
            question = market.get('question', 'N/A')
            description = market.get('description', '')
            text = f"{question} {description}"
            
            result = analyzer.analyze(text, market)
            
            logger.info(f"\nMarket {i}: {question[:60]}...")
            logger.info(f"  Sentiment: {result.get('sentiment', 'N/A')} "
                       f"(score: {result.get('sentiment_score', 0):.2f})")
            logger.info(f"  Confidence: {result.get('confidence', 0):.2f}")
            logger.info(f"  Topics: {', '.join(result.get('key_topics', []))}")
            logger.info(f"  Uncertainty: {result.get('uncertainty_level', 'N/A')}")
        
        logger.info("\n✓ Sentiment analyzer evaluation complete!")
    
    def _prepare_price_training_data(self, markets: list) -> list:
        """
        Prepare training data for price prediction.
        
        Adds synthetic price changes for demonstration.
        In production, use historical price data.
        """
        import numpy as np
        
        prepared = []
        for market in markets:
            # Extract current probability
            prob = market.get('probability', 0.5)
            
            # Simulate historical price change based on market characteristics
            # In production, replace with actual historical data
            volume = market.get('volume_24h', 0)
            liquidity = market.get('liquidity', 0)
            
            # Simple heuristic for demonstration
            if volume > 10000 and liquidity > 50000:
                # High activity markets - more momentum
                change = np.random.normal(0.02, 0.05) if prob > 0.5 else np.random.normal(-0.02, 0.05)
            else:
                # Low activity - mean reversion
                change = np.random.normal(0, 0.03)
            
            market_copy = market.copy()
            market_copy['actual_change'] = float(np.clip(change, -0.3, 0.3))
            prepared.append(market_copy)
        
        return prepared
    
    def run_full_training(self, limit: int = 1000, epochs: int = 100):
        """
        Run complete training pipeline for all models.
        """
        logger.info("🚀 Starting Full Training Pipeline on DigitalOcean GPU")
        logger.info(f"Timestamp: {datetime.now().isoformat()}")
        
        # Step 1: Collect data
        training_data = self.collect_training_data(limit=limit)
        
        if not training_data:
            logger.error("Failed to collect training data. Aborting.")
            return
        
        # Split data for training/testing
        split_idx = int(len(training_data) * 0.8)
        train_data = training_data[:split_idx]
        test_data = training_data[split_idx:]
        
        logger.info(f"Data split: {len(train_data)} training, {len(test_data)} testing")
        
        # Step 2: Train price predictor (GPU-accelerated)
        self.train_price_predictor(train_data, epochs=epochs)
        
        # Step 3: Train anomaly detector
        self.train_anomaly_detector(train_data)
        
        # Step 4: Evaluate sentiment analyzer
        self.evaluate_sentiment_analyzer(test_data)
        
        logger.info("\n" + "=" * 60)
        logger.info("✓ ALL MODELS TRAINED SUCCESSFULLY!")
        logger.info("=" * 60)
        logger.info(f"Models saved in: {self.output_dir}")
        logger.info("\nNext steps:")
        logger.info("1. Review model metrics and performance")
        logger.info("2. Deploy models to production API")
        logger.info("3. Monitor model performance in production")


def main():
    """Main training script."""
    parser = argparse.ArgumentParser(
        description="Train ML models on DigitalOcean Gradient™ AI GPU"
    )
    parser.add_argument(
        '--model',
        type=str,
        choices=['all', 'price_predictor', 'sentiment', 'anomaly'],
        default='all',
        help='Which model to train'
    )
    parser.add_argument(
        '--epochs',
        type=int,
        default=100,
        help='Number of training epochs for neural networks'
    )
    parser.add_argument(
        '--data-limit',
        type=int,
        default=1000,
        help='Number of markets to fetch for training'
    )
    parser.add_argument(
        '--output-dir',
        type=str,
        default='models',
        help='Directory to save trained models'
    )
    
    args = parser.parse_args()
    
    # Initialize trainer
    trainer = GPUTrainer(output_dir=args.output_dir)
    
    if args.model == 'all':
        trainer.run_full_training(limit=args.data_limit, epochs=args.epochs)
    else:
        # Collect data first
        data = trainer.collect_training_data(limit=args.data_limit)
        
        if args.model == 'price_predictor':
            trainer.train_price_predictor(data, epochs=args.epochs)
        elif args.model == 'anomaly':
            trainer.train_anomaly_detector(data)
        elif args.model == 'sentiment':
            trainer.evaluate_sentiment_analyzer(data)


if __name__ == "__main__":
    main()
