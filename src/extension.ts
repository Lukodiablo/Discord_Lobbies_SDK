// Global polyfill must be first import
import './polyfill';

// Polyfill for axios browser detection in Node.js environment
if (typeof (globalThis as any).navigator === 'undefined') {
  Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent: 'Node.js' },
    writable: true,
    configurable: true
  });
}

import * as vscode from 'vscode';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { DiscordAuthManager } from './services/auth';
import { DiscordRPCClient } from './services/discordRPC';
import { DiscordClient } from './gateway/discordClient';
import { CommandHandler } from './handlers/commandHandler';
import { RichPresenceManager } from './services/richPresence';
import { ChatWebviewProvider } from './views/chatWebviewProvider';
import { ServerTreeProvider } from './views/serverTreeProvider';
import { VoiceChannelsTreeProvider } from './views/voiceChannelsTreeProvider';
import { LobbiesTreeProvider } from './views/lobbiesTreeProvider';
import { DirectMessagesTreeProvider } from './views/directMessagesTreeProvider';
import { DiscordStatusBar } from './views/discordStatusBar';
import { DiscordDecorationProvider } from './views/discordDecorationProvider';
import { LobbyChatTreeProvider } from './views/lobbyChatTreeProvider';
import { createLobbyCommand } from './commands/createLobby';
import { joinLobbyCommand } from './commands/joinLobby';
import { listLobbiesCommand } from './commands/listLobbies';
import { sendLobbyMessageCommand } from './commands/sendLobbyMessage';
import { leaveLobbyCommand } from './commands/leaveLobby';
import { sendCodeToLobbyCommand } from './commands/sendCodeToLobby';
import { toggleMuteLobbyCommand, toggleDeafLobbyCommand } from './commands/voiceLobby';
import { connectLobbyVoiceCommand, disconnectLobbyVoiceCommand } from './commands/connectLobbyVoice';
import { inviteToLobbyCommand } from './commands/inviteToLobby';
import { sendDMToFriendCommand } from './commands/sendDMToFriend';
import { QuickAccessCommands } from './commands/quickAccess';
import { ChatViewProvider as ChatViewProviderText } from './views/chatViewProvider';
import { SharedCodeProvider } from './views/sharedCodeProvider';
import { RichPresenceTreeProvider } from './views/richPresenceTreeProvider';
import { startMessagePoller, stopMessagePoller } from './services/lobbyMessagePoller';
import { registerExtension, healthCheck } from './services/relayAPI';

import { DiscordSDKAdapter, sdkAdapter } from './services/discordSDKSubprocess';
import { isDiscordAppRunning } from './utils/discordAppCheck';
import { SetupWizard } from './views/setupWizard';
import { QuickAccessPanel } from './views/quickAccessPanel';
import { DiagnosticsPanel } from './utils/diagnosticsPanel';
import { ConnectionTester } from './utils/connectionTester';

// Global error handlers to catch uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  console.error('❌ UNCAUGHT EXCEPTION:', error.message);
  console.error('Stack:', error.stack);
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('❌ UNHANDLED REJECTION:', reason);
  console.error('Promise:', promise);
});

let authManager: DiscordAuthManager;
let sdkAdapterInstance: DiscordSDKAdapter;
let rpcClient: DiscordRPCClient;
let discordClient: DiscordClient | null = null;
let commandHandler: CommandHandler;
let richPresenceManager: RichPresenceManager;
let richPresenceTreeProvider: RichPresenceTreeProvider;
let chatWebviewProvider: ChatWebviewProvider;
let serverTreeProvider: ServerTreeProvider;
let sharedCodeProvider: SharedCodeProvider;
let lobbiesTreeProvider: LobbiesTreeProvider;
let lobbyChatTreeProvider: LobbyChatTreeProvider;
let directMessagesTreeProvider: DirectMessagesTreeProvider;

// Fetch configuration from Vercel backend with timeout
async function getDiscordConfig(): Promise<{ applicationId: string; clientId: string; redirectUri: string }> {
  const vercelUrl = process.env.VERCEL_BACKEND ? `${process.env.VERCEL_BACKEND}/config` : '';
  
  if (!vercelUrl) {
    console.warn('⚠️  VERCEL_BACKEND not set - using fallback config');
    return {
      applicationId: '1223325203968860261',
      clientId: '1223325203968860261',
      redirectUri: 'http://localhost:3000/oauth/callback'
    };
  }
  
  console.log('🌐 Fetching config from:', vercelUrl);
  
  try {
    // Add 10 second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(vercelUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'VS Code Extension'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const config = await response.json() as any;
    console.log('✅ Config loaded successfully');
    console.log('   applicationId:', config.applicationId ? '✓' : '✗');
    console.log('   clientId:', config.clientId ? '✓' : '✗');
    console.log('   redirectUri:', config.redirectUri ? '✓' : '✗');
    
    return {
      applicationId: config.applicationId,
      clientId: config.clientId,
      redirectUri: config.redirectUri,
    };
  } catch (error: any) {
    console.error('❌ Failed to fetch config:', error.message);
    console.warn('⚠️  Using fallback config');
    // Use fallback hardcoded config instead of crashing
    return {
      applicationId: '1223325203968860261',
      clientId: '1223325203968860261',
      redirectUri: 'http://localhost:3000/oauth/callback'
    };
  }
}

/**
 * Helper function to detect and handle code shares in message content
 * Returns true if code was detected and handled, false otherwise
 */
function handleCodeShareInMessage(
  content: string,
  authorId: string,
  lobbyId?: string
): boolean {
  console.log(`[Extension] handleCodeShareInMessage called: content=${content.substring(0, 50)}..., contains backticks=${content.includes('```')}`);
  
  if (!content.includes('```')) {
    console.log('[Extension] No code blocks detected (no triple backticks)');
    return false;
  }

  console.log('[Extension] 🔍 Checking for code share in message');

  let language = 'plaintext';
  let code = '';

  // Try strict format first: ```language\ncode\n```
  let codeMatch = content.match(/```(\w+)\n([\s\S]*?)\n```/);
  if (codeMatch) {
    language = codeMatch[1] || 'plaintext';
    code = codeMatch[2];
  } else {
    // Try lenient format: ```\ncode\n``` or just ```code```
    codeMatch = content.match(/```\n?([\s\S]*?)\n?```/);
    if (codeMatch) {
      code = codeMatch[1];
      language = 'plaintext';
    }
  }

  if (!code.trim()) {
    return false;
  }

  console.log(`[Extension] ✅ Code share detected: ${language}, ${code.length} chars`);

  // Add to shared code provider
  if (sharedCodeProvider) {
    const description = lobbyId ? `Shared in lobby ${lobbyId.substring(0, 12)}` : 'Shared code';
    console.log(`[Extension] ✅ sharedCodeProvider exists, adding snippet: ${language}`);
    sharedCodeProvider.addSnippet(authorId, code, language, description);
    console.log('[Extension] ✅ Added to SharedCodeProvider');
  } else {
    console.error('[Extension] ❌ sharedCodeProvider is NULL!');
  }

  // Show notification
  vscode.window.showInformationMessage(
    `📝 Code shared by ${authorId} (${language})`,
    'Open in Editor'
  ).then(selection => {
    if (selection === 'Open in Editor') {
      vscode.commands.executeCommand('discord-vscode.openSharedCode', {
        from: authorId,
        code: code,
        language: language
      });
    }
  });

  return true;
}

export async function activate(context: vscode.ExtensionContext) {
  extensionContext = context;
  const diagnostics = DiagnosticsPanel.getInstance();
  
  diagnostics.logActivation('Discord VS Code extension is now active!');
  diagnostics.logEnvironmentInfo();

  try {
    // Check if this is first-time setup (no token in secrets = not configured)
    // BUT: Don't show wizard if we're resuming from auth (wizard will be reopened after connection)
    const tokenExists = !!(await context.secrets.get('discord-token'));
    const wizardStateStr = await context.secrets.get('discord-wizard-state');
    const isResumingFromAuth = wizardStateStr ? JSON.parse(wizardStateStr).pendingAuth === true : false;
    
    if (!tokenExists && !isResumingFromAuth) {
      diagnostics.logSetupProgress(0, 'First-time setup detected - launching Setup Wizard');
      const setupWizard = new SetupWizard(context);
      await setupWizard.show();
    } else {
      // If already configured and user has enabled Quick Access on startup, show it
      const showQuickAccessOnStartup = vscode.workspace.getConfiguration('discord').get<boolean>('showQuickAccessOnStartup', false);
      if (showQuickAccessOnStartup) {
        const quickAccess = new QuickAccessPanel(context);
        await quickAccess.show();
      }
    }

    // Set up LD_LIBRARY_PATH for native addon dependencies (Linux)
    if (process.platform === 'linux') {
      try {
        const extensionDir = path.dirname(__dirname);
        const libPath = path.join(extensionDir, 'native', 'build', 'Release');
        const currentLdPath = process.env.LD_LIBRARY_PATH || '';
        process.env.LD_LIBRARY_PATH = libPath + (currentLdPath ? ':' + currentLdPath : '');
        console.log('📚 Set LD_LIBRARY_PATH for native addon');
      } catch (e) {
        console.warn('⚠️  Could not set LD_LIBRARY_PATH');
      }
    }

    // SDK path will be read from secrets and passed to Discord Client during initialization
    
    console.log('⚙️  Loading Discord configuration...');    
    // Set Vercel backend URL from environment (or will be set via process.env)
    if (!process.env.VERCEL_BACKEND) {
      process.env.VERCEL_BACKEND = 'https://express-js-on-vercel-lukas-projects-2b680f8b.vercel.app';
    }
        const discordConfig = await getDiscordConfig();
    
    // Set environment variables for services that need them
    process.env.DISCORD_APP_ID = discordConfig.applicationId;
    process.env.DISCORD_CLIENT_ID = discordConfig.clientId;
    process.env.REDIRECT_URI = discordConfig.redirectUri;

    try {
		console.log('✓ Discord OAuth configured - ready to authenticate');
	} catch (e) {
		console.error('Failed to initialize config:', e);
	}

    // Initialize services
    authManager = new DiscordAuthManager(context);
    richPresenceManager = new RichPresenceManager(context);
    sdkAdapterInstance = DiscordSDKAdapter.getInstance();
    
    // Initialize tree and webview providers
    serverTreeProvider = new ServerTreeProvider();
    chatWebviewProvider = new ChatWebviewProvider(context);
    
    console.log('📦 Initializing shared code provider...');
    try {
      sharedCodeProvider = SharedCodeProvider.register(context);
      console.log('✓ Shared code provider registered successfully');
    } catch (e) {
      console.error('❌ Failed to register shared code provider - continuing without it:', e);
      sharedCodeProvider = null as any;
    }
    console.log('✓ Initialization complete');
    
    let voiceChannelsTreeProvider: VoiceChannelsTreeProvider;
    
    try {
      voiceChannelsTreeProvider = new VoiceChannelsTreeProvider();
      console.log('✓ Created VoiceChannelsTreeProvider instance');
    } catch (e) {
      console.error('❌ Failed to create VoiceChannelsTreeProvider:', e);
      throw e;
    }
    
    try {
      lobbiesTreeProvider = new LobbiesTreeProvider();
      console.log('✓ Created LobbiesTreeProvider instance');
    } catch (e) {
      console.error('❌ Failed to create LobbiesTreeProvider:', e);
      throw e;
    }

    try {
      lobbyChatTreeProvider = new LobbyChatTreeProvider();
      console.log('✓ Created LobbyChatTreeProvider instance');
    } catch (e) {
      console.error('❌ Failed to create LobbyChatTreeProvider:', e);
      throw e;
    }

    try {
      directMessagesTreeProvider = new DirectMessagesTreeProvider();
      console.log('✓ Created DirectMessagesTreeProvider instance');
    } catch (e) {
      console.error('❌ Failed to create DirectMessagesTreeProvider:', e);
      throw e;
    }

    let statusBar: DiscordStatusBar;
    try {
      statusBar = new DiscordStatusBar();
      console.log('✓ Created DiscordStatusBar instance');
    } catch (e) {
      console.error('❌ Failed to create DiscordStatusBar:', e);
      throw e;
    }

    let decorationProvider: DiscordDecorationProvider;
    try {
      decorationProvider = new DiscordDecorationProvider();
      console.log('✓ Created DiscordDecorationProvider instance');
    } catch (e) {
      console.error('❌ Failed to create DiscordDecorationProvider:', e);
      throw e;
    }

    let quickAccessCommands: QuickAccessCommands;
    try {
      quickAccessCommands = new QuickAccessCommands();
      console.log('✓ Created QuickAccessCommands instance');
    } catch (e) {
      console.error('❌ Failed to create QuickAccessCommands:', e);
      throw e;
    }

    let chatViewProviderText: ChatViewProviderText;
    try {
      chatViewProviderText = new ChatViewProviderText();
      console.log('✓ Created ChatViewProvider instance');
    } catch (e) {
      console.error('❌ Failed to create ChatViewProvider:', e);
      throw e;
    }
    
    commandHandler = new CommandHandler(context, authManager, chatWebviewProvider);

    // Register tree view
    vscode.window.registerTreeDataProvider('discord-vscode.serverTree', serverTreeProvider);
    console.log('✓ Registered ServerTree provider');

    // Register file decoration provider
    context.subscriptions.push(
      vscode.window.registerFileDecorationProvider(decorationProvider)
    );
    console.log('✓ Registered FileDecoration provider');

    // Register webview views
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        ChatWebviewProvider.viewType,
        chatWebviewProvider,
        { webviewOptions: { retainContextWhenHidden: true } }
      )
    );
    console.log('✓ Registered ChatWebview provider with ID:', ChatWebviewProvider.viewType);

    // Register chat view provider (for DM chat in editor)
    ChatViewProviderText.register(context, chatViewProviderText);
    console.log('✓ Registered ChatViewProvider for editor');

    // Register tree view providers
    vscode.window.registerTreeDataProvider('discord-vscode.voiceChannelsView', voiceChannelsTreeProvider);
    console.log('✓ Registered VoiceChannels tree provider');

    // DirectMessages and Friends removed - consolidated into ServerTreeProvider for single friend list
    
    vscode.window.registerTreeDataProvider('discord-vscode.lobbiesView', lobbiesTreeProvider);
    console.log('✓ Registered Lobbies tree provider');
    
    vscode.window.registerTreeDataProvider('discord-vscode.lobbyChatView', lobbyChatTreeProvider);
    console.log('✓ Registered LobbyChat tree provider');

    vscode.window.registerTreeDataProvider('discord-vscode.directMessagesView', directMessagesTreeProvider);
    console.log('✓ Registered DirectMessages tree provider');

    // Register Rich Presence tree provider
    richPresenceTreeProvider = new RichPresenceTreeProvider();
    vscode.window.registerTreeDataProvider('discord-vscode.richPresenceView', richPresenceTreeProvider);
    console.log('✓ Registered Rich Presence tree provider');

    // Register command handlers
    commandHandler.registerCommands();

    // Add Rich Presence toggle command
    context.subscriptions.push(
      vscode.commands.registerCommand('discord-vscode.toggleRichPresence', async (settingId: string, newValue: boolean) => {
        try {
          const config = vscode.workspace.getConfiguration('discord.richPresence');
          await config.update(settingId, newValue, vscode.ConfigurationTarget.Global);
          
          // Refresh the tree view
          richPresenceTreeProvider.refresh();
          
          // Show toast notification
          const onOff = newValue ? '✅ ON' : '⭕ OFF';
          vscode.window.showInformationMessage(`Rich Presence: ${settingId} set to ${onOff}`, { modal: false });
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to toggle setting: ${(error as Error).message}`);
        }
      })
    );

    // Add force reconnect command for token issues
    context.subscriptions.push(
      vscode.commands.registerCommand('discord-vscode.forceReconnect', async () => {
        try {
          await authManager.logout();
          vscode.window.showInformationMessage('Logged out. Please run Discord: Authenticate to reconnect.');
        } catch (error) {
          vscode.window.showErrorMessage('Failed to reconnect: ' + (error as Error).message);
        }
      })
    );

    // Add manual token input command
    context.subscriptions.push(
      vscode.commands.registerCommand('discord-vscode.setTokenManually', async () => {
        const token = await vscode.window.showInputBox({
          prompt: 'Paste Discord OAuth token',
          password: true,
          placeHolder: 'Get token from: https://discord.com/oauth2/authorize?client_id=1446821879095758960&response_type=token&redirect_uri=http://127.0.0.1/callback&scope=openid+sdk.social_layer+identify+email+guilds+connections+rpc'
        });
        if (token && token.length > 20) {
          await authManager.authenticateWithToken(token);
          vscode.window.showInformationMessage('Token saved! Reload window to connect.');
        }
      })
    );

    // Add debug token command
    context.subscriptions.push(
      vscode.commands.registerCommand('discord-vscode.debugToken', async () => {
        try {
          const tokenObj = await authManager.getStoredToken();
          if (!tokenObj) {
            vscode.window.showWarningMessage('No token stored. Please authenticate first.');
            return;
          }
          // Show first 20 chars of token for debugging
          const tokenPreview = tokenObj.accessToken.substring(0, 20) + '...';
          vscode.window.showInformationMessage(`Token exists: ${tokenPreview} (length: ${tokenObj.accessToken.length}, type: ${tokenObj.tokenType})`);
          console.log('Token length:', tokenObj.accessToken.length);
          console.log('Token type:', tokenObj.tokenType);
          console.log('Token starts with:', tokenObj.accessToken.substring(0, 10));
        } catch (error) {
          vscode.window.showErrorMessage('Debug failed: ' + (error as Error).message);
        }
      })
    );

    // Test connection command (for debugging)
    context.subscriptions.push(
      vscode.commands.registerCommand('discord-vscode.testConnection', async () => {
        const tester = new ConnectionTester();
        const result = await tester.runFullTest();
        
        if (result.success) {
          vscode.window.showInformationMessage('✅ All connection tests passed!');
        } else {
          vscode.window.showErrorMessage('❌ Some connection tests failed. Check Output panel for details.');
        }
        
        diagnostics.show();
      })
    );

    // Reset Setup Wizard command
    context.subscriptions.push(
      vscode.commands.registerCommand('discord-vscode.resetSetupWizard', async () => {
        try {
          // Clear the token to reset configuration
          await context.secrets.delete('discord-token');
          await context.secrets.delete('discord-sdk-path');
          const setupWizard = new SetupWizard(context);
          await setupWizard.show();
          vscode.window.showInformationMessage('Setup Wizard has been reset.');
        } catch (error) {
          vscode.window.showErrorMessage('Failed to reset wizard: ' + (error as Error).message);
        }
      })
    );

    // Show Quick Access Panel command
    context.subscriptions.push(
      vscode.commands.registerCommand('discord-vscode.showQuickAccess', async () => {
        try {
          const quickAccess = new QuickAccessPanel(context);
          await quickAccess.show();
        } catch (error) {
          vscode.window.showErrorMessage('Failed to open Quick Access: ' + (error as Error).message);
        }
      })
    );

    // Refresh lobbies view command
    context.subscriptions.push(
      vscode.commands.registerCommand('discord-vscode.refreshLobbies', () => {
        console.log('🔄 Refreshing lobbies tree view...');
        if (lobbiesTreeProvider) {
          lobbiesTreeProvider.refresh();
        }
      })
    );

    // Create lobby command
    context.subscriptions.push(
      vscode.commands.registerCommand('discord-vscode.createLobby', createLobbyCommand)
    );

    // List lobbies command
    context.subscriptions.push(
      vscode.commands.registerCommand('discord-vscode.listLobbies', listLobbiesCommand)
    );

    // Join lobby command
    context.subscriptions.push(
      vscode.commands.registerCommand('discord-vscode.joinLobby', joinLobbyCommand)
    );

    // Send lobby message command
    context.subscriptions.push(
      vscode.commands.registerCommand('discord-vscode.sendLobbyMessage', sendLobbyMessageCommand)
    );

    // Select lobby for chat display
    context.subscriptions.push(
      vscode.commands.registerCommand('discord-vscode.selectLobbyChat', (item: any) => {
        // Extract lobbyId from TreeItem
        const lobbyId = item?.lobbyId || item;
        if (lobbyId && lobbyChatTreeProvider) {
          console.log(`[Extension] Selecting lobby for chat: ${lobbyId}`);
          lobbyChatTreeProvider.setCurrentLobby(lobbyId);
          // Store current lobby for reference
          getContext()?.workspaceState.update('currentLobby', { id: lobbyId });
        }
      })
    );

    // Leave lobby command
    context.subscriptions.push(
      vscode.commands.registerCommand('discord-vscode.leaveLobby', (item: any) => {
        // Extract lobbyId from TreeItem if passed from context menu
        const lobbyId = item?.lobbyId || item;
        if (lobbyId) {
          leaveLobbyCommand(lobbyId);
        }
      })
    );

    // Share code to lobby command
    context.subscriptions.push(
      vscode.commands.registerCommand('discord-vscode.sendCodeToLobby', (item: any) => {
        // Extract lobbyId from TreeItem if passed from context menu
        const lobbyId = item?.lobbyId || item;
        if (lobbyId) {
          sendCodeToLobbyCommand(lobbyId);
        }
      })
    );

    // Toggle microphone command
    context.subscriptions.push(
      vscode.commands.registerCommand('discord-vscode.toggleMuteLobby', () => {
        toggleMuteLobbyCommand();
      })
    );

    // Toggle audio command
    context.subscriptions.push(
      vscode.commands.registerCommand('discord-vscode.toggleDeafLobby', () => {
        toggleDeafLobbyCommand();
      })
    );

    // Connect to lobby voice command
    context.subscriptions.push(
      vscode.commands.registerCommand('discord-vscode.connectLobbyVoice', () => {
        connectLobbyVoiceCommand();
      })
    );

    // Disconnect from lobby voice command
    context.subscriptions.push(
      vscode.commands.registerCommand('discord-vscode.disconnectLobbyVoice', () => {
        disconnectLobbyVoiceCommand();
      })
    );

    // Friend context menu commands
    context.subscriptions.push(
      vscode.commands.registerCommand('discord-vscode.inviteToLobby', (item: any, lobbyId?: string, userName?: string) => {
        // Extract from tree item if it's a friend item
        if (item && item.type === 'friend') {
          const friendId = item.id;
          const friendName = item.label.replace('👤 ', '');
          inviteToLobbyCommand(friendId, friendName);
        } else if (lobbyId && userName) {
          // Called directly with parameters
          inviteToLobbyCommand(lobbyId, userName);
        }
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('discord-vscode.sendDMToFriend', (item: any) => {
        // Extract from tree item
        const friendId = item.id;
        const friendName = item.label.replace('👤 ', '');
        console.log('[sendDMToFriend command] Friend ID:', friendId, 'Name:', friendName);
        sendDMToFriendCommand(friendId, friendName);
      })
    );

    // Quick Message Command
    context.subscriptions.push(
      vscode.commands.registerCommand('discord-vscode.quickMessage', () => {
        quickAccessCommands.quickMessage();
      })
    );

    // Open Chat Command
    context.subscriptions.push(
      vscode.commands.registerCommand('discord-vscode.openChat', (item: any, friendId?: string, friendName?: string) => {
        // If called from tree item, item is the DiscordTreeItem and friendId/friendName are in args
        if (item && item.type === 'friend' && friendId && friendName) {
          // Called from tree item with arguments
          console.log('[openChat] Opening chat with:', friendId, friendName);
          chatViewProviderText.openChat(friendId, friendName);
        } else if (item && typeof item === 'string' && friendId) {
          // Called directly with friendId as first param
          console.log('[openChat] Opening chat with:', item, friendId);
          chatViewProviderText.openChat(item, friendId);
        }
      })
    );

    // Share code snippet to Discord
    context.subscriptions.push(
      vscode.commands.registerCommand('discord-vscode.shareSnippet', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage('No active editor');
          return;
        }

        const selection = editor.selection;
        const text = editor.document.getText(selection);
        if (!text) {
          vscode.window.showWarningMessage('No text selected');
          return;
        }

        const language = editor.document.languageId;
        const snippet = `\`\`\`${language}\n${text}\n\`\`\``;

        // Store snippet for webview to pick up
        context.workspaceState.update('pendingSnippet', snippet);
        
        // Show chat panel
        await vscode.commands.executeCommand('discord-vscode.chat.focus');
        vscode.window.showInformationMessage('Snippet ready to share - select channel');
      })
    );

    // Internal: Handle incoming messages from message poller
    context.subscriptions.push(
      vscode.commands.registerCommand('discord-vscode._onMessageCreated', async (messageId: string, timestamp: number) => {
        console.log(`[Extension] Message event: id=${messageId} ts=${timestamp}`);
        
        try {
          // Fetch full message content from SDK
          const client = getDiscordClient();
          if (!client) {
            console.warn('[Extension] Discord client not initialized');
            vscode.window.showWarningMessage('Discord connection not ready');
            return;
          }

          const sdkAdapter = client.getSdkAdapter();
          if (!sdkAdapter) {
            console.warn('[Extension] SDK adapter not available');
            return;
          }

          const context = getContext();
          const currentLobby = context?.workspaceState.get('currentLobby') as any;
          
          let messages: any[] = [];
          let messageSource = 'unknown';
          
          // First, get the message details by ID to know its context
          console.log(`[Extension] Fetching message details for ID: ${messageId}`);
          const msgDetails = await sdkAdapter.getMessage(messageId.toString());
          
          if (msgDetails) {
            console.log(`[Extension] Message from author ${msgDetails.author_id}, channel ${msgDetails.channel_id}, content: ${msgDetails.content.substring(0, 50)}`);
            
            // Check if message belongs to current lobby by matching channel_id
            if (currentLobby && currentLobby.id) {
              console.log(`[Extension] Current lobby ID: ${currentLobby.id}, Message channel_id: ${msgDetails.channel_id}`);
              
              // Get more messages to ensure we capture the one we're looking for
              const lobbyMessages = await sdkAdapter.getLobbyMessages(currentLobby.id, 50);
              if (lobbyMessages && lobbyMessages.length > 0) {
                // Check if this message belongs to this lobby
                const msgInLobby = lobbyMessages.find((m: any) => m.id.toString() === messageId.toString());
                if (msgInLobby) {
                  messages = lobbyMessages;
                  messageSource = 'lobby';
                  console.log(`[Extension] Message found in lobby (${lobbyMessages.length} total messages)`);
                } else {
                  console.log(`[Extension] Message not found in lobby messages list`);
                }
              }
            }
            
            // If not found in lobby, try DMs with the actual author_id
            if (!messages || messages.length === 0) {
              console.log(`[Extension] Not found in lobby, trying DMs with author: ${msgDetails.author_id}...`);
              const dmMessages = await sdkAdapter.getUserMessages(msgDetails.author_id, 50);
              if (dmMessages && dmMessages.length > 0) {
                messages = dmMessages;
                messageSource = 'dm';
                console.log(`[Extension] Message found in DMs (${dmMessages.length} total messages)`);
              }
            }
          } else {
            console.warn('[Extension] Could not fetch message details');
          }
          
          if (messages && messages.length > 0) {
            // Find the specific message by ID
            const msg = messages.find((m: any) => m.id.toString() === messageId.toString());
            
            if (!msg) {
              console.warn(`[Extension] Message ID ${messageId} not found in retrieved messages (${messages.length} total)`);
              // Show notification anyway
              vscode.window.showInformationMessage(
                '💬 New message received!',
                'View'
              ).then(selection => {
                if (selection === 'View') {
                  vscode.window.showInformationMessage(`Message ID: ${messageId}`);
                }
              });
              return;
            }
            
            const authorId = msg.author_id || 'Unknown';
            const content = msg.content || '(no content)';
            const msgId = msg.id || messageId;
            
            // Resolve author username
            let authorName = authorId;
            try {
              authorName = await sdkAdapter.resolveUsername(authorId);
            } catch (err) {
              console.warn('[Extension] Failed to resolve username, using ID:', err);
            }
            
            console.log(`[Extension] 💬 Received ${messageSource} message from ${authorName} (${authorId}): ${content.substring(0, 100)}`);
            
            // Check if this is a code share message using helper function
            const isCodeShare = handleCodeShareInMessage(content, authorId, currentLobby?.id);
            
            if (isCodeShare) {
              // Code share was handled by the helper function
              // Continue to also add it as a regular message to the chat
            } else {
              // Regular message - emit message event
              client.emit('message', {
                id: msgId,
                author_id: authorId,
                content: content,
                timestamp: timestamp
              });
              
              // Add message to correct panel based on source
              if (messageSource === 'lobby' && currentLobby && currentLobby.id && lobbyChatTreeProvider) {
                lobbyChatTreeProvider.setCurrentLobby(currentLobby.id);
                lobbyChatTreeProvider.addMessage(
                  authorName,
                  authorId,
                  content,
                  false, // isOwn
                  msgId.toString() // messageId for deduplication
                );
              } else if (messageSource === 'dm') {
                // For DMs, just show notification (DM panel not yet implemented)
                // In the future, route to DM panel here
                console.log(`[Extension] DM from ${authorName} - DM panel not yet implemented`);
              }
              
              // Show notification with actual message content and username
              vscode.window.showInformationMessage(
                `💬 Message from ${authorName}: ${content.substring(0, 80)}${content.length > 80 ? '...' : ''}`,
                'View', 'Reply'
              ).then(selection => {
                if (selection === 'View') {
                  // Show full message details
                  vscode.window.showInformationMessage(
                    `📨 From: ${authorName}\n\n${content}`,
                    'OK'
                  );
                } else if (selection === 'Reply') {
                  // Open reply dialog
                  vscode.window.showInputBox({
                    placeHolder: 'Type your reply...',
                    title: `Reply to ${authorName}`
                  }).then(reply => {
                    if (reply) {
                      // Send reply via sendDMToFriend
                      vscode.commands.executeCommand('discord-vscode.sendDMToFriend', authorId, reply);
                    }
                  });
                }
              });
            }
          } else {
            // Fallback: show just the notification
            vscode.window.showInformationMessage(
              '💬 New message received!',
              'View'
            ).then(selection => {
              if (selection === 'View') {
                vscode.window.showInformationMessage(`Message ID: ${messageId}`);
              }
            });
          }
        } catch (error) {
          console.error('[Extension] Failed to handle message:', error);
          vscode.window.showErrorMessage('Failed to retrieve message details');
        }
      })
    );

    // Command: Open shared code in editor
    context.subscriptions.push(
      vscode.commands.registerCommand('discord-vscode.openSharedCode', async (codeData: any) => {
        try {
          const { from, code, language } = codeData;
          
          console.log(`[Extension] Opening shared code from ${from} (${language})`);
          
          // Create untitled document with the shared code
          const doc = await vscode.workspace.openTextDocument({
            language: language,
            content: code
          });
          
          // Show document in editor with preview
          const editor = await vscode.window.showTextDocument(doc, {
            viewColumn: vscode.ViewColumn.Beside,
            preview: true
          });
          
          // Set title to indicate it's shared code
          doc.fileName;
          console.log(`[Extension] ✅ Opened shared code from ${from} in editor`);
          
          // Show status message
          vscode.window.showInformationMessage(
            `📝 Code from ${from} opened in editor`,
            'Copy', 'Save As'
          ).then(selection => {
            if (selection === 'Copy') {
              vscode.env.clipboard.writeText(code);
              vscode.window.showInformationMessage('✅ Code copied to clipboard');
            } else if (selection === 'Save As') {
              vscode.commands.executeCommand('workbench.action.files.saveAs');
            }
          });
        } catch (error) {
          console.error('[Extension] Failed to open shared code:', error);
          vscode.window.showErrorMessage('Failed to open shared code');
        }
      })
    );

    // Check if user triggered authentication
    const triggerAuthStr = await context.secrets.get('discord-trigger-auth');
    const triggerAuth = triggerAuthStr === 'true';
    if (triggerAuth) {
      // Clear the flag
      await context.secrets.delete('discord-trigger-auth');
      console.log('🔐 Auth triggered - starting SDK authorization...');
    }

    // Check if wizard was interrupted by auth and needs to be reopened
    // Note: wizardStateStr already declared above, reuse it
    const wizardStateReload = wizardStateStr ? JSON.parse(wizardStateStr) : null;
    console.log(`🟡 RELOAD DETECTED - wizardState: ${wizardStateReload ? JSON.stringify(wizardStateReload) : 'NOT FOUND'}`);
    const shouldReopenWizard = wizardStateReload?.pendingAuth === true;
    console.log(`🟡 shouldReopenWizard = ${shouldReopenWizard}`);
    
    // Check if user is already authenticated
    const isAuthenticated = await authManager.isAuthenticated();
    console.log(`📊 Auth status: isAuthenticated=${isAuthenticated}, triggerAuth=${triggerAuth}`);
    
    // SMART CONNECT: Auto-connect if authenticated (either by token or explicit auth)
    // Only show "please authenticate" if user has never authenticated before
    if (triggerAuth || isAuthenticated) {
      if (triggerAuth) {
        console.log('✓ Connecting to Discord (auth was just triggered)...');
      } else {
        console.log('✓ Connecting to Discord (using stored authentication)...');
      }
      
      // Get Discord App ID (guaranteed to exist from getDiscordConfig)
      const appId = process.env.DISCORD_APP_ID;
      
      if (!appId) {
        throw new Error('Discord Application ID not configured');
      }
      
      // Read SDK path from secrets (where wizard saves it) and pass to Discord Client
      const savedSdkPath = await context.secrets.get('discord-sdk-path');
      if (savedSdkPath) {
        console.log(`📍 SDK path loaded from secrets: ${savedSdkPath}`);
      } else {
        console.log(`📍 No SDK path found in secrets`);
      }
      
      // Initialize Discord Client and set token before connecting
      discordClient = new DiscordClient(appId, savedSdkPath);
      const tokenObj = await authManager.getStoredToken();
      
      if (tokenObj?.accessToken) {
        const tokenToUse = `type=${tokenObj.tokenType}:${tokenObj.accessToken}`;
        discordClient.setToken(tokenToUse);
        console.log(`🔌 Connecting with: stored token`);
      } else {
        discordClient.setToken(`SDK_AUTH_REQUIRED`);
        console.log(`🔌 Connecting with: SDK authorization flow`);
      }
      
      // CRITICAL: Register token-received handler BEFORE connecting
      // This ensures it catches tokens from the auth flow
      sdkAdapterInstance.on('token-received', async (tokenData: any) => {
        try {
          console.log('💾 Storing OAuth token for persistence...');
          
          // Handle both old format (string) and new format (object)
          if (typeof tokenData === 'string') {
            // Old format - just a token string, store with 90-day expiry
            console.log('   Token length:', tokenData.length);
            console.log('   Token preview:', tokenData.substring(0, 20) + '...');
            const stored = await authManager.authenticateWithToken(tokenData);
            if (stored) {
              console.log('✅ Token stored successfully');
            }
          } else if (typeof tokenData === 'object' && tokenData.access_token) {
            // New format - full OAuth token response with refresh token
            console.log('   Access token length:', tokenData.access_token.length);
            console.log('   Has refresh token:', !!tokenData.refresh_token);
            console.log('   Expires in:', tokenData.expires_in, 'seconds');
            
            // Use the storeToken method which handles the full OAuth response
            const storedToken: any = {
              accessToken: tokenData.access_token,
              refreshToken: tokenData.refresh_token || '',
              tokenType: tokenData.token_type || 'Bearer',
              expiresAt: Date.now() + (tokenData.expires_in * 1000)
            };
            
            await (authManager as any).context.secrets.store('discord-token', JSON.stringify(storedToken));
            console.log('✅ OAuth token stored successfully');
            
            // Verify it was stored
            const retrieved = await authManager.getStoredToken();
            console.log('🔍 Verification: token retrieved =', retrieved ? 'YES' : 'NO');
          }
        } catch (err) {
          console.error('❌ Failed to store token:', err);
        }
      });
      
      try {
        // Connect to Discord
        await discordClient.connect();
        console.log('✅ SDK connected');
        
        // CRITICAL: Set Discord client on all tree providers BEFORE refreshing
        console.log('🔗 Setting Discord client on tree providers...');
        serverTreeProvider.setDiscordClient(discordClient);
        lobbyChatTreeProvider.setDiscordClient(discordClient);
        directMessagesTreeProvider.setDiscordClient(discordClient);
        serverTreeProvider.setChatViewProvider(chatViewProviderText);
        
        // Stagger other providers to prevent simultaneous SDK calls
        if (discordClient) {
          setTimeout(() => voiceChannelsTreeProvider.setDiscordClient(discordClient!), 100);
          setTimeout(() => lobbiesTreeProvider.setDiscordClient(discordClient!), 200);
          setTimeout(() => statusBar.setDiscordClient(discordClient!), 300);
          setTimeout(() => decorationProvider.setDiscordClient(discordClient!), 400);
          setTimeout(() => quickAccessCommands.setDiscordClient(discordClient!), 500);
          setTimeout(() => chatViewProviderText.setDiscordClient(discordClient!), 600);
        }
        console.log('✅ Discord client set on all providers');
        
        // CRITICAL: Refresh tree providers after successful connection to populate UI
        console.log('🔄 Refreshing tree providers to display Discord data...');
        try {
          serverTreeProvider?.refresh();
          lobbiesTreeProvider?.refresh();
          lobbyChatTreeProvider?.refresh();
          directMessagesTreeProvider?.refresh();
          richPresenceTreeProvider?.refresh();
          console.log('✅ Tree providers refreshed');
        } catch (refreshErr) {
          console.warn('⚠️ Error refreshing tree providers:', refreshErr);
        }
        
        // After successful connection, if wizard was waiting for auth, reopen it
        if (shouldReopenWizard) {
          console.log(`🟡 shouldReopenWizard=true, scheduling wizard reopen in 1 second...`);
          setTimeout(async () => {
            console.log(`🟡 WIZARD REOPEN TIMEOUT FIRED - creating and showing wizard`);
            const wizard = new SetupWizard(context);
            console.log(`🟡 Wizard instance created, calling show()`);
            await wizard.show();
            console.log(`🟡 Wizard show() returned`);
          }, 1000);
        } else {
          console.log(`🟡 shouldReopenWizard=false, NOT reopening wizard`);
        }
      } catch (error) {
        // Handle connection errors
        const prevToken = await context.secrets.get(`discord-prev-token`);
        const currentToken = tokenObj?.accessToken || `no-token`;
        if (prevToken && prevToken !== currentToken && tokenObj) {
          console.log('🔄 Discord account switch detected - resetting SDK state...');
          DiscordSDKAdapter.resetInstance();
          sdkAdapterInstance = DiscordSDKAdapter.getInstance();
        }
        
        // Store current token for next time
        if (tokenObj) {
          await context.secrets.store('discord-prev-token', currentToken);
        }

        // Initialize RPC Client for Rich Presence (requires valid token)
        if (tokenObj && tokenObj.accessToken) {
          try {
            console.log('🔌 Initializing Discord RPC client for Rich Presence...');
            rpcClient = new DiscordRPCClient(appId, tokenObj.accessToken);
            
            // Attempt to connect to Discord app
            rpcClient.connect().then(() => {
              console.log('✅ Discord RPC client connected - Rich Presence is ready');
            }).catch((error: Error) => {
              console.warn('⚠️  RPC connection failed (Discord app may not be running):', error.message);
              // This is not critical - will try to connect when Discord app starts
            });
          } catch (error) {
            console.error('❌ Failed to initialize RPC client:', error);
          }
        } else {
          console.log('⚠️  No token available - RPC client will not be initialized');
        }
        
        // Listen for OAuth token data and store it properly
        // Handler already registered above before connecting
        
        if (discordClient) {
          discordClient.onReady(async (data: any) => {
            console.log('✅ Discord Client READY!');
            const guilds = discordClient!.getGuilds();
            console.log(`📊 Discord Client loaded ${guilds.length} guilds`);
            
            // Start real-time message event poller
            startMessagePoller();
            console.log('🔔 Real-time message listener started');
            
            // Initialize relay API
            try {
              const health = await healthCheck();
              console.log(`🔗 Relay API online: ${health.status}`);
              const extensionId = context.extension.id;
              await registerExtension(extensionId);
              console.log(`✓ Extension registered with relay API (${extensionId})`);
            } catch (relayError) {
              console.warn('⚠️  Relay API unavailable (non-critical):', relayError);
            }
          });
          
          discordClient.onMessage((message: any) => {
            const authorName = message.author?.username || message.author_username || message.author_id || 'Unknown';
            console.log(`💬 New message: ${authorName}`);
          });
          
          // Listen for code sharing events
          if (sharedCodeProvider) {
            discordClient.on('code-share', (codeShare: any) => {
              console.log(`📝 Code share from ${codeShare.from}: ${codeShare.language}`);
              sharedCodeProvider.addSnippet(codeShare.from, codeShare.code, codeShare.language);
            });
          }
          
          discordClient.onError((error: Error) => {
            console.error('❌ Discord Client error:', error);
            stopMessagePoller();
          });
          
          try {
            // Connect with timeout - don't wait forever
            const connectPromise = discordClient.connect();
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Connection timeout')), 30000)
            );
            await Promise.race([connectPromise, timeoutPromise]);
            console.log('✓ Extension activated - Discord SDK connected');
          } catch (connectError) {
            console.warn('⚠️  Discord SDK connection failed:', connectError);
            console.warn('    You can still use basic features with the stored OAuth token.');
            console.warn('    For full features, please launch Discord desktop app and reconnect.');
          }
        } else {
          console.log('⚠️ User not authenticated. Run "Discord: Authenticate" command to start using Discord features.');
          vscode.window.showWarningMessage(
            'Discord not authenticated',
            'Authenticate'
          ).then(selection => {
            if (selection === 'Authenticate') {
              vscode.commands.executeCommand('discord-vscode.authenticate');
            }
          });
        }
      } // Closes the try-catch block
    } else {
      console.log('⚠️ User not authenticated. Run "Discord: Authenticate" command to start using Discord features.');
      vscode.window.showWarningMessage(
        'Discord not authenticated',
        'Authenticate'
      ).then(selection => {
        if (selection === 'Authenticate') {
          vscode.commands.executeCommand('discord-vscode.authenticate');
        }
      });
    }
  } catch (error) {
    console.error('Failed to activate Discord VS Code extension:', error);
  }
}

export function getDiscordClient(): DiscordClient | null {
	return discordClient;
}

export function getAuthManager() {
	return authManager;
}

let extensionContext: vscode.ExtensionContext | null = null;

export function getContext(): vscode.ExtensionContext | null {
	return extensionContext;
}

export function getDiscordRPCClient(): DiscordRPCClient | null {
	return rpcClient;
}

export function getLobbyChatTreeProvider(): LobbyChatTreeProvider | null {
	return lobbyChatTreeProvider;
}

export function getSharedCodeProvider(): SharedCodeProvider | null {
	return sharedCodeProvider;
}

export function handleCodeShare(content: string, authorId: string, lobbyId?: string): boolean {
	return handleCodeShareInMessage(content, authorId, lobbyId);
}

export function deactivate() {
	console.log('🎮 Discord VS Code extension is now deactivated');
	if (discordClient) {
		discordClient.disconnect();
	}
	// Disconnect SDK adapter (don't await - fire and forget)
	sdkAdapterInstance.disconnect().catch(() => {});
	// Dispose of Rich Presence Manager
	if (richPresenceManager) {
		richPresenceManager.dispose();
	}
}

/**
 * Get the Rich Presence Manager instance for use in commands
 */
export function getRichPresenceManager(): RichPresenceManager | null {
	return richPresenceManager;
}