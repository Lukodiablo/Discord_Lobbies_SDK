import * as vscode from 'vscode';
import { getDiscordClient, handleCodeShare, getSharedCodeProvider } from '../extension';

export async function sendCodeToLobbyCommand(lobbyId: string) {
  const client = getDiscordClient();
  if (!client || !client.isConnected()) {
    vscode.window.showErrorMessage('Discord not connected.');
    return;
  }

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active text editor. Please open a file or select code.');
    return;
  }

  const fileName = editor.document.fileName.split('/').pop() || 'code.txt';
  const language = editor.document.languageId || 'plaintext';
  const selection = editor.selection;
  const fullFileLines = editor.document.lineCount;
  
  let selectedCode = '';
  let shareType = 'selection';
  
  // If there's a selection, offer choice
  if (!selection.isEmpty) {
    selectedCode = editor.document.getText(selection);
    const selectedLines = selectedCode.split('\n').length;
    const choice = await vscode.window.showQuickPick(
      [
        `$(file) Share Selected Code (${selectedLines} lines)`,
        `$(files) Share Entire File (${fullFileLines} lines)`
      ],
      { placeHolder: 'What do you want to share?' }
    );
    
    if (!choice) return;
    
    if (choice.includes('Entire File')) {
      selectedCode = editor.document.getText();
      shareType = 'file';
    } else {
      selectedCode = editor.document.getText(selection);
      shareType = 'selection';
    }
  } else {
    // No selection - share entire file
    selectedCode = editor.document.getText();
    shareType = 'file';
  }

  if (!selectedCode.trim()) {
    vscode.window.showErrorMessage('No code to share.');
    return;
  }

  // Format the code snippet for sharing
  const lineCount = selectedCode.split('\n').length;
  const shareIcon = shareType === 'file' ? '📁' : '📤';
  const shareLabel = shareType === 'file' ? 'File' : 'Code Snippet';
  
  const message =
    `${shareIcon} **${shareLabel}**: \`${fileName}\` (${lineCount} lines, ${language})\n\n` +
    `\`\`\`${language}\n` +
    selectedCode +
    `\n\`\`\``;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Sharing ${shareLabel.toLowerCase()} to lobby...`,
      cancellable: false,
    },
    async () => {
      try {
        await client.sendLobbyMessage(lobbyId, message);
        
        console.log(`[sendCodeToLobby] Code shared, adding to shared code panel...`);
        
        // Add to shared code provider directly
        const sharedCodeProvider = getSharedCodeProvider();
        if (sharedCodeProvider) {
          const currentUser = (client as any)?.getCurrentUser?.();
          const userId = currentUser?.id || 'You';
          const description = `Shared ${shareLabel.toLowerCase()} ${fileName} to lobby`;
          sharedCodeProvider.addSnippet(userId, selectedCode, language, description);
          console.log(`[sendCodeToLobby] ✅ Added to SharedCodeProvider: ${language}, ${selectedCode.length} chars`);
        } else {
          console.error('[sendCodeToLobby] ❌ SharedCodeProvider not available');
        }
        
        vscode.window.showInformationMessage(
          `✅ Shared ${lineCount}-line ${shareLabel.toLowerCase()} to lobby ${lobbyId.substring(0, 12)}`
        );
      } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to share: ${error.message}`);
      }
    }
  );
}
