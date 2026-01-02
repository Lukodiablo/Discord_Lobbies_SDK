import { EventEmitter } from 'events';
import WebSocket from 'ws';
import axios from 'axios';
import zlib from 'zlib';

const DISCORD_GATEWAY_URL = 'wss://gateway.discord.gg/?v=10&encoding=json';
const DISCORD_API_BASE = 'https://discord.com/api/v10';

interface GatewayPayload {
	op: number;
	d?: any;
	s?: number;
	t?: string;
}

interface Guild {
	id: string;
	name: string;
	icon?: string;
	owner: boolean;
	permissions: number;
}

interface Channel {
	id: string;
	name: string;
	type: number;
	guild_id?: string;
	recipients?: User[];
}

interface User {
	id: string;
	username: string;
	discriminator: string;
	avatar?: string;
}

/**
 * Discord Gateway Client - Connects via WebSocket with user token
 * Fetches REAL guilds and channels using Discord Gateway protocol
 */
export class DiscordGatewayClient extends EventEmitter {
	private token: string | null = null;
	private ws: WebSocket | null = null;
	private heartbeatInterval: NodeJS.Timeout | null = null;
	private heartbeatSequence: number = 0;
	private sessionId: string | null = null;
	private resumeUrl: string | null = null;
	
	private guilds: Map<string, Guild> = new Map();
	private channels: Map<string, Channel> = new Map();
	private dmChannels: Map<string, Channel> = new Map();
	private relationships: Map<string, User> = new Map();
	private currentUser: User | null = null;
	
	private connected: boolean = false;
	private ready: boolean = false;

	constructor() {
		super();
	}

	setToken(token: string) {
		this.token = token;
	}

	async connect(): Promise<void> {
		if (!this.token) {
			throw new Error('No user token available');
		}

		return new Promise((resolve, reject) => {
			try {
				console.log('🔌 Connecting to Discord Gateway via WebSocket...');
				console.log('   Using user OAuth token');

				this.ws = new WebSocket(DISCORD_GATEWAY_URL);

				// Add connection timeout
				const connectionTimeout = setTimeout(() => {
					if (!this.ready) {
						console.error('❌ Gateway connection timeout - READY event not received within 10 seconds');
						this.disconnect();
						reject(new Error('Gateway connection timeout - READY event not received'));
					}
				}, 10000);

				this.ws.on('open', () => {
					console.log('✅ WebSocket connected');
					this.connected = true;
				});

				this.ws.on('message', (data: Buffer) => {
					this.handleGatewayMessage(data).catch(err => {
						console.error('Error handling gateway message:', err);
					});
				});

				this.ws.on('error', (error: Error) => {
					clearTimeout(connectionTimeout);
					console.error('❌ WebSocket error:', error.message);
					reject(new Error(`Gateway connection error: ${error.message}`));
				});

				this.ws.on('close', (code: number, reason: string) => {
					clearTimeout(connectionTimeout);
					console.log(`⚠️ WebSocket closed: ${code} ${reason}`);
					this.connected = false;
					this.ready = false;
					if (this.heartbeatInterval) {
						clearInterval(this.heartbeatInterval);
					}
				});

				// Send IDENTIFY after connection opens
				this.ws.on('open', () => {
					console.log('📤 Preparing to send IDENTIFY...');
					// Add slight delay to ensure connection is fully established
					setTimeout(() => {
						if (this.connected && this.ws) {
							this.identify();
						}
					}, 500);
				});

				// Resolve when READY event is received
				const readyListener = (data: any) => {
					clearTimeout(connectionTimeout);
					console.log('✅ READY event received, resolving connection');
					this.removeListener('ready-internal', readyListener);
					resolve();
				};

				this.once('ready-internal', readyListener);

			} catch (error) {
				reject(error);
			}
		});
	}

	private identify() {
		if (!this.token || !this.ws) {
			console.error('❌ Cannot identify: token or ws missing');
			return;
		}

		console.log('📤 Sending IDENTIFY payload to Gateway...');
		console.log('   Token length:', this.token.length);
		console.log('   Token starts with:', this.token.substring(0, 10));

		// Calculate intents properly using bitwise OR
		const GUILDS = 1 << 0;           // 1
		const GUILD_MEMBERS = 1 << 1;    // 2
		const GUILD_MESSAGES = 1 << 9;   // 512
		const MESSAGE_CONTENT = 1 << 15; // 32768
		
		const intents = GUILDS | GUILD_MEMBERS | GUILD_MESSAGES | MESSAGE_CONTENT;
		console.log('   Intents value:', intents);

		const identifyPayload: GatewayPayload = {
			op: 2, // IDENTIFY opcode
			d: {
				token: this.token,
				intents: intents,
				properties: {
					os: 'linux',
					browser: 'discord-vscode-extension',
					device: 'discord-vscode-extension'
				}
			}
		};

		console.log('📡 Identify payload:', JSON.stringify(identifyPayload, null, 2));
		this.send(identifyPayload);
	}

	private async handleGatewayMessage(data: Buffer) {
		try {
			// Decompress if needed
			let message: any;
			
			// Check if message is gzipped
			if (data[0] === 0x78 || data[0] === 0x1f) {
				const decompressed = await new Promise<string>((resolve, reject) => {
					zlib.inflate(data, (err, result) => {
						if (err) reject(err);
						else resolve(result?.toString() || '');
					});
				});
				message = JSON.parse(decompressed);
			} else {
				message = JSON.parse(data.toString());
			}

			const { op, t, s, d } = message;

			// Track sequence number
			if (s !== null && s !== undefined) {
				this.heartbeatSequence = s;
			}

			// Handle different opcodes
			switch (op) {
				case 0: // DISPATCH
					this.handleDispatch(t, d);
					break;
				case 1: // HEARTBEAT
					console.log('💓 Heartbeat requested');
					this.heartbeat();
					break;
				case 10: // HELLO
					this.handleHello(d);
					break;
				case 11: // HEARTBEAT_ACK
					console.log('💓 Heartbeat ACK received');
					break;
				case 9: // INVALID_SESSION
					console.log('⚠️ Invalid session, reconnecting...');
					this.reconnect();
					break;
			}
		} catch (error) {
			console.error('Error parsing gateway message:', error);
		}
	}

	private handleHello(data: any) {
		const heartbeatInterval = data.heartbeat_interval;
		console.log(`💓 Starting heartbeat every ${heartbeatInterval}ms`);

		// Send initial heartbeat
		this.heartbeat();

		// Set up heartbeat interval
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
		}

		this.heartbeatInterval = setInterval(() => {
			this.heartbeat();
		}, heartbeatInterval);
	}

	private heartbeat() {
		if (!this.ws) return;

		const payload: GatewayPayload = {
			op: 1, // HEARTBEAT opcode
			d: this.heartbeatSequence
		};
		this.send(payload);
	}

	private handleDispatch(event: string, data: any) {
		console.log(`📥 DISPATCH: ${event}`);

		switch (event) {
			case 'READY':
				this.handleReady(data);
				break;
			case 'GUILD_CREATE':
				this.handleGuildCreate(data);
				break;
			case 'CHANNEL_CREATE':
			case 'CHANNEL_UPDATE':
				this.handleChannelCreate(data);
				break;
			case 'MESSAGE_CREATE':
				this.emit('message', data);
				break;
			case 'RELATIONSHIP_ADD':
				this.handleRelationshipAdd(data);
				break;
			case 'RELATIONSHIP_REMOVE':
				this.handleRelationshipRemove(data);
				break;
		}
	}

	private handleReady(data: any) {
		console.log(`✅ READY event received`);
		this.sessionId = data.session_id;
		this.resumeUrl = data.resume_gateway_url;

		// Store current user
		if (data.user) {
			this.currentUser = {
				id: data.user.id,
				username: data.user.username,
				discriminator: data.user.discriminator,
				avatar: data.user.avatar
			};
			console.log(`✅ Connected as user: ${this.currentUser.username}#${this.currentUser.discriminator}`);
		}

		// Initial guilds come in the READY payload
		if (data.guilds && Array.isArray(data.guilds)) {
			console.log(`📁 Received ${data.guilds.length} guilds in READY event`);
			data.guilds.forEach((guild: any) => {
				this.handleGuildCreate(guild);
			});
		}

		// Handle DM channels
		if (data.private_channels && Array.isArray(data.private_channels)) {
			console.log(`💬 Received ${data.private_channels.length} DM channels`);
			data.private_channels.forEach((channel: any) => {
				this.handleDMChannel(channel);
			});
		}

		// Handle relationships (friends)
		if (data.relationships && Array.isArray(data.relationships)) {
			console.log(`👥 Received ${data.relationships.length} relationships`);
			data.relationships.forEach((rel: any) => {
				if (rel.type === 1) { // Type 1 = friend
					this.relationships.set(rel.user.id, rel.user);
				}
			});
		}

		this.ready = true;
		const readyData = {
			user: this.currentUser,
			guilds: Array.from(this.guilds.values())
		};
		console.log('📢 Emitting ready event with', readyData.guilds.length, 'guilds');
		this.emit('ready', readyData);
		this.emit('ready-internal', readyData); // Internal event for connection promise
	}

	private handleGuildCreate(data: any) {
		const guild: Guild = {
			id: data.id,
			name: data.name,
			icon: data.icon,
			owner: data.owner || false,
			permissions: data.permissions || 0
		};

		this.guilds.set(guild.id, guild);
		console.log(`  📌 Guild: ${guild.name} (ID: ${guild.id})`);

		// Handle channels in guild
		if (data.channels && Array.isArray(data.channels)) {
			console.log(`     ✓ Received ${data.channels.length} channels`);
			data.channels.forEach((channel: any) => {
				if (channel.type === 0 || channel.type === 2) { // Text or Voice
					const ch: Channel = {
						id: channel.id,
						name: channel.name,
						type: channel.type,
						guild_id: data.id
					};
					this.channels.set(channel.id, ch);
				}
			});
		}
	}

	private handleChannelCreate(data: any) {
		if (data.type === 1 || data.type === 3) { // DM or Group DM
			this.handleDMChannel(data);
		} else {
			const channel: Channel = {
				id: data.id,
				name: data.name,
				type: data.type,
				guild_id: data.guild_id
			};
			this.channels.set(channel.id, channel);
			console.log(`  📝 Channel: ${channel.name} (type: ${channel.type})`);
		}
	}

	private handleDMChannel(data: any) {
		const channel: Channel = {
			id: data.id,
			name: data.recipients?.[0]?.username || 'DM',
			type: data.type,
			recipients: data.recipients
		};
		this.dmChannels.set(channel.id, channel);
		console.log(`  💬 DM Channel: ${channel.name}`);
	}

	private handleRelationshipAdd(data: any) {
		if (data.type === 1) { // Friend
			this.relationships.set(data.user.id, data.user);
			console.log(`  👥 Friend added: ${data.user.username}`);
		}
	}

	private handleRelationshipRemove(data: any) {
		this.relationships.delete(data.id);
		console.log(`  👥 Relationship removed: ${data.id}`);
	}

	private send(payload: GatewayPayload) {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			console.warn('⚠️ WebSocket not ready, cannot send payload');
			return;
		}
		this.ws.send(JSON.stringify(payload));
	}

	private reconnect() {
		console.log('🔄 Attempting to reconnect...');
		this.disconnect();
		this.connect().catch(err => {
			console.error('Reconnection failed:', err);
		});
	}

	disconnect() {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
			this.heartbeatInterval = null;
		}

		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}

		this.connected = false;
		this.ready = false;
		console.log('🔌 Disconnected from Discord Gateway');
	}

	isReady(): boolean {
		return this.ready;
	}

	getGuilds(): Guild[] {
		return Array.from(this.guilds.values());
	}

	getGuildChannels(guildId: string): Channel[] {
		return Array.from(this.channels.values()).filter(ch => ch.guild_id === guildId);
	}

	getDMChannels(): Channel[] {
		return Array.from(this.dmChannels.values());
	}

	getFriends(): User[] {
		return Array.from(this.relationships.values());
	}

	getCurrentUser(): User | null {
		return this.currentUser;
	}
}
