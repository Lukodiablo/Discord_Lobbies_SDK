import * as vscode from 'vscode';
import { DiscordClient } from '../gateway/discordClient';

export class DiscordStatusBar {
  private item: vscode.StatusBarItem;
  private discordClient: DiscordClient | null = null;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.item.name = 'Discord Status';
  }

  public setDiscordClient(client: DiscordClient): void {
    this.discordClient = client;
    
    // Update status on ready - NOT immediately on init
    client.onReady(() => {
      console.log('🔄 Discord Client READY: Updating StatusBar');
      this.updateStatus();
    });
  }

  private async updateStatus(): Promise<void> {
    if (!this.discordClient) {
      this.item.text = '$(broadcast) Discord: Disconnected';
      this.item.show();
      return;
    }

    try {
      const friends = await this.discordClient.fetchFriends();
      
      if (!friends) {
        this.item.text = '$(broadcast) Discord: Ready';
        this.item.show();
        return;
      }

      // Count online friends
      const onlineFriends = friends.filter((f: any) => f.status === 'online').length;
      
      // Show status bar with online count
      this.item.text = `$(broadcast) ${onlineFriends} friends online`;
      
      // Rich tooltip
      let tooltipText = `**Discord Status**\n\n`;
      tooltipText += `Friends Online: ${onlineFriends}\n`;
      tooltipText += `Total Friends: ${friends.length}\n`;
      tooltipText += `Your Status: Online`;
      
      this.item.tooltip = new vscode.MarkdownString(tooltipText);
      this.item.command = 'discord-vscode.focusDiscordPanel';
      
      this.item.show();
    } catch (err) {
      console.error('Error updating status bar:', err);
      this.item.text = '$(broadcast) Discord: Error';
      this.item.show();
    }
  }

  public refresh(): void {
    this.updateStatus();
  }

  public dispose(): void {
    this.item.dispose();
  }
}
