import * as vscode from 'vscode';
import { DiscordClient } from '../gateway/discordClient';

/**
 * Command to read messages from a lobby or fetch a specific message
 */
export async function readMessagesCommand(client: DiscordClient | null): Promise<void> {
    if (!client?.isConnected()) {
        vscode.window.showErrorMessage('Not connected to Discord');
        return;
    }

    const action = await vscode.window.showQuickPick(
        [
            { label: '📖 Read Lobby Messages', detail: 'Fetch recent messages from a lobby' },
            { label: '🔍 Get Specific Message', detail: 'Fetch a message by ID' },
        ],
        { title: 'Message Operations' }
    );

    if (!action) return;

    if (action.label.includes('Lobby')) {
        await readLobbyMessages(client);
    } else {
        await getSpecificMessage(client);
    }
}

async function readLobbyMessages(client: DiscordClient): Promise<void> {
    try {
        // Get lobby IDs
        const lobbyIds = await client.getLobbyIds();
        if (!lobbyIds || lobbyIds.length === 0) {
            vscode.window.showInformationMessage('No active lobbies');
            return;
        }

        const selected = await vscode.window.showQuickPick(
            lobbyIds.map(id => ({ label: id, description: 'Lobby ID' })),
            { title: 'Select Lobby to Read Messages From' }
        );

        if (!selected) return;

        // For now, show a message that direct message reading would require Discord server
        vscode.window.showInformationMessage(
            'Lobby messages are synced through Discord servers. ' +
            'Messages are displayed in real-time as they are sent. ' +
            'Use the Lobby Chat panel to view and send messages.'
        );

    } catch (error) {
        console.error('❌ Failed to read messages:', error);
        vscode.window.showErrorMessage(`Failed to read messages: ${error}`);
    }
}

async function getSpecificMessage(client: DiscordClient): Promise<void> {
    try {
        const messageId = await vscode.window.showInputBox({
            prompt: 'Enter message ID',
            placeHolder: 'Message ID',
        });

        if (!messageId) return;

        vscode.window.showInformationMessage(
            'Direct message fetching is handled through real-time sync. ' +
            'Messages are automatically displayed as they are received. ' +
            'Check the Lobby Chat panel for message details.'
        );
    } catch (error) {
        console.error('❌ Failed to fetch message:', error);
        vscode.window.showErrorMessage(`Failed to fetch message: ${error}`);
    }
}
