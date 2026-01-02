import * as vscode from 'vscode';
import { DiscordClient } from '../gateway/discordClient';

export class VoiceChannelsWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'discord-vscode.voiceChannelsView';

  private view?: vscode.WebviewView;
  private updateInterval?: NodeJS.Timeout;
  private discordClient: DiscordClient | null = null;

  constructor(private readonly _context: vscode.ExtensionContext) {}

  public setDiscordClient(client: DiscordClient): void {
    this.discordClient = client;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: any,
    _token: vscode.CancellationToken
  ) {
    console.log('🔊 VoiceChannelsWebviewProvider.resolveWebviewView called');
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._context.extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'joinVoice':
          await this._joinVoice(data.channelId);
          break;
        case 'leaveVoice':
          await this._leaveVoice();
          break;
        case 'listChannels':
          await this._listChannels();
          break;
      }
    });

    // Load data when view becomes visible
    webviewView.onDidChangeVisibility(async () => {
      if (webviewView.visible) {
        console.log('[VoiceChannelsProvider] View became visible, loading channels');
        await this._listChannels();
      }
    });

    // Wait for webview ready before loading
    // Don't auto-load on startup to prevent freeze
    // Only load when user makes view visible
    webviewView.onDidChangeVisibility(async () => {
      if (webviewView.visible) {
        await this._listChannels();
      }
    });
  }

  private async _listChannels() {
    if (!this.discordClient?.isConnected()) {
      this.view?.webview.postMessage({
        type: 'voiceChannelsUpdate',
        channels: [],
        connected: false,
      });
      return;
    }

    try {
      // Get guilds and their voice channels
      const guilds = await this.discordClient!.fetchGuilds();
      const channels: any[] = [];

      for (const guild of guilds || []) {
        try {
          const guildChannels = await this.discordClient!.fetchGuildChannels(guild.id);
          const voiceChannels = (guildChannels || []).filter((ch: any) => ch.type === 2); // 2 = voice
          
          for (const channel of voiceChannels) {
            channels.push({
              id: channel.id,
              name: channel.name,
              guildName: guild.name,
              guildId: guild.id,
              users: channel.userCount || 0,
            });
          }
        } catch (e) {
          // Guild fetch error, continue
        }
      }

      this.view?.webview.postMessage({
        type: 'voiceChannelsUpdate',
        channels,
        connected: true,
      });
    } catch (error) {
      console.error('Failed to list voice channels:', error);
    }
  }

  private async _joinVoice(channelId: string) {
    if (!this.discordClient?.isConnected()) {
      vscode.window.showErrorMessage('Not connected to Discord');
      return;
    }
    try {
      // Voice channel joining is handled through Discord client directly
      vscode.window.showInformationMessage('Voice channel selected. Join via Discord client.');
      await this._listChannels();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to join: ${error}`);
    }
  }

  private async _leaveVoice() {
    if (!this.discordClient?.isConnected()) {
      return;
    }
    try {
      vscode.window.showInformationMessage('Leave via Discord client.');
      await this._listChannels();
    } catch (error) {
      console.error('Failed to leave voice:', error);
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Voice Channels</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #2C2F33;
      color: #DCDDDE;
      padding: 10px;
    }
    .header { margin-bottom: 15px; border-bottom: 1px solid #40444B; padding-bottom: 10px; }
    .header h2 { font-size: 18px; color: #FFFFFF; }
    .status {
      padding: 10px;
      background: #36393F;
      border-radius: 4px;
      margin-bottom: 15px;
      text-align: center;
      font-size: 13px;
    }
    .status.connected { color: #43B581; border: 1px solid #43B581; }
    .status.disconnected { color: #ED4245; border: 1px solid #ED4245; }
    .channel-item {
      background: #36393F;
      border: 1px solid #40444B;
      border-radius: 4px;
      padding: 10px;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .channel-info { flex: 1; }
    .channel-name { font-weight: 600; font-size: 13px; color: #FFFFFF; }
    .channel-guild { font-size: 11px; color: #72767D; }
    .channel-users { font-size: 11px; color: #72767D; margin-top: 4px; }
    button {
      padding: 6px 12px;
      background: #7289DA;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
    }
    button:hover { background: #5A77CC; }
    button.danger { background: #ED4245; }
    button.danger:hover { background: #DA373C; }
    .empty-state {
      text-align: center;
      padding: 30px 10px;
      color: #72767D;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="header"><h2>🎙️ Voice Channels</h2></div>
  <div class="status" id="status">🔌 Connecting...</div>
  <div id="channelsList">
    <div class="empty-state">Loading channels...</div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function joinVoice(channelId) {
      vscode.postMessage({ type: 'joinVoice', channelId });
    }

    function leaveVoice() {
      vscode.postMessage({ type: 'leaveVoice' });
    }

    window.addEventListener('message', event => {
      const { type, channels, connected } = event.data;
      if (type === 'voiceChannelsUpdate') {
        const status = document.getElementById('status');
        const list = document.getElementById('channelsList');

        if (connected) {
          status.className = 'status connected';
          status.textContent = '🟢 Connected';
        } else {
          status.className = 'status disconnected';
          status.textContent = '🔴 Disconnected';
        }

        if (!channels || channels.length === 0) {
          list.innerHTML = '<div class="empty-state">No voice channels available</div>';
          return;
        }

        list.innerHTML = channels.map(ch => \`
          <div class="channel-item">
            <div class="channel-info">
              <div class="channel-name">🎙️ \${ch.name}</div>
              <div class="channel-guild">\${ch.guildName}</div>
              <div class="channel-users">👥 \${ch.users} users</div>
            </div>
            <button onclick="joinVoice('\${ch.id}')">Join</button>
          </div>
        \`).join('');
      }
    });

    vscode.postMessage({ type: 'listChannels' });
  </script>
</body>
</html>`;
  }

  public dispose() {
    if (this.updateInterval) clearInterval(this.updateInterval);
  }
}
