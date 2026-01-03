import * as vscode from 'vscode';
import { getDiscordClient } from '../extension';

/**
 * Real-time message event listener for lobbies
 * Polls for new messages and updates the tree view
 */
export class LobbyMessagePoller {
  private static instance: LobbyMessagePoller;
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastMessageTimestamp = new Date();
  private readonly POLL_INTERVAL = 2000; // Poll every 2 seconds for lobby messages (was 500ms - too spammy)

  private constructor() {}

  static getInstance(): LobbyMessagePoller {
    if (!LobbyMessagePoller.instance) {
      LobbyMessagePoller.instance = new LobbyMessagePoller();
    }
    return LobbyMessagePoller.instance;
  }

  /**
   * Start polling for message events
   */
  start() {
    if (this.pollingInterval) {
      return; // Already polling
    }

    console.log('[LobbyMessagePoller] Starting message event poller...');
    this.pollingInterval = setInterval(() => this.pollMessages(), this.POLL_INTERVAL);
  }

  /**
   * Stop polling for message events
   */
  stop() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('[LobbyMessagePoller] Stopped');
    }
  }

  /**
   * Poll for new message events from SDK
   */
  private async pollMessages() {
    const client = getDiscordClient();
    if (!client || !client.isConnected()) {
      return;
    }

    try {
      const events = await client.getMessageEvents();
      
      if (events && events.length > 0) {
        console.log(`[LobbyMessagePoller] 💬 Received ${events.length} new message events`);
        
        for (const event of events) {
          const messageId = event.message_id;
          const timestamp = event.timestamp;
          
          console.log(`[LobbyMessagePoller]   Message ID: ${messageId} at ${timestamp}`);
          
          // Emit event so tree provider and UI can react
          vscode.commands.executeCommand('discord-vscode._onMessageCreated', messageId, timestamp);
        }
      }
    } catch (error) {
      // Silently ignore polling errors to avoid spam in logs
    }
  }
}

/**
 * Start the real-time message poller
 */
export function startMessagePoller() {
  const poller = LobbyMessagePoller.getInstance();
  poller.start();
}

/**
 * Stop the real-time message poller
 */
export function stopMessagePoller() {
  const poller = LobbyMessagePoller.getInstance();
  poller.stop();
}
