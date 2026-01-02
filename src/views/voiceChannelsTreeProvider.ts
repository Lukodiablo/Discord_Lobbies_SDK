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
      case 'voice_channel':
        return new vscode.ThemeIcon('symbol-parameter');
      case 'no_channels':
        return new vscode.ThemeIcon('close');
      default:
        return new vscode.ThemeIcon('symbol-parameter');
    }
  }
}

export class VoiceChannelsTreeProvider implements vscode.TreeDataProvider<DiscordTreeItem> {
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
    
    // Listen for ready event - NOT immediately on init
    client.onReady(() => {
      console.log('🔄 Discord Client READY: Refreshing VoiceChannelsTreeProvider');
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

    // Root: Show all voice channels grouped by guild
    if (!element) {
      return this.discordClient
        .fetchGuilds()
        .then((guilds: any[]) => {
          if (!guilds || guilds.length === 0) {
            return [
              new DiscordTreeItem(
                'No guilds found',
                'no_guilds',
                'error',
                vscode.TreeItemCollapsibleState.None
              ),
            ];
          }

          return guilds.map((guild: any) => {
            const item = new DiscordTreeItem(
              `🏢 ${guild.name}`,
              guild.id,
              'guild',
              vscode.TreeItemCollapsibleState.Collapsed
            );
            // Member count as description
            if (guild.member_count) {
              item.description = `👥 ${guild.member_count} members`;
            } else {
              item.description = '👥 Server';
            }
            // Rich tooltip
            let tooltipText = `**${guild.name}**\n\n`;
            if (guild.member_count) {
              tooltipText += `👥 Members: ${guild.member_count}\n`;
            }
            if (guild.id) {
              tooltipText += `🔗 Server ID: ${guild.id}\n`;
            }
            tooltipText += `\n🎤 Expand to view voice channels`;
            item.tooltip = new vscode.MarkdownString(tooltipText);
            return item;
          });
        })
        .catch((err: any) => {
          console.error('Failed to fetch guilds:', err);
          return [
            new DiscordTreeItem(
              'Error loading guilds',
              'error_guilds',
              'error',
              vscode.TreeItemCollapsibleState.None
            ),
          ];
        });
    }

    // Guild children: Show voice channels
    if (element.type === 'guild') {
      return this.discordClient
        .fetchGuildChannels(element.id)
        .then((channels: any[]) => {
          const voiceChannels = (channels || []).filter(
            (ch: any) => ch.type === 2
          );

          if (voiceChannels.length === 0) {
            return [
              new DiscordTreeItem(
                'No voice channels',
                `no_channels_${element.id}`,
                'no_channels',
                vscode.TreeItemCollapsibleState.None
              ),
            ];
          }

          return voiceChannels.map((channel: any) => {
            const item = new DiscordTreeItem(
              `🎤 ${channel.name}`,
              channel.id,
              'voice_channel',
              vscode.TreeItemCollapsibleState.None
            );
            // Add user count as description if available
            if (channel.user_limit) {
              item.description = `👥 ${channel.user_limit} slots`;
            }
            // Add tooltip
            let tooltipText = `**${channel.name}**\n\nVoice Channel`;
            item.tooltip = new vscode.MarkdownString(tooltipText);
            item.command = {
              title: 'Join Voice Channel',
              command: 'discord-vscode.joinVoiceChannel',
              arguments: [channel.id, channel.name],
            };
            return item;
          });
        })
        .catch((err: any) => {
          console.error(`Failed to fetch channels for guild ${element.id}:`, err);
          return [
            new DiscordTreeItem(
              'Error loading channels',
              `error_channels_${element.id}`,
              'error',
              vscode.TreeItemCollapsibleState.None
            ),
          ];
        });
    }

    return Promise.resolve([]);
  }
}
