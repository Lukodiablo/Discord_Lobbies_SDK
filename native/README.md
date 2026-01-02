# Discord Social SDK Native Addon

This is a Node.js native addon that wraps the Discord Social SDK C++ library for use in the VS Code extension.

## Setup Instructions

### 1. Extract Discord Social SDK

You've already extracted the Discord Social SDK! The structure should look like:

```
native/
  ├── discord-sdk/
  │   ├── include/
  │   │   └── discordpp.h (and other headers)
  │   └── lib/
  │       └── release/
  │           ├── discord_partner_sdk.dll (Windows)
  │           └── discord_partner_sdk.lib (Windows)
```

**Important**: Make sure the DLL file is in the same directory as the .lib file so the linker can find both.

### 2. Install Build Requirements

On Windows, you need:
- Visual Studio 2019 or later (with C++ tools)
- Python 3.x
- Node.js 14+

Install build tools globally:
```powershell
npm install -g windows-build-tools
```

Or manually install:
- Visual Studio 2019+ with C++ workload
- Python 3.x (add to PATH)
- node-gyp: `npm install -g node-gyp`

### 3. Build the Native Addon

From the workspace root:
```powershell
cd native
npm install
npm run build
```

Or directly:
```powershell
cd native
node-gyp configure --msvs_version=2019
node-gyp build
```

This will:
1. Download node-addon-api
2. Configure the build with node-gyp
3. Compile the C++ code against the Discord Social SDK
4. Create `build/Release/discord_social_sdk.node`
5. Copy `discord_partner_sdk.dll` to the build directory

### 4. Verify Build

```powershell
node -e "console.log(require('./index.js'))"
```

You should see the DiscordAddon class without errors.

### 5. Update Extension to Use Addon

In `src/extension.ts` or `src/services/gateway.ts`, when connecting:

```typescript
import { DiscordGateway } from './services/gateway';

const gateway = new DiscordGateway(context);

// After OAuth2 authentication (user has authorized and you have access token):
const appId = '1446821879095758960';
const accessToken = 'your_oauth_access_token_here';  // From OAuth2 flow
await gateway.connect(appId, accessToken);
```

The extension will automatically:
1. Initialize the Discord Social SDK with app ID and OAuth access token
2. Call `Client::SetApplicationId()` to configure the SDK
3. Call `Client::UpdateToken()` and `Client::Connect()` to authenticate
4. Wait for `Client::Status::Ready` 
5. Use `Client::GetUserGuilds()` to fetch guilds
6. Use `Client::GetGuildChannels()` to fetch channels for each guild

## API Reference

### Methods

- `initialize(appId: string, accessToken: string): boolean` - Initialize the Discord client with OAuth token
- `getGuilds(): Guild[]` - Get all guilds for current user (after Status::Ready)
- `getGuildChannels(guildId: string): Channel[]` - Get channels in a guild
- `getCurrentUser(): User` - Get current user info
- `sendMessage(channelId: string, userId: string, content: string): boolean` - Send a message
- `joinVoiceChannel(guildId: string, channelId: string): boolean` - Join a voice channel
- `leaveVoiceChannel(): boolean` - Leave current voice channel
- `setActivityRichPresence(activity: Activity): boolean` - Update rich presence
- `disconnect(): void` - Disconnect from Discord

### Data Structures

```typescript
interface Guild {
  id: string;
  name: string;
  icon: string;
  owner: boolean;
}

interface Channel {
  id: string;
  name: string;
  type: number; // 0=text, 2=voice, 4=category, etc.
  position: number;
  parentId: string;
}

interface User {
  id: string;
  username: string;
  avatar: string;
  discriminator: string;
}

interface Activity {
  details: string;
  state: string;
}
```

## Troubleshooting

### Build Fails: "discord_partner_sdk.lib not found"

1. Verify the SDK is extracted to `native/discord-sdk/`
2. Check the file exists: `native/discord-sdk/lib/release/discord_partner_sdk.lib`
3. On Windows, both `.lib` and `.dll` must be present
4. Try cleaning and rebuilding:
   ```powershell
   npm run clean
   npm run build
   ```

### Build Fails: "Cannot find module 'node-addon-api'"

```powershell
cd native
npm install node-addon-api
npm run build
```

### Python not found

- Install Python 3.x from python.org
- Add to PATH
- Verify: `python --version`

### Visual Studio build tools not found

- Install Visual Studio 2019 or later with C++ workload
- Or: `npm install -g windows-build-tools` (requires admin)

### DLL not found at runtime

The native addon copies `discord_partner_sdk.dll` to the build output:
- Check: `native/build/Release/discord_partner_sdk.dll` exists
- Should be copied automatically during build
- If not, manually copy from `native/discord-sdk/lib/release/`

### "Extension module version mismatch"

This happens when Node.js ABI changes. Rebuild:
```powershell
cd native
npm run clean
npm run rebuild
```

## Implementation Notes

The C++ wrapper currently has template code with commented examples. To fully integrate:

1. **GetGuilds()**: Uncomment the `Client::GetUserGuilds()` call in `discord_client.cc`
2. **GetGuildChannels()**: Uncomment the `Client::GetGuildChannels()` call
3. **SendMessage()**: Use either Linked Channels or Direct Messages API
4. **Voice**: Use the Voice Manager from the SDK

Refer to Discord Social SDK documentation for exact API signatures.

## Key Advantages Over HTTP API

✅ No more 401 Unauthorized errors  
✅ Direct access to `Client::GetGuildChannels()` (sorted by position!)  
✅ Built-in OAuth2 authentication via SDK  
✅ Voice chat support with WebRTC  
✅ Rich Presence integration  
✅ Linked channels support  
✅ Better performance  
✅ Access to raw SDK data  

## References

- [Discord Social SDK Documentation](https://discord.com/developers/docs/game-sdk/sdk-starter-guide)
- [Discord Social SDK C++ API](https://discord.com/developers/docs/game-sdk/sdk-starter-guide)
- [Node-Addon-API Documentation](https://github.com/nodejs/node-addon-api)
- [node-gyp Documentation](https://github.com/nodejs/node-gyp)

