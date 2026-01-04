import * as vscode from 'vscode';
import { getDiscordClient, getContext } from '../extension';

/**
 * Real-time message event listener for lobbies
 * Polls Discord SDK for MESSAGE_CREATED events via message event queue
 * Caches messages in VS Code secrets for persistence across restarts
 */
export class LobbyMessagePoller {
  private static instance: LobbyMessagePoller;
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastMessageTimestamp = new Date();
  private readonly POLL_INTERVAL = 500; // Poll SDK every 500ms for real-time message events
  private messageCache: Map<string, any[]> = new Map(); // Cache: lobbyId -> messages[]

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
   * This hooks into Discord's MESSAGE_CREATED callback events
   */
  private async pollMessages() {
    const client = getDiscordClient();
    if (!client || !client.isConnected()) {
      return;
    }

    try {
      // Get message events from SDK (queued by MESSAGE_CREATED callback)
      const events = await client.getMessageEvents();
      
      if (events && events.length > 0) {
        console.log(`[LobbyMessagePoller] 💬 Received ${events.length} message events from SDK`);
        
        for (const event of events) {
          const messageId = event.message_id;
          const timestamp = event.timestamp;
          
          console.log(`[LobbyMessagePoller]   Message ID: ${messageId} at ${timestamp}`);
          
          // Emit event so extension can process it
          vscode.commands.executeCommand('discord-vscode._onMessageCreated', messageId, timestamp);
        }
      } else {
        // Silently skip when no events (very frequent)
      }
    } catch (error) {
      // Silently ignore polling errors to avoid spam in logs
    }
  }

  /**
   * Cache a lobby message in VS Code secrets for persistence
   */
  async cacheMessage(lobbyId: string, message: any) {
    try {
      const context = getContext();
      if (!context) return;

      const cacheKey = `lobby-messages-${lobbyId}`;
      const cachedStr = await context.secrets.get(cacheKey);
      let messages = cachedStr ? JSON.parse(cachedStr) : [];
      
      // Avoid duplicates
      if (!messages.find((m: any) => m.id === message.id)) {
        messages.push({
          id: message.id,
          author_id: message.author_id,
          content: message.content,
          timestamp: message.timestamp,
          cached_at: Date.now()
        });
        
        // Keep only last 100 messages
        if (messages.length > 100) {
          messages = messages.slice(-100);
        }
        
        await context.secrets.store(cacheKey, JSON.stringify(messages));
        console.log(`[LobbyMessagePoller] 💾 Cached message for lobby ${lobbyId}`);
      }
    } catch (error) {
      console.warn('[LobbyMessagePoller] Failed to cache message:', error);
    }
  }

  /**
   * Retrieve cached messages for a lobby from VS Code secrets
   */
  async getCachedMessages(lobbyId: string): Promise<any[]> {
    try {
      const context = getContext();
      if (!context) return [];

      const cacheKey = `lobby-messages-${lobbyId}`;
      const cachedStr = await context.secrets.get(cacheKey);
      return cachedStr ? JSON.parse(cachedStr) : [];
    } catch (error) {
      console.warn('[LobbyMessagePoller] Failed to retrieve cached messages:', error);
      return [];
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

/**
 * Cache a message for a lobby (used after receiving)
 */
export async function cacheLobbyChatMessage(lobbyId: string, message: any) {
  const poller = LobbyMessagePoller.getInstance();
  await poller.cacheMessage(lobbyId, message);
}

/**
 * Get cached messages for a lobby
 */
export async function getCachedLobbyChatMessages(lobbyId: string): Promise<any[]> {
  const poller = LobbyMessagePoller.getInstance();
  return await poller.getCachedMessages(lobbyId);
}
