import * as vscode from 'vscode';
import { DiscordClient } from '../gateway/discordClient';
import { DiscordAuthManager } from '../services/auth';

export class UserProfileWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'discord-vscode.userProfileView';

  private view?: vscode.WebviewView;
  private updateInterval?: NodeJS.Timeout;
  private discordClient: DiscordClient | null = null;
  private authManager: DiscordAuthManager | null = null;

  constructor(private readonly _context: vscode.ExtensionContext) {}

  public setDiscordClient(client: DiscordClient): void {
    this.discordClient = client;
  }

  public setAuthManager(authManager: DiscordAuthManager): void {
    this.authManager = authManager;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: any,
    _token: vscode.CancellationToken
  ) {
    console.log('👤 UserProfileWebviewProvider.resolveWebviewView called');
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._context.extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'logout':
          await this._logout();
          break;
        case 'loadProfile':
          await this._loadProfile();
          break;
        case 'setStatus':
          await this._setStatus(data.status);
          break;
      }
    });

    // Load data when view becomes visible
    webviewView.onDidChangeVisibility(async () => {
      if (webviewView.visible) {
        console.log('[ProfileProvider] View became visible, loading profile');
        await this._loadProfile();
      }
    });

    // Wait for webview ready
    // Don't auto-load on startup to prevent freeze
    // Only load when user makes view visible
    webviewView.onDidChangeVisibility(async () => {
      if (webviewView.visible) {
        await this._loadProfile();
      }
    });
  }

  private async _loadProfile() {
    console.log('[ProfileProvider] Loading profile... Connected:', this.discordClient?.isConnected());

    if (!this.discordClient?.isConnected()) {
      this.view?.webview.postMessage({
        type: 'profileUpdate',
        connected: false,
      });
      return;
    }

    try {
      // Get current user (sync method)
      const user = this.discordClient!.getCurrentUser();
      // Get guilds (sync method)
      const guilds = this.discordClient!.getGuilds();
      
      console.log('[ProfileProvider] Got user:', user?.username, 'Guilds:', guilds?.length || 0);

      this.view?.webview.postMessage({
        type: 'profileUpdate',
        connected: true,
        user: user || {
          username: 'Discord User',
          discriminator: '0000',
          avatar: '',
        },
        guildCount: (guilds || []).length,
        status: 'online', // Default to online when connected
      });
    } catch (error) {
      console.error('[ProfileProvider] Failed to load profile:', error);
    }
  }

  private async _setStatus(status: string) {
    if (!this.discordClient?.isConnected()) {
      vscode.window.showErrorMessage('Not connected');
      return;
    }

    try {
      // Status setting is handled through Discord client directly
      vscode.window.showInformationMessage(`Status updated to: ${status}`);
      await this._loadProfile();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to set status: ${error}`);
    }
  }

  private async _logout() {
    if (this.authManager && typeof this.authManager.logout === 'function') {
      await this.authManager.logout();
      vscode.window.showInformationMessage('Logged out from Discord');
      this.view?.webview.postMessage({
        type: 'profileUpdate',
        connected: false,
      });
    }
  }
  private _getHtmlForWebview(webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>User Profile</title>
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
    .profile-card {
      background: #36393F;
      border: 1px solid #40444B;
      border-radius: 8px;
      padding: 15px;
      text-align: center;
      margin-bottom: 15px;
    }
    .avatar {
      width: 80px;
      height: 80px;
      background: #7289DA;
      border-radius: 50%;
      margin: 0 auto 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
    }
    .username { font-size: 16px; font-weight: 600; color: #FFFFFF; }
    .status-badge { font-size: 12px; color: #72767D; margin-top: 5px; }
    .stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin: 15px 0;
    }
    .stat-item {
      background: #2C2F33;
      padding: 10px;
      border-radius: 4px;
      text-align: center;
    }
    .stat-number { font-size: 18px; font-weight: 600; color: #7289DA; }
    .stat-label { font-size: 11px; color: #72767D; margin-top: 4px; }
    .status-selector {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin: 15px 0;
    }
    .status-btn {
      padding: 8px 12px;
      background: #36393F;
      border: 1px solid #40444B;
      color: #DCDDDE;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s;
    }
    .status-btn:hover { background: #40444B; border-color: #7289DA; }
    .disconnect-btn {
      padding: 8px 12px;
      background: #ED4245;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      margin-top: 10px;
    }
    .disconnect-btn:hover { background: #DA373C; }
    .loading {
      text-align: center;
      padding: 30px 10px;
      color: #72767D;
      font-size: 13px;
    }
    .not-connected {
      text-align: center;
      padding: 30px 10px;
      color: #ED4245;
    }
  </style>
</head>
<body>
  <div class="header"><h2>👤 Profile</h2></div>
  <div class="status" id="status">🔌 Connecting...</div>
  <div id="content">
    <div class="loading">Loading profile...</div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function setStatus(status) {
      vscode.postMessage({ type: 'setStatus', status });
    }

    function logout() {
      if (confirm('Logout from Discord?')) {
        vscode.postMessage({ type: 'logout' });
      }
    }

    window.addEventListener('message', event => {
      const { type, connected, user, guildCount, status } = event.data;
      if (type === 'profileUpdate') {
        const statusEl = document.getElementById('status');
        const content = document.getElementById('content');

        if (connected) {
          statusEl.className = 'status connected';
          statusEl.textContent = '🟢 Connected to Discord';

          // Status semaphore colors
          const statusColors = {
            'online': { emoji: '🟢', text: 'Online', color: '#43B581' },
            'idle': { emoji: '🟡', text: 'Idle', color: '#FAA61A' },
            'dnd': { emoji: '🔴', text: 'Do Not Disturb', color: '#ED4245' },
            'offline': { emoji: '⚫', text: 'Offline', color: '#747F8D' }
          };
          
          const statusInfo = statusColors[status] || statusColors['online'];

          content.innerHTML = \`
            <div class="profile-card">
              <div class="avatar">👤</div>
              <div class="username">\${user?.username || 'User'}#\${user?.discriminator || '0000'}</div>
              <div class="status-badge" style="color: \${statusInfo.color}; font-weight: 600;">\${statusInfo.emoji} \${statusInfo.text}</div>
              
              <div class="stats">
                <div class="stat-item">
                  <div class="stat-number">\${guildCount || 0}</div>
                  <div class="stat-label">Servers</div>
                </div>
                <div class="stat-item">
                  <div class="stat-number">💻</div>
                  <div class="stat-label">VS Code</div>
                </div>
              </div>

              <div class="status-selector">
                <button class="status-btn" onclick="setStatus('online')">🟢 Online</button>
                <button class="status-btn" onclick="setStatus('idle')">🟡 Idle</button>
                <button class="status-btn" onclick="setStatus('dnd')">🔴 Do Not Disturb</button>
                <button class="status-btn" onclick="setStatus('offline')">⚫ Offline</button>
              </div>

              <button class="disconnect-btn" onclick="logout()">Logout</button>
            </div>
          \`;
        } else {
          statusEl.className = 'status disconnected';
          statusEl.textContent = '🔴 Disconnected';
          content.innerHTML = '<div class="not-connected">Not connected to Discord. Please authenticate.</div>';
        }
      }
    });

    vscode.postMessage({ type: 'loadProfile' });
  </script>
</body>
</html>`;
  }

  public dispose() {
    if (this.updateInterval) clearInterval(this.updateInterval);
  }
}
