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
        case 'toggleVoice':
          await this._toggleVoice(data.channelId);
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
        lobbyMembers: [],
        voiceMembers: [],
        inVoice: false
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

      // Get current lobby members and voice members from tracking
      const context = this._context.workspaceState;
      const currentLobby = context.get<any>('currentLobby');
      const lobbyMembers = currentLobby ? this.discordClient!.getLobbyMembers(currentLobby.id) : [];
      const voiceMembers = this.discordClient!.getVoiceParticipants();
      const micEnabled = this.discordClient!.isMicEnabled();
      const audioEnabled = this.discordClient!.isAudioEnabled();
      const inVoice = voiceMembers.length > 0; // User is in voice if there are voice participants

      this.view?.webview.postMessage({
        type: 'voiceChannelsUpdate',
        channels,
        lobbyMembers,
        voiceMembers,
        micEnabled,
        audioEnabled,
        inVoice,
        connected: true,
      });
    } catch (error) {
      console.error('Failed to list voice channels:', error);
    }
  }

  private async _toggleVoice(channelId: string) {
    if (!this.discordClient?.isConnected()) {
      vscode.window.showErrorMessage('Not connected to Discord');
      return;
    }
    
    try {
      const voiceMembers = this.discordClient!.getVoiceParticipants();
      const inVoice = voiceMembers.length > 0;
      
      if (inVoice) {
        // Leave voice
        await vscode.commands.executeCommand('discord-lobbies.disconnectVoice');
        vscode.window.showInformationMessage('Left voice channel');
      } else {
        // Join voice - use the connectLobbyVoice command
        await vscode.commands.executeCommand('discord-lobbies.connectVoice');
        vscode.window.showInformationMessage('Joined voice channel');
      }
      
      await this._listChannels();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to toggle voice: ${error}`);
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
  
  <!-- Voice Status Indicators -->
  <div id="statusIndicators" style="display: none; margin-bottom: 12px; padding: 8px; background: #2C2F33; border-radius: 4px; display: flex; gap: 8px;">
    <div id="micIndicator" style="flex: 1; padding: 6px; background: #4CAF50; border-radius: 3px; text-align: center; font-weight: 600; color: white; font-size: 11px;">
      🎤 ON
    </div>
    <div id="audioIndicator" style="flex: 1; padding: 6px; background: #4CAF50; border-radius: 3px; text-align: center; font-weight: 600; color: white; font-size: 11px;">
      🔊 ON
    </div>
  </div>
  
  <!-- Lobby Members Section -->
  <div id="lobbySection" style="display: none; margin-bottom: 15px; padding: 10px; background: #2C2F33; border-radius: 4px;">
    <div style="font-weight: 600; margin-bottom: 8px;">👥 Lobby Members:</div>
    <div id="lobbyMembersList" style="font-size: 12px;"></div>
  </div>
  
  <!-- Voice Members Section -->
  <div id="voiceSection" style="display: none; margin-bottom: 15px; padding: 10px; background: #2C2F33; border-radius: 4px;">
    <div style="font-weight: 600; margin-bottom: 8px;">🎤 Voice Members:</div>
    <div id="voiceMembersList" style="font-size: 12px;"></div>
  </div>
  
  <div id="channelsList">
    <div class="empty-state">Loading channels...</div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function toggleVoice(channelId) {
      vscode.postMessage({ type: 'toggleVoice', channelId });
    }

    window.addEventListener('message', event => {
      const { type, channels, connected, lobbyMembers, voiceMembers, micEnabled, audioEnabled, inVoice } = event.data;
      if (type === 'voiceChannelsUpdate') {
        const status = document.getElementById('status');
        const list = document.getElementById('channelsList');
        const statusIndicators = document.getElementById('statusIndicators');
        const micIndicator = document.getElementById('micIndicator');
        const audioIndicator = document.getElementById('audioIndicator');
        const lobbySection = document.getElementById('lobbySection');
        const lobbyList = document.getElementById('lobbyMembersList');
        const voiceSection = document.getElementById('voiceSection');
        const voiceList = document.getElementById('voiceMembersList');

        if (connected) {
          status.className = 'status connected';
          status.textContent = '🟢 Connected';
        } else {
          status.className = 'status disconnected';
          status.textContent = '🔴 Disconnected';
        }

        // Display voice status indicators when user is in voice
        if (inVoice) {
          statusIndicators.style.display = 'flex';
          micIndicator.style.background = micEnabled ? '#4CAF50' : '#f44336';
          micIndicator.textContent = micEnabled ? '🎤 ON' : '🎤 OFF';
          audioIndicator.style.background = audioEnabled ? '#4CAF50' : '#f44336';
          audioIndicator.textContent = audioEnabled ? '🔊 ON' : '🔊 OFF';
        } else {
          statusIndicators.style.display = 'none';
        }

        // Display lobby members if any
        if (lobbyMembers && lobbyMembers.length > 0) {
          lobbySection.style.display = 'block';
          let lobbyHtml = '';
          for (const m of lobbyMembers) {
            lobbyHtml += '<div style="padding: 4px 0; color: #99AAB5;">👤 ' + m.username + '</div>';
          }
          lobbyList.innerHTML = lobbyHtml;
        } else {
          lobbySection.style.display = 'none';
        }

        // Display voice members if any
        if (voiceMembers && voiceMembers.length > 0) {
          voiceSection.style.display = 'block';
          let voiceHtml = '';
          for (const m of voiceMembers) {
            voiceHtml += '<div style="padding: 4px 0; color: #99AAB5;">🎤 ' + m.username + '</div>';
          }
          voiceList.innerHTML = voiceHtml;
        } else {
          voiceSection.style.display = 'none';
        }

        if (!channels || channels.length === 0) {
          list.innerHTML = '<div class="empty-state">No voice channels available</div>';
          return;
        }

        // Show toggle button for each channel
        list.innerHTML = channels.map(ch => \`
          <div class="channel-item">
            <div class="channel-info">
              <div class="channel-name">🎙️ \${ch.name}</div>
              <div class="channel-guild">\${ch.guildName}</div>
              <div class="channel-users">👥 \${ch.users} users</div>
            </div>
            <button onclick="toggleVoice('\${ch.id}')" class="\${inVoice ? 'danger' : ''}">\${inVoice ? 'Leave Voice' : 'Connect Voice'}</button>
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
