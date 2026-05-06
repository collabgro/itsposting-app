#!/bin/bash

# PostFlow Installation Script
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "================================================"
echo "  🚀 PostFlow Installation"
echo "================================================"
echo ""

# Check Node.js
echo -n "Checking Node.js... "
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗${NC} Not found"
    echo "Please install Node.js 18+ from https://nodejs.org"
    exit 1
fi
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}✗${NC} Need Node.js 18+, found $(node -v)"
    exit 1
fi
echo -e "${GREEN}✓${NC} $(node -v)"

# Check PostgreSQL
echo -n "Checking PostgreSQL... "
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}⚠${NC} Not found - you'll need to install it or use a remote DB"
else
    echo -e "${GREEN}✓${NC} $(psql --version | head -1)"
fi

# Install dependencies
echo ""
echo "Installing dependencies..."
echo ""

echo "→ Root..."
npm install --silent

echo "→ Backend..."
cd backend && npm install --silent && cd ..

echo "→ Frontend..."
cd frontend && npm install --silent && cd ..

echo -e "${GREEN}✓${NC} All dependencies installed"

# Setup .env
echo ""
if [ ! -f "backend/.env" ]; then
    cp backend/.env.example backend/.env
    echo -e "${GREEN}✓${NC} Created backend/.env from template"
    echo ""
    echo -e "${YELLOW}⚠ IMPORTANT:${NC} Edit backend/.env with your API keys:"
    echo "  - ANTHROPIC_API_KEY (required)"
    echo "  - GOOGLE_AI_API_KEY (for NanoBanana - recommended)"
    echo "  - CLOUDINARY_* (required for image storage)"
    echo "  - REPLICATE_API_TOKEN (optional, for Midjourney)"
    echo "  - HEYGEN_API_KEY (optional, for videos)"
else
    echo -e "${GREEN}✓${NC} backend/.env already exists"
fi

# Database setup
echo ""
read -p "Set up PostgreSQL database now? (y/n) " setup_db

if [[ "$setup_db" =~ ^[Yy]$ ]]; then
    echo "Creating database 'socialmedia'..."
    createdb socialmedia 2>/dev/null || echo "Database already exists"
    
    echo "Running schema..."
    psql -d socialmedia -f backend/db/schema.sql
    echo -e "${GREEN}✓${NC} Database ready"
fi

echo ""
echo "================================================"
echo -e "${GREEN}  ✓ Installation Complete!${NC}"
echo "================================================"
echo ""
echo "Next steps:"
echo "  1. Edit backend/.env with your API keys"
echo "  2. Run: npm run dev"
echo "  3. Open: http://localhost:3000"
echo ""
echo "API keys you'll need:"
echo "  • Anthropic:    https://console.anthropic.com"
echo "  • Google AI:    https://aistudio.google.com/app/apikey  (NanoBanana 🍌)"
echo "  • Cloudinary:   https://cloudinary.com  (free 25GB)"
echo "  • Replicate:    https://replicate.com  (optional - Midjourney)"
echo "  • HeyGen:       https://app.heygen.com  (optional - videos)"
echo ""
