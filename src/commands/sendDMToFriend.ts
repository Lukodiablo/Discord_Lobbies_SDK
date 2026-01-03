import * as vscode from 'vscode';
import { sdkAdapter } from '../services/discordSDKSubprocess';
import { relayMessage } from '../services/relayAPI';

export async function sendDMToFriendCommand(friendId: string, friendName: string) {
    const message = await vscode.window.showInputBox({
        prompt: `Send message to ${friendName}`,
        placeHolder: 'Your message',
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
            title: `Sending message to ${friendName}...`,
            cancellable: false
        }, async () => {
            const currentUser = (vscode.extensions.getExtension('lobbies-sdk') as any)?.exports?.getCurrentUser?.() || {};
            const userId = currentUser.id || 'unknown';
            
            // Send via SDK to Discord
            await sdkAdapter.sendDM(friendId, message);
            
            // Also relay via API so receiving device gets it
            try {
                // Use friendId as the channel/lobby ID for relay storage
                await relayMessage(friendId, {
                    from: userId,
                    content: message,
                    timestamp: Date.now()
                });
                console.log('[sendDMToFriend] DM relayed via API');
            } catch (relayError) {
                console.warn('[sendDMToFriend] Relay failed (non-critical):', relayError);
            }
            
            vscode.window.showInformationMessage(`Message sent to ${friendName}!`);
        });
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to send message: ${error}`);
    }
}
