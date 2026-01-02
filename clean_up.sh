#!/bin/bash

# Clean up script for Discord Lobbies SDK
# Removes all build artifacts, caches, and post-install dependencies
# Keeps the codebase in a clean state

echo "🧹 Cleaning up Discord VS Code Extension..."

# Remove npm artifacts
echo "🗑️  Removing npm artifacts..."
rm -rf node_modules/
rm -f package-lock.json

# Remove TypeScript/build outputs
echo "🗑️  Removing build outputs..."
rm -rf dist/
rm -f dist/**

# Remove Rust build artifacts
echo "🗑️  Removing Rust build artifacts..."
rm -rf rust-native/target/
rm -f rust-native/Cargo.lock

# Remove native C++ build artifacts
echo "🗑️  Removing native C++ build artifacts..."
rm -rf native/build/
rm -rf native/.node-gyp/

# Remove ESLint cache
echo "🗑️  Removing cache files..."
rm -f .eslintcache
rm -f .DS_Store
rm -rf **/.DS_Store

# Remove any VSIX files (optional - comment out if you want to keep them)
# rm -f *.vsix

echo "✅ Cleanup complete!"
echo ""
echo "📋 Summary:"
echo "  ✓ npm dependencies removed (node_modules/)"
echo "  ✓ package-lock.json removed"
echo "  ✓ Build outputs removed (dist/)"
echo "  ✓ Rust artifacts removed (rust-native/target/)"
echo "  ✓ Native bindings removed (native/build/)"
echo "  ✓ Cache files removed"
echo ""
echo "💡 To rebuild, run:"
echo "  ./auto.sh"
