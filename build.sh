#!/bin/bash
# Build script for Firefox addon
# Creates a signed XPI file ready for distribution

set -e

if ! command -v web-ext &> /dev/null; then
    echo "Error: web-ext not found. Install with: npm install -g web-ext"
    exit 1
fi

# Check for API credentials
if [ -z "$MOZILLA_API_KEY" ] || [ -z "$MOZILLA_API_SECRET" ]; then
    echo "Error: MOZILLA_API_KEY and MOZILLA_API_SECRET must be set"
    echo ""
    echo "Get credentials from: https://addons.mozilla.org/developers/addon/api/key/"
    echo ""
    echo "Then run:"
    echo "  export MOZILLA_API_KEY=your_key"
    echo "  export MOZILLA_API_SECRET=your_secret"
    echo "  ./build.sh"
    exit 1
fi

# Build dist first
node build.js

echo "Building and signing addon..."
web-ext sign \
    --api-key="$MOZILLA_API_KEY" \
    --api-secret="$MOZILLA_API_SECRET" \
    --channel=unlisted \
    --ignore-files="build.sh" "bump-version.sh" ".github/**" "README.md" ".gitignore" "src/**" "build.js" "*.test.js" \
    --source-dir=./dist \
    --artifacts-dir=./web-ext-artifacts

XPI_FILE=$(ls -t web-ext-artifacts/*.xpi 2>/dev/null | head -1)

if [ -z "$XPI_FILE" ]; then
    echo "Error: Failed to create XPI file"
    exit 1
fi

echo ""
echo "Signed XPI created: $XPI_FILE"
echo ""
echo "Next steps:"
echo "1. Upload to your private cloud storage"
echo "2. Get a direct download link"
echo "3. Install in Firefox by opening the link"
echo ""
echo "Or install locally:"
echo "  firefox $XPI_FILE"
