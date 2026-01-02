# Discord Rust Extension - Native Social SDK Integration

**Status**: Initial Setup  
**Date**: December 8, 2025  
**Target**: VS Code Extension with native Discord Social SDK (no REST/Gateway APIs)

---

## 🎯 Architecture

This is a **Rust-first rewrite** of the Discord VS Code extension, replacing the Node.js/C++ addon approach with pure Rust FFI bindings to the native Discord Social SDK.

### Why Rust?

- **Memory Safety**: Eliminates entire classes of C++ compatibility issues
- **FFI Simplicity**: Cleaner bindings to C++ libraries than Node.js N-API
- **Performance**: Near-native speed with zero-cost abstractions
- **Single Binary**: Compile to single cross-platform binary
- **Better Async**: Native async/await with tokio

### Architecture Layers

```
┌─────────────────────────────────────────┐
│       VS Code Extension (TypeScript)    │
│       (Webviews, Commands, UI)          │
└────────────────┬────────────────────────┘
                 │ IPC / Node.js FFI
┌────────────────▼────────────────────────┐
│   Rust FFI Wrapper Library              │
│   (Safe Rust API around C++ SDK)        │
└────────────────┬────────────────────────┘
                 │ FFI / C Bindings
┌────────────────▼────────────────────────┐
│ Discord Social SDK (Official C++ lib)   │
│ • Status/Presence Management            │
│ • Direct Messaging                      │
│ • User/Channel/Guild Info               │
└─────────────────────────────────────────┘
```

---

## 📦 Project Structure

```
rust-native/
├── Cargo.toml              # Rust package manifest
├── build.rs                # Build script for C++ linking
├── Makefile                # Development convenience commands
├── .env                    # Discord credentials
├── src/
│   ├── lib.rs              # Main FFI bindings & safe wrappers
│   └── main.rs             # CLI test binary
└── target/                 # Build output
    ├── debug/
    │   └── libdiscord_social_sdk_rust.so
    └── release/
        └── discord_social_sdk_rust
```

---

## 🚀 Quick Start

### Prerequisites

```bash
# Install Rust (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Install C++ build tools
sudo apt-get install -y build-essential clang libstdc++-12-dev
```

### Build from Source

```bash
# Navigate to rust-native directory
cd rust-native

# Debug build
make build

# Release build (optimized)
make release

# Run tests
make test
```

### Run the CLI Tool

```bash
# Set up environment
source .env

# Run the Discord client
make run

# Or directly with cargo
cargo run --release
```

---

## 🔧 Development

### Building the Dynamic Library

For VS Code integration, build as a dynamic library:

```bash
cargo build --lib --release
# Output: target/release/libdiscord_social_sdk_rust.so
```

### FFI Bindings

The `src/lib.rs` file contains:

1. **C FFI Declarations** - Direct bindings to Discord Social SDK C++ functions
2. **Rust Wrapper Types** - Safe abstractions over raw FFI
3. **DiscordClientWrapper** - Main API for Rust consumers
4. **C Export Functions** - For calling from other languages (Node.js, etc.)

### Key APIs

```rust
// Create client
let client = DiscordClientWrapper::new(client_id)?;

// Connect to Discord
client.connect()?;

// Get authenticated user
let (user_id, username) = client.get_current_user()?;

// Get channels
let channels = client.get_channels()?;

// Send message
client.send_message(channel_id, "Hello Discord!")?;

// Set activity/rich presence
client.set_activity("Coding", "Building extension", "rust-logo")?;

// Disconnect
client.disconnect()?;
```

---

## 📋 Features (Planned)

- [x] FFI bindings to Discord Social SDK
- [x] Safe Rust wrapper API
- [x] User authentication
- [x] Channel enumeration
- [x] Rich presence/activity
- [x] Message sending
- [ ] Message receiving (callbacks)
- [ ] VS Code webview integration
- [ ] TypeScript bridge layer
- [ ] Full extension UI

---

## 🔗 Integration with VS Code Extension

### Current Status

The `src/` directory in the main discord-extension contains the TypeScript extension:
- `src/extension.ts` - Main VS Code activation
- `src/services/discordSocialSDK.ts` - Will call Rust FFI
- `src/views/` - UI components

### Next Steps

1. **Build Rust library** → `libdiscord_social_sdk_rust.so`
2. **Create Node.js bridge** → Bindings to call Rust from TypeScript
3. **Update discordSocialSDK.ts** → Use Rust-backed API
4. **Package extension** → Include .so binary

---

## 🐛 Troubleshooting

### "Cannot find Discord Social SDK"

Ensure the path in `build.rs` is correct:
```
/home/tester/Documents/discord-extension/DiscordSocialSdk-1.7.13152/
```

### Linking errors

Check that C++ runtime is available:
```bash
# Ubuntu/Debian
sudo apt-get install -y libstdc++-12-dev

# Check available libs
ls -la /usr/lib/x86_64-linux-gnu/libstdc++*
```

### FFI call failures

1. Check SDK is compatible with your platform
2. Verify Discord credentials in `.env`
3. Enable debug logging: `RUST_LOG=debug`

---

## 📚 References

- [Rust FFI Book](https://doc.rust-lang.org/nomicon/ffi.html)
- [Discord Social SDK Documentation](../DiscordSocialSdk-1.7.13152/)
- [Tokio Async Runtime](https://tokio.rs/)
- [Building Rust Libraries](https://doc.rust-lang.org/cargo/guide/build-cache.html)

---

## 📝 License

MIT License - Same as parent project
