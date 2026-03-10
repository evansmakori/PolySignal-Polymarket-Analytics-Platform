#!/bin/bash
# Start Frontend Server Script

echo "🚀 Starting Polymarket Dashboard Frontend..."
echo ""

# Navigate to frontend directory
cd "$(dirname "$0")/frontend"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies (this may take 2-3 minutes)..."
    npm install
else
    echo "✅ Dependencies already installed"
fi

# Create .env if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
fi

# Start the dev server
echo ""
echo "🎯 Starting development server on http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop the server"
echo "=================================================="
echo ""

npm run dev
