import * as vscode from 'vscode';
import { getDiscordClient } from '../extension';

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
        });

        vscode.window.showInformationMessage(`✅ Left lobby ${lobbyId.substring(0, 12)}`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to leave lobby: ${(error as Error).message}`);
    }
}
