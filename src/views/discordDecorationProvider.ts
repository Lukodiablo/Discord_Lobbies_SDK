import * as vscode from 'vscode';
import { DiscordClient } from '../gateway/discordClient';

/**
 * Provides file decorations (badges and colors) for Discord tree items
 * Shows online status for friends and activity indicators for channels
 */
export class DiscordDecorationProvider implements vscode.FileDecorationProvider {
  private _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
  readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

  private discordClient: DiscordClient | null = null;
  private friendStatusMap: Map<string, string> = new Map();

  public setDiscordClient(client: DiscordClient): void {
    this.discordClient = client;
    
    // Refresh decorations when client is ready - NOT immediately on init
    client.onReady(() => {
      console.log('🔄 Discord Client READY: Updating Decorations');
      this.updateFriendStatuses();
      this._onDidChangeFileDecorations.fire(undefined);
    });
  }

  private async updateFriendStatuses(): Promise<void> {
    if (!this.discordClient) return;

    try {
      const friends = await this.discordClient.fetchFriends();
      
      if (friends) {
        this.friendStatusMap.clear();
        // Since SDK doesn't provide status, mark all friends as available
        friends.forEach((friend: any) => {
          this.friendStatusMap.set(friend.id, 'available');
        });
      }
    } catch (err) {
      console.error('Failed to fetch friend data:', err);
    }
  }

  provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    // Only provide decorations for discord URIs
    if (uri.scheme !== 'discord') return undefined;

    const parts = uri.path.split('/');
    const type = parts[1]; // 'friend', 'channel', etc.
    const id = parts[2];

    // Decoration for friends (show available indicators)
    if (type === 'friend') {
      const status = this.friendStatusMap.get(id);
      
      // All friends in our list are reachable
      if (status) {
        return {
          badge: '✨',
          tooltip: 'Friend - Click to message',
          color: new vscode.ThemeColor('charts.blue'),
          propagate: true
        };
      }
    }

    // Decoration for active channels
    if (type === 'channel') {
      return {
        badge: '💬',
        tooltip: 'Text Channel',
        color: new vscode.ThemeColor('charts.blue'),
        propagate: true
      };
    }

    // Decoration for voice channels
    if (type === 'voice_channel') {
      return {
        badge: '🎤',
        tooltip: 'Voice Channel',
        color: new vscode.ThemeColor('charts.purple'),
        propagate: true
      };
    }

    return undefined;
  }

  public refresh(): void {
    this.updateFriendStatuses();
    this._onDidChangeFileDecorations.fire(undefined);
  }
}
