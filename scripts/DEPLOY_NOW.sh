#!/bin/bash
# DigitalOcean Deployment Script for Polymarket AI Predictor
# This script will guide you through deploying to DigitalOcean

set -e

echo "🚀 DigitalOcean Deployment Script"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check if doctl is installed
echo -e "${BLUE}Step 1: Checking for doctl CLI...${NC}"
if command -v doctl &> /dev/null; then
    echo -e "${GREEN}✓ doctl is installed${NC}"
    doctl version
else
    echo -e "${YELLOW}⚠ doctl not found. Installing...${NC}"
    
    # Detect OS
    OS=$(uname -s)
    if [ "$OS" == "Darwin" ]; then
        # macOS
        if command -v brew &> /dev/null; then
            echo "Installing via Homebrew..."
            brew install doctl
        else
            echo -e "${RED}Error: Homebrew not found. Please install Homebrew first:${NC}"
            echo "https://brew.sh"
            exit 1
        fi
    elif [ "$OS" == "Linux" ]; then
        # Linux
        echo "Installing doctl for Linux..."
        cd ~
        wget https://github.com/digitalocean/doctl/releases/download/v1.98.1/doctl-1.98.1-linux-amd64.tar.gz
        tar xf doctl-1.98.1-linux-amd64.tar.gz
        sudo mv doctl /usr/local/bin
        rm doctl-1.98.1-linux-amd64.tar.gz
        echo -e "${GREEN}✓ doctl installed${NC}"
    else
        echo -e "${RED}Error: Unsupported OS. Please install doctl manually:${NC}"
        echo "https://docs.digitalocean.com/reference/doctl/how-to/install/"
        exit 1
    fi
fi

echo ""

# Step 2: Authenticate with DigitalOcean
echo -e "${BLUE}Step 2: Authenticating with DigitalOcean...${NC}"
echo ""
echo "You need a DigitalOcean API token."
echo "Get one here: https://cloud.digitalocean.com/account/api/tokens"
echo ""
read -p "Do you have a DigitalOcean API token? (y/n): " has_token

if [ "$has_token" != "y" ]; then
    echo ""
    echo -e "${YELLOW}Please follow these steps:${NC}"
    echo "1. Go to: https://cloud.digitalocean.com/account/api/tokens"
    echo "2. Click 'Generate New Token'"
    echo "3. Name: 'Hackathon Deploy'"
    echo "4. Scopes: Read + Write"
    echo "5. Copy the token"
    echo ""
    read -p "Press Enter when you have your token..."
fi

echo ""
echo "Authenticating..."
doctl auth init

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Authentication successful${NC}"
else
    echo -e "${RED}✗ Authentication failed${NC}"
    exit 1
fi

echo ""

# Step 3: Validate app.yaml exists
echo -e "${BLUE}Step 3: Validating configuration...${NC}"
if [ ! -f ".do/app.yaml" ]; then
    echo -e "${RED}Error: .do/app.yaml not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Configuration file found${NC}"

echo ""

# Step 4: Create the app
echo -e "${BLUE}Step 4: Creating app on DigitalOcean...${NC}"
echo ""
echo "This will:"
echo "  - Deploy backend API (Professional XS: \$12/month)"
echo "  - Deploy frontend (Basic XXS: \$5/month)"
echo "  - Total cost: ~\$17/month"
echo ""
read -p "Continue with deployment? (y/n): " continue_deploy

if [ "$continue_deploy" != "y" ]; then
    echo "Deployment cancelled."
    exit 0
fi

echo ""
echo "Creating app... (this may take 5-10 minutes)"
doctl apps create --spec .do/app.yaml --format ID,Spec.Name,DefaultIngress,ActiveDeployment.ID

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ App created successfully!${NC}"
else
    echo -e "${RED}✗ App creation failed${NC}"
    exit 1
fi

echo ""

# Step 5: Get app details
echo -e "${BLUE}Step 5: Getting app details...${NC}"
APP_ID=$(doctl apps list --format ID --no-header | head -1)

if [ -z "$APP_ID" ]; then
    echo -e "${RED}Error: Could not retrieve app ID${NC}"
    exit 1
fi

echo "App ID: $APP_ID"
echo ""

# Step 6: Monitor deployment
echo -e "${BLUE}Step 6: Monitoring deployment...${NC}"
echo ""
echo "You can monitor the deployment with:"
echo -e "${YELLOW}doctl apps logs $APP_ID --follow${NC}"
echo ""
echo "Or check the DigitalOcean console:"
echo -e "${YELLOW}https://cloud.digitalocean.com/apps/$APP_ID${NC}"
echo ""

# Wait for deployment to complete
echo "Waiting for initial deployment..."
sleep 30

# Get app details
echo ""
echo -e "${BLUE}Checking deployment status...${NC}"
doctl apps get $APP_ID --format ID,Spec.Name,DefaultIngress,ActiveDeployment.Phase

echo ""

# Step 7: Get live URLs
echo -e "${GREEN}==================================${NC}"
echo -e "${GREEN}🎉 DEPLOYMENT STARTED!${NC}"
echo -e "${GREEN}==================================${NC}"
echo ""
echo "Your app is being deployed!"
echo ""
echo "📊 View deployment progress:"
echo "   https://cloud.digitalocean.com/apps/$APP_ID"
echo ""
echo "📝 View logs:"
echo "   doctl apps logs $APP_ID --follow"
echo ""
echo "🔍 Check status:"
echo "   doctl apps get $APP_ID"
echo ""
echo "⏰ Deployment typically takes 5-10 minutes"
echo ""

# Save app ID for later
echo "$APP_ID" > .do/app_id.txt
echo "App ID saved to .do/app_id.txt"

echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Wait for deployment to complete (~5-10 minutes)"
echo "2. Check: doctl apps get $APP_ID"
echo "3. Get your live URL from the console"
echo "4. Test the AI endpoints!"
echo ""
echo -e "${GREEN}Deployment initiated successfully! 🚀${NC}"
