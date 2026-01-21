#!/bin/bash

# Detect OS
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
    IS_WINDOWS=true
else
    IS_WINDOWS=false
fi

# Check for --clean flag
CLEAN_BUILD=false
if [[ "$1" == "--clean" ]]; then
    CLEAN_BUILD=true
fi

echo "🔨 Building Discord VS Code Extension..."
echo "📍 Detected OS: $([ "$IS_WINDOWS" = true ] && echo "Windows" || echo "Linux/macOS")"
if [ "$CLEAN_BUILD" = true ]; then
    echo "🧹 Clean build mode: removing all caches"
fi
echo ""

# ============================================================================
# CLEAN BUILD (if --clean flag passed)
# ============================================================================
if [ "$CLEAN_BUILD" = true ]; then
    echo "🧹 Cleaning build caches..."
    
    # Clean Rust cache
    echo "  • Cleaning Rust cache..."
    cd rust-native
    cargo clean 2>/dev/null || true
    cd ..
    
    # Clean npm caches
    echo "  • Cleaning npm caches..."
    rm -rf node_modules 2>/dev/null || true
    rm -rf native/node_modules 2>/dev/null || true
    rm -rf rust-native/node_modules 2>/dev/null || true
    
    # Clean build artifacts (but PRESERVE binaries in release directories!)
    echo "  • Cleaning build artifacts..."
    rm -rf dist 2>/dev/null || true
    rm -rf native/build 2>/dev/null || true
    # Only delete specific Rust build cache, PRESERVE all target/*/release/ binaries
    cd rust-native
    rm -rf target/debug 2>/dev/null || true
    # Delete only build artifacts in release dirs, keep the binaries themselves
    find target -type d \( -name "build" -o -name "deps" -o -name ".fingerprint" -o -name "incremental" \) -exec rm -rf {} + 2>/dev/null || true
    # Delete artifact files but NOT the executables
    find target -type f \( -name "*.d" -o -name "*.rlib" -o -name "*.pdb" \) -delete 2>/dev/null || true
    cd ..
    
    echo "✅ Cache cleaned"
    echo ""
fi

# ============================================================================
# STEP 1: Verify Discord SDK (Robust - supports env var and multiple locations)
# ============================================================================
echo "🔧 Verifying Discord SDK..."

SDK_FOUND=false
SDK_PATH=""

# Priority 1: Environment variable
if [ -n "$DISCORD_SDK_PATH" ]; then
    if [ -d "$DISCORD_SDK_PATH" ]; then
        SDK_PATH="$DISCORD_SDK_PATH"
        SDK_FOUND=true
    else
        echo "⚠️  DISCORD_SDK_PATH set but not found: $DISCORD_SDK_PATH"
    fi
fi

# Priority 2: Project root directory
if [ "$SDK_FOUND" = false ]; then
    # Look for discord_social_sdk folder first (from zip extraction)
    if [ -d "discord_social_sdk" ]; then
        SDK_PATH="discord_social_sdk"
        SDK_FOUND=true
    # Look for DiscordSocialSdk-* folders
    elif [ -d "DiscordSocialSdk-"* ]; then
        SDK_PATH=$(ls -1d DiscordSocialSdk-* 2>/dev/null | sort -V | tail -1)
        SDK_FOUND=true
    fi
fi

# Priority 3: Common system locations
if [ "$SDK_FOUND" = false ]; then
    for location in /opt/discord-sdk /usr/local/discord-sdk "$HOME/.discord-sdk"; do
        if [ -d "$location" ]; then
            SDK_PATH="$location"
            SDK_FOUND=true
            break
        fi
    done
fi

if [ "$SDK_FOUND" = true ]; then
    echo "✓ Discord SDK found: $SDK_PATH"
    
    # Verify structure
    if [ -d "$SDK_PATH/include" ] && [ -d "$SDK_PATH/lib" ]; then
        echo "✓ SDK structure verified (include/, lib/ directories present)"
    else
        echo "⚠️  Warning: SDK structure may be incomplete, but continuing..."
    fi
else
    echo "⚠️  Warning: Discord Social SDK not found"
    echo ""
    echo "   Searched locations:"
    echo "     • Project root: discord_social_sdk/"
    echo "     • Project root: DiscordSocialSdk-*/"
    echo "     • /opt/discord-sdk"
    echo "     • /usr/local/discord-sdk"
    echo "     • ~/.discord-sdk"
    echo ""
    echo "   To use SDK from different location, set environment variable:"
    echo "     export DISCORD_SDK_PATH=/path/to/discord_social_sdk"
    echo "     ./auto.sh"
    echo ""
    echo "   Continuing with build (may fail if SDK is required)..."
fi
echo ""

# ============================================================================
# STEP 2: Build Rust subprocess (rust-native/)
# ============================================================================
echo "📦 Building Rust subprocess (rust-native/)..."
cd rust-native

if [ "$IS_WINDOWS" = true ]; then
    echo "🪟 Windows detected: Running cargo build..."
    echo "   If this fails with 'corrupt metadata', run: ./auto.sh --clean"
    cargo build --release 2>&1
else
    echo "🐧 Linux/macOS detected: Running cargo build..."
    cargo build --release 2>&1
fi

if [ $? -ne 0 ]; then
    echo "❌ Rust build failed!"
    if [ "$IS_WINDOWS" = true ]; then
        echo "💡 Windows troubleshooting:"
        echo "   1. Run: ./auto.sh --clean"
        echo "   2. Then: ./auto.sh"
        echo "   3. If still failing: cd rust-native && cargo clean && cargo build --release"
    fi
    exit 1
fi
cd ..
echo "✅ Rust build complete"
echo ""

# ============================================================================
# STEP 3: Build Native C++ bindings (native/)
# ============================================================================
echo "📦 Building Native C++ bindings (native/)..."
cd native

# Install native dependencies first (node-addon-api)
echo "📥 Installing native dependencies..."
npm install

if [ "$IS_WINDOWS" = true ]; then
    echo "🪟 Windows detected: Using node-gyp..."
    # Clean old build
    npm run clean 2>/dev/null || true
    # Rebuild with node-gyp
    npm run rebuild
else
    echo "🐧 Linux/macOS detected: Using node-gyp..."
    npm run rebuild
fi

if [ $? -ne 0 ]; then
    echo "⚠️  Warning: Native build failed"
    if [ "$IS_WINDOWS" = true ]; then
        echo "💡 Windows troubleshooting:"
        echo "   1. Try: ./auto.sh --clean"
        echo "   2. Ensure Python 3 and MSVC build tools are installed"
        echo "   3. Run: npm config set python C:\\path\\to\\python.exe"
    fi
    echo "   Continuing with TypeScript build..."
fi
cd ..
echo "✅ Native build attempt complete"
echo ""

# ============================================================================
# STEP 4: Build TypeScript extension (root)
# ============================================================================
echo "📦 Building TypeScript extension..."

# Install root dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📥 Installing root dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "⚠️  Warning: npm install had issues, but continuing..."
    fi
fi

# Compile TypeScript
npm run compile
if [ $? -ne 0 ]; then
    echo "❌ TypeScript compilation failed!"
    exit 1
fi

# Bundle with esbuild
npm run esbuild
if [ $? -ne 0 ]; then
    echo "❌ TypeScript esbuild failed!"
    exit 1
fi
echo "✅ TypeScript build complete"
echo ""

# ============================================================================
# BUILD COMPLETE
# ============================================================================
echo "🎉 Build complete! Extension ready to use."
echo ""
echo "📋 Summary:"
echo "  ✓ Rust subprocess: rust-native/target/release/lobbies-sdk"
echo "  ✓ Native bindings: native/build/Release/discord_social_sdk.node"
echo "  ✓ Extension bundle: dist/extension.js"
echo ""
echo "To run the extension:"
echo "  1. Press F5 in VS Code to launch extension host"
echo "  2. Or run: code --extensionDevelopmentPath=$(pwd)"
echo ""
echo "💡 Usage:"
echo "  ./auto.sh           - Normal build"
echo "  ./auto.sh --clean   - Clean all caches and rebuild"
echo ""
echo "📚 Troubleshooting:"
if [ "$IS_WINDOWS" = true ]; then
    echo "  Windows users: If build fails with cache errors, always try:"
    echo "    ./auto.sh --clean"
    echo "  "
    echo "  For native build issues, ensure you have:"
    echo "    • Python 3 (https://www.python.org/)"
    echo "    • MSVC Build Tools (Visual Studio Build Tools)"
    echo "    • Node.js v18+ (https://nodejs.org/)"
else
    echo "  Linux users: If native build fails, install build tools:"
    echo "    sudo apt-get install build-essential python3"
    echo "  "
    echo "  macOS users: Ensure Xcode Command Line Tools are installed:"
    echo "    xcode-select --install"
fi

