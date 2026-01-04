import * as vscode from 'vscode';
import { DiscordClient } from '../gateway/discordClient';
import { getContext } from '../extension';
import { getCachedLobbyChatMessages } from '../services/lobbyMessagePoller';

interface LobbyMessage {
  id: string;
  author: string;
  authorId: string;
  content: string;
  timestamp: Date;
  isOwn: boolean;
}

/**
 * Tree item for displaying lobby messages
 */
class LobbyMessageItem extends vscode.TreeItem {
  constructor(
    public readonly message: LobbyMessage,
    public readonly type: 'message' | 'no-messages' | 'loading'
  ) {
    super(
      type === 'message' 
        ? `${message.isOwn ? '✍️' : '💬'} ${message.author}: ${message.content.substring(0, 60)}${message.content.length > 60 ? '...' : ''}`
        : type === 'loading'
        ? 'Loading messages...'
        : 'No messages yet',
      vscode.TreeItemCollapsibleState.None
    );

    if (type === 'message') {
      this.tooltip = `${message.author} at ${message.timestamp.toLocaleTimeString()}\n${message.content}`;
      this.description = message.timestamp.toLocaleTimeString();
      this.iconPath = new vscode.ThemeIcon(message.isOwn ? 'edit' : 'comment');
    } else if (type === 'loading') {
      this.iconPath = new vscode.ThemeIcon('loading~spin');
    } else {
      this.iconPath = new vscode.ThemeIcon('info');
    }
  }
}

/**
 * Provides a tree view of lobby chat messages
 * Shows messages sent and received in the current lobby
 */
export class LobbyChatTreeProvider implements vscode.TreeDataProvider<LobbyMessageItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<LobbyMessageItem | undefined | null | void> = 
    new vscode.EventEmitter<LobbyMessageItem | undefined | null | void>();
  
  readonly onDidChangeTreeData: vscode.Event<LobbyMessageItem | undefined | null | void> = 
    this._onDidChangeTreeData.event;

  private discordClient: DiscordClient | null = null;
  private messages: Map<string, LobbyMessage[]> = new Map(); // lobbyId -> messages
  private currentLobbyId: string | null = null;
  private currentUser: any = null;
  private loadingMessages = new Map<string, boolean>();

  public setDiscordClient(client: DiscordClient): void {
    this.discordClient = client;
    this.currentUser = client.getCurrentUser();
    
    // Listen for message events
    client.onMessage((message: any) => {
      this.handleMessageEvent(message);
    });
  }

  /**
   * Set the current lobby being viewed
   */
  public setCurrentLobby(lobbyId: string): void {
    if (this.currentLobbyId !== lobbyId) {
      console.log(`[LobbyChatTreeProvider] Setting current lobby: ${lobbyId}`);
      this.currentLobbyId = lobbyId;
      
      // Initialize messages array for this lobby if not present
      if (!this.messages.has(lobbyId)) {
        this.messages.set(lobbyId, []);
        // Load cached messages first, then fetch from SDK
        this.loadCachedMessagesFirst(lobbyId);
      } else {
        console.log(`[LobbyChatTreeProvider] Lobby ${lobbyId} already has ${this.messages.get(lobbyId)?.length || 0} messages, not reloading`);
      }
      
      this.refresh();
    }
  }

  /**
   * Load cached messages first for immediate display, then fetch from SDK
   */
  private async loadCachedMessagesFirst(lobbyId: string): Promise<void> {
    try {
      // First, load cached messages for instant display
      const cached = await getCachedLobbyChatMessages(lobbyId);
      if (cached && cached.length > 0) {
        const cachedMessages: LobbyMessage[] = cached.map((msg: any) => ({
          id: msg.id || `msg-${Date.now()}`,
          author: msg.author_name || msg.author_id || 'Unknown',
          authorId: msg.author_id || 'unknown',
          content: msg.content || '',
          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
          isOwn: msg.author_id === this.currentUser?.id || msg.author_id === 'self'
        }));

        // Sort by timestamp ascending (oldest first)
        cachedMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        
        this.messages.set(lobbyId, cachedMessages);
        console.log(`[LobbyChatTreeProvider] Loaded ${cachedMessages.length} cached messages for lobby ${lobbyId}`);
        this.refresh();
      }
    } catch (error) {
      console.warn('[LobbyChatTreeProvider] Failed to load cached messages:', error);
    }

    // Then load from SDK in the background
    this.loadMessages(lobbyId);
  }

  /**
   * Load messages for a lobby
   */
  private async loadMessages(lobbyId: string): Promise<void> {
    if (!this.discordClient || this.loadingMessages.get(lobbyId)) {
      return;
    }

    this.loadingMessages.set(lobbyId, true);
    this.refresh();

    try {
      // Get the SDK adapter from the Discord client
      const sdkAdapter = this.discordClient.getSdkAdapter?.();
      if (!sdkAdapter) {
        console.warn('[LobbyChatTreeProvider] SDK adapter not available');
        return;
      }

      // Fetch messages from the SDK
      const response = await sdkAdapter.getLobbyMessages(lobbyId, 50);
      
      if (response && Array.isArray(response)) {
        const loadedMessages: LobbyMessage[] = response.map((msg: any) => ({
          id: msg.id || `msg-${Date.now()}`,
          author: msg.author_username || msg.author_id || 'Unknown',
          authorId: msg.author_id || 'unknown',
          content: msg.content || '',
          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
          isOwn: msg.author_id === this.currentUser?.id
        }));

        // Sort by timestamp ascending (oldest first)
        loadedMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        
        // MERGE with locally added messages instead of replacing
        // Keep any messages we already added locally
        const existingMessages = this.messages.get(lobbyId) || [];
        const mergedMessages = [...loadedMessages];
        
        // Add any locally-added messages that aren't in the fetched list
        for (const local of existingMessages) {
          const exists = mergedMessages.some(m => m.id === local.id);
          if (!exists) {
            mergedMessages.push(local);
          }
        }
        
        // Re-sort after merge
        mergedMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        
        this.messages.set(lobbyId, mergedMessages);
        console.log(`[LobbyChatTreeProvider] Loaded ${loadedMessages.length} messages + ${existingMessages.length - loadedMessages.length} local for lobby ${lobbyId}`);
      }
    } catch (error) {
      console.error('[LobbyChatTreeProvider] Failed to load messages:', error);
    } finally {
      this.loadingMessages.set(lobbyId, false);
      this.refresh();
    }
  }

  /**
   * Handle incoming message event
   */
  private handleMessageEvent(message: any): void {
    if (!this.currentLobbyId) {
      return;
    }

    try {
      const lobbyMessages = this.messages.get(this.currentLobbyId) || [];
      
      const newMessage: LobbyMessage = {
        id: message.id || `msg-${Date.now()}`,
        author: message.author_username || message.author?.username || message.author_id || 'Unknown',
        authorId: message.author_id || message.author?.id || 'unknown',
        content: message.content || '',
        timestamp: new Date(),
        isOwn: message.author_id === this.currentUser?.id
      };

      lobbyMessages.push(newMessage);
      this.messages.set(this.currentLobbyId, lobbyMessages);
      
      console.log(`[LobbyChatTreeProvider] New message in lobby ${this.currentLobbyId}: ${newMessage.content.substring(0, 50)}`);
      this.refresh();
    } catch (error) {
      console.error('[LobbyChatTreeProvider] Failed to handle message:', error);
    }
  }

  /**
   * Add a message to the current lobby
   * @param author Author name or username
   * @param authorId Author ID (used for deduplication)
   * @param content Message content
   * @param isOwn Whether this is the current user's message
   * @param messageId Optional message ID from SDK (for deduplication)
   */
  public addMessage(author: string, authorId: string, content: string, isOwn: boolean = false, messageId?: string): void {
    if (!this.currentLobbyId) {
      console.warn('[LobbyChatTreeProvider] No current lobby set, cannot add message');
      return;
    }

    // Ensure messages array exists for this lobby
    if (!this.messages.has(this.currentLobbyId)) {
      this.messages.set(this.currentLobbyId, []);
    }

    const lobbyMessages = this.messages.get(this.currentLobbyId)!;
    
    // Generate unique ID - use provided messageId or create local one
    const id = messageId || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Check if message already exists (deduplication)
    const existingMessage = lobbyMessages.find(m => 
      (m.id === id) || 
      (m.content === content && m.authorId === authorId && 
       Math.abs(m.timestamp.getTime() - Date.now()) < 1000) // Within 1 second
    );
    
    if (existingMessage) {
      console.log(`[LobbyChatTreeProvider] Message already exists, skipping (ID: ${id})`);
      return;
    }
    
    const message: LobbyMessage = {
      id,
      author,
      authorId,
      content,
      timestamp: new Date(),
      isOwn
    };

    lobbyMessages.push(message);
    
    console.log(`[LobbyChatTreeProvider] Added message to lobby ${this.currentLobbyId} (total: ${lobbyMessages.length}, ID: ${id})`);
    this.refresh();
  }

  /**
   * Clear messages for a lobby
   */
  public clearMessages(lobbyId?: string): void {
    if (lobbyId) {
      this.messages.delete(lobbyId);
    } else if (this.currentLobbyId) {
      this.messages.delete(this.currentLobbyId);
    }
    this.refresh();
  }

  public getTreeItem(element: LobbyMessageItem): vscode.TreeItem {
    return element;
  }

  public getChildren(element?: LobbyMessageItem): Thenable<LobbyMessageItem[]> {
    // If no current lobby, show message
    if (!this.currentLobbyId) {
      return Promise.resolve([
        new LobbyMessageItem(
          {
            id: 'no-lobby',
            author: 'System',
            authorId: 'system',
            content: 'Select a lobby to view messages',
            timestamp: new Date(),
            isOwn: false
          },
          'no-messages'
        )
      ]);
    }

    // Get messages for current lobby
    const messages = this.messages.get(this.currentLobbyId) || [];

    if (messages.length === 0 && !this.loadingMessages.get(this.currentLobbyId)) {
      return Promise.resolve([
        new LobbyMessageItem(
          {
            id: 'empty',
            author: 'System',
            authorId: 'system',
            content: 'No messages yet',
            timestamp: new Date(),
            isOwn: false
          },
          'no-messages'
        )
      ]);
    }

    if (this.loadingMessages.get(this.currentLobbyId)) {
      return Promise.resolve([
        new LobbyMessageItem(
          {
            id: 'loading',
            author: 'System',
            authorId: 'system',
            content: 'Loading messages...',
            timestamp: new Date(),
            isOwn: false
          },
          'loading'
        )
      ]);
    }

    return Promise.resolve(
      messages.map(msg => new LobbyMessageItem(msg, 'message'))
    );
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire(null);
  }
}
