#!/bin/bash
# Start Backend Server Script

echo "🚀 Starting Polymarket Dashboard Backend..."
echo ""

# Navigate to backend directory
cd "$(dirname "$0")/backend"

# Check if we should use the existing env
if [ -d "../../env/bin" ]; then
    echo "✅ Using existing Python environment from workspace"
    PYTHON_BIN="../../env/bin/python3"
    PIP_BIN="../../env/bin/pip"
else
    echo "⚠️  Creating new virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    PYTHON_BIN="python3"
    PIP_BIN="pip"
fi

# Install dependencies if needed
echo ""
echo "📦 Checking dependencies..."
$PYTHON_BIN -c "import fastapi" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "Installing required packages (this may take 2-3 minutes)..."
    $PIP_BIN install fastapi uvicorn[standard] python-multipart websockets pydantic-settings aiofiles
fi

# Create .env if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
fi

# Start the server
echo ""
echo "🎯 Starting FastAPI server on http://localhost:8000"
echo "📚 API Docs will be at http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop the server"
echo "=================================================="
echo ""

$PYTHON_BIN -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
