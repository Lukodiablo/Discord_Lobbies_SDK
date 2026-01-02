# Discord Lobbies SDK - Developer Notes

## Project Architecture

### Overview
Discord Lobbies SDK is a VS Code extension that provides full Discord integration with lobbies, messaging, voice channels, and rich presence features. It uses a **Rust subprocess with Discord Social SDK FFI** for efficient lobby and voice management.

### Technology Stack
- **Extension Layer**: TypeScript (VS Code Extension API)
- **Build Tool**: esbuild (TypeScript bundling)
- **Subprocess**: Rust with FFI bindings to Discord Social SDK
- **IPC Communication**: JSON-based message passing via stdio
- **Build System**: auto.sh (orchestrates Rust compilation + TypeScript bundling)
- **Native SDK**: Discord Social SDK (C/C++)

### Project Structure

```
discord-extension/
├── src/                    # TypeScript Extension Source
│   ├── extension.ts        # Extension entry point
│   ├── polyfill.ts         # Browser API polyfills
│   ├── commands/           # Command implementations
│   │   ├── createLobby.ts
│   │   ├── joinLobby.ts
│   │   ├── leaveLobby.ts
│   │   ├── listLobbies.ts
│   │   ├── sendLobbyMessage.ts
│   │   ├── voiceLobby.ts
│   │   └── ...
│   ├── gateway/            # Discord client interface
│   │   └── discordClient.ts
│   ├── services/           # Business logic services
│   │   ├── auth.ts                    # OAuth 2.0 authentication
│   │   ├── discordSubprocess.ts       # IPC to Rust subprocess
│   │   ├── lobbyMessagePoller.ts      # Message polling (500ms)
│   │   ├── richPresence.ts            # Discord presence updates
│   │   └── oauthCallbackServer.ts     # OAuth callback handler
│   ├── handlers/           # Command/event handlers
│   │   └── commandHandler.ts
│   ├── views/              # UI providers for sidebar
│   │   ├── lobbiesTreeProvider.ts
│   │   ├── serverTreeProvider.ts
│   │   ├── voiceChannelsTreeProvider.ts
│   │   ├── chatViewProvider.ts
│   │   └── discordStatusBar.ts
│   └── utils/              # Utility functions
│
├── rust-native/            # Rust Subprocess (MAIN SDK LAYER)
│   ├── Cargo.toml          # Rust dependencies
│   ├── build.rs            # Build script
│   ├── src/
│   │   ├── main.rs         # Entry point (IPC server)
│   │   ├── lib.rs          # Library exports
│   │   └── ...
│   ├── target/
│   │   └── release/
│   │       └── discord-extension  # Compiled Rust binary
│   └── README.md
│
├── DiscordSocialSdk-1.7.13152/  # Discord Social SDK (C/C++)
│   └── discord_social_sdk/
│       ├── include/         # C header files
│       │   ├── cdiscord.h
│       │   └── discordpp.h
│       └── lib/             # Pre-compiled libraries
│           ├── discord_partner_sdk.aar
│           └── libdiscord_partner_sdk.dbg
│
├── native/                 # Optional Node.js C++ bindings
│   ├── binding.gyp
│   ├── src/                # C++ source files
│   └── build/              # Compiled modules
│
├── auto.sh                 # Build orchestrator (Rust + TypeScript)
├── package.json            # Extension manifest & npm scripts
├── tsconfig.json           # TypeScript configuration
│
└── dist/                   # Output (after build)
    └── extension.js        # Bundled extension
```

## Build System

### auto.sh - Main Build Orchestrator
The `auto.sh` script handles the complete build process:

1. **Compiles Rust Subprocess**
   ```bash
   cd rust-native
   cargo build --release
   # Output: target/release/discord-extension (Rust binary)
   ```

2. **Bundles TypeScript Extension**
   ```bash
   esbuild src/extension.ts --bundle --outfile=dist/extension.js --platform=node --external:vscode
   ```

3. **Creates Final Package**
   - VSIX file ready for publication
   - Includes Rust binary + bundled JS

### Development Workflow

**Watch Mode** (TypeScript only):
```bash
npm run esbuild-watch
# Rebuilds TypeScript on file changes
# Still uses previously compiled Rust binary
```

**Full Rebuild**:
```bash
./auto.sh
# Recompiles both Rust and TypeScript
# Use after Rust source changes
```

## Core Components

### Extension Layer (TypeScript)

#### Extension Entry Point (src/extension.ts)
- Initializes extension when VS Code starts
- Registers all commands and views
- Starts Rust subprocess
- Manages VS Code API integrations

#### Discord Subprocess Handler (src/services/discordSubprocess.ts)
- **Spawns Rust binary** at startup
- **IPC Communication**: Sends JSON commands to Rust subprocess via stdin
- **Message Parsing**: Receives JSON responses via stdout
- **Error Handling**: Captures stderr for debugging
- **Lifecycle Management**: Handles process restart on crash

#### OAuth Authentication (src/services/auth.ts)
- OAuth 2.0 flow with Discord
- Token exchange via `oauthCallbackServer.ts` (local HTTP server on port 3000)
- Secure storage using **VS Code Secret Storage API** (encrypted per user)
- Automatic token refresh

#### Lobby Message Poller (src/services/lobbyMessagePoller.ts)
- **Polls Rust subprocess every 500ms** for new messages
- Sends request: `{ action: "getPendingMessages" }`
- Receives message events from Rust layer
- Triggers UI updates in real-time

### Rust Subprocess Layer (rust-native/)

The Rust binary is the **core SDK layer** that:

1. **FFI Bindings to Discord Social SDK**
   - Links against Discord Social SDK libraries
   - Provides C/C++ FFI interface
   - Manages SDK initialization and lifecycle

2. **Lobby Management**
   - Creates Discord lobbies
   - Joins/leaves lobbies
   - Manages lobby membership
   - Handles voice connections

3. **Voice Controls**
   - Mute/unmute microphone
   - Deafen/undeafen audio
   - Voice state management

4. **Message Handling**
   - Queues incoming messages
   - Provides message API for TypeScript

5. **IPC Server**
   - Listens for JSON commands on stdin
   - Processes commands from TypeScript extension
   - Sends responses via stdout
   - Logs errors to stderr

### Discord Social SDK (Native C/C++)

Located in `DiscordSocialSdk-1.7.13152/`:
- Pre-compiled Discord SDK libraries
- Headers for C/C++ integration
- Platform-specific binaries (ARM64, x86_64)
- Used by Rust subprocess via FFI

## Core Services

### Authentication (src/services/auth.ts)
```
User clicks "Authenticate" 
    ↓
Opens Discord OAuth login
    ↓
User approves permissions
    ↓
oauthCallbackServer.ts catches redirect
    ↓
Token exchanged with Discord
    ↓
Stored in VS Code secrets (encrypted)
    ↓
Extension ready for API calls
```

### IPC Communication Pattern
```
TypeScript Extension           Rust Subprocess
        │                             │
        ├─ JSON Command ──────────────>│
        │  { action, params }         │ FFI Call
        │                             ↓
        │                        Discord SDK
        │                             │
        │                          Process
        │                             │
        │   JSON Response <──────────┤
        │  { success, data }         │
        └─────────────────────────────┘
```

### Message Flow
```
1. TypeScript polls Rust every 500ms
2. Rust checks SDK for pending events
3. Events queued internally
4. Response sent back to TypeScript
5. UI updated with new messages
```

### Voice Lobby Integration
```
User joins voice lobby
    ↓
Rust connects to Discord voice gateway
    ↓
Microphone/speaker initialized
    ↓
User can toggle mute/deaf via VS Code commands
    ↓
Commands sent via IPC to Rust
    ↓
Rust relays to Discord SDK
    ↓
Voice state updates reflected in Discord
```

## Setup & Development

### Prerequisites
- Node.js 16+
- TypeScript
- VS Code 1.99.0+
- Rust 1.70+ (for compiling Rust subprocess)
- Python 3 (for node-gyp, if using native modules)
- C++ compiler (for Discord Social SDK and native modules)

### Installation & Building

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Build Rust Subprocess**
   ```bash
   cd rust-native
   cargo build --release
   cd ..
   ```

3. **Full Build (Recommended)**
   ```bash
   ./auto.sh
   ```
   This compiles both Rust and TypeScript, creating `dist/extension.js`

### Running the Extension

1. Open the project in VS Code
2. Press `F5` to launch in debug mode
3. A new VS Code window opens with the extension loaded
4. Run command: **Discord: Authenticate**
5. Test commands and features

### Development Workflow

**For TypeScript Changes Only:**
```bash
npm run esbuild-watch
# Rebuilds TS on file changes
# Rust binary doesn't need recompilation
```

**For Rust Changes:**
```bash
./auto.sh
# Recompiles Rust binary AND TypeScript
# Necessary after modifying rust-native/src/
```

## Environment Variables
Required for development:
- `DISCORD_CLIENT_ID` - OAuth client ID
- `DISCORD_CLIENT_SECRET` - OAuth client secret
- `DISCORD_REDIRECT_URI` - OAuth redirect URL (typically `http://127.0.0.1:3000/callback`)

Stored securely in **VS Code Secret Storage** (encrypted per user, not in .env file)

## Testing

### Manual Testing
1. Create a test Discord application at [Discord Developer Portal](https://discord.com/developers/applications)
2. Configure OAuth credentials
3. Launch extension in debug mode (F5)
4. Test OAuth flow and features

### Debug Mode
Press F5 in VS Code to:
- Run extension with debugger attached
- Set breakpoints in TypeScript code
- Step through code
- Inspect variables
- Monitor Rust subprocess stderr in Debug Console

### Debugging Tips

1. **Monitor Subprocess Output**
   - Check "Discord Subprocess" in Output panel
   - Look for JSON IPC messages
   - Check for Rust panic messages

2. **Check Message Polling**
   - Set breakpoint in `lobbyMessagePoller.ts`
   - Monitor IPC calls to Rust
   - Verify message response format

3. **OAuth Debugging**
   - Check port 3000 is available
   - Monitor `oauthCallbackServer.ts` for redirects
   - Verify token storage in VS Code secrets

4. **Rust Binary Issues**
   - Check binary exists at `rust-native/target/release/discord-extension`
   - Verify Discord SDK libraries are loadable
   - Check `LD_LIBRARY_PATH` environment variable

## Common Tasks

### Adding a New Lobby Command
1. Create command file in `src/commands/`
2. Implement command logic
3. Send IPC message to Rust subprocess via `discordSubprocess.ts`
4. Handle response from Rust
5. Register in `commandHandler.ts`
6. Add to `package.json` contributions

### Modifying Rust Subprocess Behavior
1. Edit `rust-native/src/main.rs` or relevant module
2. Handle new JSON command type
3. Call Discord SDK via FFI
4. Return JSON response
5. Run `./auto.sh` to rebuild

### Adding a New Tree View
1. Create provider in `src/views/`
2. Extend `vscode.TreeDataProvider`
3. Query data from Rust subprocess
4. Register in `package.json`
5. Initialize in `extension.ts`

### Debugging IPC Communication
- Log all JSON commands and responses
- Check message format matches expected schema
- Verify Rust subprocess is handling commands
- Monitor for timeout errors in Rust binary

## Performance Considerations

- **Message Polling**: Currently 500ms interval - adjust in `lobbyMessagePoller.ts` for different responsiveness
- **Rust Binary Startup**: Takes ~1-2 seconds on first launch
- **SDK Library Loading**: Discord Social SDK libs may be large - consider lazy loading
- **Tree View Updates**: Use debouncing for frequent updates

## Common Issues & Solutions

### Rust Subprocess Fails to Start
**Error**: `Failed to spawn subprocess`
- Check binary exists: `ls -la rust-native/target/release/discord-extension`
- Verify permissions: `chmod +x rust-native/target/release/discord-extension`
- Rebuild: `./auto.sh`

### Lobbies Not Appearing
**Error**: Empty lobby list
- Check OAuth token is valid
- Verify user has active Discord lobbies
- Check Rust subprocess is running in Debug Console
- Look for errors in Rust subprocess stderr

### IPC Communication Timeout
**Error**: Commands not executing
- Verify JSON format is correct
- Check Rust binary is processing commands
- Monitor stdout/stderr from subprocess
- Add timeout error handling in `discordSubprocess.ts`

### Port 3000 Already in Use
**Error**: OAuth callback fails
- Kill existing process: `lsof -ti:3000 | xargs kill -9`
- Or change port in `src/services/oauthCallbackServer.ts`

## Cross-Platform Path Discovery

### Problem Solved
Previous versions used hardcoded relative paths that only worked for specific directory structures:
- `../../rust-native` assumed specific nesting depth
- Different on Linux vs Windows due to SDK location differences
- Broke when project was cloned to different paths
- Failed for new developers with different workspace structures

### Solution Implemented
Both the **Rust binary** and **Discord SDK** are now discovered dynamically by searching upward through the directory hierarchy:

#### Binary Discovery (`findBinary()`)
- Starts from `__dirname` and searches upward
- Looks for `rust-native/target/release` or `rust-native/target/debug`
- Works from any directory depth (dist or src)
- Gracefully falls back to system PATH on Linux/macOS
- **Result**: Works on any machine, any project location, any developer

#### SDK Discovery (`findSDKPath()`)
- Searches upward from binary directory for `DiscordSocialSdk-*` folder
- **Platform-specific paths**:
  - **Windows**: Uses `bin/release` (contains `.dll` files)
  - **Linux/macOS**: Uses `lib/release` (contains `.so`/`.dylib` files)
- **Architecture-aware**: Checks for ARM64 variants if available
- Sets appropriate environment variables:
  - Windows: Updates `PATH`
  - Linux: Updates `LD_LIBRARY_PATH`
  - macOS: Uses standard library loading

#### Key Implementation Details
```typescript
// Example: Binary found at:
// c:\Users\lukod\OneDrive\Desktop\discord-extension\rust-native\target\release\discord-extension.exe

// SDK found at:
// c:\Users\lukod\OneDrive\Desktop\discord-extension\DiscordSocialSdk-1.7.13152\discord_social_sdk\bin\release

// Works from:
// - Any git clone location
// - Any developer machine
// - Any future Windows/Linux/macOS update
// - Any architecture (x64, arm64, etc.)
```

### Files Modified
- `src/services/discordSubprocess.ts`: 
  - `findBinary()` - Dynamic binary discovery
  - `findSDKPath()` - Dynamic SDK discovery
  - `start()` - Platform/architecture-aware environment setup

### Testing Cross-Platform
Before committing changes affecting path resolution:
1. Test on Windows (x64 and arm64 if available)
2. Test on Linux (x64 and arm64 if available)
3. Test from different directory nesting levels
4. Verify subprocess starts without crashes
5. Check that friends list loads (`[DiscordSubprocess] Fetched X friends`)

## Contributing Guidelines

1. **TypeScript Code**
   - Follow TypeScript best practices
   - Use async/await for async operations
   - Handle errors gracefully with try-catch
   - Add comments for complex logic

2. **Rust Code**
   - Document FFI interactions with Discord SDK
   - Handle SDK errors appropriately
   - Keep JSON protocol well-documented
   - Test IPC message format changes

3. **Path Resolution**
   - **NEVER hardcode paths** - Always search dynamically
   - Test changes on both Windows and Linux
   - Consider both development (`src/`) and distribution (`dist/`) paths
   - Account for future architectures (ARM, etc.)

4. **Testing**
   - Test on multiple machines if possible
   - Verify both TypeScript and Rust changes
   - Check subprocess works after rebuild
   - Test OAuth flow end-to-end
6. Keep commits focused and descriptive

## Release Process

1. Update version in `package.json`
2. Run `npm run build`
3. Verify all features work
4. Tag commit with version number
5. Publish to VS Code Marketplace

## OAuth Scopes Configuration

**CRITICAL:** All scope definitions must be kept in sync across Node.js and Rust code.

### Required Scopes

```
openid sdk.social_layer identify email guilds connections rpc
```

### Scope Reference

| Scope | Purpose | Used For |
|-------|---------|----------|
| `openid` | OpenID Connect protocol | SDK authorization |
| `sdk.social_layer` | Discord Social SDK features | Lobbies, messaging, guild access |
| `identify` | User ID and username | Identifying the user |
| `email` | User email address | Account verification |
| `guilds` | Access to servers and channels | Fetching server/channel lists |
| `connections` | Connected social accounts | Displaying social links |
| `rpc` | Rich Presence activities | Showing coding status |

### Scope Locations (Must Stay in Sync)

**Three locations that MUST be kept synchronized:**

1. **src/services/auth.ts** (line 40)
   ```typescript
   private readonly SCOPES = 'openid sdk.social_layer identify email guilds connections rpc';
   ```

2. **src/extension.ts** (line 380 - OAuth URL)
   ```
   scope=openid+sdk.social_layer+identify+email+guilds+connections+rpc
   ```

3. **rust-native/src/main.rs** (line 2039)
   ```rust
   let scopes_str = b"openid sdk.social_layer identify email guilds connections rpc";
   ```

**See [OAUTH_SCOPES.md](./OAUTH_SCOPES.md) for full synchronization checklist.**

## Troubleshooting

### Extension Won't Load
- Check `package.json` for syntax errors
- Verify `main` entry point in `package.json`
- Check activation events

### OAuth Flow Fails
- Verify client ID and secret
- Check redirect URI matches Discord app settings
- Ensure token refresh is working

### Commands Don't Execute
- Verify command ID in `package.json`
- Check handler registration
- Review Debug Console for errors

## Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Discord API Documentation](https://discord.com/developers/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
