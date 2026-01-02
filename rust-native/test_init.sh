#!/bin/bash

# Discord SDK Path Finder - ROBUST VERSION
# Supports DISCORD_SDK_PATH environment variable

# Priority 1: Environment variable
if [ -n "$DISCORD_SDK_PATH" ]; then
    if [ -d "$DISCORD_SDK_PATH" ]; then
        SDK_DIR="$DISCORD_SDK_PATH"
    fi
fi

# Priority 2: Local project directory
if [ -z "$SDK_DIR" ]; then
    # Look for discord_social_sdk folder first
    if [ -d "discord_social_sdk" ]; then
        SDK_DIR="discord_social_sdk"
    else
        # Look for DiscordSocialSdk-* folders and use the newest
        SDK_DIR=$(ls -1d DiscordSocialSdk-* 2>/dev/null | sort -V | tail -1)
    fi
fi

# Priority 3: Common system locations
if [ -z "$SDK_DIR" ]; then
    for location in /opt/discord-sdk /usr/local/discord-sdk "$HOME/.discord-sdk"; do
        if [ -d "$location" ]; then
            SDK_DIR="$location"
            break
        fi
    done
fi

# Check if SDK was found
if [ -z "$SDK_DIR" ] || [ ! -d "$SDK_DIR" ]; then
    echo "❌ Error: Discord Social SDK not found!"
    echo ""
    echo "Searched locations:"
    echo "  • Current directory: discord_social_sdk"
    echo "  • Current directory: DiscordSocialSdk-*"
    echo "  • /opt/discord-sdk"
    echo "  • /usr/local/discord-sdk"
    echo "  • ~/.discord-sdk"
    echo ""
    echo "Solutions:"
    echo "  1. Set DISCORD_SDK_PATH environment variable:"
    echo "     export DISCORD_SDK_PATH=/path/to/discord_social_sdk"
    echo ""
    echo "  2. Place SDK in current directory"
    echo ""
    exit 1
fi

# Detect platform and architecture
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    ARCH=$(uname -m)
    if [ "$ARCH" = "aarch64" ]; then
        LIB_PATH="$SDK_DIR/lib/release/arm64"
        # Fallback to standard path if arm64 not available
        if [ ! -d "$LIB_PATH" ]; then
            LIB_PATH="$SDK_DIR/lib/release"
        fi
    else
        LIB_PATH="$SDK_DIR/lib/release"
    fi
elif [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    LIB_PATH="$SDK_DIR/lib/release"
else
    echo "⚠️  Unsupported platform: $OSTYPE"
    exit 1
fi

# Validate lib path
if [ ! -d "$LIB_PATH" ]; then
    echo "❌ Error: SDK lib path not found: $LIB_PATH"
    echo "Available SDK structure:"
    find "$SDK_DIR" -maxdepth 2 -type d 2>/dev/null | head -10
    exit 1
fi

echo "✓ Using Discord SDK: $SDK_DIR"
echo "✓ Library path: $LIB_PATH"
echo ""

export LD_LIBRARY_PATH="$LIB_PATH:$LD_LIBRARY_PATH"
(echo '{"id":1,"command":"initialize","args":{"token":"MTQ0NjgyMTg3OTA5NTc1ODk2MA.uMfDDo3VSsLAtv2eEQ3ZisH4mSP8t7"}}'; sleep 1; echo '{"id":2,"command":"get_guilds","args":null}'; sleep 1) | timeout 5 ./target/release/discord-extension
echo "Exit code: $?"
