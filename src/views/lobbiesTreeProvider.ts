import * as vscode from 'vscode';
import { DiscordClient } from '../gateway/discordClient';
import { getContext } from '../extension';

class LobbyItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly lobbyId: string,
    public readonly type: 'root' | 'lobby' | 'send_message' | 'leave' | 'share_code' | 'toggle_mute' | 'toggle_deaf' | 'connect_voice' | 'disconnect_voice' | 'empty' | 'error',
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly secret?: string,
  ) {
    super(label, collapsibleState);
    this.setIcon();
    this.contextValue = this.type;
    
    // Show secret in tooltip if available
    if (secret) {
      this.tooltip = `ID: ${lobbyId}\nSecret: ${secret}`;
      this.description = `[Secret: ${secret.substring(0, 6)}...]`;
    } else {
      this.tooltip = `ID: ${lobbyId}`;
    }
    
    // Set command for lobby items to select them in chat view
    if (this.type === 'lobby') {
      this.command = {
        title: 'Select Lobby for Chat',
        command: 'discord-vscode.selectLobbyChat',
        arguments: [this]
      };
    }
  }

  private setIcon(): void {
    switch (this.type) {
      case 'lobby':
        this.iconPath = new vscode.ThemeIcon('group');
        break;
      case 'send_message':
        this.iconPath = new vscode.ThemeIcon('comment');
        break;
      case 'leave':
        this.iconPath = new vscode.ThemeIcon('close');
        break;
      case 'share_code':
        this.iconPath = new vscode.ThemeIcon('file-code');
        break;
      case 'toggle_mute':
        this.iconPath = new vscode.ThemeIcon('microphone');
        break;
      case 'toggle_deaf':
        this.iconPath = new vscode.ThemeIcon('unmute');
        break;
      case 'connect_voice':
        this.iconPath = new vscode.ThemeIcon('call-incoming');
        break;
      case 'disconnect_voice':
        this.iconPath = new vscode.ThemeIcon('call-outgoing');
        break;
      case 'error':
        this.iconPath = new vscode.ThemeIcon('error');
        break;
      default:
        this.iconPath = new vscode.ThemeIcon('folder');
    }
  }
}

export class LobbiesTreeProvider implements vscode.TreeDataProvider<LobbyItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<LobbyItem | undefined | null | void> = 
    new vscode.EventEmitter<LobbyItem | undefined | null | void>();

  readonly onDidChangeTreeData: vscode.Event<LobbyItem | undefined | null | void> = 
    this._onDidChangeTreeData.event;

  private discordClient: DiscordClient | null = null;
  private lobbyFetchInProgress = false;
  private cachedLobbies: string[] = [];
  private lastFetchTime = 0;
  private CACHE_TTL = 3000; // 3 second cache

  public setDiscordClient(client: DiscordClient): void {
    this.discordClient = client;
    
    // Listen for ready event - NOT immediately on init
    client.onReady(() => {
      console.log('🔄 Discord Client READY: Refreshing LobbiesTreeProvider');
      this.refresh();
    });
  }

  public refresh(): void {
    console.log('[LobbiesTreeProvider] refresh() called - firing tree data change event');
    this._onDidChangeTreeData.fire(null);
  }

  public getTreeItem(element: LobbyItem): vscode.TreeItem {
    return element;
  }

  public getChildren(element?: LobbyItem): Thenable<LobbyItem[]> {
    if (!this.discordClient) {
      return Promise.resolve([
        new LobbyItem(
          'Loading Discord data...',
          '',
          'error',
          vscode.TreeItemCollapsibleState.None
        ),
      ]);
    }

    // Root: show all active lobbies
    if (!element) {
      const context = getContext();
      const currentLobby = context?.workspaceState.get('currentLobby') as any;
      
      console.log('[LobbiesTreeProvider.getChildren] currentLobby from state:', currentLobby);
      
      // If we have a current lobby, show it first (even if SDK doesn't have it yet)
      const items: LobbyItem[] = [];
      if (currentLobby && currentLobby.id) {
        console.log(`📍 Found current lobby in state: ${currentLobby.id}`);
        items.push(new LobbyItem(
          `📍 ${currentLobby.title || 'Current Lobby'}`,
          currentLobby.id,
          'lobby',
          vscode.TreeItemCollapsibleState.Collapsed,
          currentLobby.secret
        ));
      }

      // Return cached if fresh
      const now = Date.now();
      if (this.cachedLobbies.length > 0 && (now - this.lastFetchTime) < this.CACHE_TTL) {
        console.log('📦 Lobbies tree using cache, avoiding duplicate fetch');
        const cachedItems = this.cachedLobbies.map((id: string) => 
          new LobbyItem(
            `Lobby ${id.substring(0, 12)}...`,
            id,
            'lobby',
            vscode.TreeItemCollapsibleState.Collapsed
          )
        );
        // Avoid duplicate if current lobby is also in SDK list
        const filteredCached = cachedItems.filter(item => 
          !currentLobby || item.lobbyId !== currentLobby.id
        );
        return Promise.resolve([...items, ...filteredCached]);
      }

      // Prevent concurrent fetches
      if (this.lobbyFetchInProgress) {
        console.warn('⚠️  Lobby fetch already in progress, skipping duplicate');
        return Promise.resolve(
          items.length > 0 ? items : [
            new LobbyItem(
              'Fetching...',
              '',
              'empty',
              vscode.TreeItemCollapsibleState.None
            ),
          ]
        );
      }

      this.lobbyFetchInProgress = true;
      console.log('🔄 Starting lobby fetch...');

      return this.discordClient
        .getLobbyIds()
        .then((lobbyIds: string[]) => {
          this.lobbyFetchInProgress = false;
          this.lastFetchTime = Date.now();

          if (!lobbyIds || lobbyIds.length === 0) {
            this.cachedLobbies = [];
            // Still show current lobby even if no SDK lobbies
            if (items.length > 0) {
              return items;
            }
            return [
              new LobbyItem(
                'No active lobbies',
                '',
                'empty',
                vscode.TreeItemCollapsibleState.None
              ),
            ];
          }

          this.cachedLobbies = lobbyIds;
          const sdkItems = lobbyIds.map((id: string) => 
            new LobbyItem(
              `Lobby ${id.substring(0, 12)}...`,
              id,
              'lobby',
              vscode.TreeItemCollapsibleState.Collapsed
            )
          );
          
          // Filter out duplicates
          const filteredSdk = sdkItems.filter(item => 
            !currentLobby || item.lobbyId !== currentLobby.id
          );
          
          return [...items, ...filteredSdk];
        })
        .catch((err: any) => {
          this.lobbyFetchInProgress = false;
          console.error('❌ Failed to fetch lobbies:', err);
          return [
            new LobbyItem(
              `Error: ${err.message || 'failed to load'}`,
              '',
              'error',
              vscode.TreeItemCollapsibleState.None
            ),
          ];
        });
    }

    // Show members for selected lobby
    if (element.type === 'lobby') {
      // Show quick actions for the lobby
      return Promise.resolve([
        new LobbyItem(
          '💬 Send Message',
          element.lobbyId,
          'send_message',
          vscode.TreeItemCollapsibleState.None
        ),
        new LobbyItem(
          '� Share Code',
          element.lobbyId,
          'share_code',
          vscode.TreeItemCollapsibleState.None
        ),
        new LobbyItem(
          '📞 Connect Voice',
          element.lobbyId,
          'connect_voice',
          vscode.TreeItemCollapsibleState.None
        ),
        new LobbyItem(
          '🎤 Toggle Microphone',
          element.lobbyId,
          'toggle_mute',
          vscode.TreeItemCollapsibleState.None
        ),
        new LobbyItem(
          '🔊 Toggle Audio',
          element.lobbyId,
          'toggle_deaf',
          vscode.TreeItemCollapsibleState.None
        ),
        new LobbyItem(
          '�👋 Leave Lobby',
          element.lobbyId,
          'leave',
          vscode.TreeItemCollapsibleState.None
        ),
      ]);
    }

    return Promise.resolve([]);
  }
}
