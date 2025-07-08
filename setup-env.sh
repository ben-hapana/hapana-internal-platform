#!/bin/bash

# Hapana Central Engineering Environment Setup Script

echo "🚀 Setting up Hapana Central Engineering Environment..."

# Check if .env.local exists
if [ -f ".env.local" ]; then
    echo "⚠️  .env.local already exists. Creating backup..."
    cp .env.local .env.local.backup
fi

# Copy from example
cp env.example .env.local

echo "✅ Created .env.local from env.example"

# Set the correct Playwright directory
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s|PLAYWRIGHT_TESTS_DIR=.*|PLAYWRIGHT_TESTS_DIR=$PWD/../playwright|" .env.local
else
    # Linux
    sed -i "s|PLAYWRIGHT_TESTS_DIR=.*|PLAYWRIGHT_TESTS_DIR=$PWD/../playwright|" .env.local
fi

echo "✅ Updated Playwright directory path"

echo ""
echo "🔧 Next steps:"
echo "1. Edit .env.local and add your API credentials:"
echo "   - Firebase configuration"
echo "   - OpenAI API key"
echo "   - HappyFox API credentials"
echo "   - Jira API credentials"
echo ""
echo "2. Install dependencies:"
echo "   npm install --legacy-peer-deps"
echo ""
echo "3. Install Playwright browsers (if needed):"
echo "   cd ../playwright && npm install"
echo ""
echo "4. Start the development server:"
echo "   npm run dev"
echo ""
echo "📝 See README-PLATFORM.md for detailed setup instructions" 