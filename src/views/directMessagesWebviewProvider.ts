import * as vscode from 'vscode';
import { DiscordClient } from '../gateway/discordClient';

interface DM {
  id: string;
  username: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unread?: boolean;
}

export class DirectMessagesWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'discord-vscode.directMessagesView';

  private view?: vscode.WebviewView;
  private updateInterval?: NodeJS.Timeout;
  private dms: DM[] = [];
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
    console.log('💬 DirectMessagesWebviewProvider.resolveWebviewView called');
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._context.extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'openDM':
          await this._openDM(data.friendId, data.friendName);
          break;
        case 'listDMs':
          await this._listDMs();
          break;
        case 'sendMessage':
          await this._sendMessage(data.friendId, data.message);
          break;
      }
    });

    // Load data when view becomes visible
    webviewView.onDidChangeVisibility(async () => {
      if (webviewView.visible) {
        console.log('[DirectMessagesProvider] View became visible, loading DMs');
        await this._listDMs();
      }
    });

    // Wait for webview ready
    // Don't auto-load on startup to prevent freeze
    // Only load when user makes view visible
    webviewView.onDidChangeVisibility(async () => {
      if (webviewView.visible) {
        await this._listDMs();
      }
    });
  }

  private async _listDMs() {
    console.log('[DirectMessagesProvider] Fetching DMs... Connected:', this.discordClient?.isConnected());
    
    if (!this.discordClient?.isConnected()) {
      this.view?.webview.postMessage({
        type: 'dmListUpdate',
        dms: [],
        connected: false,
      });
      return;
    }

    try {
      const relationships = await this.discordClient!.fetchFriends();
      console.log('[DirectMessagesProvider] Got relationships:', relationships?.length || 0);
      
      const friends = (relationships || [])
        .map((r: any) => ({
          id: r.id,
          username: r.username,
          lastMessage: r.lastMessage || 'No messages yet',
          unread: false,
        }));

      console.log('[DirectMessagesProvider] Mapped to friends:', friends.length);
      this.dms = friends;
      
      this.view?.webview.postMessage({
        type: 'dmListUpdate',
        dms: friends,
        connected: true,
      });
    } catch (error) {
      console.error('[DirectMessagesProvider] Failed to list DMs:', error);
    }
  }

  private async _openDM(friendId: string, friendName: string) {
    const message = await vscode.window.showInputBox({
      prompt: `Message with ${friendName}`,
      placeHolder: 'Type your message...',
    });

    if (!message) return;
    await this._sendMessage(friendId, message);
  }

  private async _sendMessage(friendId: string, message: string) {
    if (!this.discordClient?.isConnected()) {
      vscode.window.showErrorMessage('Not connected to Discord');
      return;
    }
    try {
      // Send message via Discord SDK
      await this.discordClient.sendUserMessage(BigInt(friendId), message);
      vscode.window.showInformationMessage('Message sent!');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to send message: ${error}`);
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Direct Messages</title>
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
    .search-box { margin-bottom: 15px; }
    input[type="text"] {
      width: 100%;
      padding: 8px;
      background: #2C2F33;
      color: #DCDDDE;
      border: 1px solid #40444B;
      border-radius: 4px;
      font-size: 12px;
    }
    input[type="text"]:focus { outline: none; border-color: #7289DA; }
    .dms-list { display: flex; flex-direction: column; gap: 4px; }
    .dm-item {
      background: #36393F;
      border: 1px solid #40444B;
      border-radius: 4px;
      padding: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: background 0.2s;
      cursor: pointer;
    }
    .dm-item:hover { background: #40444B; }
    .dm-info { flex: 1; min-width: 0; }
    .dm-username { font-weight: 600; font-size: 13px; color: #FFFFFF; }
    .dm-last { font-size: 11px; color: #72767D; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    button {
      padding: 6px 12px;
      background: #7289DA;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      margin-left: 8px;
    }
    button:hover { background: #5A77CC; }
    .empty-state {
      text-align: center;
      padding: 30px 10px;
      color: #72767D;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="header"><h2>💬 Direct Messages</h2></div>
  <div class="status" id="status">🔌 Connecting...</div>
  <div class="search-box">
    <input type="text" id="searchInput" placeholder="Search conversations..." />
  </div>
  <div class="dms-list" id="dmsList">
    <div class="empty-state">Loading messages...</div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let allDMs = [];

    function sendMessage(friendId, friendName) {
      vscode.postMessage({ type: 'openDM', friendId, friendName });
    }

    function filterDMs() {
      const searchTerm = document.getElementById('searchInput').value.toLowerCase();
      const filtered = allDMs.filter(dm =>
        dm.username.toLowerCase().includes(searchTerm)
      );
      updateDMList(filtered);
    }

    function updateDMList(dms, connected = true) {
      const list = document.getElementById('dmsList');
      const status = document.getElementById('status');

      if (connected !== undefined) {
        if (connected) {
          status.className = 'status connected';
          status.textContent = '🟢 Connected';
        } else {
          status.className = 'status disconnected';
          status.textContent = '🔴 Disconnected';
        }
      }

      if (!dms || dms.length === 0) {
        list.innerHTML = '<div class="empty-state">No conversations yet</div>';
        return;
      }

      list.innerHTML = dms.map(dm => \`
        <div class="dm-item" onclick="sendMessage('\${dm.id}', '\${dm.username}')">
          <div class="dm-info">
            <div class="dm-username">👤 \${dm.username}</div>
            <div class="dm-last">\${dm.lastMessage}</div>
          </div>
        </div>
      \`).join('');
    }

    window.addEventListener('message', event => {
      const { type, dms, connected } = event.data;
      if (type === 'dmListUpdate') {
        allDMs = dms || [];
        updateDMList(allDMs, connected);
      }
    });

    document.getElementById('searchInput').addEventListener('input', filterDMs);
    vscode.postMessage({ type: 'listDMs' });
  </script>
</body>
</html>`;
  }

  public dispose() {
    if (this.updateInterval) clearInterval(this.updateInterval);
  }
}
