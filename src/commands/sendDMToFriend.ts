import * as vscode from 'vscode';
import { sdkAdapter } from '../services/discordSDKSubprocess';

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
            await sdkAdapter.sendDM(friendId, message);
            vscode.window.showInformationMessage(`Message sent to ${friendName}!`);
        });
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to send message: ${error}`);
    }
}
