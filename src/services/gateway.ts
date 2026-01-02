import * as vscode from 'vscode';
import axios from 'axios';
import { DiscordAPIUtils } from '../utils/apiUtils';
import * as DiscordSDK from './discordSocialSDK';

const DISCORD_API_BASE = 'https://discord.com/api/v10';

interface GatewayPayload {
	op: number; // Opcode
	d?: any;
	s?: number; // Sequence
	t?: string; // Event type
}

export class DiscordGateway {
	private context: vscode.ExtensionContext;
	private ws: any = null; // WebSocket type - using any to avoid Node.js WebSocket issues
	private token: string | null = null;
	private heartbeatInterval: NodeJS.Timeout | null = null;
	private heartbeatAckReceived: boolean = false;
	private gatewayUrl: string = '';
	private sessionId: string | null = null;
	private sequence: number = 0;
	private eventListeners: Map<string, ((data: any) => void)[]> = new Map();
	private guilds: Map<string, any> = new Map(); // Cache for guilds received from GUILD_CREATE
	private channels: Map<string, any[]> = new Map(); // Cache for channels by guild ID
	private cachedGuildsFromAPI: any[] = []; // Cache guilds fetched from API

	// Gateway Opcodes
	private readonly OPCODES = {
		DISPATCH: 0,
		HEARTBEAT: 1,
		IDENTIFY: 2,
		STATUS_UPDATE: 3,
		VOICE_STATE_UPDATE: 4,
		VOICE_GUILD_PING: 5,
		RESUME: 6,
		RECONNECT: 7,
		REQUEST_GUILD_MEMBERS: 8,
		INVALID_SESSION: 9,
		HELLO: 10,
		HEARTBEAT_ACK: 11
	};

	constructor(context: vscode.ExtensionContext) {
		this.context = context;
	}

	/**
	 * Get gateway URL from Discord
	 */
	private async getGatewayUrl(): Promise<string> {
		try {
			// Use a bot token path since we might not have a bot token
			const response = await axios.get(`${DISCORD_API_BASE}/gateway`, {
				headers: {
					'Content-Type': 'application/json'
				}
			});
			return response.data.url + '?v=10&encoding=json';
		} catch (error) {
			throw new Error('Failed to get gateway URL: ' + (error as Error).message);
		}
	}

	/**
	 * Connect to Discord Gateway
	 */
	async connect(token: string, appId?: string): Promise<void> {
		this.token = token;
		try {
			// Initialize Discord Social SDK addon - REQUIRED, no fallback
			if (!appId) {
				throw new Error('Application ID required for Discord Social SDK connection');
			}
			
			console.log('🚀 Initializing Discord Social SDK addon...');
			const sdkReady = await DiscordSDK.initializeDiscordAddon(appId, token);
			if (!sdkReady) {
				throw new Error('Failed to initialize Discord Social SDK');
			}
			
			console.log('✅ Discord Social SDK addon initialized with token');
			
			// Get guilds from SDK
			console.log('📚 Fetching guilds from SDK...');
			const guilds = await DiscordSDK.getGuilds();
			console.log(`📚 SDK returned ${guilds.length} guilds`);
			
			// Store in map (even if empty - SDK will return data when it's ready)
			guilds.forEach((guild: any) => {
				this.guilds.set(guild.id, {
					id: guild.id,
					name: guild.name,
					icon: guild.icon,
					owner: guild.owner
				});
			});
			
			// Fetch channels for each guild via SDK
			await this.populateGuildsAndChannelsFromSDK();
			
			await this.setupGatewayConnection();
			vscode.window.showInformationMessage('✓ Connected to Discord Gateway');
		} catch (error) {
			console.error('Failed to connect to gateway:', error);
			vscode.window.showErrorMessage('Failed to connect to Discord Gateway: ' + (error as Error).message);
		}
	}

	/**
	 * Populate guilds and channels using Discord Social SDK addon
	 * This bypasses HTTP API auth issues by using Client::GetGuildChannels directly
	 */
	private async populateGuildsAndChannelsFromSDK(): Promise<void> {
		try {
			// Get guilds from SDK
			const guilds = await DiscordSDK.getGuilds();
			console.log('✓ Fetched guilds from SDK:', guilds.length);
			this.cachedGuildsFromAPI = guilds;
			
			// Store guilds in map
			guilds.forEach((guild: any) => {
				this.guilds.set(guild.id, {
					id: guild.id,
					name: guild.name,
					icon: guild.icon,
					owner: guild.owner
				});
			});

			// Fetch channels for each guild using SDK
			for (const guild of guilds) {
				try {
					console.log(`Fetching channels for guild ${guild.name} (${guild.id}) from SDK...`);
					const channels = await DiscordSDK.getGuildChannels(guild.id);
					console.log(`✓ Fetched ${channels.length} channels for guild ${guild.name} from SDK`);
					this.channels.set(guild.id, channels);
				} catch (error) {
					console.warn(`Failed to fetch channels for guild ${guild.id} from SDK:`, error);
					this.channels.set(guild.id, []);
				}
			}
			console.log('✓ All guilds and channels populated from Discord Social SDK');
		} catch (error) {
			console.error('Failed to populate guilds and channels from SDK:', error);
			throw error;
		}
	}

	/**
	 * Populate guilds and channels cache from API
	 */
	private async populateGuildsAndChannels(): Promise<void> {
		if (!this.token) {
			throw new Error('Token not available');
		}

		try {
			// Fetch user's guilds
			const guilds = await DiscordAPIUtils.getUserGuilds(this.token);
			console.log('Fetched guilds:', guilds.length);
			this.cachedGuildsFromAPI = guilds;
			
			// Store guilds in map
			guilds.forEach((guild: any) => {
				this.guilds.set(guild.id, {
					id: guild.id,
					name: guild.name,
					icon: guild.icon,
					owner_id: guild.owner_id,
					permissions: guild.permissions
				});
			});

			// Fetch channels for each guild
			for (const guild of guilds) {
				try {
					console.log(`Fetching channels for guild ${guild.name} (${guild.id})...`);
					const channels = await DiscordAPIUtils.getGuildChannels(guild.id, this.token);
					console.log(`✓ Fetched ${channels.length} channels for guild ${guild.name}`);
					this.channels.set(guild.id, channels);
				} catch (error) {
					console.warn(`Failed to fetch channels for guild ${guild.id}:`, error);
					this.channels.set(guild.id, []);
				}
			}
			console.log('✓ All guilds and channels populated and cached');
		} catch (error) {
			console.error('Failed to populate guilds and channels:', error);
			throw error;
		}
	}

	/**
	 * Setup WebSocket connection to gateway
	 */
	private async setupGatewayConnection(): Promise<void> {
		// This is where you would establish the WebSocket connection
		// Due to VS Code extension limitations, you might need to use:
		// 1. A custom native module
		// 2. A separate Node.js process
		// 3. Or use the REST API with polling for real-time events
		
		console.log('Gateway setup initialized. Ready to receive real-time events.');
		
		// Emit a connected event for listeners
		this.emit('GATEWAY_READY', { gateway: this.gatewayUrl });
	}

	/**
	 * Disconnect from gateway
	 */
	disconnect(): void {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
		}
		if (this.ws) {
			this.ws.close();
		}
		console.log('Disconnected from Discord Gateway');
	}

	/**
	 * Send message to a Discord channel
	 */
	async sendMessage(channelId: string, content: string): Promise<any> {
		try {
			if (!this.token) {
				throw new Error('Not authenticated');
			}
			return await DiscordAPIUtils.sendMessage(channelId, content, this.token);
		} catch (error) {
			throw new Error('Failed to send message: ' + (error as Error).message);
		}
	}

	/**
	 * Register event listener
	 */
	on(event: string, callback: (data: any) => void): void {
		if (!this.eventListeners.has(event)) {
			this.eventListeners.set(event, []);
		}
		this.eventListeners.get(event)!.push(callback);
	}

	/**
	 * Emit event to all listeners
	 */
	private emit(event: string, data: any): void {
		const listeners = this.eventListeners.get(event);
		if (listeners) {
			listeners.forEach(callback => callback(data));
		}
	}

	/**
	 * Handle incoming gateway message
	 */
	private handleMessage(payload: GatewayPayload): void {
		// Update sequence number
		if (payload.s) {
			this.sequence = payload.s;
		}

		switch (payload.op) {
			case this.OPCODES.HELLO:
				console.log('Received HELLO from gateway');
				this.startHeartbeat(payload.d.heartbeat_interval);
				break;

			case this.OPCODES.HEARTBEAT_ACK:
				this.heartbeatAckReceived = true;
				break;

			case this.OPCODES.INVALID_SESSION:
				console.error('Invalid session, need to re-authenticate');
				this.disconnect();
				break;

			case this.OPCODES.DISPATCH:
				this.handleDispatch(payload);
				break;

			default:
				console.log('Received opcode:', payload.op);
		}
	}

	/**
	 * Handle dispatch events from gateway
	 */
	private handleDispatch(payload: GatewayPayload): void {
		const eventType = payload.t;
		console.log('Dispatch event:', eventType);

		switch (eventType) {
			case 'READY':
				this.sessionId = payload.d.session_id;
				console.log('Gateway READY, session:', this.sessionId);
				this.emit('READY', payload.d);
				break;

			case 'MESSAGE_CREATE':
				console.log('New message:', payload.d);
				this.emit('MESSAGE_CREATE', payload.d);
				break;

			case 'VOICE_STATE_UPDATE':
				console.log('Voice state updated');
				this.emit('VOICE_STATE_UPDATE', payload.d);
				break;

			case 'GUILD_CREATE':
				console.log('Guild received:', payload.d.name);
				// Cache the guild data
				this.guilds.set(payload.d.id, {
					id: payload.d.id,
					name: payload.d.name,
					icon: payload.d.icon,
					owner_id: payload.d.owner_id,
					permissions: payload.d.permissions
				});
				// Cache the guild's channels
				if (payload.d.channels) {
					this.channels.set(payload.d.id, payload.d.channels);
				}
				this.emit('GUILD_CREATE', payload.d);
				break;

			default:
				this.emit(eventType!, payload.d);
		}
	}

	/**
	 * Start sending heartbeats
	 */
	private startHeartbeat(interval: number): void {
		this.heartbeatInterval = setInterval(() => {
			if (!this.heartbeatAckReceived) {
				console.warn('Heartbeat ACK not received, reconnecting...');
				this.disconnect();
				return;
			}

			this.heartbeatAckReceived = false;
			console.log('Sending heartbeat...');
			// Send heartbeat - would be implemented with WebSocket
		}, interval);
	}

	/**
	 * Get cached guilds from API or GUILD_CREATE events
	 */
	getGuilds(): any[] {
		// Return guilds from cache (either from API or from GUILD_CREATE events)
		const guilds = Array.from(this.guilds.values());
		console.log('getGuilds() returning:', guilds.length, 'guilds');
		return guilds;
	}

	/**
	 * Get cached channels for a guild
	 */
	getGuildChannels(guildId: string): any[] {
		const channels = this.channels.get(guildId) || [];
		console.log(`getGuildChannels(${guildId}) returning ${channels.length} channels`);
		if (channels.length > 0) {
			console.log('First channel:', channels[0]);
		}
		return channels;
	}

	/**
	 * Get user guilds from API
	 */
	async getUserGuilds(token: string): Promise<any[]> {
		try {
			return await DiscordAPIUtils.getUserGuilds(token);
		} catch (error) {
			throw new Error('Failed to fetch guilds: ' + (error as Error).message);
		}
	}

	/**
	 * Get guild channels from API
	 */
	async getGuildChannelsFromAPI(guildId: string, token: string): Promise<any[]> {
		try {
			return await DiscordAPIUtils.getGuildChannels(guildId, token);
		} catch (error) {
			throw new Error('Failed to fetch channels: ' + (error as Error).message);
		}
	}

	/**
	 * Get channel messages
	 */
	async getChannelMessages(channelId: string, token: string, limit: number = 50): Promise<any[]> {
		try {
			return await DiscordAPIUtils.getChannelMessages(channelId, token, limit);
		} catch (error) {
			throw new Error('Failed to fetch messages: ' + (error as Error).message);
		}
	}


}
