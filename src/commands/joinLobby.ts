import * as vscode from 'vscode';
import { getDiscordClient, getContext } from '../extension';
import { registerLobby } from '../services/relayAPI';
import { updateRelayPollerLobbies } from '../services/relayMessagePoller';
import { isDiscordAppRunning } from '../utils/discordAppCheck';

export async function joinLobbyCommand(options?: { lobbyId?: string; secret?: string }) {
    const client = getDiscordClient();
    
    if (!client || !client.isConnected()) {
        vscode.window.showErrorMessage('Discord not connected. Please authenticate first.');
        return;
    }

    const context = getContext();
    const currentLobby = context?.workspaceState.get('currentLobby') as any;

    // If direct parameters provided (e.g., from invite button), use them
    if (options?.lobbyId && options?.secret) {
        console.log(`[joinLobby] Direct join with lobby ID: ${options.lobbyId}`);
        await performLobbyJoin(client, context, options.lobbyId, options.secret);
        return;
    }

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

    await performLobbyJoin(client, context, lobbyId, secret);
}

/**
 * Helper function to perform the actual lobby join
 */
async function performLobbyJoin(client: any, context: any, lobbyId: string, secret: string) {
    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Joining lobby...',
            cancellable: false
        }, async () => {
            // CRITICAL: First, actually join the Discord lobby with the SDK using the secret
            // This makes us a member so we can receive messages
            let actualJoinedLobbyId: string | null = null;
            try {
                console.log(`[JoinLobby] ==================== START JOIN PROCESS ====================`);
                console.log(`[JoinLobby] Calling Discord SDK CreateOrJoinLobby with secret: ${secret.substring(0, 5)}...`);
                console.log(`[JoinLobby] Expected lobby ID from invite: ${lobbyId}`);
                
                actualJoinedLobbyId = await client.createOrJoinLobby(secret);
                
                console.log(`[JoinLobby] ✅ createOrJoinLobby returned: ${actualJoinedLobbyId}`);
                console.log(`[JoinLobby] Expected: ${lobbyId}`);
                console.log(`[JoinLobby] Match: ${actualJoinedLobbyId === lobbyId ? '✅ YES' : '❌ NO'}`);
                
                // Verify we got the right lobby
                if (actualJoinedLobbyId !== lobbyId) {
                    console.warn(`[JoinLobby] ⚠️  SDK returned different lobby ID: ${actualJoinedLobbyId} vs requested ${lobbyId}`);
                }
            } catch (sdkError) {
                console.error('[JoinLobby] ❌ CRITICAL: SDK call failed completely:', sdkError);
                vscode.window.showErrorMessage(`❌ Failed to join lobby with Discord SDK:\n${sdkError}`);
                throw sdkError; // Don't continue if join failed
            }

            // After joining, refresh lobby list to ensure cache is updated
            try {
                console.log(`[JoinLobby] Refreshing lobby list to verify join...`);
                const lobbies = await client.getLobbyIds();
                console.log(`[JoinLobby] Your lobbies after join: [${lobbies.join(', ')}]`);
                console.log(`[JoinLobby] Checking if ${lobbyId} is in list: ${lobbies.includes(lobbyId) ? '✅ YES' : '❌ NO'}`);
                
                if (!lobbies.includes(lobbyId) && !lobbies.includes(actualJoinedLobbyId || '')) {
                    console.error(`[JoinLobby] ❌ CRITICAL: Lobby ${lobbyId} not found in your lobby list!`);
                    console.error(`[JoinLobby] This means createOrJoinLobby may have failed silently.`);
                    console.error(`[JoinLobby] Returned ID: ${actualJoinedLobbyId}, Expected: ${lobbyId}`);
                    vscode.window.showWarningMessage(`⚠️  Warning: Lobby may not have been joined successfully. Check logs.`);
                }
            } catch (error) {
                console.warn('[JoinLobby] Failed to refresh lobbies list:', error);
            }

            console.log(`[JoinLobby] ==================== END JOIN PROCESS ====================`);

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
