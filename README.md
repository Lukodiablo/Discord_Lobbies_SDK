# Discord VS Code Extension 🎮

Bring Discord directly into VS Code. Chat with friends, collaborate in lobbies, share code snippets, and show what you're coding with privacy-first Rich Presence.

## ✨ Key Features

- **👥 See Your Servers** - Browse Discord guilds and channels in the sidebar
- **💬 Chat & Messaging** - Real-time messages with friend names, message preview, and quick reply
- **🎮 Collaborative Lobbies** - Create coding spaces with friends and team members
- **🎤 Voice Channels** - Join voice calls right from the editor
- **📝 Share Code** - Send code snippets directly in messages with syntax highlighting
- **🌟 Rich Presence** - Let friends know you're coding (with full privacy control)
- **🔔 Notifications** - Get instant alerts when friends message you

## 🚀 Getting Started

### Step 1: Install
Click **Install** button above (no setup needed!)

### Step 2: Authenticate
⚠️ **Make sure Discord desktop app is running first!**

1. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Type **"Discord: Authenticate"**
3. Click the link to log in with your Discord account
4. Done! You're connected.

### Step 3: Configure Privacy
Open the **Discord Rich Presence** panel on the left sidebar. By default, nothing is shared. Enable only what you want:

- **Show File Name** - Display what file you're editing
- **Show Line Number** - Display current line number
- **Show Project Name** - Display your workspace name
- **Show Lobby Name** - Display which lobby you're in
- **Show Voice Channel** - Display your voice channel status

**All features are OFF by default** - you control what's visible.

## � Messaging Features

### Receiving Messages
- **Real-time Notifications** - Instant alerts when friends message you
- **Username Display** - See your friend's name instead of user IDs  
- **Message Preview** - First 80 characters shown in notification
- **Quick Reply** - Click "Reply" to respond directly

### Sending Messages
- **Direct Messages** - Chat with friends from VS Code
- **Lobby Messages** - Collaborate with your coding team
- **Code Sharing** - Send snippets with syntax highlighting

## �💡 What Gets Shared?

When you enable Rich Presence, Discord sees:
- File name and line number (if enabled)
- Programming language
- Project name (if enabled)
- Lobby/voice status (if enabled)

**Never shared**: Your actual code, passwords, or personal files.

Your OAuth token is encrypted and never leaves your computer.

## �️ Troubleshooting

**"Rich Presence not showing in Discord"**
- Make sure Discord desktop app is running
- Check the Rich Presence panel - settings might be all OFF by default
- Restart VS Code and Discord

**"Can't join voice channels"**
- Discord app must be running
- Check your Discord permissions in the server
- Make sure your microphone is working

**"Authentication failed"**
- Log out and try authenticating again
- Try "Discord: Force Reconnect" from Command Palette

**"Not receiving messages"**
- Confirm Discord desktop app is running
- Check that you're authenticated and online
- Verify friends are messaging the correct account

## ✅ Requirements

- Discord desktop app (for messaging, voice, and Rich Presence)
- VS Code 1.80+

## 🏗️ Architecture

Built with **Rust + Discord Social SDK** for native performance:
- Zero-latency FFI communication with Discord SDK
- Real-time message delivery via Discord Desktop IPC
- Local encryption - your token never leaves your computer
- No external API calls needed
