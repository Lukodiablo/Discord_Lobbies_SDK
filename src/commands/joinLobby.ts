import * as vscode from 'vscode';
import { getDiscordClient, getContext } from '../extension';
import { registerLobby } from '../services/relayAPI';
import { updateRelayPollerLobbies } from '../services/relayMessagePoller';

export async function joinLobbyCommand() {
    const client = getDiscordClient();
    
    if (!client || !client.isConnected()) {
        vscode.window.showErrorMessage('Discord not connected. Please authenticate first.');
        return;
    }

    const context = getContext();
    const currentLobby = context?.workspaceState.get('currentLobby') as any;

    // If already in a lobby, ask if they want to rejoin or join new one
    if (currentLobby && currentLobby.id && currentLobby.secret) {
        const choice = await vscode.window.showQuickPick(
            ['Rejoin current lobby', 'Join different lobby'],
            { placeHolder: 'What do you want to do?' }
        );

        if (choice === 'Rejoin current lobby') {
            try {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Rejoining ${currentLobby.title}...`,
                    cancellable: false
                }, async () => {
                    // Reconfirm the join
                    vscode.window.showInformationMessage(
                        `✅ Joined: ${currentLobby.title}\nID: ${currentLobby.id}`
                    );
                });
                return;
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to join lobby: ${error}`);
                return;
            }
        }
        // Otherwise fall through to join new lobby
    }

    const lobbyId = await vscode.window.showInputBox({
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

    const secret = await vscode.window.showInputBox({
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

    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Joining lobby...',
            cancellable: false
        }, async () => {
            // Fetch lobby metadata from Discord SDK
            let lobbyTitle = `Lobby ${lobbyId.substring(0, 8)}...`;
            try {
                const lobbyMetadata = await client.getLobbyMetadata(lobbyId);
                if (lobbyMetadata && typeof lobbyMetadata === 'object') {
                    // Try to get title from metadata - Discord may use different keys
                    const title = (lobbyMetadata as any)['title'] || 
                                 (lobbyMetadata as any)['name'] || 
                                 (lobbyMetadata as any)['display_name'];
                    if (title) {
                        lobbyTitle = title;
                        console.log(`[JoinLobby] Fetched real lobby title: ${lobbyTitle}`);
                    }
                }
            } catch (error) {
                console.warn('[JoinLobby] Failed to fetch lobby metadata, using default:', error);
            }

            // Store the lobby info with real or fallback title
            if (context) {
                await context.workspaceState.update('currentLobby', {
                    id: lobbyId,
                    secret,
                    title: lobbyTitle,
                    description: 'Joined lobby'
                });
                
                // Register lobby with relay API so we receive messages
                const extensionId = vscode.extensions.getExtension('lobbies-sdk')?.id || 'unknown';
                try {
                    await registerLobby(lobbyId, extensionId);
                    console.log(`[JoinLobby] Registered lobby ${lobbyId} with relay API`);
                    
                    // Tell relay poller to monitor this lobby
                    updateRelayPollerLobbies([lobbyId]);
                    console.log(`[JoinLobby] Added lobby ${lobbyId} to relay poller`);
                } catch (registerError) {
                    console.warn('[JoinLobby] Failed to register lobby with relay API:', registerError);
                }
                
                // Refresh tree view
                vscode.commands.executeCommand('discord-vscode.refreshLobbies');
            }
            vscode.window.showInformationMessage(`✅ Joined: ${lobbyTitle}\nID: ${lobbyId}`);
        });
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to join lobby: ${error}`);
    }
}
