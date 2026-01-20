import * as vscode from 'vscode';
import { getDiscordClient, getRichPresenceManager, getContext } from '../extension';

export async function leaveLobbyCommand(lobbyId: string) {
    const client = getDiscordClient();
    
    if (!client || !client.isConnected()) {
        vscode.window.showErrorMessage('Discord not connected.');
        return;
    }

    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Leaving lobby ${lobbyId.substring(0, 12)}...`,
            cancellable: false
        }, async () => {
            await client.leaveLobby(lobbyId);
            
            // Clear lobby info from rich presence
            const richPresenceManager = getRichPresenceManager();
            if (richPresenceManager) {
                richPresenceManager.setLobbyInfo(null);
            }
            
            // Remove current user from lobby member tracking
            const currentUser = client.getCurrentUser();
            if (currentUser) {
                client.removeLobbyMember(lobbyId, currentUser.id);
            }
            
            // CRITICAL FIX: Clear currentLobby from workspace state when leaving
            const context = getContext();
            if (context) {
                const storedLobby = context.workspaceState.get('currentLobby') as any;
                if (storedLobby && storedLobby.id === lobbyId) {
                    console.log('[LeaveLobby] Clearing currentLobby from workspace state:', lobbyId);
                    await context.workspaceState.update('currentLobby', null);
                    console.log('[LeaveLobby] ✅ currentLobby cleared');
                }
            }
        });

        vscode.window.showInformationMessage(`✅ Left lobby ${lobbyId.substring(0, 12)}`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to leave lobby: ${(error as Error).message}`);
    }
}
