import * as vscode from 'vscode';
import { getDiscordClient, getContext, getRichPresenceManager } from '../extension';

export async function connectLobbyVoiceCommand(itemLobbyId?: string) {
  console.log('[connectLobbyVoice] COMMAND STARTED - itemLobbyId from tree:', itemLobbyId);
  const client = getDiscordClient();
  
  if (!client || !client.isConnected()) {
    console.log('[connectLobbyVoice] ERROR: Client not connected');
    vscode.window.showErrorMessage('Discord not connected. Please authenticate first.');
    return;
  }

  const context = getContext();
  const currentLobby = context?.workspaceState.get<any>('currentLobby');
  console.log('[connectLobbyVoice] currentLobby:', currentLobby?.id, 'title:', currentLobby?.title);
  console.log('[connectLobbyVoice] currentLobby full object:', JSON.stringify(currentLobby));
  
  // If called from tree item, use that lobbyId directly
  let lobbyId: string | undefined = itemLobbyId || currentLobby?.id;
  console.log('[connectLobbyVoice] Using lobbyId:', lobbyId);
  
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

  console.log('[connectLobbyVoice] About to connect to lobby:', lobbyId);
  try {
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Connecting to lobby voice...',
      cancellable: false
    }, async () => {
      console.log('[connectLobbyVoice] Starting voice connection...');
      await client.connectLobbyVoice(lobbyId!);
      console.log('[connectLobbyVoice] Voice connection successful');
      
      // Get current lobby info for rich presence
      const context = getContext();
      const currentLobby = context?.workspaceState.get<any>('currentLobby');
      const channelName = currentLobby?.title ? `${currentLobby.title} (Voice)` : 'Lobby Voice';
      
      // Update rich presence with voice channel info
      const richPresenceManager = getRichPresenceManager();
      if (richPresenceManager) {
        richPresenceManager.setVoiceChannelInfo(channelName);
      }
      
      // Track current user as connected to voice
      let currentUserId = 'unknown';
      let currentUsername = 'You';
      
      // Try to get user from workspace state
      try {
        const userData = context?.workspaceState.get<any>('userData');
        console.log('[connectLobbyVoice] userData from state:', userData?.id, userData?.username);
        if (userData?.id) {
          currentUserId = userData.id;
          currentUsername = userData.username || userData.global_name || 'You';
        }
      } catch (e) {
        console.log('[connectLobbyVoice] Could not get userData from state', e);
      }
      
      console.log(`[connectLobbyVoice] Adding user to voice: ${currentUsername} (${currentUserId})`);
      if (currentUserId && currentUserId !== 'unknown' && lobbyId) {
        console.log('[connectLobbyVoice] Calling addLobbyVoiceMember...');
        client.addLobbyVoiceMember(lobbyId, currentUserId, currentUsername);
        console.log('[connectLobbyVoice] User added to voice tracking');
      } else {
        console.log(`[connectLobbyVoice] WARNING: Could not add user - userId: ${currentUserId}, lobbyId: ${lobbyId}`);
      }
      
      vscode.window.showInformationMessage(`🎤 Connected to lobby voice`);
    });
  } catch (error: any) {
    console.error('[connectLobbyVoice] Error:', error);
    vscode.window.showErrorMessage(`Failed to connect to lobby voice: ${error.message}`);
  }
}

export async function disconnectLobbyVoiceCommand(itemLobbyId?: string) {
  const client = getDiscordClient();
  
  if (!client || !client.isConnected()) {
    vscode.window.showErrorMessage('Discord not connected.');
    return;
  }

  const context = getContext();
  const currentLobby = context?.workspaceState.get<any>('currentLobby');
  
  // If called from tree item, use that lobbyId directly
  let lobbyId: string | undefined = itemLobbyId || currentLobby?.id;
  
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
      console.log('[disconnectLobbyVoice] Starting voice disconnection...');
      await client.disconnectLobbyVoice(lobbyId!);
      console.log('[disconnectLobbyVoice] Voice disconnection successful');
      
      // Clear voice channel info from rich presence
      const richPresenceManager = getRichPresenceManager();
      if (richPresenceManager) {
        richPresenceManager.setVoiceChannelInfo('');
      }
      
      // Remove current user from voice tracking
      let currentUserId = 'unknown';
      try {
        const context = getContext();
        const userData = context?.workspaceState.get<any>('userData');
        if (userData?.id) {
          currentUserId = userData.id;
        }
      } catch (e) {
        console.log('[disconnectLobbyVoice] Could not get userData from state');
      }
      
      console.log(`[disconnectLobbyVoice] Removing user from voice: ${currentUserId}`);
      if (currentUserId && currentUserId !== 'unknown' && lobbyId) {
        client.removeLobbyVoiceMember(lobbyId, currentUserId);
        console.log('[disconnectLobbyVoice] User removed from voice tracking');
      } else {
        console.log(`[disconnectLobbyVoice] WARNING: Could not remove user - userId: ${currentUserId}`);
      }
      
      vscode.window.showInformationMessage(`📴 Disconnected from lobby voice`);
    });
  } catch (error: any) {
    console.error('[disconnectLobbyVoice] Error:', error);
    vscode.window.showErrorMessage(`Failed to disconnect from lobby voice: ${error.message}`);
  }
}
