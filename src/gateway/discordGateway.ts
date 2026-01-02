import WebSocket from 'ws';
import * as https from 'https';
import axios from 'axios';

interface GatewayPayload {
	op: number;
	d: any;
	s?: number;
	t?: string;
}

interface Guild {
	id: string;
	name: string;
	icon: string | null;
	channels: Channel[];
}

interface Channel {
	id: string;
	name: string;
	type: number;
	guild_id?: string;
	parent_id?: string | null;
	position?: number;
}

interface Message {
	id: string;
	content: string;
	author: {
		id: string;
		username: string;
		discriminator: string;
		avatar: string | null;
	};
	timestamp: string;
	channel_id: string;
	attachments?: any[];
	embeds?: any[];
}

export class DiscordGateway {
	private ws: WebSocket | null = null;
	private heartbeatInterval: NodeJS.Timeout | null = null;
	private sequence: number | null = null;
	private sessionId: string | null = null;
	private token: string;
	
	// Store all data from Gateway
	public guilds: Map<string, Guild> = new Map();
	public channels: Map<string, Channel> = new Map();
	
	// Events
	private onReadyCallback?: () => void;
	private onMessageCallback?: (message: Message) => void;
	private onErrorCallback?: (error: Error) => void;
	private onGuildLoadedCallback?: (guild: Guild) => void;

	constructor(token: string) {
		this.token = token;
	}

	/**
	 * Connect to Discord Gateway
	 */
	async connect(): Promise<void> {
		try {
			// Get Gateway URL
			const gatewayUrl = await this.getGatewayUrl();
			
			console.log('🔌 Connecting to Discord Gateway:', gatewayUrl);
			
			// Connect WebSocket
			this.ws = new WebSocket(gatewayUrl);
			
			this.ws.on('open', () => {
				console.log('✅ Gateway WebSocket opened');
			});
			
			this.ws.on('message', (data: WebSocket.Data) => {
				this.handleMessage(data);
			});
			
			this.ws.on('error', (error: Error) => {
				console.error('❌ Gateway WebSocket error:', error);
				if (this.onErrorCallback) {
					this.onErrorCallback(error);
				}
			});
			
			this.ws.on('close', (code: number, reason: Buffer) => {
				console.log(`🔌 Gateway closed: ${code} - ${reason.toString()}`);
				this.cleanup();
				
				// Auto-reconnect on unexpected close (but not manual disconnect)
				if (code !== 1000) {
					console.log('♻️ Reconnecting in 5 seconds...');
					setTimeout(() => this.connect(), 5000);
				}
			});
			
		} catch (error) {
			console.error('❌ Failed to connect to Gateway:', error);
			throw error;
		}
	}

	/**
	 * Get Gateway URL from Discord API
	 */
	private async getGatewayUrl(): Promise<string> {
		return new Promise((resolve, reject) => {
			const url = new URL('https://discord.com/api/v10/gateway');
			const options = {
				method: 'GET',
				headers: {
					'User-Agent': 'Discord-VSCode-Extension/1.0'
				}
			};

			const req = https.request(url, options, (res) => {
				let data = '';
				res.on('data', (chunk) => {
					data += chunk;
				});
				res.on('end', () => {
					try {
						const parsed = JSON.parse(data);
						resolve(`${parsed.url}?v=10&encoding=json`);
					} catch (e) {
						reject(new Error(`Failed to parse gateway response: ${(e as Error).message}`));
					}
				});
			});

			req.on('error', reject);
			req.end();
		});
	}

	/**
	 * Handle incoming Gateway messages
	 */
	private handleMessage(data: WebSocket.Data): void {
		try {
			const payload: GatewayPayload = JSON.parse(data.toString());
			
			// Update sequence number
			if (payload.s !== null && payload.s !== undefined) {
				this.sequence = payload.s;
			}
			
			switch (payload.op) {
				case 10: // HELLO
					this.handleHello(payload.d);
					break;
				case 0: // DISPATCH
					this.handleDispatch(payload);
					break;
				case 11: // HEARTBEAT_ACK
					// Heartbeat acknowledged (silent)
					break;
				case 1: // HEARTBEAT
					this.sendHeartbeat();
					break;
				case 7: // RECONNECT
					console.log('♻️ Gateway requested reconnect');
					this.reconnect();
					break;
				case 9: // INVALID_SESSION
					console.log('⚠️ Invalid session, reconnecting in 2s...');
					setTimeout(() => this.identify(), 2000);
					break;
			}
		} catch (error) {
			console.error('❌ Error handling Gateway message:', error);
		}
	}

	/**
	 * Handle HELLO event and start heartbeat
	 */
	private handleHello(data: any): void {
		const { heartbeat_interval } = data;
		
		console.log(`💓 Starting heartbeat every ${heartbeat_interval}ms`);
		
		// Start heartbeat
		this.heartbeatInterval = setInterval(() => {
			this.sendHeartbeat();
		}, heartbeat_interval);
		
		// Send IDENTIFY
		this.identify();
	}

	/**
	 * Send IDENTIFY payload for user client
	 * User tokens connect to Gateway with Bearer token format
	 */
	private identify(): void {
		const identifyPayload = {
			op: 2,
			d: {
				token: `${this.token}`, // Use the token as-is (it's already the user token)
				intents: 3276799, // All intents
				properties: {
					os: 'Windows',
					browser: 'Discord',
					device: 'Discord',
					system_locale: 'en-US',
					browser_user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Discord/1.0',
					browser_version: '1.0.0',
					client_version: '1.0.0'
				},
				compress: false,
				large_threshold: 250
			}
		};
		
		this.send(identifyPayload);
		console.log('🔐 Sent IDENTIFY to Gateway with user token');
	}

	/**
	 * Send heartbeat
	 */
	private sendHeartbeat(): void {
		this.send({
			op: 1,
			d: this.sequence
		});
	}

	/**
	 * Handle DISPATCH events
	 */
	private handleDispatch(payload: GatewayPayload): void {
		const { t: eventName, d: data } = payload;
		
		switch (eventName) {
			case 'READY':
				this.handleReady(data);
				break;
			case 'GUILD_CREATE':
				this.handleGuildCreate(data);
				break;
			case 'CHANNEL_CREATE':
				this.handleChannelCreate(data);
				break;
			case 'CHANNEL_UPDATE':
				this.handleChannelUpdate(data);
				break;
			case 'CHANNEL_DELETE':
				this.handleChannelDelete(data);
				break;
			case 'MESSAGE_CREATE':
				this.handleMessageCreate(data);
				break;
			default:
				// Uncomment to see all events:
				// console.log(`📨 Event: ${eventName}`);
				break;
		}
	}

	/**
	 * Handle READY event
	 */
	private handleReady(data: any): void {
		this.sessionId = data.session_id;
		console.log(`✅ Gateway READY!`);
		console.log(`👤 User: ${data.user.username}#${data.user.discriminator}`);
		console.log(`🏰 Connected to ${data.guilds.length} guilds (loading details...)`);
		
		// Guilds will send GUILD_CREATE events with full data
		if (this.onReadyCallback) {
			this.onReadyCallback();
		}
	}

	/**
	 * Handle GUILD_CREATE event (full guild data with channels)
	 */
	private handleGuildCreate(data: any): void {
		const guild: Guild = {
			id: data.id,
			name: data.name,
			icon: data.icon,
			channels: []
		};
		
		// Process all channels in the guild
		if (data.channels) {
			data.channels.forEach((channelData: any) => {
				const channel: Channel = {
					id: channelData.id,
					name: channelData.name,
					type: channelData.type,
					guild_id: data.id,
					parent_id: channelData.parent_id,
					position: channelData.position
				};
				
				guild.channels.push(channel);
				this.channels.set(channel.id, channel);
			});
		}
		
		this.guilds.set(guild.id, guild);
		console.log(`✅ Guild loaded: "${guild.name}" with ${guild.channels.length} channels`);
		
		// Notify listeners
		if (this.onGuildLoadedCallback) {
			this.onGuildLoadedCallback(guild);
		}
	}

	/**
	 * Handle CHANNEL_CREATE event
	 */
	private handleChannelCreate(data: any): void {
		const channel: Channel = {
			id: data.id,
			name: data.name,
			type: data.type,
			guild_id: data.guild_id,
			parent_id: data.parent_id,
			position: data.position
		};
		
		this.channels.set(channel.id, channel);
		
		// Add to guild if exists
		if (channel.guild_id) {
			const guild = this.guilds.get(channel.guild_id);
			if (guild) {
				guild.channels.push(channel);
			}
		}
		
		console.log(`➕ Channel created: #${channel.name}`);
	}

	/**
	 * Handle CHANNEL_UPDATE event
	 */
	private handleChannelUpdate(data: any): void {
		const channel = this.channels.get(data.id);
		if (channel) {
			channel.name = data.name;
			channel.position = data.position;
			console.log(`✏️ Channel updated: #${channel.name}`);
		}
	}

	/**
	 * Handle CHANNEL_DELETE event
	 */
	private handleChannelDelete(data: any): void {
		this.channels.delete(data.id);
		
		// Remove from guild
		if (data.guild_id) {
			const guild = this.guilds.get(data.guild_id);
			if (guild) {
				guild.channels = guild.channels.filter(c => c.id !== data.id);
			}
		}
		
		console.log(`➖ Channel deleted: ${data.id}`);
	}

	/**
	 * Handle MESSAGE_CREATE event (new message)
	 */
	private handleMessageCreate(data: any): void {
		const message: Message = {
			id: data.id,
			content: data.content,
			author: data.author,
			timestamp: data.timestamp,
			channel_id: data.channel_id,
			attachments: data.attachments,
			embeds: data.embeds
		};
		
		console.log(`💬 New message in ${data.channel_id}: ${message.content.substring(0, 50)}...`);
		
		if (this.onMessageCallback) {
			this.onMessageCallback(message);
		}
	}

	/**
	 * Reconnect to Gateway
	 */
	private reconnect(): void {
		this.cleanup();
		setTimeout(() => this.connect(), 1000);
	}

	/**
	 * Send data to Gateway
	 */
	private send(payload: any): void {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(payload));
		} else {
			console.warn('⚠️ Cannot send - WebSocket not open');
		}
	}

	/**
	 * Cleanup resources
	 */
	private cleanup(): void {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
			this.heartbeatInterval = null;
		}
	}

	/**
	 * Disconnect from Gateway
	 */
	disconnect(): void {
		console.log('🔌 Disconnecting from Gateway');
		this.cleanup();
		if (this.ws) {
			this.ws.close(1000, 'User disconnected');
			this.ws = null;
		}
	}

	/**
	 * Get all guilds
	 */
	getGuilds(): Guild[] {
		return Array.from(this.guilds.values());
	}

	/**
	 * Get channels for a specific guild
	 */
	getGuildChannels(guildId: string): Channel[] {
		const guild = this.guilds.get(guildId);
		return guild ? guild.channels : [];
	}

	/**
	 * Get a specific channel
	 */
	getChannel(channelId: string): Channel | undefined {
		return this.channels.get(channelId);
	}

	/**
	 * Fetch messages from a channel using REST API
	 */
	async fetchMessages(channelId: string, limit: number = 50): Promise<Message[]> {
		try {
			const response = await axios.get(
				`https://discord.com/api/v10/channels/${channelId}/messages?limit=${limit}`,
				{
					headers: {
						'Authorization': `Bearer ${this.token}`
					}
				}
			);
			
			return response.data.reverse(); // Discord sends newest first, we want oldest first
		} catch (error) {
			console.error('❌ Failed to fetch messages:', error);
			throw error;
		}
	}

	/**
	 * Send a message to a channel
	 */
	async sendMessage(channelId: string, content: string): Promise<Message> {
		try {
			const response = await axios.post(
				`https://discord.com/api/v10/channels/${channelId}/messages`,
				{ content },
				{
					headers: {
						'Authorization': `Bearer ${this.token}`,
						'Content-Type': 'application/json'
					}
				}
			);
			
			console.log(`✅ Message sent to channel ${channelId}`);
			return response.data;
		} catch (error) {
			console.error('❌ Failed to send message:', error);
			throw error;
		}
	}

	/**
	 * Event handlers
	 */
	onReady(callback: () => void): void {
		this.onReadyCallback = callback;
	}

	onMessage(callback: (message: Message) => void): void {
		this.onMessageCallback = callback;
	}

	onError(callback: (error: Error) => void): void {
		this.onErrorCallback = callback;
	}

	onGuildLoaded(callback: (guild: Guild) => void): void {
		this.onGuildLoadedCallback = callback;
	}

	/**
	 * Check if Gateway is connected
	 */
	isConnected(): boolean {
		return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
	}
}