import * as vscode from 'vscode';

export class RichPresenceItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly id: string,
    public readonly type: 'root' | 'toggle' | 'status' | 'idle-timeout',
    public readonly isEnabled: boolean,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly value?: string | number,
  ) {
    super(label, collapsibleState);
    this.contextValue = this.type;
    this.setIcon();
    this.setDescription();
    this.setCommand();
  }

  private setIcon(): void {
    switch (this.type) {
      case 'root':
        this.iconPath = this.isEnabled 
          ? new vscode.ThemeIcon('rocket', new vscode.ThemeColor('charts.green'))
          : new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('charts.red'));
        break;
      case 'toggle':
        this.iconPath = this.isEnabled
          ? new vscode.ThemeIcon('check-all', new vscode.ThemeColor('charts.green'))
          : new vscode.ThemeIcon('circle-outline');
        break;
      case 'status':
        this.iconPath = new vscode.ThemeIcon('info');
        break;
      case 'idle-timeout':
        this.iconPath = new vscode.ThemeIcon('clock');
        break;
    }
  }

  private setDescription(): void {
    switch (this.type) {
      case 'root':
        this.description = this.isEnabled ? '🟢 ENABLED' : '🔴 DISABLED';
        break;
      case 'toggle':
        this.description = this.isEnabled ? '✅ ON' : '⭕ OFF';
        break;
      case 'idle-timeout':
        const seconds = ((this.value as number) / 1000).toFixed(0);
        this.description = `${seconds}s`;
        break;
    }
  }

  private setCommand(): void {
    if (this.type === 'toggle') {
      this.command = {
        title: 'Toggle Rich Presence Setting',
        command: 'discord-vscode.toggleRichPresence',
        arguments: [this.id, !this.isEnabled],
      };
    } else if (this.type === 'root') {
      this.command = {
        title: 'Toggle Rich Presence Master',
        command: 'discord-vscode.toggleRichPresence',
        arguments: ['enabled', !this.isEnabled],
      };
    }
  }
}

export class RichPresenceTreeProvider implements vscode.TreeDataProvider<RichPresenceItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<RichPresenceItem | undefined | null | void> =
    new vscode.EventEmitter<RichPresenceItem | undefined | null | void>();

  readonly onDidChangeTreeData: vscode.Event<RichPresenceItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  constructor() {
    // Listen for configuration changes
    vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('discord.richPresence')) {
        this.refresh();
      }
    });
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire(null);
  }

  public getTreeItem(element: RichPresenceItem): vscode.TreeItem {
    return element;
  }

  public async getChildren(element?: RichPresenceItem): Promise<RichPresenceItem[]> {
    const config = vscode.workspace.getConfiguration('discord.richPresence');

    // Root element - show all settings
    if (!element) {
      const enabled = config.get<boolean>('enabled') ?? false;

      return [
        // Master toggle
        new RichPresenceItem(
          '🎮 Rich Presence',
          'enabled',
          'root',
          enabled,
          vscode.TreeItemCollapsibleState.Expanded
        ),
      ];
    }

    // Show children for root
    if (element.id === 'enabled') {
      const enabled = config.get<boolean>('enabled') ?? false;
      const showFileName = config.get<boolean>('showFileName') ?? false;
      const showFileLine = config.get<boolean>('showFileLine') ?? false;
      const showLanguage = config.get<boolean>('showLanguage') ?? true;
      const showProject = config.get<boolean>('showProject') ?? false;
      const showLobby = config.get<boolean>('showLobby') ?? true;
      const showVoiceChannel = config.get<boolean>('showVoiceChannel') ?? true;
      const idleTimeout = config.get<number>('idleTimeout') ?? 300000;

      // Current status
      const statusLabel = enabled
        ? '✏️ Editing file.ts | TypeScript'
        : '💤 Rich Presence Disabled';

      const items: RichPresenceItem[] = [
        // Current status display
        new RichPresenceItem(
          statusLabel,
          'status',
          'status',
          enabled,
          vscode.TreeItemCollapsibleState.None
        ),

        // Separator/category
        new RichPresenceItem(
          '━━━ VISIBILITY SETTINGS ━━━',
          'visibility-sep',
          'status',
          true,
          vscode.TreeItemCollapsibleState.None
        ),

        // Toggles
        new RichPresenceItem(
          '📄 Show File Name',
          'showFileName',
          'toggle',
          showFileName,
          vscode.TreeItemCollapsibleState.None
        ),
        new RichPresenceItem(
          '📍 Show Line Number',
          'showFileLine',
          'toggle',
          showFileLine,
          vscode.TreeItemCollapsibleState.None
        ),
        new RichPresenceItem(
          '🔤 Show Language',
          'showLanguage',
          'toggle',
          showLanguage,
          vscode.TreeItemCollapsibleState.None
        ),
        new RichPresenceItem(
          '📁 Show Project Name',
          'showProject',
          'toggle',
          showProject,
          vscode.TreeItemCollapsibleState.None
        ),

        // Separator/category
        new RichPresenceItem(
          '━━━ COLLABORATION ━━━',
          'collab-sep',
          'status',
          true,
          vscode.TreeItemCollapsibleState.None
        ),

        new RichPresenceItem(
          '🎮 Show Lobby Status',
          'showLobby',
          'toggle',
          showLobby,
          vscode.TreeItemCollapsibleState.None
        ),
        new RichPresenceItem(
          '🎤 Show Voice Channel',
          'showVoiceChannel',
          'toggle',
          showVoiceChannel,
          vscode.TreeItemCollapsibleState.None
        ),

        // Separator/category
        new RichPresenceItem(
          '━━━ ADVANCED ━━━',
          'advanced-sep',
          'status',
          true,
          vscode.TreeItemCollapsibleState.None
        ),

        new RichPresenceItem(
          '⏱️ Auto-Hide Idle Timeout',
          'idleTimeout',
          'idle-timeout',
          true,
          vscode.TreeItemCollapsibleState.None,
          idleTimeout
        ),
      ];

      // If not enabled, disable toggles visually
      if (!enabled) {
        return items.map(item => {
          if (item.type === 'toggle') {
            item.iconPath = new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('disabledForeground'));
            item.description = '⭕ (Disabled - Enable Rich Presence first)';
          }
          return item;
        });
      }

      return items;
    }

    return [];
  }
}
