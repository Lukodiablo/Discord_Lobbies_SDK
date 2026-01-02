import * as vscode from 'vscode';
import { DiscordRPCClient } from '../services/discordRPC';
import { DiscordClient } from '../gateway/discordClient';
import { DiscordAuthManager } from '../services/auth';
import { relayMessage } from '../services/relayAPI';

export class ChatWebviewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'discord-vscode.chatView';

	private _view?: vscode.WebviewView;
	private rpcClient: DiscordRPCClient | null = null;
	private discordClient: DiscordClient | null = null;
	private authManager: DiscordAuthManager | null = null;
	private selectedChannelId: string = '';
	private selectedChannelName: string = '';
	private messages: any[] = [];

	constructor(
		private readonly _context: vscode.ExtensionContext
	) {
	}

	/**
	 * Set RPC client instance
	 */
	public setRPCClient(rpcClient: DiscordRPCClient): void {
		this.rpcClient = rpcClient;
	}

	/**
	 * Set Discord Client instance for real-time message events
	 */
	public setDiscordClient(client: DiscordClient): void {
		this.discordClient = client;
		
		// Listen for new messages from Discord Client
		client.onMessage((message) => {
			// Only add to chat if it's in the currently selected channel
			if (message.channel_id === this.selectedChannelId) {
				this.messages.push(message);
				this._updateMessageList();
			}
		});
	}

	/**
	 * Set Auth manager for getting access token
	 */
	public setAuthManager(authManager: DiscordAuthManager): void {
		this.authManager = authManager;
	}

	/**
	 * Public method to load channel messages (called from extension)
	 */
	public async loadChannel(channelId: string, channelName: string): Promise<void> {
		console.log(`📂 Loading channel: ${channelName} (${channelId})`);
		this.selectedChannelId = channelId;
		this.selectedChannelName = channelName;
		
		await this._loadChannelMessages(channelId);
		
		// Notify webview of channel header
		if (this._view) {
			this._view.webview.postMessage({
				command: 'setChannelName',
				channelName: channelName
			});
		}
	}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: any,
		_token: vscode.CancellationToken,
	) {
		console.log('💬 ChatWebviewProvider.resolveWebviewView called');
		this._view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._context.extensionUri]
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
		console.log('✓ Chat webview HTML set');

		// Handle messages from webview
		webviewView.webview.onDidReceiveMessage((data: any) => {
			this._handleWebviewMessage(data);
		});
	}

	/**
	 * Handle messages from the webview
	 */
	private async _handleWebviewMessage(data: any) {
		switch (data.command) {
			case 'selectChannel':
				await this._loadChannelMessages(data.channelId);
				break;

			case 'sendMessage':
				await this._sendMessage(data.content);
				break;

			case 'loadMessages':
				await this._loadChannelMessages(data.channelId);
				break;

			case 'editMessage':
				await this._editMessage(data.messageId, data.content);
				break;

			case 'deleteMessage':
				await this._deleteMessage(data.messageId);
				break;
		}
	}

	/**
	 * Load messages for a channel
	 */
	private async _loadChannelMessages(channelId: string) {
		this.selectedChannelId = channelId;
		console.log(`📬 Channel ${channelId} selected`);
		
		// Channel message history not available via SDK
		this.messages = [];
		this._updateMessageList();
	}

	/**
	 * Fetch messages from Discord REST API with Bearer token
	 */
	private async _fetchMessagesFromRest(channelId: string, token: string, limit: number = 50): Promise<any[]> {
		try {
			const axios = require('axios');
			const response = await axios.get(
				`https://discord.com/api/v10/channels/${channelId}/messages?limit=${limit}`,
				{
					headers: {
						'Authorization': `Bearer ${token}`,
						'User-Agent': 'Discord-VSCode-Extension/1.0.0'
					}
				}
			);
			return response.data.reverse();
		} catch (error: any) {
			if (error.response?.status === 401) {
				throw new Error('Unauthorized - token expired or invalid');
			}
			if (error.response?.status === 403) {
				throw new Error('Forbidden - no access to this channel');
			}
			throw new Error(`Failed to fetch messages: ${error.message}`);
		}
	}

	/**
	 * Send a message to the channel
	 */
	private async _sendMessage(content: string) {
		if (!content.trim()) {
			return;
		}
		
		// If we have a selected channel, relay it
		if (this.selectedChannelId) {
			try {
				const currentUser = this.discordClient?.getCurrentUser?.() as any;
				const userId = currentUser?.id || 'unknown';
				
				await relayMessage(this.selectedChannelId, {
					from: userId,
					content: content,
					timestamp: Date.now(),
					channel_id: this.selectedChannelId
				});
				console.log('[ChatWebview] Message relayed via API');
			} catch (error) {
				console.warn('[ChatWebview] Relay failed:', error);
			}
		}
		
		// Channel messaging not available via SDK
		vscode.window.showInformationMessage('Channel messaging not yet implemented');
	}

	/**
	 * Send message to Discord REST API with Bearer token
	 */
	private async _sendMessageToRest(channelId: string, content: string, token: string): Promise<any> {
		try {
			const axios = require('axios');
			const response = await axios.post(
				`https://discord.com/api/v10/channels/${channelId}/messages`,
				{
					content: content
				},
				{
					headers: {
						'Authorization': `Bearer ${token}`,
						'Content-Type': 'application/json',
						'User-Agent': 'Discord-VSCode-Extension/1.0.0'
					}
				}
			);
			return response.data;
		} catch (error: any) {
			if (error.response?.status === 401) {
				throw new Error('Unauthorized - token expired or invalid');
			}
			if (error.response?.status === 403) {
				throw new Error('Forbidden - no permission to send in this channel');
			}
			if (error.response?.status === 429) {
				throw new Error('Rate limited - please wait');
			}
			throw new Error(`Failed to send message: ${error.message}`);
		}
	}

	/**
	 * Edit a message
	 */
	private async _editMessage(messageId: string, newContent: string) {
		vscode.window.showInformationMessage('Edit message feature coming soon!');
	}

	/**
	 * Delete a message
	 */
	private async _deleteMessage(messageId: string) {
		vscode.window.showInformationMessage('Delete message feature coming soon!');
	}

	/**
	 * Update message list in webview
	 */
	private _updateMessageList() {
		if (this._view) {
			this._view.webview.postMessage({
				command: 'updateMessages',
				messages: this.messages.map(msg => ({
					id: msg.id,
					author: msg.author?.username || 'Unknown',
					avatar: msg.author?.avatar,
					content: msg.content,
					timestamp: msg.timestamp,
					editedTimestamp: msg.edited_timestamp
				}))
			});
		}
	}

	/**
	 * Get HTML for the webview
	 */
	private _getHtmlForWebview(webview: vscode.Webview): string {
		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Discord Chat</title>
	<style>
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}

		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
			background-color: var(--vscode-editor-background);
			color: var(--vscode-editor-foreground);
			display: flex;
			flex-direction: column;
			height: 100vh;
			overflow: hidden;
		}

		#chatContainer {
			display: flex;
			flex-direction: column;
			height: 100%;
		}

		#header {
			padding: 12px 16px;
			background-color: var(--vscode-titleBar-activeBackground);
			border-bottom: 1px solid var(--vscode-panel-border);
			font-weight: 600;
		}

		#messagesContainer {
			flex: 1;
			overflow-y: auto;
			padding: 16px;
			display: flex;
			flex-direction: column;
			gap: 12px;
		}

		.message {
			display: flex;
			gap: 10px;
			animation: fadeIn 0.3s ease-in;
		}

		@keyframes fadeIn {
			from {
				opacity: 0;
				transform: translateY(10px);
			}
			to {
				opacity: 1;
				transform: translateY(0);
			}
		}

		.message-avatar {
			width: 32px;
			height: 32px;
			border-radius: 50%;
			background-color: var(--vscode-button-background);
			flex-shrink: 0;
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 12px;
			font-weight: bold;
		}

		.message-content {
			flex: 1;
			display: flex;
			flex-direction: column;
			gap: 4px;
		}

		.message-header {
			display: flex;
			gap: 8px;
			align-items: center;
		}

		.message-author {
			font-weight: 600;
			color: var(--vscode-editor-foreground);
		}

		.message-timestamp {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
		}

		.message-text {
			color: var(--vscode-editor-foreground);
			word-wrap: break-word;
			white-space: pre-wrap;
		}

		#inputContainer {
			padding: 12px 16px;
			border-top: 1px solid var(--vscode-panel-border);
			display: flex;
			gap: 8px;
			background-color: var(--vscode-editor-background);
		}

		#messageInput {
			flex: 1;
			padding: 8px 12px;
			background-color: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			border: 1px solid var(--vscode-input-border);
			border-radius: 4px;
			font-family: inherit;
			font-size: 14px;
			resize: none;
			max-height: 100px;
		}

		#messageInput:focus {
			outline: none;
			border-color: var(--vscode-focusBorder);
		}

		#sendButton {
			padding: 8px 16px;
			background-color: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			border: none;
			border-radius: 4px;
			cursor: pointer;
			font-weight: 500;
			align-self: flex-end;
		}

		#sendButton:hover {
			background-color: var(--vscode-button-hoverBackground);
		}

		#sendButton:active {
			background-color: var(--vscode-button-background);
		}

		.empty-state {
			display: flex;
			align-items: center;
			justify-content: center;
			height: 100%;
			color: var(--vscode-descriptionForeground);
			font-size: 14px;
		}

		.message-actions {
			display: none;
			gap: 5px;
			margin-left: auto;
		}

		.message:hover .message-actions {
			display: flex;
		}

		.message-btn {
			padding: 2px 8px;
			font-size: 12px;
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			border: none;
			cursor: pointer;
			border-radius: 3px;
			transition: background-color 0.2s;
		}

		.message-btn:hover {
			background-color: var(--vscode-button-hoverBackground);
		}

		.edited-label {
			font-size: 11px;
			color: var(--vscode-descriptionForeground);
			margin-left: 5px;
			font-style: italic;
		}

		#editModal {
			position: fixed;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			background: var(--vscode-editor-background);
			padding: 20px;
			border-radius: 8px;
			border: 1px solid var(--vscode-input-border);
			z-index: 1000;
			min-width: 400px;
			box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
		}

		#editModal.hidden {
			display: none;
		}

		#editModalOverlay {
			position: fixed;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background: rgba(0, 0, 0, 0.5);
			z-index: 999;
		}

		#editModalOverlay.hidden {
			display: none;
		}

		#editModal h3 {
			margin-top: 0;
			margin-bottom: 15px;
			color: var(--vscode-foreground);
		}

		#editInput {
			width: 100%;
			min-height: 80px;
			background: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			border: 1px solid var(--vscode-input-border);
			padding: 10px;
			border-radius: 4px;
			font-family: inherit;
			font-size: 14px;
			resize: vertical;
			margin-bottom: 15px;
		}

		#editInput:focus {
			outline: none;
			border-color: var(--vscode-focusBorder);
		}

		.modal-buttons {
			display: flex;
			gap: 10px;
			justify-content: flex-end;
		}

		.modal-btn {
			padding: 8px 16px;
			border: none;
			cursor: pointer;
			border-radius: 4px;
			font-weight: 500;
		}

		#saveEditBtn {
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
		}

		#saveEditBtn:hover {
			background: var(--vscode-button-hoverBackground);
		}

		#cancelEditBtn {
			background: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			border: 1px solid var(--vscode-input-border);
		}

		#cancelEditBtn:hover {
			background: var(--vscode-inputOption-hoverBackground);
		}
	</style>
</head>
<body>
	<div id="chatContainer">
		<div id="header">💬 Discord Chat</div>
		<div id="messagesContainer">
			<div class="empty-state">Select a channel to start chatting</div>
		</div>
		<div id="inputContainer">
			<textarea
				id="messageInput"
				placeholder="Type a message... (Shift+Enter for new line)"
				rows="1"
			></textarea>
			<button id="sendButton">Send</button>
		</div>
	</div>

	<div id="editModalOverlay" class="hidden"></div>
	<div id="editModal" class="hidden">
		<h3>Edit Message</h3>
		<textarea id="editInput" placeholder="Edit your message..."></textarea>
		<div class="modal-buttons">
			<button id="saveEditBtn" class="modal-btn">Save</button>
			<button id="cancelEditBtn" class="modal-btn">Cancel</button>
		</div>
	</div>

	<script>
		const vscode = acquireVsCodeApi();
		const messagesContainer = document.getElementById('messagesContainer');
		const messageInput = document.getElementById('messageInput');
		const sendButton = document.getElementById('sendButton');

		let messages = [];

		// Send message on button click
		sendButton.addEventListener('click', () => {
			const content = messageInput.value.trim();
			if (content) {
				vscode.postMessage({
					command: 'sendMessage',
					content: content
				});
			}
		});

		// Send message on Ctrl+Enter or Cmd+Enter
		messageInput.addEventListener('keydown', (e) => {
			if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
				sendButton.click();
			}
		});

		// Auto-resize textarea
		messageInput.addEventListener('input', () => {
			messageInput.style.height = 'auto';
			messageInput.style.height = Math.min(messageInput.scrollHeight, 100) + 'px';
		});

		// Handle messages from the extension
		window.addEventListener('message', (event) => {
			const message = event.data;

			switch (message.command) {
				case 'updateMessages':
					messages = message.messages;
					renderMessages();
					break;

				case 'clearInput':
					messageInput.value = '';
					messageInput.style.height = 'auto';
					messagesContainer.scrollTop = messagesContainer.scrollHeight;
					break;

				case 'hideEditModal':
					closeEditModal();
					break;
			}
		});

		function renderMessages() {
			messagesContainer.innerHTML = '';

			if (messages.length === 0) {
				messagesContainer.innerHTML = '<div class="empty-state">No messages yet</div>';
				return;
			}

			messages.forEach(msg => {
				const messageEl = document.createElement('div');
				messageEl.className = 'message';
				messageEl.setAttribute('data-message-id', msg.id);

				const avatar = document.createElement('div');
				avatar.className = 'message-avatar';
				avatar.textContent = msg.author.charAt(0).toUpperCase();

				const content = document.createElement('div');
				content.className = 'message-content';

				const header = document.createElement('div');
				header.className = 'message-header';

				const author = document.createElement('span');
				author.className = 'message-author';
				author.textContent = msg.author;

				const timestamp = document.createElement('span');
				timestamp.className = 'message-timestamp';
				const date = new Date(msg.timestamp);
				timestamp.textContent = date.toLocaleTimeString();

				header.appendChild(author);
				header.appendChild(timestamp);

				// Add edited label if message was edited
				if (msg.editedTimestamp) {
					const editedLabel = document.createElement('span');
					editedLabel.className = 'edited-label';
					editedLabel.textContent = '(edited)';
					header.appendChild(editedLabel);
				}

				// Add action buttons
				const actions = document.createElement('div');
				actions.className = 'message-actions';

				const editBtn = document.createElement('button');
				editBtn.className = 'message-btn';
				editBtn.textContent = '✏️ Edit';
				editBtn.onclick = () => openEditModal(msg.id, msg.content);

				const deleteBtn = document.createElement('button');
				deleteBtn.className = 'message-btn';
				deleteBtn.textContent = '🗑️ Delete';
				deleteBtn.onclick = () => {
					vscode.postMessage({
						command: 'deleteMessage',
						messageId: msg.id
					});
				};

				actions.appendChild(editBtn);
				actions.appendChild(deleteBtn);
				header.appendChild(actions);

				const text = document.createElement('div');
				text.className = 'message-text';
				text.textContent = msg.content;

				content.appendChild(header);
				content.appendChild(text);

				messageEl.appendChild(avatar);
				messageEl.appendChild(content);

				messagesContainer.appendChild(messageEl);
			});

			// Auto-scroll to bottom
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		}

		// Edit modal functions
		const editModal = document.getElementById('editModal');
		const editModalOverlay = document.getElementById('editModalOverlay');
		const editInput = document.getElementById('editInput');
		const saveEditBtn = document.getElementById('saveEditBtn');
		const cancelEditBtn = document.getElementById('cancelEditBtn');

		let currentEditMessageId = null;

		function openEditModal(messageId, content) {
			currentEditMessageId = messageId;
			editInput.value = content;
			editModal.classList.remove('hidden');
			editModalOverlay.classList.remove('hidden');
			editInput.focus();
			editInput.select();
		}

		function closeEditModal() {
			editModal.classList.add('hidden');
			editModalOverlay.classList.add('hidden');
			currentEditMessageId = null;
			editInput.value = '';
		}

		saveEditBtn.addEventListener('click', () => {
			const newContent = editInput.value.trim();
			if (newContent && currentEditMessageId) {
				vscode.postMessage({
					command: 'editMessage',
					messageId: currentEditMessageId,
					content: newContent
				});
				closeEditModal();
			}
		});

		cancelEditBtn.addEventListener('click', closeEditModal);

		// Close modal on Escape key
		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape' && !editModal.classList.contains('hidden')) {
				closeEditModal();
			}
		});

		// Close modal on overlay click
		editModalOverlay.addEventListener('click', closeEditModal);
	</script>
</body>
</html>`;
	}
}
