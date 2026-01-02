import * as vscode from 'vscode';
import { DiscordClient } from '../gateway/discordClient';
import { ChatViewProvider } from './chatViewProvider';

/**
 * Tree item representing a server, channel, DM, or status
 */
class DiscordTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly id: string,
    public readonly type: 'guild' | 'channel' | 'voice' | 'dm' | 'dms_root' | 'loading' | 'error' | 'friend',
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.tooltip = label;
    
    // Set icons based on type
    switch (type) {
      case 'guild':
        this.iconPath = new vscode.ThemeIcon('server');
        this.description = 'Server';
        break;
      case 'channel':
        this.iconPath = new vscode.ThemeIcon('comment-discussion');
        this.description = 'Text Channel';
        break;
      case 'voice':
        this.iconPath = new vscode.ThemeIcon('unmute');
        this.description = 'Voice Channel';
        break;
      case 'dm':
        this.iconPath = new vscode.ThemeIcon('person');
        this.description = 'Direct Message';
        break;
      case 'friend':
        this.iconPath = new vscode.ThemeIcon('account');
        this.contextValue = 'friend';
        break;
      case 'dms_root':
        this.iconPath = new vscode.ThemeIcon('comment');
        this.description = 'Direct Messages';
        break;
      case 'loading':
        this.iconPath = new vscode.ThemeIcon('loading~spin');
        break;
      case 'error':
        this.iconPath = new vscode.ThemeIcon('error');
        this.description = 'Error';
        break;
    }
  }
}

/**
 * ServerTreeProvider: Displays Discord servers and channels from Gateway data
 * Powered by the DiscordGateway WebSocket connection
 */
export class ServerTreeProvider implements vscode.TreeDataProvider<DiscordTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<DiscordTreeItem | undefined | null | void> = 
    new vscode.EventEmitter<DiscordTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<DiscordTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private discordClient: DiscordClient | null = null;
  private chatViewProvider: ChatViewProvider | null = null;

  /**
   * Inject the Discord Client instance
   */
  setDiscordClient(client: DiscordClient): void {
    this.discordClient = client;
    
    // Listen for Discord Client READY event
    client.onReady(() => {
      console.log('🔄 Discord Client READY: Refreshing ServerTreeProvider');
      this.refresh();
    });
  }

  /**
   * Set the chat view provider for opening DMs
   */
  setChatViewProvider(provider: ChatViewProvider): void {
    this.chatViewProvider = provider;
  }

  /**
   * Refresh the tree view
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Get the tree item for display
   */
  getTreeItem(element: DiscordTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get children of a tree node
   */
  async getChildren(element?: DiscordTreeItem): Promise<DiscordTreeItem[]> {
    // Not connected to Discord Client yet
    if (!this.discordClient) {
      return [
        new DiscordTreeItem(
          'Initializing Discord...',
          'init',
          'loading',
          vscode.TreeItemCollapsibleState.None
        )
      ];
    }

    // Discord Client not yet connected
    if (!this.discordClient.isConnected()) {
      return [
        new DiscordTreeItem(
          'Connecting to Discord...',
          'connecting',
          'loading',
          vscode.TreeItemCollapsibleState.None
        )
      ];
    }

    // Root level: Show Friends FIRST (primary), then Servers (collapsible group)
    if (!element) {
      const rootItems: DiscordTreeItem[] = [];

      // 👥 FRIENDS - PRIMARY SECTION (expanded by default)
      const friendsRoot = new DiscordTreeItem(
        '👥 FRIENDS',
        'friends_root',
        'dms_root',
        vscode.TreeItemCollapsibleState.Expanded
      );
      friendsRoot.description = '🌟 Your contacts';
      rootItems.push(friendsRoot);

      // Fetch guilds dynamically
      return this.discordClient.fetchGuilds()
        .then(guilds => {
          // 🏢 SERVERS - SECONDARY SECTION (collapsed by default to avoid clutter)
          if (guilds && guilds.length > 0) {
            const serversRoot = new DiscordTreeItem(
              '🏢 SERVERS',
              'servers_root',
              'dms_root',
              vscode.TreeItemCollapsibleState.Collapsed
            );
            serversRoot.description = `📊 ${guilds.length} servers`;
            rootItems.push(serversRoot);
          }
          
          return rootItems;
        })
        .catch((err: any) => {
          console.error('Failed to fetch guilds:', err);
          return rootItems;
        });
    }

    // Servers root: Show all servers
    if (element.type === 'dms_root' && element.id === 'servers_root') {
      return this.discordClient.fetchGuilds()
        .then(guilds => {
          if (!guilds || guilds.length === 0) {
            return [
              new DiscordTreeItem(
                'No servers',
                'no_guilds',
                'error',
                vscode.TreeItemCollapsibleState.None
              )
            ];
          }

          return guilds.map((guild: any) => {
            const item = new DiscordTreeItem(
              `🏢 ${guild.name}`,
              guild.id,
              'guild',
              vscode.TreeItemCollapsibleState.Collapsed
            );
            if (guild.member_count) {
              item.description = `👥 ${guild.member_count}`;
            }
            let tooltipText = `**${guild.name}**\n\n👥 Members: ${guild.member_count}\n\n📂 Expand to view channels`;
            item.tooltip = new vscode.MarkdownString(tooltipText);
            return item;
          });
        })
        .catch((err: any) => {
          console.error('Failed to fetch guilds:', err);
          return [
            new DiscordTreeItem(
              'Error loading servers',
              'error_guilds',
              'error',
              vscode.TreeItemCollapsibleState.None
            )
          ];
        });
    }

    // Friends root: Show friends list
    if (element.type === 'dms_root' && element.id === 'friends_root') {
      return this.discordClient.fetchFriends()
        .then(friends => {
          if (!friends || friends.length === 0) {
            return [
              new DiscordTreeItem(
                'No friends found',
                'no_friends',
                'error',
                vscode.TreeItemCollapsibleState.None
              )
            ];
          }
          
          // Sort friends alphabetically by username
          const sortedFriends = [...friends].sort((a, b) => 
            a.username.toLowerCase().localeCompare(b.username.toLowerCase())
          );
          
          return sortedFriends.map((friend: any) => {
            const item = new DiscordTreeItem(
              `👤 ${friend.username}`,
              friend.id,
              'friend',
              vscode.TreeItemCollapsibleState.None
            );
            item.description = '💬 Open chat';
            // Rich tooltip
            let tooltipText = `**${friend.username}**\n\n`;
            tooltipText += `📧 Discord User\n`;
            if (friend.id) {
              tooltipText += `🔗 ID: ${friend.id.substring(0, 8)}...\n`;
            }
            tooltipText += `\n✨ Click to open direct message chat`;
            item.tooltip = new vscode.MarkdownString(tooltipText);
            item.contextValue = 'friend';
            
            // Open chat when clicked
            item.command = {
              title: 'Open Chat',
              command: 'discord-vscode.openChat',
              arguments: [friend.id, friend.username]
            };
            
            return item;
          });
        })
        .catch((err: any) => {
          console.error('Failed to fetch friends:', err);
          return [
            new DiscordTreeItem(
              'Error loading friends',
              'error_friends',
              'error',
              vscode.TreeItemCollapsibleState.None
            )
          ];
        });
    }

    // Guild: Show its channels
    if (element.type === 'guild') {
      // Fetch channels dynamically
      return this.discordClient.fetchGuildChannels(element.id)
        .then(channels => {
          if (!channels || channels.length === 0) {
            return [
              new DiscordTreeItem(
                'No channels',
                `${element.id}_empty`,
                'error',
                vscode.TreeItemCollapsibleState.None
              )
            ];
          }
          
          console.log(`[TreeProvider] Guild ${element.id} has ${channels.length} channels`);
          channels.forEach((c: any) => console.log(`  Channel: ${c.name} type=${c.type} (${typeof c.type})`));
          
          return channels
            .filter((c: any) => c.type === 0 || c.type === 2)
            .map((channel: any) => {
              const item = new DiscordTreeItem(
                channel.type === 0 ? `# ${channel.name}` : `🎤 ${channel.name}`,
                `${element.id}_${channel.id}`,
                channel.type === 0 ? 'channel' : 'voice',
                vscode.TreeItemCollapsibleState.None
              );
              item.command = {
                command: 'discord-vscode.selectChannel',
                title: 'Select Channel',
                arguments: [channel.id, channel.name]
              };
              return item;
            });
        })
        .catch((err: any) => {
          console.error('Failed to fetch channels:', err);
          return [
            new DiscordTreeItem(
              'Error loading channels',
              `${element.id}_error`,
              'error',
              vscode.TreeItemCollapsibleState.None
            )
          ];
        });
    }



    return [];
  }
}