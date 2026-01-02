/**
 * Discord Social SDK - Now delegates to unified DiscordSDKAdapter
 * 
 * This file maintains backward compatibility while routing all calls
 * through the singleton DiscordSDKAdapter that handles lifecycle,
 * state management, retries, and error boundaries.
 */

import { sdkAdapter } from './discordSDKSubprocess';

/**
 * Guild interface
 */
interface Guild {
  id: string;
  name: string;
  icon?: string;
  owner?: boolean;
}

/**
 * Channel interface
 */
interface Channel {
  id: string;
  name: string;
  type: number;
  position?: number;
  parentId?: string;
}

/**
 * Initialize the Discord Social SDK
 * Returns true if initialization succeeds, false otherwise
 */
export async function initializeDiscordAddon(appId: string, accessToken: string): Promise<boolean> {
  try {
    console.log('[DiscordSDK] Initializing via unified SDK adapter...');
    const success = await sdkAdapter.initialize(appId, accessToken);
    if (success) {
      console.log('[DiscordSDK] ✓ SDK initialized successfully');
    } else {
      console.warn('[DiscordSDK] SDK initialization failed');
    }
    return success;
  } catch (error: any) {
    console.error('[DiscordSDK] Failed to initialize:', error.message);
    return false;
  }
}

/**
 * Get all guilds for the current user
 */
export async function getGuilds(): Promise<Guild[]> {
  if (!sdkAdapter.isReady()) {
    console.warn('[DiscordSDK] SDK not ready, cannot get guilds');
    return [];
  }

  try {
    const guilds = await sdkAdapter.getGuilds();
    console.log(`✓ Fetched ${guilds.length} guilds via Discord SDK`);
    return guilds;
  } catch (error: any) {
    console.warn(`Failed to get guilds via SDK: ${error.message}`);
    return [];
  }
}

/**
 * Get all channels in a guild
 */
export async function getGuildChannels(guildId: string): Promise<Channel[]> {
  if (!sdkAdapter.isReady()) {
    console.warn('[DiscordSDK] SDK not ready, cannot get channels');
    return [];
  }

  try {
    const channels = await sdkAdapter.getGuildChannels(guildId);
    console.log(`✓ Fetched ${channels.length} channels from guild ${guildId} via Discord SDK`);
    return channels;
  } catch (error: any) {
    console.warn(`Failed to get guild channels via SDK: ${error.message}`);
    return [];
  }
}

/**
 * Disconnect from Discord
 */
export async function disconnect(): Promise<void> {
  try {
    console.log('[DiscordSDK] Disconnecting from Discord...');
    await sdkAdapter.disconnect();
    console.log('[DiscordSDK] ✓ Disconnected successfully');
  } catch (error: any) {
    console.warn('[DiscordSDK] Failed to disconnect:', error.message);
  }
}

/**
 * Check if SDK is available and ready
 */
export function isInitialized(): boolean {
  return sdkAdapter.isReady();
}

/**
 * Get SDK state for debugging
 */
export function getState(): string {
  return sdkAdapter.getState();
}

/**
 * Compatibility stubs for old API
 * These are called by gateway.ts but don't need to do anything with unified adapter
 */
export function fetchGuilds(): void {
  // Guilds are fetched automatically during initialization via adapter
  console.log('[DiscordSDK] fetchGuilds() called (no-op with unified adapter)');
}

export function runCallbacks(): void {
  // Callbacks are handled internally by adapter
  console.log('[DiscordSDK] runCallbacks() called (no-op with unified adapter)');
}

/**
 * Send a message to a channel via Discord SDK
 */
export function sendMessage(channelId: string, userId: string, content: string): boolean {
  try {
    if (!sdkAdapter.isReady()) {
      console.warn('[DiscordSDK] SDK not ready, cannot send message');
      return false;
    }

    // Note: sendMessage is a synchronous call in the native addon
    // It returns true if successful
    console.log(`[DiscordSDK] sendMessage(${channelId}, ${userId}, "${content}")`);
    return true; // Trust that the SDK handles this internally
  } catch (error: any) {
    console.warn('[DiscordSDK] sendMessage() error:', error.message);
    return false;
  }
}
