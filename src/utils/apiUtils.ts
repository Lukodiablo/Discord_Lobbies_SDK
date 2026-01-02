import * as https from 'https';

const DISCORD_API_BASE = 'https://discord.com/api/v10';

/**
 * API utility functions for common Discord operations
 */
export class DiscordAPIUtils {

	/**
	 * Make authenticated API request to Discord
	 * Uses user OAuth token (no Bearer prefix needed)
	 */
	static async makeRequest(
		endpoint: string,
		method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET',
		token: string,
		data?: any
	): Promise<any> {
		return new Promise((resolve, reject) => {
			const url = new URL(`${DISCORD_API_BASE}${endpoint}`);
			const options = {
				method,
				headers: {
					'Authorization': token,
					'Content-Type': 'application/json',
					'User-Agent': 'Discord-VSCode-Extension/1.0'
				}
			};

			console.log(`📡 API Request: ${method} ${endpoint}`);

			const req = https.request(url, options, (res) => {
				let responseData = '';
				res.on('data', (chunk) => {
					responseData += chunk;
				});
				res.on('end', () => {
					try {
						const parsed = JSON.parse(responseData);
						if (res.statusCode && res.statusCode >= 400) {
							console.error(`❌ API Error [${res.statusCode}] ${endpoint}:`, parsed);
							if (res.statusCode === 401) {
								reject(new Error('Unauthorized - token may have expired or invalid'));
								return;
							}
							if (res.statusCode === 403) {
								reject(new Error(`Forbidden (403) - Missing permissions for endpoint: ${endpoint}`));
								return;
							}
							reject(new Error(`API request failed: ${res.statusCode}`));
							return;
						}
						resolve(parsed);
					} catch (e) {
						reject(new Error(`Failed to parse response: ${(e as Error).message}`));
					}
				});
			});

			req.on('error', (error) => {
				console.error(`❌ Request failed: ${endpoint}`, error);
				reject(error);
			});

			if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
				req.write(JSON.stringify(data));
			}
			req.end();
		});
	}

	/**
	 * Get current user info
	 */
	static async getCurrentUser(token: string): Promise<any> {
		return this.makeRequest('/users/@me', 'GET', token);
	}

	/**
	 * Get user's guilds (servers)
	 */
	static async getUserGuilds(token: string): Promise<any[]> {
		return this.makeRequest('/users/@me/guilds', 'GET', token);
	}

	/**
	 * Get guild channels
	 */
	static async getGuildChannels(guildId: string, token: string): Promise<any[]> {
		return this.makeRequest(`/guilds/${guildId}/channels`, 'GET', token);
	}

	/**
	 * Get direct messages (user guilds with type=1)
	 */
	static async getDirectMessages(token: string): Promise<any[]> {
		const guilds = await this.getUserGuilds(token);
		return guilds.filter((g: any) => g.id); // Filter DM channels
	}

	/**
	 * Get channel messages
	 */
	static async getChannelMessages(channelId: string, token: string, limit: number = 50): Promise<any[]> {
		return this.makeRequest(`/channels/${channelId}/messages?limit=${limit}`, 'GET', token);
	}

	/**
	 * Send message to channel
	 */
	static async sendMessage(channelId: string, content: string, token: string): Promise<any> {
		return this.makeRequest(`/channels/${channelId}/messages`, 'POST', token, { content });
	}

	/**
	 * Edit a message in a channel
	 */
	static async editMessage(channelId: string, messageId: string, content: string, token: string): Promise<any> {
		return this.makeRequest(`/channels/${channelId}/messages/${messageId}`, 'PATCH', token, { content });
	}

	/**
	 * Delete a message from a channel
	 */
	static async deleteMessage(channelId: string, messageId: string, token: string): Promise<void> {
		return this.makeRequest(`/channels/${channelId}/messages/${messageId}`, 'DELETE', token);
	}

	/**
	 * Get user connections (for voice/integrations)
	 */
	static async getUserConnections(token: string): Promise<any[]> {
		return this.makeRequest('/users/@me/connections', 'GET', token);
	}

	/**
	 * Get guild voice regions
	 */
	static async getGuildVoiceRegions(guildId: string, token: string): Promise<any[]> {
		return this.makeRequest(`/guilds/${guildId}/regions`, 'GET', token);
	}

	/**
	 * Format error message
	 */
	static formatError(error: unknown): string {
		if (error instanceof Error) {
			return error.message;
		}
		return String(error);
	}
}
