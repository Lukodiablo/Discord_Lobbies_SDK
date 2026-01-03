import * as vscode from 'vscode';
import { getLobbyMessages } from './relayAPI';

/**
 * Relay Message Poller - polls relay API for messages meant for this extension
 * This is the PRIMARY message delivery mechanism for cross-device message sync
 */
export class RelayMessagePoller {
  private static instance: RelayMessagePoller;
  private pollingInterval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL = 2000; // Poll every 2 seconds
  private lastMessageIds = new Set<string>();
  private monitoredLobbies: string[] = [];

  private constructor() {}

  static getInstance(): RelayMessagePoller {
    if (!RelayMessagePoller.instance) {
      RelayMessagePoller.instance = new RelayMessagePoller();
    }
    return RelayMessagePoller.instance;
  }

  /**
   * Set which lobbies to monitor for relayed messages
   */
  setMonitoredLobbies(lobbyIds: string[]) {
    this.monitoredLobbies = lobbyIds;
    console.log(`[RelayMessagePoller] Monitoring ${lobbyIds.length} lobbies`);
  }

  /**
   * Start polling relay API for messages
   */
  start() {
    if (this.pollingInterval) {
      return; // Already polling
    }

    console.log('[RelayMessagePoller] Starting relay message poller (2s interval)...');
    this.pollingInterval = setInterval(() => this.pollRelayMessages(), this.POLL_INTERVAL);
  }

  /**
   * Stop polling relay API
   */
  stop() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('[RelayMessagePoller] Stopped');
    }
  }

  /**
   * Poll each monitored lobby for relayed messages
   */
  private async pollRelayMessages() {
    if (this.monitoredLobbies.length === 0) {
      return;
    }

    for (const lobbyId of this.monitoredLobbies) {
      try {
        const messages = await getLobbyMessages(lobbyId);
        if (!messages || messages.length === 0) {
          continue;
        }

        // Check for new messages we haven't seen
        for (const msg of messages) {
          const msgId = msg.id || msg.message_id;
          if (msgId && !this.lastMessageIds.has(msgId)) {
            this.lastMessageIds.add(msgId);
            
            console.log(`[RelayMessagePoller] 📡 New message in lobby ${lobbyId}`);
            
            // Trigger message handler to show notification
            vscode.commands.executeCommand('discord-vscode._onMessageCreated', msgId, Date.now());
          }
        }
      } catch (error) {
        // Silently ignore polling errors
      }
    }
  }
}

/**
 * Start the relay message poller
 */
export function startRelayPoller() {
  const poller = RelayMessagePoller.getInstance();
  poller.start();
}

/**
 * Stop the relay message poller
 */
export function stopRelayPoller() {
  const poller = RelayMessagePoller.getInstance();
  poller.stop();
}

/**
 * Update the list of lobbies to monitor
 */
export function updateRelayPollerLobbies(lobbyIds: string[]) {
  const poller = RelayMessagePoller.getInstance();
  poller.setMonitoredLobbies(lobbyIds);
}
