import * as vscode from 'vscode';
import { DiscordClient } from '../gateway/discordClient';

/**
 * Quick access commands for better user experience
 * - Quick Message: Pick a friend and send message
 * - Quick Invite: Pick a friend to invite to a lobby
 */
export class QuickAccessCommands {
  private discordClient: DiscordClient | null = null;

  setDiscordClient(client: DiscordClient): void {
    this.discordClient = client;
  }

  async quickMessage(): Promise<void> {
    if (!this.discordClient) {
      vscode.window.showErrorMessage('Discord not connected');
      return;
    }

    try {
      const friends = await this.discordClient.fetchFriends();
      if (!friends || friends.length === 0) {
        vscode.window.showWarningMessage('No friends available');
        return;
      }

      // QuickPick list of friends
      const quickPick = vscode.window.createQuickPick();
      quickPick.title = '💬 Select friend to message';
      quickPick.placeholder = 'Search friends...';
      quickPick.items = friends.map((f: any) => ({
        label: `👤 ${f.username}`,
        description: '📧 Direct Message',
        detail: `Click to send message to ${f.username}`,
        id: f.id,
        username: f.username
      }));

      quickPick.show();

      quickPick.onDidChangeSelection(async (items) => {
        if (items.length > 0) {
          const selected = items[0] as any;
          quickPick.dispose();

          // Open message input
          const message = await vscode.window.showInputBox({
            prompt: `Message to ${selected.username}`,
            placeHolder: 'Type your message...'
          });

          if (message) {
            try {
              await this.discordClient!.sendUserMessage(selected.id, message);
              vscode.window.showInformationMessage(`✅ Message sent to ${selected.username}`);
            } catch (err) {
              vscode.window.showErrorMessage(`Failed to send message: ${err}`);
            }
          }
        }
      });
    } catch (err) {
      vscode.window.showErrorMessage(`Error: ${err}`);
    }
  }
}
