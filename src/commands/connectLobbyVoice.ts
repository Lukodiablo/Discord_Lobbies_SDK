import * as vscode from 'vscode';
import { getDiscordClient, getContext } from '../extension';

export async function connectLobbyVoiceCommand() {
  const client = getDiscordClient();
  
  if (!client || !client.isConnected()) {
    vscode.window.showErrorMessage('Discord not connected. Please authenticate first.');
    return;
  }

  const context = getContext();
  const currentLobby = context?.workspaceState.get<any>('currentLobby');
  
  let lobbyId: string | undefined;
  
  if (currentLobby) {
    const useCurrentLobby = await vscode.window.showQuickPick(
      ['Use current lobby: ' + currentLobby.title, 'Enter different lobby ID'],
      { placeHolder: 'Select lobby' }
    );
    
    if (!useCurrentLobby) {
      return;
    }
    
    if (useCurrentLobby.startsWith('Use current')) {
      lobbyId = currentLobby.id;
    }
  }
  
  if (!lobbyId) {
    // Try to auto-fetch lobbies
    try {
      const lobbyIds = await client.getLobbyIds();
      if (lobbyIds.length > 0) {
        const selectedLobbyId = await vscode.window.showQuickPick(lobbyIds, {
          placeHolder: 'Select a lobby'
        });
        lobbyId = selectedLobbyId;
      }
    } catch (error) {
      console.log('Could not auto-fetch lobbies');
    }
    
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
    }
    
    if (!lobbyId) {
      return;
    }
  }

  try {
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Connecting to lobby voice...',
      cancellable: false
    }, async () => {
      await client.connectLobbyVoice(lobbyId!);
      vscode.window.showInformationMessage(`🎤 Connected to lobby voice`);
    });
  } catch (error: any) {
    vscode.window.showErrorMessage(`Failed to connect to lobby voice: ${error.message}`);
  }
}

export async function disconnectLobbyVoiceCommand() {
  const client = getDiscordClient();
  
  if (!client || !client.isConnected()) {
    vscode.window.showErrorMessage('Discord not connected.');
    return;
  }

  const context = getContext();
  const currentLobby = context?.workspaceState.get<any>('currentLobby');
  
  let lobbyId: string | undefined;
  
  if (currentLobby) {
    const useCurrentLobby = await vscode.window.showQuickPick(
      ['Use current lobby: ' + currentLobby.title, 'Enter different lobby ID'],
      { placeHolder: 'Select lobby' }
    );
    
    if (!useCurrentLobby) {
      return;
    }
    
    if (useCurrentLobby.startsWith('Use current')) {
      lobbyId = currentLobby.id;
    }
  }
  
  if (!lobbyId) {
    // Try to auto-fetch lobbies
    try {
      const lobbyIds = await client.getLobbyIds();
      if (lobbyIds.length > 0) {
        const selectedLobbyId = await vscode.window.showQuickPick(lobbyIds, {
          placeHolder: 'Select a lobby'
        });
        lobbyId = selectedLobbyId;
      }
    } catch (error) {
      console.log('Could not auto-fetch lobbies');
    }
    
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
    }
    
    if (!lobbyId) {
      return;
    }
  }

  try {
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Disconnecting from lobby voice...',
      cancellable: false
    }, async () => {
      await client.disconnectLobbyVoice(lobbyId!);
      vscode.window.showInformationMessage(`🔇 Disconnected from lobby voice`);
    });
  } catch (error: any) {
    vscode.window.showErrorMessage(`Failed to disconnect from lobby voice: ${error.message}`);
  }
}
