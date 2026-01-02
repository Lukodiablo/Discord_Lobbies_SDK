import * as vscode from 'vscode';
import { DiscordClient } from '../gateway/discordClient';

interface Friend {
  id: string;
  username: string;
  discriminator?: string;
  status?: string;
}

export class FriendsWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'discord-vscode.friendsView';

  private _view?: vscode.WebviewView;
  private discordClient: DiscordClient | null = null;

  constructor(
    private readonly _context: vscode.ExtensionContext,
  ) { 
    console.log('🚀 FriendsWebviewProvider CONSTRUCTOR called');
  }

  public setDiscordClient(client: DiscordClient): void {
    this.discordClient = client;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: any,
    _token: vscode.CancellationToken,
  ) {
    console.log('👥 FriendsWebviewProvider.resolveWebviewView called');
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        this._context.extensionUri
      ]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'listFriends':
          await this._listFriends();
          break;
        case 'sendDM':
          await this._sendDM(data.friendId, data.friendName);
          break;
        case 'copyId':
          await vscode.env.clipboard.writeText(data.friendId);
          vscode.window.showInformationMessage('Friend ID copied!');
          break;
      }
    });

    // Load friends when view becomes visible
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this._listFriends();
      }
    });

    // Initial load
    this._listFriends();
  }

  private async _listFriends() {
    if (!this.discordClient?.isConnected()) {
      this._view?.webview.postMessage({
        type: 'friendsUpdate',
        friends: [],
      });
      return;
    }

    try {
      const friends = await this.discordClient.fetchFriends();
      this._view?.webview.postMessage({
        type: 'friendsUpdate',
        friends: friends || [],
      });
    } catch (error) {
      this._view?.webview.postMessage({
        type: 'friendsUpdate',
        friends: [],
      });
    }
  }

  private async _sendDM(friendId: string, friendName: string) {
    if (!this.discordClient?.isConnected()) {
      vscode.window.showErrorMessage('Not connected to Discord');
      return;
    }

    const message = await vscode.window.showInputBox({
      prompt: `Send message to ${friendName}`,
      placeHolder: 'Type your message...',
    });

    if (!message) return;

    try {
      await this.discordClient.sendUserMessage(BigInt(friendId), message);
      vscode.window.showInformationMessage(`Message sent to ${friendName}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to send message: ${error}`);
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Friends</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui; background: #2C2F33; color: #DCDDDE; font-size: 13px; padding: 10px; }
    .friend-item { padding: 8px; margin: 2px 0; background: #36393F; border-left: 3px solid #7289DA; display: flex; justify-content: space-between; align-items: center; border-radius: 3px; }
    .friend-item:hover { background: #40444B; }
    button { padding: 4px 8px; background: #7289DA; color: white; border: none; border-radius: 3px; cursor: pointer; margin-left: 4px; }
    button:hover { background: #5A77CC; }
    .empty { text-align: center; padding: 20px; color: #72767D; }
  </style>
</head>
<body>
  <div id="friendsList"><div class="empty">Loading friends...</div></div>
  <script>
    const vscode = acquireVsCodeApi();
    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.type === 'friendsUpdate') {
        const html = (msg.friends && msg.friends.length > 0)
          ? msg.friends.map(f => \`<div class="friend-item"><span>\${f.username}</span><div><button onclick="send('\${f.id}', '\${f.username}')">Message</button><button onclick="copy('\${f.id}')">Copy</button></div></div>\`).join('')
          : '<div class="empty">No friends</div>';
        document.getElementById('friendsList').innerHTML = html;
      }
    });
    window.send = (id, name) => vscode.postMessage({ type: 'sendDM', friendId: id, friendName: name });
    window.copy = (id) => vscode.postMessage({ type: 'copyId', friendId: id });
    vscode.postMessage({ type: 'listFriends' });
  </script>
</body>
</html>`;
  }

  public dispose() {
  }
}
