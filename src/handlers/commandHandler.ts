import * as vscode from 'vscode';
import { DiscordAuthManager } from '../services/auth';
import { ChatWebviewProvider } from '../views/chatWebviewProvider';

export class CommandHandler {
	private context: vscode.ExtensionContext;
	private authManager: DiscordAuthManager;
	private chatWebviewProvider: ChatWebviewProvider;

	constructor(
		context: vscode.ExtensionContext,
		authManager: DiscordAuthManager,
		chatWebviewProvider: ChatWebviewProvider
	) {
		this.context = context;
		this.authManager = authManager;
		this.chatWebviewProvider = chatWebviewProvider;
	}

	registerCommands(): void {
		// Authenticate command - triggers SDK authorization via Discord app
		this.context.subscriptions.push(
			vscode.commands.registerCommand('discord-vscode.authenticate', async () => {
				try {
					// Check if already authenticated
					const isAuth = await this.authManager.isAuthenticated();
					if (isAuth) {
						const choice = await vscode.window.showInformationMessage(
							'Already authenticated. Re-authenticate?',
							'Yes', 'No'
						);
						if (choice !== 'Yes') {
							return;
						}
						await this.authManager.logout();
					}
					
					// Show progress notification
					await vscode.window.withProgress({
						location: vscode.ProgressLocation.Notification,
						title: 'Discord Authentication',
						cancellable: false
					}, async (progress) => {
						progress.report({ message: 'Starting authentication...' });
						
						// Store a flag in secrets to trigger SDK auth on next activation
						// CRITICAL: Must await this completely before reloading
						await this.context.secrets.store('discord-trigger-auth', 'true');
						
						// Also save wizard state with pendingAuth flag so wizard reopens after auth
						const wizardState = {
							currentStep: 3,  // OAuth step
							pendingAuth: true,
							timestamp: Date.now()
						};
						await this.context.secrets.store('discord-wizard-state', JSON.stringify(wizardState));
						console.log('✅ Auth flag saved to secrets, waiting before reload...');
						
						progress.report({ message: 'Reloading extension...' });
						// Give state time to persist to disk (2-3 seconds)
						await new Promise(resolve => setTimeout(resolve, 2500));
						
						// Reload to trigger SDK auth flow
						await vscode.commands.executeCommand('workbench.action.reloadWindow');
					});
					
					vscode.window.showInformationMessage(
						'👉 Please approve the authorization request in your Discord desktop app'
					);
				} catch (error) {
					vscode.window.showErrorMessage('Authentication failed: ' + (error as Error).message);
				}
			})
		);

		// Logout command
		this.context.subscriptions.push(
			vscode.commands.registerCommand('discord-vscode.logout', async () => {
				try {
					await this.authManager.logout();
					vscode.window.showInformationMessage('✓ Successfully logged out');
				} catch (error) {
					vscode.window.showErrorMessage('Logout failed: ' + (error as Error).message);
				}
			})
		);

		// Join voice command
		this.context.subscriptions.push(
			vscode.commands.registerCommand('discord-vscode.joinVoice', async () => {
				const isAuth = await this.authManager.isAuthenticated();
				if (!isAuth) {
					vscode.window.showWarningMessage('Please authenticate first: Discord: Authenticate');
					return;
				}
				vscode.window.showInformationMessage('🎤 Voice feature coming soon!');
			})
		);

		// Select channel command
		this.context.subscriptions.push(
			vscode.commands.registerCommand('discord-vscode.selectChannel', async (channelId: string, channelName: string) => {
				try {
					console.log(`📝 User selected channel: ${channelName}`);
					await this.chatWebviewProvider.loadChannel(channelId, channelName);
					
					// Show information message that channel is loaded
					vscode.window.showInformationMessage(`📝 Loaded channel: #${channelName}`);
				} catch (error) {
					console.error('Failed to load channel:', error);
					vscode.window.showErrorMessage('Failed to load channel: ' + (error as Error).message);
				}
			})
		);
	}
}