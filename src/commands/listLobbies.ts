import * as vscode from 'vscode';
import { getDiscordClient } from '../extension';

export async function listLobbiesCommand() {
    const client = getDiscordClient();
    
    if (!client || !client.isConnected()) {
        vscode.window.showErrorMessage('Discord not connected. Please authenticate first.');
        return;
    }

    try {
        const lobbyIds = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Loading lobbies...',
            cancellable: false
        }, async () => {
            return await client.getLobbyIds();
        });

        if (!lobbyIds || lobbyIds.length === 0) {
            vscode.window.showInformationMessage('You are not in any lobbies. Create one with "Create Lobby" command.');
            return;
        }

        // Show quick pick with lobby IDs
        const selected = await vscode.window.showQuickPick(
            lobbyIds.map(id => ({
                label: `Lobby: ${id}`,
                description: `ID: ${id}`,
                detail: 'Click to view details',
                lobbyId: id
            })),
            {
                title: `Your Lobbies (${lobbyIds.length})`,
                placeHolder: 'Select a lobby to join or send message'
            }
        );

        if (!selected) {
            return;
        }

        // Show actions for the selected lobby
        const action = await vscode.window.showQuickPick(
            [
                { label: '💬 Send Message', detail: 'Send a message to the lobby' },
                { label: '👋 Leave Lobby', detail: 'Leave this lobby' }
            ],
            { title: `Actions for Lobby ${selected.lobbyId}` }
        );

        if (!action) {
            return;
        }

        if (action.label.includes('Send Message')) {
            const message = await vscode.window.showInputBox({
                prompt: 'Enter message to send',
                placeHolder: 'Hello everyone!'
            });

            if (message) {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Sending message...',
                    cancellable: false
                }, async () => {
                    await client.sendLobbyMessage(selected.lobbyId, message);
                });

                vscode.window.showInformationMessage(`✅ Message sent to lobby ${selected.lobbyId}`);
            }
        } else if (action.label.includes('Leave Lobby')) {
            const confirm = await vscode.window.showWarningMessage(
                `Leave lobby ${selected.lobbyId}?`,
                'Yes',
                'Cancel'
            );

            if (confirm === 'Yes') {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Leaving lobby...',
                    cancellable: false
                }, async () => {
                    await client.leaveLobby(selected.lobbyId);
                });

                vscode.window.showInformationMessage(`✅ Left lobby ${selected.lobbyId}`);
            }
        }
    } catch (error) {
        console.error('Failed to list lobbies:', error);
        vscode.window.showErrorMessage('Failed to list lobbies: ' + (error as Error).message);
    }
}
