import * as vscode from 'vscode';
import { DiscordClient } from '../gateway/discordClient';

interface MessageRecord {
  timestamp: Date;
  author: string;
  content: string;
  authorId: string;
}

/**
 * Provides a chat interface in the editor for Direct Messages
 * Uses Output Channel to display chat (interactive, writable)
 */
export class ChatViewProvider {
  private discordClient: DiscordClient | null = null;
  private messageHistory: Map<string, MessageRecord[]> = new Map();
  private outputChannels: Map<string, vscode.OutputChannel> = new Map();
  private currentUser: any = null;
  private currentChatFriendId: string | null = null;

  public setDiscordClient(client: DiscordClient): void {
    this.discordClient = client;
    this.currentUser = client.getCurrentUser();
    
    // Listen for incoming messages
    client.onMessage((message: any) => {
      this.handleIncomingMessage(message);
    });
  }

  /**
   * Handle incoming message from Discord
   */
  private handleIncomingMessage(message: any): void {
    // For DMs, channel_id is the sender's user ID
    const friendId = message.channel_id;
    const authorName = message.author?.username || 'Unknown';
    const authorId = message.author?.id || friendId;
    const content = message.content;

    console.log(`[ChatViewProvider] Message received:`, { friendId, authorName, contentLen: content?.length, currentChat: this.currentChatFriendId });

    // Add to message history
    this.addMessage(friendId, authorName, content, authorId);

    // If chat is open for this friend, refresh the display
    if (this.currentChatFriendId === friendId) {
      console.log(`[ChatViewProvider] Refreshing chat for open friend: ${friendId}`);
      const channel = this.outputChannels.get(friendId);
      if (channel) {
        // Need friend name from somewhere - for now, use author name
        this.refreshChatDisplay(friendId, authorName);
      }
    } else {
      console.log(`[ChatViewProvider] Chat not open for this friend. Current: ${this.currentChatFriendId}, Incoming: ${friendId}`);
    }
  }

  /**
   * Main entry point - open chat for a friend
   */
  async openChat(friendId: string, friendName: string): Promise<void> {
    if (!this.discordClient) {
      vscode.window.showErrorMessage('Discord not connected');
      return;
    }

    try {
      // Track which chat is currently open
      this.currentChatFriendId = friendId;

      // Get or create output channel for this friend
      let channel = this.outputChannels.get(friendId);
      if (!channel) {
        channel = vscode.window.createOutputChannel(`💬 ${friendName}`);
        this.outputChannels.set(friendId, channel);
      }

      // Display chat header
      this.refreshChatDisplay(friendId, friendName);
      
      // Show the output channel
      channel.show(true);

      // Offer to send message
      await this.promptSendMessage(friendId, friendName);
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to open chat: ${err}`);
    }
  }

  /**
   * Refresh chat display in output channel
   */
  private refreshChatDisplay(friendId: string, friendName: string): void {
    const channel = this.outputChannels.get(friendId);
    if (!channel) return;

    channel.clear();
    
    channel.appendLine('╔════════════════════════════════════════════════════════════════════════════════════╗');
    channel.appendLine(`║                        💬 CHAT WITH ${friendName.toUpperCase().padEnd(50)}║`);
    channel.appendLine('╚════════════════════════════════════════════════════════════════════════════════════╝');
    channel.appendLine('');

    const messages = this.messageHistory.get(friendId) || [];

    if (messages.length === 0) {
      channel.appendLine('    No messages yet. Start a conversation!');
      channel.appendLine('');
    } else {
      channel.appendLine('    ───────────────────────────────────────────────────────────────────────────────────');
      channel.appendLine('');
      for (const msg of messages) {
        const time = msg.timestamp.toLocaleTimeString();
        const author = msg.author;
        channel.appendLine(`    [${time}] ${author}:`);
        channel.appendLine(`    ${msg.content}`);
        channel.appendLine('');
      }
      channel.appendLine('    ───────────────────────────────────────────────────────────────────────────────────');
      channel.appendLine('');
    }
  }

  /**
   * Prompt user to send a message
   */
  private async promptSendMessage(friendId: string, friendName: string): Promise<void> {
    const message = await vscode.window.showInputBox({
      prompt: `Message to ${friendName}`,
      placeHolder: 'Type your message... (or press Escape to cancel)',
      ignoreFocusOut: false
    });

    if (message && message.trim()) {
      try {
        await this.discordClient!.sendUserMessage(friendId, message);
        
        // Add to message history
        this.addMessage(friendId, this.currentUser?.username || 'You', message, this.currentUser?.id || 'self');
        
        // Refresh chat display
        this.refreshChatDisplay(friendId, friendName);
        
        // Prompt again for continuous chat
        await this.promptSendMessage(friendId, friendName);
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to send message: ${err}`);
      }
    }
  }

  /**
   * Register provider with VS Code
   */
  static register(context: vscode.ExtensionContext, provider: ChatViewProvider): void {
    // No registration needed for output channel approach
    // Just initialize the provider
  }

  /**
   * Add message to history
   */
  private addMessage(friendId: string, author: string, content: string, authorId: string): void {
    if (!this.messageHistory.has(friendId)) {
      this.messageHistory.set(friendId, []);
    }

    this.messageHistory.get(friendId)!.push({
      timestamp: new Date(),
      author,
      content,
      authorId
    });
  }
}
