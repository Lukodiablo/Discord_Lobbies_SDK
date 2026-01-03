#!/bin/bash

# Clean up script for Discord Lobbies SDK
# Removes all build artifacts, caches, and post-install dependencies
# IMPORTANT: Keeps native/node_modules since it's required for the build

echo "🧹 Cleaning up Discord VS Code Extension..."

# Remove npm artifacts (root only - NOT native/node_modules!)
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

# Remove native C++ build artifacts ONLY (NOT node_modules - those are needed for build!)
echo "🗑️  Removing native C++ build artifacts..."
rm -rf native/build/
rm -rf native/.node-gyp/

# Remove ESLint cache
echo "🗑️  Removing cache files..."
rm -f .eslintcache
rm -f .DS_Store
rm -rf **/.DS_Store

echo "✅ Cleanup complete!"
echo ""
echo "📋 Summary:"
echo "  ✓ npm dependencies removed (node_modules/)"
echo "  ✓ package-lock.json removed"
echo "  ✓ Build outputs removed (dist/)"
echo "  ✓ Rust artifacts removed (rust-native/target/)"
echo "  ✓ Native bindings removed (native/build/)"
echo "  ✓ Cache files removed"
echo "  ✓ native/node_modules PRESERVED (needed for ./auto.sh)"
echo ""
echo "💡 To rebuild, run:"
echo "  ./auto.sh"
