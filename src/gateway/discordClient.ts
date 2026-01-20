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

			// Forward SDK adapter events
			sdkAdapter.on('micStatusChanged', (data) => {
				console.log('[DiscordClient] Forwarding micStatusChanged to micEnabled');
				this.emit('micEnabled', data);
			});
			sdkAdapter.on('audioStatusChanged', (data) => {
				console.log('[DiscordClient] Forwarding audioStatusChanged to audioEnabled');
				this.emit('audioEnabled', data);
			});
			sdkAdapter.on('lobbyVoiceMemberJoined', (data) => {
				console.log('[DiscordClient] Forwarding lobbyVoiceMemberJoined to voiceStateUpdate', data);
				this.emit('voiceStateUpdate', data);
			});
			sdkAdapter.on('lobbyVoiceMemberLeft', (data) => {
				console.log('[DiscordClient] Forwarding lobbyVoiceMemberLeft to voiceStateUpdate', data);
				this.emit('voiceStateUpdate', data);
			});

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

	/**
	 * Add general lobby member (not voice)
	 */
	addLobbyMember(lobbyId: string, userId: string, username: string): void {
		return sdkAdapter.addLobbyMember(lobbyId, userId, username);
	}

	/**
	 * Remove general lobby member
	 */
	removeLobbyMember(lobbyId: string, userId: string): void {
		return sdkAdapter.removeLobbyMember(lobbyId, userId);
	}

	/**
	 * Add member to lobby voice tracking
	 */
	addLobbyVoiceMember(lobbyId: string, userId: string, username: string): void {
		return sdkAdapter.addLobbyVoiceMember(lobbyId, userId, username);
	}

	/**
	 * Remove member from lobby voice tracking
	 */
	removeLobbyVoiceMember(lobbyId: string, userId: string): void {
		return sdkAdapter.removeLobbyVoiceMember(lobbyId, userId);
	}

	/**
	 * Get current lobby voice members
	 */
	getLobbyVoiceMembers(lobbyId: string): Array<{ userId: string; username: string }> {
		return sdkAdapter.getLobbyVoiceMembers(lobbyId);
	}

	/**
	 * Get all voice participants
	 */
	getVoiceParticipants(): Array<{ userId: string; username: string }> {
		return sdkAdapter.getVoiceParticipants();
	}

	/**
	 * Set mic enabled status
	 */
	setMicEnabled(enabled: boolean): void {
		return sdkAdapter.setMicEnabled(enabled);
	}

	/**
	 * Get mic enabled status
	 */
	isMicEnabled(): boolean {
		return sdkAdapter.isMicEnabled();
	}

	/**
	 * Set audio enabled status
	 */
	setAudioEnabled(enabled: boolean): void {
		return sdkAdapter.setAudioEnabled(enabled);
	}

	/**
	 * Get audio enabled status
	 */
	isAudioEnabled(): boolean {
		return sdkAdapter.isAudioEnabled();
	}

	/**
	 * Clear lobby members
	 */
	clearLobbyMembers(lobbyId: string): void {
		return sdkAdapter.clearLobbyMembers(lobbyId);
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

	setCurrentUser(user: any): void {
		this.currentUser = user;
		console.log(`[DiscordClient] Current user set: ${user?.username} (${user?.id})`);
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