import * as vscode from 'vscode';
import { getDiscordClient } from '../extension';

export async function toggleMuteLobbyCommand(_item?: any) {
  const client = getDiscordClient();
  if (!client || !client.isConnected()) {
    vscode.window.showErrorMessage('Discord not connected.');
    return;
  }

  try {
    // Get current mute status
    const statusResult = await client.getMuteStatus();
    const currentMuted = statusResult.muted || false;

    // Toggle mute
    await client.setMute(!currentMuted);

    const newStatus = !currentMuted ? 'muted' : 'unmuted';
    vscode.window.showInformationMessage(`🎤 Microphone ${newStatus}`);
  } catch (error: any) {
    vscode.window.showErrorMessage(`Failed to toggle mute: ${error.message}`);
  }
}

export async function toggleDeafLobbyCommand(_item?: any) {
  const client = getDiscordClient();
  if (!client || !client.isConnected()) {
    vscode.window.showErrorMessage('Discord not connected.');
    return;
  }

  try {
    // Get current deaf status
    const statusResult = await client.getDeafStatus();
    const currentDeafened = statusResult.deafened || false;

    // Toggle deaf
    await client.setDeaf(!currentDeafened);

    const newStatus = !currentDeafened ? 'deafened' : 'undeafened';
    vscode.window.showInformationMessage(`🔊 Audio output ${newStatus}`);
  } catch (error: any) {
    vscode.window.showErrorMessage(`Failed to toggle deafen: ${error.message}`);
  }
}
