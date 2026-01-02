import * as vscode from 'vscode';
import * as path from 'path';
import { DiscordRPCClient } from './discordRPC';
import { getDiscordRPCClient } from '../extension';

/**
 * Privacy-First Rich Presence Manager
 * 
 * Provides granular control over what information is shared with Discord.
 * All privacy settings are disabled by default - users must explicitly opt-in.
 */
export class RichPresenceManager {
	private context: vscode.ExtensionContext;
	private currentFile: string = '';
	private currentLine: number = 0;
	private currentLanguage: string = 'plaintext';
	private workspaceName: string = '';
	private currentLobby: any = null;
	private voiceChannel: string = '';
	private isIdle: boolean = false;
	private lastActivityTime: number = Date.now();
	private presenceUpdateTimer: NodeJS.Timeout | null = null;
	private updateDebounceTimer: NodeJS.Timeout | null = null;
	private activityStartTime: number = Math.floor(Date.now() / 1000);

	constructor(context: vscode.ExtensionContext) {
		this.context = context;
		this.initialize();
	}

	/**
	 * Initialize the Rich Presence manager with event listeners
	 */
	private initialize(): void {
		console.log('[RichPresence] Initializing Privacy-First Rich Presence Manager');

		// Set workspace name
		this.updateWorkspaceName();

		// Get initial active editor
		const activeEditor = vscode.window.activeTextEditor;
		if (activeEditor) {
			this.currentFile = activeEditor.document.fileName;
			this.currentLanguage = activeEditor.document.languageId || 'plaintext';
			this.currentLine = activeEditor.selection.active.line + 1;
		}

		// File/editor change listener
		this.setupEditorListener();

		// Selection/cursor change listener
		this.setupSelectionListener();

		// Focus/idle tracking
		this.setupFocusListener();

		// Configuration change listener
		this.setupConfigurationListener();

		// Initial update
		this.updatePresence();

		console.log('[RichPresence] ✓ Rich Presence Manager initialized');
	}

	/**
	 * Listen for active text editor changes
	 */
	private setupEditorListener(): void {
		vscode.window.onDidChangeActiveTextEditor(
			(editor: vscode.TextEditor | undefined) => {
				if (editor) {
					this.currentFile = editor.document.fileName;
					this.currentLanguage = editor.document.languageId || 'plaintext';
					this.currentLine = editor.selection.active.line + 1;
					this.lastActivityTime = Date.now();
					this.isIdle = false;
				} else {
					this.currentFile = '';
					// Keep language as 'plaintext' when no editor is active
				}
				this.debouncedUpdate();
			},
			undefined,
			this.context.subscriptions
		);
	}

	/**
	 * Listen for cursor/selection changes
	 */
	private setupSelectionListener(): void {
		vscode.window.onDidChangeTextEditorSelection(
			(event: vscode.TextEditorSelectionChangeEvent) => {
				this.currentLine = event.selections[0].active.line + 1;
				this.lastActivityTime = Date.now();
				this.isIdle = false;
				this.debouncedUpdate();
			},
			undefined,
			this.context.subscriptions
		);
	}

	/**
	 * Track focus/idle state
	 */
	private setupFocusListener(): void {
		vscode.window.onDidChangeWindowState(
			(state: vscode.WindowState) => {
				if (state.focused) {
					this.isIdle = false;
					this.lastActivityTime = Date.now();
				} else {
					this.isIdle = true;
				}
				this.updatePresence();
			},
			undefined,
			this.context.subscriptions
		);
	}

	/**
	 * Listen for configuration changes to apply immediately
	 */
	private setupConfigurationListener(): void {
		vscode.workspace.onDidChangeConfiguration(
			(event: vscode.ConfigurationChangeEvent) => {
				if (event.affectsConfiguration('discord.richPresence')) {
					console.log('[RichPresence] Configuration changed, updating presence');
					this.updatePresence();
				}
			},
			undefined,
			this.context.subscriptions
		);
	}

	/**
	 * Update workspace name from active workspace
	 */
	private updateWorkspaceName(): void {
		if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
			this.workspaceName = path.basename(vscode.workspace.workspaceFolders[0].uri.fsPath);
		} else {
			this.workspaceName = '';
		}
	}

	/**
	 * Debounced update to avoid hammering the API
	 */
	private debouncedUpdate = (): void => {
		if (this.updateDebounceTimer) {
			clearTimeout(this.updateDebounceTimer);
		}
		this.updateDebounceTimer = setTimeout(() => {
			this.updatePresence();
		}, 500);
	};

	/**
	 * Main presence update method
	 */
	async updatePresence(): Promise<void> {
		try {
			const config = vscode.workspace.getConfiguration('discord.richPresence');

			// If disabled, do nothing
			if (!config.enabled) {
				console.log('[RichPresence] Presence disabled in settings');
				return;
			}

			// Check idle timeout
			if (config.idleTimeout > 0 && this.isIdle) {
				const idleTime = Date.now() - this.lastActivityTime;
				if (idleTime > config.idleTimeout) {
					await this.setIdlePresence();
					return;
				}
			}

			const presence = this.buildPresence(config);
			await this.setPresence(presence);
		} catch (error) {
			console.error('[RichPresence] Error updating presence:', error);
		}
	}

	/**
	 * Build the Discord Rich Presence object based on user settings
	 */
	private buildPresence(config: vscode.WorkspaceConfiguration): any {
		let state = '💻 VS Code';
		let details = 'Coding';
		let smallImageKey = '';
		let smallImageText = '';
		let largeImageText = '';

		// Build state (highest priority)
		if (config.showLobby && this.currentLobby) {
			state = `🎮 Lobby: ${this.currentLobby.name}`;
		} else if (config.showVoiceChannel && this.voiceChannel) {
			state = `🎤 Voice: ${this.voiceChannel}`;
		}

		// Build details
		const detailParts: string[] = [];

		if (config.showFileName && this.currentFile) {
			const fileName = path.basename(this.currentFile);
			detailParts.push(`✏️ Editing ${fileName}`);
		}

		if (config.showFileLine && this.currentFile && this.currentLine) {
			// If we already have a filename, append line number
			if (detailParts.length > 0) {
				detailParts[0] += ` (Line ${this.currentLine})`;
			}
		}

		// Add language to details if enabled (no asset needed, just text)
		if (config.showLanguage && this.currentLanguage) {
			const langDisplay = this.getLanguageDisplayName(this.currentLanguage);
			if (detailParts.length > 0) {
				// Append to existing details
				detailParts[detailParts.length - 1] += ` • ${langDisplay}`;
			} else {
				// No file, just show language
				detailParts.push(`💻 ${langDisplay}`);
			}
		}

		if (detailParts.length > 0) {
			details = detailParts.join(' ');
		}

		// Add project name if enabled
		if (config.showProject && this.workspaceName) {
			largeImageText = `📁 Project: ${this.workspaceName}`;
		}

		const presence = {
			state,
			details,
			largeImageKey: 'vscode',
			largeImageText: largeImageText || 'Visual Studio Code',
			timestamps: {
				start: this.activityStartTime
			}
		};

		return presence;
	}

	/**
	 * Set the Discord Rich Presence
	 * Sends presence to Discord RPC client
	 */
	private async setPresence(presence: any): Promise<void> {
		try {
			// Get RPC client from extension context
			const rpcClient = getDiscordRPCClient();
			
			if (!rpcClient || !rpcClient.isConnectedToRPC()) {
				return;
			}

			// Convert presence to Discord RPC format
			const activityData: any = {
				state: presence.state,
				details: presence.details,
				assets: {
					large_image: presence.largeImageKey || 'vscode',
					large_text: presence.largeImageText || 'Visual Studio Code'
				},
				timestamps: presence.timestamps || {
					start: Math.floor(Date.now() / 1000)
				}
			};

			// Only add small_image and small_text if they have values (Discord RPC doesn't allow empty strings)
			if (presence.smallImageKey) {
				activityData.assets.small_image = presence.smallImageKey;
			}
			if (presence.smallImageText) {
				activityData.assets.small_text = presence.smallImageText;
			}

			// Send to Discord via RPC
			await rpcClient.send('SET_ACTIVITY', {
				pid: process.pid,
				activity: activityData
			});

		} catch (error) {
			console.error('[RichPresence] Failed to send presence:', (error as Error).message);
			// Fall back to logging
			console.log('[RichPresence] 📡 Presence object (not sent):', {
				state: presence.state,
				details: presence.details,
				language: presence.smallImageText || '(none)',
				project: presence.largeImageText || '(none)'
			});
		}
	}

	/**
	 * Set idle presence
	 */
	private async setIdlePresence(): Promise<void> {
		const presence = {
			state: '💤 Away',
			details: 'AFK in VS Code',
			largeImageKey: 'vscode',
			largeImageText: 'Visual Studio Code',
			timestamps: {
				start: Math.floor(Date.now() / 1000)
			}
		};

		console.log('[RichPresence] Setting idle presence');
		await this.setPresence(presence);
	}

	/**
	 * Update lobby information
	 */
	public setLobbyInfo(lobby: any): void {
		this.currentLobby = lobby;
		this.updatePresence();
	}

	/**
	 * Clear lobby information
	 */
	public clearLobbyInfo(): void {
		this.currentLobby = null;
		this.updatePresence();
	}

	/**
	 * Update voice channel information
	 */
	public setVoiceChannelInfo(channelName: string): void {
		this.voiceChannel = channelName;
		this.updatePresence();
	}

	/**
	 * Clear voice channel information
	 */
	public clearVoiceChannelInfo(): void {
		this.voiceChannel = '';
		this.updatePresence();
	}

	/**
	 * Get language icon key for Discord Rich Presence
	 */
	private getLanguageIcon(language: string): string {
		const languageMap: Record<string, string> = {
			typescript: 'typescript',
			javascript: 'javascript',
			python: 'python',
			java: 'java',
			cpp: 'cpp',
			csharp: 'csharp',
			'c#': 'csharp',
			rust: 'rust',
			go: 'go',
			golang: 'go',
			html: 'html',
			css: 'css',
			scss: 'css',
			less: 'css',
			json: 'json',
			yaml: 'yaml',
			yml: 'yaml',
			xml: 'xml',
			sql: 'sql',
			markdown: 'markdown',
			md: 'markdown',
			dart: 'dart',
			kotlin: 'kotlin',
			swift: 'swift',
			objectivec: 'objective-c',
			'objective-c': 'objective-c',
			php: 'php',
			ruby: 'ruby',
			perl: 'perl',
			'shell': 'shell',
			bash: 'shell',
			sh: 'shell',
			dockerfile: 'docker',
			makefile: 'makefile',
		};

		return languageMap[language.toLowerCase()] || 'code';
	}

	/**
	 * Get display name for language
	 */
	private getLanguageDisplayName(language: string): string {
		const displayNames: Record<string, string> = {
			typescript: 'TypeScript',
			javascript: 'JavaScript',
			python: 'Python',
			java: 'Java',
			cpp: 'C++',
			csharp: 'C#',
			'c#': 'C#',
			rust: 'Rust',
			go: 'Go',
			golang: 'Go',
			html: 'HTML',
			css: 'CSS',
			scss: 'SCSS',
			less: 'Less',
			json: 'JSON',
			yaml: 'YAML',
			yml: 'YAML',
			xml: 'XML',
			sql: 'SQL',
			markdown: 'Markdown',
			md: 'Markdown',
			dart: 'Dart',
			kotlin: 'Kotlin',
			swift: 'Swift',
			objectivec: 'Objective-C',
			'objective-c': 'Objective-C',
			php: 'PHP',
			ruby: 'Ruby',
			perl: 'Perl',
			shell: 'Shell',
			bash: 'Bash',
			sh: 'Shell',
			dockerfile: 'Docker',
			makefile: 'Makefile',
		};

		return displayNames[language.toLowerCase()] || language.charAt(0).toUpperCase() + language.slice(1);
	}

	/**
	 * Cleanup on extension deactivate
	 */
	public dispose(): void {
		if (this.presenceUpdateTimer) {
			clearTimeout(this.presenceUpdateTimer);
		}
		if (this.updateDebounceTimer) {
			clearTimeout(this.updateDebounceTimer);
		}
		console.log('[RichPresence] Disposed');
	}
}
