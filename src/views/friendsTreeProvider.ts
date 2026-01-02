import * as vscode from 'vscode';
import { DiscordClient } from '../gateway/discordClient';

export class FriendTreeItem extends vscode.TreeItem {
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
      case 'friend':
        return new vscode.ThemeIcon('person');
      case 'no_friends':
        return new vscode.ThemeIcon('person');
      default:
        return new vscode.ThemeIcon('person');
    }
  }
}

export class FriendsTreeProvider implements vscode.TreeDataProvider<FriendTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    FriendTreeItem | undefined | null | void
  > = new vscode.EventEmitter<FriendTreeItem | undefined | null | void>();

  readonly onDidChangeTreeData: vscode.Event<
    FriendTreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private discordClient: DiscordClient | null = null;

  constructor() {}

  public setDiscordClient(client: DiscordClient): void {
    this.discordClient = client;
    
    // Refresh when Discord Client fires ready event - NOT immediately on init
    client.onReady(() => {
      console.log('🔄 Discord Client READY: Refreshing FriendsTreeProvider');
      this.refresh();
    });
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire(null);
  }

  public getTreeItem(element: FriendTreeItem): vscode.TreeItem {
    return element;
  }

  public getChildren(
    element?: FriendTreeItem
  ): Thenable<FriendTreeItem[]> {
    if (!this.discordClient) {
      return Promise.resolve([
        new FriendTreeItem(
          'Loading Discord data...',
          'loading',
          'loading',
          vscode.TreeItemCollapsibleState.None
        ),
      ]);
    }

    // Root: Show all friends
    if (!element) {
      return this.discordClient
        .fetchFriends()
        .then((friends: any[]) => {
          if (!friends || friends.length === 0) {
            return [
              new FriendTreeItem(
                'No friends',
                'no_friends',
                'no_friends',
                vscode.TreeItemCollapsibleState.None
              ),
            ];
          }

          return friends.map((friend: any) => {
            const item = new FriendTreeItem(
              `👤 ${friend.username}`,
              friend.id,
              'friend',
              vscode.TreeItemCollapsibleState.None
            );
            // Show action instead of fake status
            item.description = '💬 Send message';
            // Rich tooltip with actual data
            let tooltipText = `**${friend.username}**\n\n`;
            tooltipText += `📧 Discord User\n`;
            if (friend.id) {
              tooltipText += `🔗 ID: ${friend.id.substring(0, 8)}...\n`;
            }
            tooltipText += `\n✨ Click to send direct message`;
            item.tooltip = new vscode.MarkdownString(tooltipText);
            item.contextValue = 'friend';
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
            new FriendTreeItem(
              'Error loading friends',
              'error_friends',
              'error',
              vscode.TreeItemCollapsibleState.None
            ),
          ];
        });
    }

    return Promise.resolve([]);
  }
}
