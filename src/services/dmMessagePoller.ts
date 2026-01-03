import * as vscode from 'vscode';
import { getDiscordClient } from '../extension';

/**
 * Direct Message poller - polls for new DMs from friends
 * Since Discord SDK doesn't emit MESSAGE_CREATED for DMs,
 * we need to actively poll for them
 */
export class DMMessagePoller {
  private static instance: DMMessagePoller;
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastMessageIds = new Set<string>(); // Track seen message IDs
  private readonly POLL_INTERVAL = 10000; // Poll every 10 seconds for DMs
  private activeFriends: string[] = []; // Friends to poll for DMs

  private constructor() {}

  static getInstance(): DMMessagePoller {
    if (!DMMessagePoller.instance) {
      DMMessagePoller.instance = new DMMessagePoller();
    }
    return DMMessagePoller.instance;
  }

  /**
   * Set the list of friends to monitor for DMs
   */
  setActiveFriends(friendIds: string[]) {
    this.activeFriends = friendIds;
    console.log(`[DMMessagePoller] Monitoring ${friendIds.length} friends for DMs`);
  }

  /**
   * Start polling for DM messages
   * NOTE: Currently disabled - Discord SDK getUserMessages returns 0
   * All DM delivery is via RelayAPI polling instead
   */
  start() {
    if (this.pollingInterval) {
      return; // Already polling
    }

    // DM polling is disabled - relay API handles all message delivery
  }

  /**
   * Stop polling for DM messages
   */
  stop() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('[DMMessagePoller] Stopped');
    }
  }

  /**
   * Poll for new messages from each friend
   * NOTE: Discord SDK getUserMessages() returns 0 (doesn't work)
   * All DM delivery is handled by RelayAPI polling instead
   */
  private async pollDMs() {
    // DISABLED: Discord SDK getUserMessages returns 0 messages due to SDK limitation
    // DM delivery is handled entirely by RelayAPI polling (relayMessagePoller.ts)
    return;
  }

  /**
   * Check for new messages from a specific friend
   */
  private async checkFriendMessages(friendId: string) {
    const client = getDiscordClient();
    if (!client) {
      return;
    }

    try {
      const sdkAdapter = client.getSdkAdapter();
      if (!sdkAdapter) {
        return;
      }

      // Get latest 10 messages from this friend
      const messages = await sdkAdapter.getUserMessages(friendId, 10);
      if (!messages || messages.length === 0) {
        return;
      }

      // Check for new messages we haven't seen
      for (const msg of messages) {
        const msgId = msg.id.toString();
        
        if (!this.lastMessageIds.has(msgId)) {
          // New message found!
          this.lastMessageIds.add(msgId);
          
          console.log(`[DMMessagePoller] 💬 New DM from friend ${friendId}: ${msg.content.substring(0, 50)}`);
          
          // Trigger the same message handler as lobby messages
          vscode.commands.executeCommand('discord-vscode._onMessageCreated', msgId, Date.now());
        }
      }
    } catch (error) {
      // Silently ignore errors for individual friends
    }
  }
}

/**
 * Start the DM message poller
 */
export function startDMPoller() {
  const poller = DMMessagePoller.getInstance();
  poller.start();
}

/**
 * Stop the DM message poller
 */
export function stopDMPoller() {
  const poller = DMMessagePoller.getInstance();
  poller.stop();
}

/**
 * Update the list of friends to monitor
 */
export function updateDMPollerFriends(friendIds: string[]) {
  const poller = DMMessagePoller.getInstance();
  poller.setActiveFriends(friendIds);
}
