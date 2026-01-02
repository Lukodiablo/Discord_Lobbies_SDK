import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import * as https from 'https';

const DISCORD_API_ENDPOINT = 'https://discord.com/api/v10';

/**
 * Fetch guilds via Discord REST API
 * Uses OAuth token with 'guilds' scope
 */
export async function fetchGuildsRest(accessToken: string): Promise<any[]> {
	console.log('📡 Fetching guilds via REST API...');
	return new Promise((resolve, reject) => {
		const url = new URL(`${DISCORD_API_ENDPOINT}/users/@me/guilds`);
		
		const options = {
			hostname: url.hostname,
			path: url.pathname + url.search,
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${accessToken}`,
				'User-Agent': 'Discord-VSCode-Extension/1.0.0'
			}
		};

		const req = https.request(options, (res) => {
			let data = '';

			res.on('data', (chunk) => {
				data += chunk;
			});

			res.on('end', () => {
				if (res.statusCode && res.statusCode >= 400) {
					try {
						const errorData = JSON.parse(data);
						reject(new Error(`REST API error ${res.statusCode}: ${errorData.message || JSON.stringify(errorData)}`));
					} catch {
						reject(new Error(`REST API error ${res.statusCode}`));
					}
				} else {
					try {
						const guilds = JSON.parse(data);
						console.log(`✅ Fetched ${guilds.length} guilds via REST API`);
						resolve(guilds);
					} catch (e) {
						reject(new Error(`Failed to parse guild response: ${e}`));
					}
				}
			});
		});

		req.on('error', (error) => {
			console.error('❌ Failed to fetch guilds via REST API:', error.message);
			reject(new Error(`Could not fetch guilds via REST: ${error.message}`));
		});

		req.end();
	});
}

/**
 * Fetch channels for a guild via Discord REST API
 * Uses OAuth token with 'guilds' scope
 * Only returns channels the user has access to
 */
export async function fetchChannelsRest(guildId: string, accessToken: string): Promise<any[]> {
	console.log(`📡 Fetching channels for guild ${guildId} via REST API...`);
	return new Promise((resolve, reject) => {
		const url = new URL(`${DISCORD_API_ENDPOINT}/guilds/${guildId}/channels`);
		
		const options = {
			hostname: url.hostname,
			path: url.pathname + url.search,
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${accessToken}`,
				'User-Agent': 'Discord-VSCode-Extension/1.0.0'
			}
		};

		const req = https.request(options, (res) => {
			let data = '';

			res.on('data', (chunk) => {
				data += chunk;
			});

			res.on('end', () => {
				if (res.statusCode === 401 || res.statusCode === 403) {
					// User doesn't have permission to view channels
					console.log(`⚠️  User doesn't have permission to view channels in guild ${guildId}`);
					resolve([]);
				} else if (res.statusCode && res.statusCode >= 400) {
					try {
						const errorData = JSON.parse(data);
						reject(new Error(`REST API error ${res.statusCode}: ${errorData.message || JSON.stringify(errorData)}`));
					} catch {
						reject(new Error(`REST API error ${res.statusCode}`));
					}
				} else {
					try {
						const channels = JSON.parse(data);
						console.log(`✅ Fetched ${channels.length} channels for guild ${guildId} via REST API`);
						// Filter to only text channels (type 0) and announcement channels (type 5)
						const textChannels = channels.filter((c: any) => c.type === 0 || c.type === 5);
						console.log(`   (${textChannels.length} text/announcement channels)`);
						resolve(textChannels);
					} catch (e) {
						reject(new Error(`Failed to parse channels response: ${e}`));
					}
				}
			});
		});

		req.on('error', (error) => {
			console.error(`❌ Failed to fetch channels for guild ${guildId}:`, error.message);
			reject(new Error(`Could not fetch channels: ${error.message}`));
		});

		req.end();
	});
}

// RPC Opcodes
const OPCODES = {
	HANDSHAKE: 0,
	FRAME: 1,
	CLOSE: 2,
	PING: 3,
	PONG: 4
};

/**
 * Encode a message into Discord's binary RPC frame format
 * Frame: [Opcode: 4 bytes LE][Length: 4 bytes LE][Payload: N bytes]
 */
function encodeFrame(opcode: number, data: any): Buffer {
	const json = JSON.stringify(data);
	const jsonLength = Buffer.byteLength(json);

	const frame = Buffer.alloc(8 + jsonLength);
	frame.writeUInt32LE(opcode, 0);      // Opcode at offset 0
	frame.writeUInt32LE(jsonLength, 4);  // Length at offset 4
	frame.write(json, 8);                 // JSON payload at offset 8

	return frame;
}

/**
 * Decode a single frame from the buffer
 * Returns decoded frame or null if incomplete
 */
function decodeFrame(buffer: Buffer): { op: number; data: any; frameLength: number } | null {
	if (buffer.length < 8) {
		return null; // Not enough data for header
	}

	const op = buffer.readUInt32LE(0);
	const length = buffer.readUInt32LE(4);
	const frameLength = 8 + length;

	if (buffer.length < frameLength) {
		return null; // Not enough data for full payload
	}

	const jsonBuffer = buffer.slice(8, frameLength);
	try {
		const data = JSON.parse(jsonBuffer.toString('utf8'));
		return { op, data, frameLength };
	} catch (e) {
		console.error('Failed to parse RPC frame:', e);
		return null;
	}
}

/**
 * Discord RPC Client using proper binary wire protocol
 */
export class DiscordRPCClient {
	private clientId: string;
	private accessToken: string;
	private socket: net.Socket | null = null;
	private isConnected: boolean = false;
	private nonce: number = 0;
	private listeners: Map<string, ((data: any) => void)[]> = new Map();
	private receiveBuffer: Buffer = Buffer.alloc(0);

	// Data storage
	public guilds: Map<string, any> = new Map();
	public channels: Map<string, any> = new Map();
	public user: any = null;

	constructor(clientId: string, accessToken: string) {
		this.clientId = clientId;
		this.accessToken = accessToken;
	}

	private getSocketPath(): string {
		const platform = os.platform();
		if (platform === 'win32') {
			return '\\\\.\\pipe\\discord-ipc-0';
		} else if (platform === 'darwin') {
			const home = os.homedir();
			return path.join(home, 'Library/Application Support/Discord/discord-ipc-0');
		} else {
			const xdgRuntime = process.env.XDG_RUNTIME_DIR;
			return xdgRuntime
				? path.join(xdgRuntime, 'discord-ipc-0')
				: path.join(os.homedir(), '.config/discord/discord-ipc-0');
		}
	}

	async connect(): Promise<void> {
		return new Promise((resolve, reject) => {
			const socketPath = this.getSocketPath();
			console.log(`🔌 Connecting to Discord RPC at ${socketPath}`);

			this.socket = net.createConnection(socketPath, () => {
				console.log('✅ Socket connected');

				// Send HANDSHAKE (Opcode 0)
				const handshake = encodeFrame(OPCODES.HANDSHAKE, {
					v: 1,
					client_id: this.clientId
				});

				this.socket!.write(handshake, (err) => {
					if (err) {
						reject(err);
					} else {
						console.log('📡 Handshake sent');
					}
				});
			});

			this.socket.on('data', (chunk: Buffer) => {
				this.receiveBuffer = Buffer.concat([this.receiveBuffer, chunk]);
				this.processIncomingFrames(resolve, reject);
			});

			this.socket.on('error', (error: Error) => {
				console.error('❌ Socket error:', error.message);
				this.isConnected = false;
				reject(new Error(`RPC connection failed: ${error.message}`));
			});

			this.socket.on('close', () => {
				console.log('🔌 Socket closed');
				this.isConnected = false;
			});

			setTimeout(() => {
				if (!this.isConnected) {
					reject(new Error('RPC connection timeout - Discord may not be running'));
				}
			}, 5000);
		});
	}

	private processIncomingFrames(resolve?: Function, reject?: Function): void {
		let decoded;
		while ((decoded = decodeFrame(this.receiveBuffer)) !== null) {
			this.receiveBuffer = this.receiveBuffer.slice(decoded.frameLength);

			const { op, data } = decoded;

			console.log(`[RPC Frame] Op: ${op}, Data:`, JSON.stringify(data).substring(0, 300));

			// Handle handshake response
			if (op === OPCODES.HANDSHAKE || op === OPCODES.FRAME) {
			if (data.evt === 'READY' && !this.isConnected) {
				console.log('🔐 Handshake successful, authenticating...');
				this.isConnected = true;

				// Authenticate immediately after handshake
				this.authenticate()
					.then(() => {
						console.log('✅ Authenticated with Discord RPC');
						// NOTE: Guild and channel fetching moved to serverTreeProvider
						// using REST API and RPC GET_CHANNELS
						if (resolve) resolve();
					})
					.catch((err) => {
						console.error('Auth error:', err);
						if (reject) reject(err);
					});
			}				// Emit events for listeners
				if (data.nonce) {
					this.emit(data.nonce, data);
				}
				if (data.evt) {
					this.emit(data.evt, data);
				}
			}
		}
	}

	private sendFrame(opcode: number, data: any): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.socket) {
				reject(new Error('Socket not connected'));
				return;
			}

			const frame = encodeFrame(opcode, data);
			this.socket.write(frame, (err) => {
				if (err) reject(err);
				else resolve();
			});
		});
	}

	public async send(cmd: string, args?: any): Promise<any> {
		return new Promise((resolve, reject) => {
			if (!this.socket || !this.isConnected) {
				reject(new Error('Not connected to Discord RPC'));
				return;
			}

			const nonce = String(this.nonce++);
			const payload = { cmd, args, nonce };

			// Wait for response with this nonce
			const timeout = setTimeout(() => {
				this.removeListener(nonce, handler);
				reject(new Error(`RPC timeout: ${cmd}`));
			}, 3000);

			const handler = (data: any) => {
				clearTimeout(timeout);
				this.removeListener(nonce, handler);

				console.log(`📨 RPC Response for ${cmd}:`, JSON.stringify(data).substring(0, 200));

				if (data.evt === 'ERROR') {
					reject(new Error(data.data?.message || `RPC error: ${JSON.stringify(data.data)}`));
				} else if (data.data) {
					resolve(data.data);
				} else {
					resolve(data);
				}
			};

			this.on(nonce, handler);

			// Send the frame
			this.sendFrame(OPCODES.FRAME, payload).catch(reject);
		});
	}

	private async authenticate(): Promise<void> {
		await this.send('AUTHENTICATE', {
			access_token: this.accessToken
		});
	}
	/**
	 * Note: Message fetching and sending will use REST API
	 * RPC is reserved for Voice and Rich Presence features
	 */

	private on(event: string, callback: (data: any) => void): void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, []);
		}
		this.listeners.get(event)!.push(callback);
	}

	private removeListener(event: string, callback: (data: any) => void): void {
		const list = this.listeners.get(event);
		if (list) {
			const index = list.indexOf(callback);
			if (index !== -1) list.splice(index, 1);
		}
	}

	private emit(event: string, data: any): void {
		const callbacks = this.listeners.get(event);
		if (callbacks) {
			callbacks.forEach((cb) => cb(data));
		}
	}

	/**
	 * Select a voice channel to join
	 * Part of Step 3: Real-time Interaction (RPC/Social SDK)
	 * Sends SELECT_VOICE_CHANNEL RPC command
	 */
	async selectVoiceChannel(channelId: string | null): Promise<void> {
		try {
			console.log(`🎤 Selecting voice channel: ${channelId || 'None (disconnect)'}`);
			await this.send('SELECT_VOICE_CHANNEL', {
				channel_id: channelId
			});
			console.log(`✅ Voice channel selection command sent`);
		} catch (error) {
			console.error('Failed to select voice channel:', error);
			throw error;
		}
	}

	/**
	 * Set user's voice settings (mute, deafen, etc.)
	 * Part of Step 3: Real-time Interaction (RPC/Social SDK)
	 * Sends SET_USER_VOICE_SETTINGS RPC command
	 */
	async setUserVoiceSettings(settings: {
		mute?: boolean;
		deaf?: boolean;
	}): Promise<void> {
		try {
			console.log(`🔊 Setting voice settings:`, settings);
			await this.send('SET_USER_VOICE_SETTINGS', {
				...settings
			});
			console.log(`✅ Voice settings command sent`);
		} catch (error) {
			console.error('Failed to set voice settings:', error);
			throw error;
		}
	}

	/**
	 * Get messages from a channel via RPC
	 * Part of Step 3: Real-time Interaction (RPC/Social SDK)
	 * Uses RPC GET_CHANNEL command to fetch recent messages
	 * Falls back to REST API if RPC fails
	 */
	async getChannelMessages(channelId: string, accessToken: string): Promise<any[]> {
		try {
			console.log(`📨 Fetching messages for channel ${channelId} via RPC...`);
			const messages = await this.send('GET_CHANNEL', {
				channel_id: channelId
			});
			
			if (messages && messages.messages) {
				console.log(`✅ Fetched ${messages.messages.length} messages via RPC`);
				return messages.messages;
			}
			
			console.log(`⚠️  RPC GET_CHANNEL returned no messages, falling back to REST API`);
			return await this.getChannelMessagesRest(channelId, accessToken);
		} catch (rpcError) {
			console.warn(`RPC message fetch failed, falling back to REST API:`, rpcError);
			return await this.getChannelMessagesRest(channelId, accessToken);
		}
	}

	/**
	 * Fallback: Get messages via REST API using User Token
	 */
	private async getChannelMessagesRest(channelId: string, accessToken: string): Promise<any[]> {
		console.log(`📡 Fetching messages for channel ${channelId} via REST API...`);
		return new Promise((resolve, reject) => {
			const url = new URL(`${DISCORD_API_ENDPOINT}/channels/${channelId}/messages?limit=50`);
			
			const options = {
				hostname: url.hostname,
				path: url.pathname + url.search,
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${accessToken}`,
					'User-Agent': 'Discord-VSCode-Extension/1.0.0'
				}
			};

			const req = https.request(options, (res) => {
				let data = '';

				res.on('data', (chunk) => {
					data += chunk;
				});

				res.on('end', () => {
					if (res.statusCode && res.statusCode >= 400) {
						try {
							const errorData = JSON.parse(data);
							reject(new Error(`REST API error ${res.statusCode}: ${errorData.message || JSON.stringify(errorData)}`));
						} catch {
							reject(new Error(`REST API error ${res.statusCode}`));
						}
					} else {
						try {
							const messages = JSON.parse(data);
							console.log(`✅ Fetched ${messages.length} messages via REST API`);
							resolve(messages);
						} catch (e) {
							reject(new Error(`Failed to parse messages response: ${e}`));
						}
					}
				});
			});

			req.on('error', (error) => {
				console.error(`Failed to fetch messages for channel ${channelId}:`, error.message);
				reject(new Error(`Could not fetch messages: ${error.message}`));
			});

			req.end();
		});
	}

	/**
	 * Send a message to a channel via REST API using User Token
	 * Part of Step 3: Real-time Interaction
	 * Uses REST API endpoint with User Bearer Token
	 * Message will appear with the authenticated user's identity
	 */
	async sendMessage(channelId: string, accessToken: string, content: string): Promise<any> {
		console.log(`📤 Sending message to channel ${channelId}...`);
		return new Promise((resolve, reject) => {
			const url = new URL(`${DISCORD_API_ENDPOINT}/channels/${channelId}/messages`);
			
			const messageData = JSON.stringify({
				content: content
			});
			
			const options = {
				hostname: url.hostname,
				path: url.pathname + url.search,
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json',
					'User-Agent': 'Discord-VSCode-Extension/1.0.0',
					'Content-Length': Buffer.byteLength(messageData)
				}
			};

			const req = https.request(options, (res) => {
				let data = '';

				res.on('data', (chunk) => {
					data += chunk;
				});

				res.on('end', () => {
					if (res.statusCode && res.statusCode >= 400) {
						try {
							const errorData = JSON.parse(data);
							reject(new Error(`Failed to send message ${res.statusCode}: ${errorData.message || JSON.stringify(errorData)}`));
						} catch {
							reject(new Error(`Failed to send message ${res.statusCode}`));
						}
					} else {
						try {
							const message = JSON.parse(data);
							console.log(`✅ Message sent successfully (ID: ${message.id})`);
							resolve(message);
						} catch (e) {
							reject(new Error(`Failed to parse message response: ${e}`));
						}
					}
				});
			});

			req.on('error', (error) => {
				console.error(`Failed to send message to channel ${channelId}:`, error.message);
				reject(new Error(`Could not send message: ${error.message}`));
			});

			req.write(messageData);
			req.end();
		});
	}

	isConnectedToRPC(): boolean {
		return this.isConnected;
	}

	getGuildsList(): any[] {
		return Array.from(this.guilds.values());
	}

	getGuild(guildId: string): any {
		return this.guilds.get(guildId);
	}

	getChannel(channelId: string): any {
		return this.channels.get(channelId);
	}

	disconnect(): void {
		if (this.socket) {
			this.socket.destroy();
			this.socket = null;
		}
		this.isConnected = false;
		console.log('🔌 Disconnected from RPC');
	}
}
