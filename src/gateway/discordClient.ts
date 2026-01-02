import { EventEmitter } from 'events';
import { sdkAdapter } from '../services/discordSDKSubprocess';

/**
 * Discord Client - Uses SDK subprocess (requires Discord app running)
 */
export class DiscordClient extends EventEmitter {
	private appId: string;
	private sdkPath: string | undefined;
	private token: string | null = null;
	private connected: boolean = false;
	private currentUser: any = null;
	private guilds: any[] = [];

	constructor(appId: string, sdkPath?: string) {
		super();
		this.appId = appId;
		this.sdkPath = sdkPath;
	}

	setToken(token: string) {
		this.token = token;
	}

	async connect(): Promise<void> {
		try {
			// If no token, use SDK_AUTH marker to trigger SDK authorization flow
			const tokenToUse = this.token || 'SDK_AUTH_REQUIRED';

			console.log('🔌 Connecting via Discord SDK...');

			const success = await sdkAdapter.initialize(this.appId, tokenToUse, this.sdkPath);
			if (!success) {
				throw new Error('SDK initialization failed - Discord app may not be running');
			}

			this.connected = true;
			console.log('✅ SDK connected');

			// Current user data would be fetched through separate API call if needed
			// For now, we have the user from OAuth token decode

			const guilds = await sdkAdapter.getGuilds();
			if (guilds) {
				this.guilds = guilds;
				console.log(`📊 Loaded ${guilds.length} guilds`);
			}

			this.emit('ready', { guilds: this.guilds, user: this.currentUser });
		} catch (error) {
			console.error('❌ Failed to connect:', error);
			this.connected = false;
			this.emit('error', error);
			throw error;
		}
	}

	async disconnect(): Promise<void> {
		await sdkAdapter.disconnect();
		this.connected = false;
		console.log('✅ Disconnected');
	}

	isConnected(): boolean {
		return this.connected && sdkAdapter.isReady();
	}

	getGuilds(): any[] {
		return this.guilds;
	}

	getGuildChannels(guildId: string): any[] {
		return [];
	}

	async fetchGuilds(): Promise<any[]> {
		return await sdkAdapter.getGuilds();
	}

	async fetchGuildChannels(guildId: string): Promise<any[]> {
		return await sdkAdapter.getGuildChannels(guildId);
	}

	async fetchFriends(): Promise<any[]> {
		return await sdkAdapter.getRelationships();
	}

	async createLobby(secret: string, title: string, description: string): Promise<string> {
		return await sdkAdapter.createLobby(secret, title, description);
	}

	async sendLobbyMessage(lobbyId: string, content: string): Promise<void> {
		return await sdkAdapter.sendLobbyMessage(lobbyId, content);
	}

	async getLobbyIds(): Promise<string[]> {
		return await sdkAdapter.getLobbyIds();
	}

	async getLobbyHandle(lobbyId: string): Promise<any> {
		return await sdkAdapter.getLobbyHandle(lobbyId);
	}

	async getLobbyMetadata(lobbyId: string): Promise<any> {
		return await sdkAdapter.getLobbyMetadata(lobbyId);
	}

	async createOrJoinLobby(secret: string): Promise<string> {
		return await sdkAdapter.createOrJoinLobby(secret);
	}

	async inviteToLobby(lobbyId: string, userId: string): Promise<void> {
		return await sdkAdapter.inviteToLobby(lobbyId, userId);
	}

	async leaveLobby(lobbyId: string): Promise<void> {
		return await sdkAdapter.leaveLobby(lobbyId);
	}

	async getLobbyMembers(lobbyId: string): Promise<any[]> {
		return await sdkAdapter.getLobbyMembers(lobbyId);
	}

	async connectLobbyVoice(lobbyId: string): Promise<void> {
		return await sdkAdapter.connectLobbyVoice(lobbyId);
	}

	async disconnectLobbyVoice(lobbyId: string): Promise<void> {
		return await sdkAdapter.disconnectLobbyVoice(lobbyId);
	}

	async setLobbyVoiceMute(mute: boolean): Promise<void> {
		return await sdkAdapter.setLobbyVoiceMute(mute);
	}

	async setMute(mute: boolean): Promise<void> {
		return await sdkAdapter.setMute(mute);
	}

	async getMuteStatus(): Promise<{ muted: boolean }> {
		return await sdkAdapter.getMuteStatus();
	}

	async setDeaf(deaf: boolean): Promise<void> {
		return await sdkAdapter.setDeaf(deaf);
	}

	async getDeafStatus(): Promise<{ deafened: boolean }> {
		return await sdkAdapter.getDeafStatus();
	}

	async sendUserMessage(userId: bigint | string, content: string): Promise<void> {
		const userIdStr = typeof userId === 'bigint' ? userId.toString() : userId;
		await sdkAdapter.sendDM(userIdStr, content);
	}

	getCurrentUser(): any {
		return this.currentUser;
	}

	async getMessageEvents(): Promise<any[]> {
		return await sdkAdapter.getMessageEvents();
	}

	/**
	 * Get SDK adapter instance for direct access
	 */
	getSdkAdapter() {
		return sdkAdapter;
	}

	/**
	 * Register callback for ready event
	 */
	onReady(callback: (data: any) => void): void {
		this.on('ready', callback);
	}

	/**
	 * Register callback for message event
	 */
	onMessage(callback: (message: any) => void): void {
		this.on('message', callback);
	}

	/**
	 * Register callback for error event
	 */
	onError(callback: (error: Error) => void): void {
		this.on('error', callback);
	}
}