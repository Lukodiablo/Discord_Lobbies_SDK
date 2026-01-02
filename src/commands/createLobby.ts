import * as vscode from 'vscode';
import { getDiscordClient, getContext } from '../extension';
import { sdkAdapter } from '../services/discordSDKSubprocess';

export async function createLobbyCommand() {
    const client = getDiscordClient();
    
    if (!client || !client.isConnected()) {
        vscode.window.showErrorMessage('Discord not connected. Please authenticate first.');
        return;
    }

    const title = await vscode.window.showInputBox({
        prompt: 'Enter lobby title',
        placeHolder: 'Code Review Session',
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return 'Title cannot be empty';
            }
            if (value.length > 100) {
                return 'Title too long (max 100 characters)';
            }
            return null;
        }
    });

    if (!title) {
        return;
    }

    const description = await vscode.window.showInputBox({
        prompt: 'Enter lobby description (optional)',
        placeHolder: 'Reviewing feature X implementation',
    });

    const secret = Math.random().toString(36).substring(2, 15);

    try {
        const lobbyId = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Creating lobby...',
            cancellable: false
        }, async () => {
            return await client.createLobby(secret, title, description || '');
        });
        
        // Store lobby info for easy access
        const context = getContext();
        if (context) {
            await context.workspaceState.update('currentLobby', {
                id: lobbyId,
                secret,
                title,
                description
            });
            
            // Trigger tree view refresh via view state change
            vscode.commands.executeCommand('discord-vscode.refreshLobbies');
        }
        
        const friends = await client.fetchFriends();
        
        if (friends.length === 0) {
            vscode.window.showInformationMessage(
                `Lobby created! ID: ${lobbyId}`,
                'Copy ID'
            ).then(selection => {
                if (selection === 'Copy ID') {
                    vscode.env.clipboard.writeText(lobbyId);
                }
            });
            return;
        }

        const friendItems = friends.map(f => ({
            label: f.username,
            description: `ID: ${f.id}`,
            id: f.id
        }));

        const selectedFriends = await vscode.window.showQuickPick(friendItems, {
            canPickMany: true,
            placeHolder: 'Select friends to invite (optional)'
        });

        if (selectedFriends && selectedFriends.length > 0) {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Sending invites to ${selectedFriends.length} friend(s)...`,
                cancellable: false
            }, async () => {
                const inviteMessage = `🎮 You're invited to join: ${title}\n${description ? description + '\n' : ''}Lobby ID: ${lobbyId}\nSecret: ${secret}`;
                
                for (const friend of selectedFriends) {
                    try {
                        await sdkAdapter.sendDM(friend.id, inviteMessage);
                    } catch (error) {
                        console.error(`Failed to send invite to ${friend.label}:`, error);
                    }
                }
            });
            
            vscode.window.showInformationMessage(
                `Lobby created! Invites sent to ${selectedFriends.length} friend(s).`,
                'Copy Lobby Info'
            ).then(selection => {
                if (selection === 'Copy Lobby Info') {
                    vscode.env.clipboard.writeText(`Lobby ID: ${lobbyId}\nSecret: ${secret}`);
                }
            });
        } else {
            vscode.window.showInformationMessage(
                `Lobby created! ID: ${lobbyId}`,
                'Copy ID'
            ).then(selection => {
                if (selection === 'Copy ID') {
                    vscode.env.clipboard.writeText(lobbyId);
                }
            });
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create lobby: ${error}`);
    }
}
