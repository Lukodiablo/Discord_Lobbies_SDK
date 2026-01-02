import * as vscode from 'vscode';
import { getDiscordClient, getContext, getLobbyChatTreeProvider, handleCodeShare } from '../extension';
import { sdkAdapter } from '../services/discordSDKSubprocess';
import { relayMessage } from '../services/relayAPI';

export async function sendLobbyMessageCommand() {
    const client = getDiscordClient();
    
    if (!client || !client.isConnected()) {
        vscode.window.showErrorMessage('Discord not connected. Please authenticate first.');
        return;
    }

    const context = getContext();
    const currentLobby = context?.workspaceState.get<any>('currentLobby');
    
    let lobbyId: string | undefined;
    
    if (currentLobby) {
        const useCurrentLobby = await vscode.window.showQuickPick(
            ['Use current lobby: ' + currentLobby.title, 'Enter different lobby ID'],
            { placeHolder: 'Select lobby' }
        );
        
        if (!useCurrentLobby) {
            return;
        }
        
        if (useCurrentLobby.startsWith('Use current')) {
            lobbyId = currentLobby.id;
        }
    }
    
    if (!lobbyId) {
        // Try to auto-fetch lobbies and let user select
        try {
            const lobbyIds = await client.getLobbyIds();
            if (lobbyIds.length > 0) {
                const selectedLobbyId = await vscode.window.showQuickPick(lobbyIds, {
                    placeHolder: 'Select a lobby'
                });
                lobbyId = selectedLobbyId;
            }
        } catch (error) {
            console.log('Could not auto-fetch lobbies, falling back to manual input');
        }
        
        // If still no lobby ID, ask user to enter manually
        if (!lobbyId) {
            lobbyId = await vscode.window.showInputBox({
                prompt: 'Enter lobby ID',
                placeHolder: '123456789',
                validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                        return 'Lobby ID cannot be empty';
                    }
                    return null;
                }
            });
        }

        if (!lobbyId) {
            return;
        }
    }

    const editor = vscode.window.activeTextEditor;
    let defaultMessage = '';
    
    if (editor && !editor.selection.isEmpty) {
        const selection = editor.selection;
        const text = editor.document.getText(selection);
        const language = editor.document.languageId;
        defaultMessage = `\`\`\`${language}\n${text}\n\`\`\``;
    }

    const message = await vscode.window.showInputBox({
        prompt: 'Enter message to send',
        placeHolder: 'Your message or code snippet',
        value: defaultMessage,
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return 'Message cannot be empty';
            }
            return null;
        }
    });

    if (!message) {
        return;
    }

    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Sending message...',
            cancellable: false
        }, async () => {
            const currentUser = (getDiscordClient() as any)?.getCurrentUser?.();
            const userId = currentUser?.id || 'unknown';
            
            await sdkAdapter.sendLobbyMessage(lobbyId, message);
            
            // Relay message to other extensions via API
            try {
                await relayMessage(lobbyId, {
                    from: userId,
                    content: message,
                    timestamp: Date.now()
                });
                console.log('[sendLobbyMessage] Message relayed via API');
            } catch (relayError) {
                console.warn('[sendLobbyMessage] Relay failed (non-critical):', relayError);
            }
            
            console.log(`[sendLobbyMessage] Message sent, checking for code: ${message.substring(0, 50)}...`);
            
            // Inline code detection - don't rely on export/import
            if (message.includes('```')) {
                console.log('[sendLobbyMessage] 🔍 Code block detected in message!');
                
                let language = 'plaintext';
                let code = '';
                
                // Try strict format first
                let codeMatch = message.match(/```(\w+)\n([\s\S]*?)\n```/);
                if (codeMatch) {
                    language = codeMatch[1] || 'plaintext';
                    code = codeMatch[2];
                } else {
                    // Try lenient format
                    codeMatch = message.match(/```\n?([\s\S]*?)\n?```/);
                    if (codeMatch) {
                        code = codeMatch[1];
                    }
                }
                
                if (code.trim()) {
                    console.log(`[sendLobbyMessage] ✅ Extracted code: ${language}, ${code.length} chars`);
                    // Call the helper function
                    handleCodeShare(message, (getDiscordClient() as any)?.getCurrentUser?.()?.id || 'self', lobbyId);
                }
            }
            
            // Ensure lobby chat provider knows which lobby we're in
            const lobbyChatProvider = getLobbyChatTreeProvider();
            if (lobbyChatProvider) {
                lobbyChatProvider.setCurrentLobby(lobbyId);
                
                const currentUser = (getDiscordClient() as any)?.getCurrentUser?.();
                lobbyChatProvider.addMessage(
                    currentUser?.username || 'You',
                    currentUser?.id || 'self',
                    message,
                    true // isOwn
                );
            }
            
            // Show notification with message content
            const displayText = message.length > 100 ? message.substring(0, 100) + '...' : message;
            vscode.window.showInformationMessage(
                `✅ Message sent to lobby:\n${displayText}`
            );
        });
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to send message: ${error}`);
    }
}
