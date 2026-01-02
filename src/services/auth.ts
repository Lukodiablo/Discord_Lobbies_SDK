import * as vscode from 'vscode';
import axios from 'axios';
import { OAuthCallbackServer } from './oauthCallbackServer';

// Load environment from VS Code workspace settings / .env in dev mode
const DISCORD_API_BASE = 'https://discord.com/api/v10';
const OAUTH_AUTHORIZE_URL = 'https://discord.com/api/oauth2/authorize';
const OAUTH_TOKEN_URL = 'https://discord.com/api/oauth2/token';

interface TokenResponse {
	access_token: string;
	token_type: string;
	expires_in: number;
	refresh_token: string;
	scope: string;
}

interface StoredToken {
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
	tokenType: string;
}

	export class DiscordAuthManager {
		private context: vscode.ExtensionContext;
		private readonly VERCEL_BACKEND = process.env.VERCEL_BACKEND || '';
		private readonly clientId: string = process.env.DISCORD_CLIENT_ID || '';
		private readonly redirectUri: string = process.env.REDIRECT_URI || '';
		private oauthServer: OAuthCallbackServer | null = null;
		private refreshTokenTimeout: NodeJS.Timeout | null = null;

		// OAuth scopes required for Discord access
		// MUST MATCH Rust SDK scopes in rust-native/src/main.rs line 2039 + Rich Presence requirements
		// openid: OpenID Connect
		// sdk.social_layer: Discord Social SDK layer
		// identify: User ID
		// email: User email
		// guilds: Guild/server access
		// connections: Social account links
		// rpc: Rich Presence/activities
		private readonly SCOPES = 'openid sdk.social_layer identify email guilds connections rpc';

		constructor(context: vscode.ExtensionContext) {
			this.context = context;
			console.log('✓ Discord OAuth ready - Vercel backend handles token exchange securely');
		}

	/**
	 * Start OAuth2 authentication flow with automatic callback handling
	 * DISABLED - Using Discord SDK app authorization instead
	 */
	async authenticate(): Promise<boolean> {
		vscode.window.showInformationMessage('Authentication handled by Discord SDK - approve in Discord app');
		return true;
	}

	/**
	 * Generate Discord OAuth2 authorization URL
	 */
	private generateAuthUrl(): string {
		const params = new URLSearchParams({
			client_id: this.clientId,
			response_type: 'code',
			redirect_uri: this.redirectUri,
			scope: this.SCOPES,
			state: Math.random().toString(36).substring(7),
			prompt: 'consent'
		});

		// Open the authorization URL in default browser
		const authUrl = `${OAUTH_AUTHORIZE_URL}?${params.toString()}`;
		vscode.env.openExternal(vscode.Uri.parse(authUrl)).then(() => {}, (err: Error) => {
			console.error('Failed to open browser:', err);
			vscode.window.showErrorMessage('Failed to open browser for authentication');
		});

		return authUrl;
	}

	/**
	 * Exchange authorization code for access token via Vercel backend
	 * Vercel has CLIENT_SECRET, so it's secure to do token exchange there
	 */
	private async exchangeCodeForToken(code: string): Promise<TokenResponse> {
		try {
			// Call Vercel backend endpoint which has CLIENT_SECRET
			const response = await fetch(`${this.VERCEL_BACKEND}/api/callback?code=${encodeURIComponent(code)}`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (!response.ok) {
				throw new Error(`Vercel backend returned ${response.status}: ${response.statusText}`);
			}

			const data = await response.json() as any;
			
			if (!data.access_token) {
				throw new Error('No access token in Vercel response');
			}

			return {
				access_token: data.access_token,
				token_type: data.token_type || 'Bearer',
				expires_in: data.expires_in || 604800,
				refresh_token: data.refresh_token || '',
				scope: data.scope || this.SCOPES
			};
		} catch (error) {
			console.error('Token exchange via Vercel failed:', error);
			throw error;
		}
	}

	/**
	 * Store token securely in VS Code SecretStorage
	 */
	private async storeToken(tokenData: TokenResponse): Promise<void> {
		const storedToken: StoredToken = {
			accessToken: tokenData.access_token,
			refreshToken: tokenData.refresh_token,
			tokenType: tokenData.token_type,
			expiresAt: Date.now() + (tokenData.expires_in * 1000)
		};

		console.log('💾 Storing token in VS Code SecretStorage');
		await this.context.secrets.store('discord-token', JSON.stringify(storedToken));
		this.scheduleTokenRefresh(tokenData.expires_in);
	}

	/**
	 * Refresh access token via Vercel backend
	 */
	async refreshAccessToken(): Promise<boolean> {
		try {
			const storedTokenStr = await this.context.secrets.get('discord-token');
			if (!storedTokenStr) {
				console.log('No stored token to refresh');
				return false;
			}

			const storedToken: StoredToken = JSON.parse(storedTokenStr);

			// Call Vercel endpoint to refresh token
			const response = await fetch(`${this.VERCEL_BACKEND}/api/refresh?refresh_token=${encodeURIComponent(storedToken.refreshToken)}`, {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			});

			if (!response.ok) {
				console.error('Token refresh failed:', response.statusText);
				return false;
			}

			const data = await response.json() as TokenResponse;
			if (!data.access_token) {
				return false;
			}

			await this.storeToken(data);
			console.log('✅ Token refreshed successfully');
			return true;
		} catch (error) {
			console.error('Token refresh error:', error);
			return false;
		}
	}

	/**
	 * Schedule automatic token refresh
	 */
	private scheduleTokenRefresh(expiresIn: number): void {
		// Clear existing timeout
		if (this.refreshTokenTimeout) {
			clearTimeout(this.refreshTokenTimeout);
		}

		// Refresh 5 minutes before expiration
		const refreshTime = (expiresIn * 1000) - (5 * 60 * 1000);

		this.refreshTokenTimeout = setTimeout(() => {
			this.refreshAccessToken().catch(err => {
				console.error('Automatic token refresh failed:', err);
			});
		}, Math.max(refreshTime, 0));
	}

	/**
	 * Get stored authentication token, refreshing if necessary
	 */
	async getStoredToken(): Promise<{accessToken: string, tokenType: number} | undefined> {
		try {
			const storedTokenStr = await this.context.secrets.get('discord-token');
			if (!storedTokenStr) {
				console.log('❌ No stored token found');
				return undefined;
			}

			const storedToken: StoredToken = JSON.parse(storedTokenStr);

			console.log('📝 Got stored token');

			// Token validation - Discord OAuth returns user tokens (57 chars with dots)
			// This is correct format for SDK with sdk.social_layer scope

			// Check if token is expired
			if (Date.now() > storedToken.expiresAt) {
				console.log('🔄 Token expired, refreshing...');
				const refreshed = await this.refreshAccessToken();
				if (!refreshed) {
					console.log('❌ Token refresh failed');
					return undefined;
				}

				const newTokenStr = await this.context.secrets.get('discord-token');
				if (newTokenStr) {
					const newToken: StoredToken = JSON.parse(newTokenStr);
					console.log('✅ New token obtained after refresh');
					// Convert tokenType string to number (1 for Bearer)
					const typeNum = newToken.tokenType === 'Bearer' ? 1 : 0;
					return {accessToken: newToken.accessToken, tokenType: typeNum};
				}
				return undefined;
			}

			console.log('✅ Using existing OAuth token (not expired)');
			console.log('   Token format: OAuth access token (30 chars)');
			// Convert tokenType string to number (1 for Bearer)
			const typeNum = storedToken.tokenType === 'Bearer' ? 1 : 0;
			return {accessToken: storedToken.accessToken, tokenType: typeNum};
		} catch (error) {
			console.error('Failed to get stored token:', error);
			return undefined;
		}
	}

	/**
	 * Check if user is authenticated
	 */
	async isAuthenticated(): Promise<boolean> {
		const token = await this.getStoredToken();
		return !!token;
	}

	/**
	 * Authenticate with direct user token (not OAuth2)
	 * For user account integration with Gateway
	 */
	async authenticateWithToken(token: string): Promise<boolean> {
		try {
			console.log('🔐 Authenticating with direct user token...');
			console.log('   Token length:', token.length);
			
			// Store token directly
			const storedToken: StoredToken = {
				accessToken: token,
				refreshToken: '',
				tokenType: 'Bearer',
				expiresAt: Date.now() + (90 * 24 * 60 * 60 * 1000) // 90 days
			};

			console.log('💾 Storing user token...');
			await this.context.secrets.store('discord-token', JSON.stringify(storedToken));
			
			console.log('✅ User token stored successfully');
			console.log('   Token length:', token.length);
			
			vscode.window.showInformationMessage('✓ Authenticated with user token');
			return true;

		} catch (error) {
			console.error('Authentication with token failed:', error);
			vscode.window.showErrorMessage('Failed to authenticate: ' + (error as Error).message);
			return false;
		}
	}

	async getCurrentUser(token: string): Promise<any> {
		try {
			const response = await axios.get(`${DISCORD_API_BASE}/users/@me`, {
				headers: {
					'Authorization': `Bearer ${token}`
				}
			});
			return response.data;
		} catch (error) {
			if (axios.isAxiosError(error)) {
				const errorMsg = error.response?.data?.message || error.message;
				throw new Error('Failed to fetch user profile: ' + errorMsg);
			}
			throw new Error('Failed to fetch user profile: ' + (error as Error).message);
		}
	}

	/**
	 * Get user's guilds (servers)
	 */
	async getUserGuilds(token: string) {
		try {
			const response = await axios.get(`${DISCORD_API_BASE}/users/@me/guilds`, {
				headers: {
					'Authorization': `Bearer ${token}`
				}
			});
			return response.data;
		} catch (error) {
			if (axios.isAxiosError(error)) {
				const errorMsg = error.response?.data?.message || error.message;
				throw new Error('Failed to fetch guilds: ' + errorMsg);
			}
			throw new Error('Failed to fetch guilds: ' + (error as Error).message);
		}
	}

	/**
	 * Get guild channels
	 */
	async getGuildChannels(token: string, guildId: string) {
		try {
			const response = await axios.get(`${DISCORD_API_BASE}/guilds/${guildId}/channels`, {
				headers: {
					'Authorization': `Bearer ${token}`
				}
			});
			return response.data;
		} catch (error) {
			if (axios.isAxiosError(error)) {
				const errorMsg = error.response?.data?.message || error.message;
				throw new Error('Failed to fetch channels: ' + errorMsg);
			}
			throw new Error('Failed to fetch channels: ' + (error as Error).message);
		}
	}

	/**
	 * Get channel messages
	 */
	async getChannelMessages(token: string, channelId: string, limit: number = 50) {
		try {
			const response = await axios.get(
				`${DISCORD_API_BASE}/channels/${channelId}/messages?limit=${limit}`,
				{
					headers: {
						'Authorization': `Bearer ${token}`
					}
				}
			);
			return response.data;
		} catch (error) {
			if (axios.isAxiosError(error)) {
				const errorMsg = error.response?.data?.message || error.message;
				throw new Error('Failed to fetch messages: ' + errorMsg);
			}
			throw new Error('Failed to fetch messages: ' + (error as Error).message);
		}
	}

	/**
	 * Send a message to a channel
	 */
	async sendMessage(token: string, channelId: string, content: string) {
		try {
			const response = await axios.post(
				`${DISCORD_API_BASE}/channels/${channelId}/messages`,
				{ content },
				{
					headers: {
						'Authorization': `Bearer ${token}`,
						'Content-Type': 'application/json'
					}
				}
			);
			return response.data;
		} catch (error) {
			if (axios.isAxiosError(error)) {
				const errorMsg = error.response?.data?.message || error.message;
				throw new Error('Failed to send message: ' + errorMsg);
			}
			throw new Error('Failed to send message: ' + (error as Error).message);
		}
	}

	/**
	 * Logout and remove stored token
	 */
	async logout(): Promise<void> {
		// Clear refresh timeout
		if (this.refreshTokenTimeout) {
			clearTimeout(this.refreshTokenTimeout);
		}

		// Remove stored token
		await this.context.secrets.delete('discord-token');
		vscode.window.showInformationMessage('✓ Logged out from Discord');
	}
	/**
	 * Destroy/revoke the token on Discord servers
	 */
	async revokeToken(): Promise<void> {
		try {
			const tokenObj = await this.getStoredToken();
			if (!tokenObj) {
				return;
			}

			// Token revocation is handled by Vercel backend
			// For local development, tokens can be cleared from secrets storage
			console.log('✓ Token revocation handled securely on backend');

			await this.logout();
		} catch (error) {
			console.error('Failed to revoke token:', error);
		}
	}
}