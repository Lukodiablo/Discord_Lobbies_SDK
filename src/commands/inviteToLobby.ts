import * as vscode from 'vscode';
import { sdkAdapter } from '../services/discordSDKSubprocess';
import { getContext, getDiscordClient } from '../extension';

export async function inviteToLobbyCommand(friendId: string, friendName: string) {
    const context = getContext();
    const client = getDiscordClient();
    const currentLobby = context?.workspaceState.get<any>('currentLobby');
    
    let lobbyId: string | undefined;
    let secret: string | undefined;
    let title: string | undefined;
    
    if (currentLobby) {
        const useCurrentLobby = await vscode.window.showQuickPick(
            ['Use current lobby: ' + currentLobby.title, 'Enter different lobby'],
            { placeHolder: 'Select lobby to invite to' }
        );
        
        if (!useCurrentLobby) {
            return;
        }
        
        if (useCurrentLobby.startsWith('Use current')) {
            lobbyId = currentLobby.id;
            secret = currentLobby.secret;
            title = currentLobby.title;
        }
    }
    
    if (!lobbyId) {
        // Try to auto-fetch lobbies and let user select
        if (client && client.isConnected()) {
            try {
                const lobbyIds = await client.getLobbyIds();
                if (lobbyIds.length > 0) {
                    const selectedLobbyId = await vscode.window.showQuickPick(lobbyIds, {
                        placeHolder: 'Select a lobby'
                    });
                    lobbyId = selectedLobbyId;
                    if (lobbyId) {
                        title = `Lobby ${lobbyId.substring(0, 8)}...`;
                    }
                }
            } catch (error) {
                console.log('Could not auto-fetch lobbies, falling back to manual input');
            }
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

            if (!lobbyId) {
                return;
            }

            secret = await vscode.window.showInputBox({
                prompt: 'Enter lobby secret',
                placeHolder: 'abc123xyz',
                validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                        return 'Secret cannot be empty';
                    }
                    return null;
                }
            });

            if (!secret) {
                return;
            }

            title = await vscode.window.showInputBox({
                prompt: 'Enter lobby title (optional)',
                placeHolder: 'Code Review Session'
            });
        }
    }

    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Inviting ${friendName}...`,
            cancellable: false
        }, async () => {
            const message = `🎮 You're invited to join${title ? ': ' + title : ''}!\nLobby ID: ${lobbyId}\nSecret: ${secret}`;
            await sdkAdapter.sendDM(friendId, message);
            vscode.window.showInformationMessage(`Invite sent to ${friendName}!`);
        });
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to send invite: ${error}`);
    }
}
