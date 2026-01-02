/**
 * Discord SDK Adapter - Subprocess Edition
 * 
 * Drop-in replacement for the old C++ addon.
 * Uses Rust subprocess for clean, simple IPC communication.
 */

import { EventEmitter } from 'events';
import DiscordSubprocess from './discordSubprocess';

type SDKState = 'UNINITIALIZED' | 'CONNECTING' | 'READY' | 'ERROR' | 'DISCONNECTED';

interface Guild {
    id: string;
    name: string;
    icon?: string;
    owner?: boolean;
}

interface Channel {
    id: string;
    name: string;
    type: number;
    position?: number;
    parentId?: string;
}

interface DMChannel {
    id: string;
    recipientId: string;
    recipientName: string;
    lastMessageId?: string;
}

/**
 * Discord SDK Adapter using Rust subprocess
 */
export class DiscordSDKAdapter extends EventEmitter {
    private static instance: DiscordSDKAdapter | null = null;

    private state: SDKState = 'UNINITIALIZED';
    private subprocess: DiscordSubprocess | null = null;
    private appId: string = '';
    private token: string = '';
    private guilds: Map<string, Guild> = new Map();
    private channels: Map<string, Channel> = new Map();
    
    // MEMORY OPTIMIZATION: Cache lobby IDs to avoid repeated SDK calls
    private cachedLobbyIds: string[] = [];
    private lastLobbyFetch: number = 0;
    private LOBBY_CACHE_TTL: number = 5000; // 5 second cache
    
    // USER NAME CACHE: Maps user IDs to usernames
    private userNameCache: Map<string, string> = new Map();
    private friendListCache: any[] | null = null;
    private lastFriendFetch: number = 0;
    private FRIEND_CACHE_TTL: number = 10000; // 10 second cache

    private constructor() {
        super();
        console.log('[DiscordSDKAdapter] Created');
    }

    /**
     * Get singleton instance
     */
    static getInstance(): DiscordSDKAdapter {
        if (!DiscordSDKAdapter.instance) {
            DiscordSDKAdapter.instance = new DiscordSDKAdapter();
        }
        return DiscordSDKAdapter.instance;
    }

    /**
     * Reset singleton instance completely (call when switching Discord accounts)
     * This ensures no stale state affects new connections
     */
    static resetInstance(): void {
        if (DiscordSDKAdapter.instance) {
            console.log('[DiscordSDKAdapter] Resetting singleton instance for new account...');
            DiscordSDKAdapter.instance = null;
        }
    }

    /**
     * Get current state
     */
    getState(): SDKState {
        return this.state;
    }

    /**
     * Check if SDK is ready
     */
    isReady(): boolean {
        return this.state === 'READY' && this.subprocess !== null;
    }

    /**
     * Initialize the Discord SDK
     */
    async initialize(appId: string, token: string, sdkPath?: string): Promise<boolean> {
        // If already initialized with the SAME app ID and token, return ready state
        if ((this.state === 'CONNECTING' || this.state === 'READY') && 
            this.appId === appId && 
            this.token === token) {
            console.log('[DiscordSDKAdapter] Already initialized with same credentials');
            return this.isReady();
        }

        // If app ID or token changed, disconnect and restart
        if (this.appId !== appId || this.token !== token) {
            console.log('[DiscordSDKAdapter] App ID or token changed - reconnecting...');
            if (this.subprocess) {
                try {
                    await this.subprocess.disconnect();
                } catch (e) {
                    console.warn('[DiscordSDKAdapter] Error disconnecting old subprocess:', e);
                }
                this.subprocess = null;
            }
        }

        try {
            this.appId = appId;
            this.token = token;
            this.state = 'CONNECTING';
            this.emit('state-change', 'CONNECTING');

            console.log('[DiscordSDKAdapter] Initializing with app ID:', appId);

            // Start subprocess (pass SDK path if provided)
            if (!this.subprocess) {
                this.subprocess = new DiscordSubprocess(sdkPath);
                
                // Listen for SDK token to store
                this.subprocess.on('sdk-token', (token: string) => {
                    console.log('[DiscordSDKAdapter] Received SDK token, storing...');
                    // Store token via a global event that extension.ts can listen to
                    this.emit('token-received', token);
                });
                
                await this.subprocess.start();
            }

            // Initialize Discord with app ID and token
            console.log('[DiscordSDKAdapter] Sending initialization to subprocess with app_id:', appId);
            const success = await this.subprocess.initialize(appId, token);
            if (!success) {
                throw new Error('Failed to initialize Discord');
            }

            this.state = 'READY';
            this.emit('state-change', 'READY');
            console.log('[DiscordSDKAdapter] Initialized successfully');
            return true;
        } catch (error) {
            this.state = 'ERROR';
            this.emit('state-change', 'ERROR');
            console.error('[DiscordSDKAdapter] Initialization failed:', error);
            
            // Clean up subprocess without blocking
            if (this.subprocess) {
                this.subprocess.disconnect().catch(() => {});
                this.subprocess = null;
            }
            
            return false;
        }
    }

    /**
     * Get guilds (servers)
     */
    async getGuilds(): Promise<Guild[]> {
        if (!this.isReady() || !this.subprocess) {
            throw new Error('SDK not ready');
        }

        try {
            const result = await this.subprocess.executeCommand('get_guilds', {});
            const guilds: Guild[] = (result.guilds || []).map((g: any) => ({
                id: g.id,
                name: g.name,
                icon: g.icon,
                owner: g.owner,
            }));

            guilds.forEach(g => this.guilds.set(g.id, g));
            console.log('[DiscordSDKAdapter] Fetched', guilds.length, 'guilds');
            return guilds;
        } catch (error) {
            console.error('[DiscordSDKAdapter] Failed to get guilds:', error);
            throw error;
        }
    }

    /**
     * Get channels for a guild
     */
    async getGuildChannels(guildId: string): Promise<Channel[]> {
        if (!this.isReady() || !this.subprocess) {
            throw new Error('SDK not ready');
        }

        try {
            const result = await this.subprocess.executeCommand('get_guild_channels', {
                guild_id: guildId,
            });
            const channels: Channel[] = (result.channels || []).map((ch: any) => ({
                id: ch.id,
                name: ch.name,
                type: ch.type,
                position: ch.position,
                parentId: ch.parent_id,
            }));

            channels.forEach(c => this.channels.set(c.id, c));
            console.log('[DiscordSDKAdapter] Fetched', channels.length, 'channels for guild', guildId);
            return channels;
        } catch (error) {
            console.error('[DiscordSDKAdapter] Failed to get channels:', error);
            throw error;
        }
    }

    /**
     * Send a DM to a user
     */
    async sendDM(recipientId: string, content: string): Promise<string> {
        if (!this.isReady() || !this.subprocess) {
            throw new Error('SDK not ready');
        }

        try {
            const result = await this.subprocess.executeCommand('send_dm', {
                recipient_id: recipientId,
                content: content,
            });
            console.log('[DiscordSDKAdapter] DM sent, message ID:', result.message_id);
            return result.message_id;
        } catch (error) {
            console.error('[DiscordSDKAdapter] Failed to send DM:', error);
            throw error;
        }
    }

    /**
     * Send message to a user (alias for sendDM)
     */
    async sendUserMessage(userId: string, content: string): Promise<void> {
        try {
            await this.sendDM(userId, content);
            console.log('[DiscordSDKAdapter] Message sent to user:', userId);
        } catch (error) {
            console.error('[DiscordSDKAdapter] Failed to send user message:', error);
            throw error;
        }
    }

    /**
     * Get friends list
     */
    async getRelationships(): Promise<any[]> {
        if (!this.isReady() || !this.subprocess) {
            throw new Error('SDK not ready');
        }

        try {
            const result = await this.subprocess.executeCommand('get_relationships', {});
            const friends = result.friends || [];
            console.log('[DiscordSDKAdapter] Fetched', friends.length, 'friends');
            return friends;
        } catch (error) {
            console.error('[DiscordSDKAdapter] Failed to get relationships:', error);
            throw error;
        }
    }

    /**
     * Resolve a user ID to their username
     * Uses cached friend list to avoid repeated SDK calls
     */
    async resolveUsername(userId: string): Promise<string> {
        // Check if we already have it cached
        if (this.userNameCache.has(userId)) {
            return this.userNameCache.get(userId)!;
        }

        try {
            // Refresh friend list cache if expired
            const now = Date.now();
            if (!this.friendListCache || now - this.lastFriendFetch > this.FRIEND_CACHE_TTL) {
                console.log('[DiscordSDKAdapter] Refreshing friend list cache for username resolution');
                this.friendListCache = await this.getRelationships();
                this.lastFriendFetch = Date.now();
                
                // Build cache from fresh friend list
                for (const friend of this.friendListCache) {
                    if (friend.id && friend.username) {
                        this.userNameCache.set(friend.id, friend.username);
                    }
                }
            }

            // Look up in cache
            if (this.userNameCache.has(userId)) {
                return this.userNameCache.get(userId)!;
            }

            // Not found in friends list
            console.log(`[DiscordSDKAdapter] User ${userId} not in friends list`);
            return `User#${userId.substring(0, 8)}`; // Fallback to short ID
        } catch (error) {
            console.error('[DiscordSDKAdapter] Failed to resolve username:', error);
            return `User#${userId.substring(0, 8)}`; // Fallback on error
        }
    }

    /**
     * Create a lobby for code collaboration
     */
    async createLobby(secret: string, title: string, description: string): Promise<string> {
        if (!this.isReady() || !this.subprocess) {
            throw new Error('SDK not ready');
        }

        try {
            const result = await this.subprocess.executeCommand('create_lobby', {
                secret,
                title,
                description,
            });
            console.log('[DiscordSDKAdapter] Lobby created:', result.lobby_id);
            return result.lobby_id;
        } catch (error) {
            console.error('[DiscordSDKAdapter] Failed to create lobby:', error);
            throw error;
        }
    }

    /**
     * Send message to lobby
     */
    async sendLobbyMessage(lobbyId: string, content: string): Promise<void> {
        if (!this.isReady() || !this.subprocess) {
            throw new Error('SDK not ready');
        }

        try {
            // Ensure lobbyId is a string and not empty
            const lobbyIdStr = String(lobbyId).trim();
            if (!lobbyIdStr) {
                throw new Error('Invalid lobby ID');
            }

            await this.subprocess.executeCommand('send_lobby_message', {
                lobby_id: lobbyIdStr,
                content,
            });
            console.log('[DiscordSDKAdapter] Message sent to lobby:', lobbyIdStr);
        } catch (error) {
            console.error('[DiscordSDKAdapter] Failed to send lobby message:', error);
            throw error;
        }
    }

    /**
     * Get all lobbies the user is a member of
     * OPTIMIZED: Uses cache to prevent repeated SDK calls which can cause memory issues
     */
    async getLobbyIds(): Promise<string[]> {
        if (!this.isReady() || !this.subprocess) {
            throw new Error('SDK not ready');
        }

        // Return cached result if fresh (within 5 seconds)
        const now = Date.now();
        if (now - this.lastLobbyFetch < this.LOBBY_CACHE_TTL && this.cachedLobbyIds.length > 0) {
            console.log('[DiscordSDKAdapter] Returning cached lobby IDs:', this.cachedLobbyIds);
            return this.cachedLobbyIds;
        }

        try {
            console.log('[DiscordSDKAdapter] Fetching lobby IDs from SDK...');
            const result = await this.subprocess.executeCommand('get_lobby_ids', {});
            this.cachedLobbyIds = result.lobby_ids || [];
            this.lastLobbyFetch = Date.now();
            console.log('[DiscordSDKAdapter] Got lobby IDs:', this.cachedLobbyIds);
            return this.cachedLobbyIds;
        } catch (error) {
            console.error('[DiscordSDKAdapter] Failed to get lobby IDs:', error);
            // Return cached result as fallback
            return this.cachedLobbyIds;
        }
    }

    /**
     * Get metadata for a specific lobby (name, title, etc)
     */
    async getLobbyMetadata(lobbyId: string): Promise<any> {
        if (!this.isReady() || !this.subprocess) {
            throw new Error('SDK not ready');
        }

        try {
            console.log('[DiscordSDKAdapter] Fetching metadata for lobby:', lobbyId);
            const result = await this.subprocess.executeCommand('get_lobby', {
                lobby_id: lobbyId
            });
            
            if (result && result.metadata) {
                console.log('[DiscordSDKAdapter] Got lobby metadata:', result.metadata);
                return result.metadata;
            }
            
            return null;
        } catch (error) {
            console.error('[DiscordSDKAdapter] Failed to get lobby metadata:', error);
            throw error;
        }
    }

    /**
     * Leave a lobby
     */
    async leaveLobby(lobbyId: string): Promise<void> {
        if (!this.isReady() || !this.subprocess) {
            throw new Error('SDK not ready');
        }

        try {
            // First check if this lobby is actually in our active list
            const activeLobbies = await this.getLobbyIds();
            if (!activeLobbies.includes(lobbyId)) {
                console.warn('[DiscordSDKAdapter] Lobby not in active list, clearing state instead:', lobbyId);
                // Lobby already left or doesn't exist in SDK, just clear state and return
                this.clearCurrentLobby(lobbyId);
                return;
            }
            
            await this.subprocess.executeCommand('leave_lobby', {
                lobby_id: lobbyId,
            });
            console.log('[DiscordSDKAdapter] Left lobby:', lobbyId);
            
            // Clear the current lobby from workspace state
            this.clearCurrentLobby(lobbyId);
        } catch (error) {
            console.error('[DiscordSDKAdapter] Failed to leave lobby:', error);
            // Even on error, try to clear the state
            this.clearCurrentLobby(lobbyId);
            throw error;
        }
    }

    /**
     * Clear current lobby from workspace state
     */
    private clearCurrentLobby(lobbyId: string): void {
        try {
            const context = require('../extension').getContext();
            if (context) {
                const currentLobby = context.workspaceState.get('currentLobby') as any;
                if (currentLobby && currentLobby.id === lobbyId) {
                    console.log('[DiscordSDKAdapter] Clearing current lobby from state:', lobbyId);
                    context.workspaceState.update('currentLobby', null);
                    
                    // Refresh the lobbies tree
                    const lobbiesProvider = require('../extension').getLobbiesTreeProvider();
                    if (lobbiesProvider) {
                        console.log('[DiscordSDKAdapter] Refreshing lobbies tree');
                        lobbiesProvider.refresh();
                    }
                }
            }
        } catch (err) {
            console.warn('[DiscordSDKAdapter] Error clearing lobby state:', err);
        }
    }

    /**
     * Set microphone mute status
     */
    async setMute(mute: boolean): Promise<void> {
        if (!this.isReady() || !this.subprocess) {
            throw new Error('SDK not ready');
        }

        try {
            await this.subprocess.executeCommand('set_mute', { mute });
            console.log('[DiscordSDKAdapter] Mute set to:', mute);
        } catch (error) {
            console.error('[DiscordSDKAdapter] Failed to set mute:', error);
            throw error;
        }
    }

    /**
     * Get microphone mute status
     */
    async getMuteStatus(): Promise<{ muted: boolean }> {
        if (!this.isReady() || !this.subprocess) {
            throw new Error('SDK not ready');
        }

        try {
            const result = await this.subprocess.executeCommand('get_mute_status', {});
            return result as { muted: boolean };
        } catch (error) {
            console.error('[DiscordSDKAdapter] Failed to get mute status:', error);
            throw error;
        }
    }

    /**
     * Set deafen status (disable audio output)
     */
    async setDeaf(deaf: boolean): Promise<void> {
        if (!this.isReady() || !this.subprocess) {
            throw new Error('SDK not ready');
        }

        try {
            await this.subprocess.executeCommand('set_deaf', { deaf });
            console.log('[DiscordSDKAdapter] Deafen set to:', deaf);
        } catch (error) {
            console.error('[DiscordSDKAdapter] Failed to set deafen:', error);
            throw error;
        }
    }

    /**
     * Get deafen status
     */
    async getDeafStatus(): Promise<{ deafened: boolean }> {
        if (!this.isReady() || !this.subprocess) {
            throw new Error('SDK not ready');
        }

        try {
            const result = await this.subprocess.executeCommand('get_deaf_status', {});
            return result as { deafened: boolean };
        } catch (error) {
            console.error('[DiscordSDKAdapter] Failed to get deaf status:', error);
            throw error;
        }
    }

    /**
     * Get messages from a lobby
     */
    async getLobbyMessages(lobbyId: string, limit: number = 50): Promise<any[]> {
        if (!this.isReady() || !this.subprocess) {
            throw new Error('SDK not ready');
        }

        try {
            const messages = await this.subprocess.getLobbyMessages(lobbyId, limit);
            console.log('[DiscordSDKAdapter] Fetched', messages.length, 'messages from lobby:', lobbyId);
            return messages;
        } catch (error) {
            console.error('[DiscordSDKAdapter] Failed to get lobby messages:', error);
            throw error;
        }
    }

    /**
     * Get a specific message by ID
     */
    async getMessage(messageId: string): Promise<any | null> {
        if (!this.isReady() || !this.subprocess) {
            throw new Error('SDK not ready');
        }

        try {
            const message = await this.subprocess.getMessage(messageId);
            if (message) {
                console.log('[DiscordSDKAdapter] Fetched message:', messageId);
            } else {
                console.log('[DiscordSDKAdapter] Message not found:', messageId);
            }
            return message;
        } catch (error) {
            console.error('[DiscordSDKAdapter] Failed to get message:', error);
            throw error;
        }
    }

    /**
     * Stub methods for future implementation
     */
    async getLobbyHandle(lobbyId: string): Promise<any> {
        throw new Error('getLobbyHandle not yet implemented');
    }

    async createOrJoinLobby(secret: string): Promise<string> {
        if (!this.isReady() || !this.subprocess) {
            throw new Error('SDK not ready');
        }

        try {
            const result = await this.subprocess.executeCommand('create_or_join_lobby', {
                secret,
            });
            console.log('[DiscordSDKAdapter] Created or joined lobby:', result.lobby_id);
            // Clear cache since we may have a new lobby
            this.cachedLobbyIds = [];
            this.lastLobbyFetch = 0;
            return result.lobby_id;
        } catch (error) {
            console.error('[DiscordSDKAdapter] Failed to create/join lobby:', error);
            throw error;
        }
    }

    async inviteToLobby(lobbyId: string, userId: string): Promise<void> {
        throw new Error('inviteToLobby not yet implemented');
    }

    async getLobbyMembers(lobbyId: string): Promise<any[]> {
        throw new Error('getLobbyMembers not yet implemented');
    }

    async connectLobbyVoice(lobbyId: string): Promise<void> {
        if (!this.isReady() || !this.subprocess) {
            throw new Error('SDK not ready');
        }

        try {
            const lobbyIdStr = String(lobbyId).trim();
            if (!lobbyIdStr) {
                throw new Error('Invalid lobby ID');
            }

            await this.subprocess.executeCommand('connect_lobby_voice', {
                lobby_id: lobbyIdStr,
            });
            console.log('[DiscordSDKAdapter] Connected to lobby voice:', lobbyIdStr);
        } catch (error) {
            console.error('[DiscordSDKAdapter] Failed to connect to lobby voice:', error);
            throw error;
        }
    }

    async disconnectLobbyVoice(lobbyId: string): Promise<void> {
        if (!this.isReady() || !this.subprocess) {
            throw new Error('SDK not ready');
        }

        try {
            const lobbyIdStr = String(lobbyId).trim();
            if (!lobbyIdStr) {
                throw new Error('Invalid lobby ID');
            }

            await this.subprocess.executeCommand('disconnect_lobby_voice', {
                lobby_id: lobbyIdStr,
            });
            console.log('[DiscordSDKAdapter] Disconnected from lobby voice:', lobbyIdStr);
        } catch (error) {
            console.error('[DiscordSDKAdapter] Failed to disconnect from lobby voice:', error);
            throw error;
        }
    }

    async setLobbyVoiceMute(mute: boolean): Promise<void> {
        throw new Error('setLobbyVoiceMute not yet implemented');
    }

    /**
     * Get pending message events (real-time)
     */
    async getMessageEvents(): Promise<any[]> {
        if (!this.isReady() || !this.subprocess) {
            return [];
        }

        try {
            const messages = await this.subprocess.getMessageEvents();
            return messages;
        } catch (error) {
            console.error('[DiscordSDKAdapter] Failed to get message events:', error);
            return [];
        }
    }

    /**
     * Get messages from a specific user/recipient
     */
    async getUserMessages(recipientId: string, limit: number = 50): Promise<any[]> {
        if (!this.isReady() || !this.subprocess) {
            return [];
        }

        try {
            const messages = await this.subprocess.getUserMessages(recipientId, limit);
            return messages;
        } catch (error) {
            console.error('[DiscordSDKAdapter] Failed to get user messages:', error);
            return [];
        }
    }

    /**
     * Disconnect
     */
    async disconnect(): Promise<void> {
        try {
            if (this.subprocess) {
                await this.subprocess.disconnect();
                this.subprocess = null;
            }

            this.state = 'DISCONNECTED';
            this.emit('state-change', 'DISCONNECTED');
            this.guilds.clear();
            this.channels.clear();
            // Clear cache on disconnect
            this.cachedLobbyIds = [];
            this.lastLobbyFetch = 0;
            this.channels.clear();
            this.userNameCache.clear();
            this.friendListCache = null;

            console.log('[DiscordSDKAdapter] Disconnected');
        } catch (error) {
            console.error('[DiscordSDKAdapter] Disconnect error:', error);
            throw error;
        }
    }
}

/**
 * Singleton export
 */
export const sdkAdapter = DiscordSDKAdapter.getInstance();

export default DiscordSDKAdapter;
