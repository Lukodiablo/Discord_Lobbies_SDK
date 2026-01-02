import * as vscode from 'vscode';
import { DiscordClient } from '../gateway/discordClient';

export class DiscordTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly id: string,
    public readonly type: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
  ) {
    super(label, collapsibleState);
    this.iconPath = this.getIconPath();
  }

  private getIconPath(): any {
    switch (this.type) {
      case 'dm':
        return new vscode.ThemeIcon('mail');
      case 'no_dms':
        return new vscode.ThemeIcon('close');
      default:
        return new vscode.ThemeIcon('mail');
    }
  }
}

export class DirectMessagesTreeProvider implements vscode.TreeDataProvider<DiscordTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    DiscordTreeItem | undefined | null | void
  > = new vscode.EventEmitter<DiscordTreeItem | undefined | null | void>();

  readonly onDidChangeTreeData: vscode.Event<
    DiscordTreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private discordClient: DiscordClient | null = null;

  constructor() {}

  public setDiscordClient(client: DiscordClient): void {
    this.discordClient = client;
    
    // Refresh when Discord Client fires ready event - NOT immediately on init
    client.onReady(() => {
      console.log('🔄 Discord Client READY: Refreshing DirectMessagesTreeProvider');
      this.refresh();
    });
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire(null);
  }

  public getTreeItem(element: DiscordTreeItem): vscode.TreeItem {
    return element;
  }

  public getChildren(
    element?: DiscordTreeItem
  ): Thenable<DiscordTreeItem[]> {
    if (!this.discordClient) {
      return Promise.resolve([
        new DiscordTreeItem(
          'Loading Discord data...',
          'loading',
          'loading',
          vscode.TreeItemCollapsibleState.None
        ),
      ]);
    }

    // Root: Show all DMs (friends)
    if (!element) {
      return this.discordClient
        .fetchFriends()
        .then((friends: any[]) => {
          if (!friends || friends.length === 0) {
            return [
              new DiscordTreeItem(
                'No direct messages',
                'no_dms',
                'no_dms',
                vscode.TreeItemCollapsibleState.None
              ),
            ];
          }

          return friends.map((friend: any) => {
            const item = new DiscordTreeItem(
              `💬 ${friend.username}`,
              friend.id,
              'dm',
              vscode.TreeItemCollapsibleState.None
            );
            item.description = '📧 Direct Message';
            // Rich tooltip
            let tooltipText = `**${friend.username}**\n\n`;
            tooltipText += `💬 Direct Message Channel\n`;
            if (friend.id) {
              tooltipText += `🔗 User ID: ${friend.id.substring(0, 8)}...\n`;
            }
            tooltipText += `\n📨 Click to open chat`;
            item.tooltip = new vscode.MarkdownString(tooltipText);
            item.contextValue = 'dm';
            item.command = {
              title: 'Send Direct Message',
              command: 'discord-vscode.sendDMToFriend',
              arguments: [friend.id, friend.username],
            };
            return item;
          });
        })
        .catch((err: any) => {
          console.error('Failed to fetch friends:', err);
          return [
            new DiscordTreeItem(
              'Error loading direct messages',
              'error_dms',
              'error',
              vscode.TreeItemCollapsibleState.None
            ),
          ];
        });
    }

    return Promise.resolve([]);
  }
}
