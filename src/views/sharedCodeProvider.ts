import * as vscode from 'vscode';

interface SharedCodeSnippet {
  id: string;
  from: string;
  code: string;
  language: string;
  timestamp: number;
  description?: string;
}

/**
 * Provides a tree view of shared code snippets for lobby collaboration
 */
export class SharedCodeProvider implements vscode.TreeDataProvider<SharedCodeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<SharedCodeItem | undefined | null | void> = new vscode.EventEmitter<SharedCodeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<SharedCodeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private snippets: Map<string, SharedCodeSnippet> = new Map();
  private treeView: vscode.TreeView<SharedCodeItem> | null = null;

  constructor(private context: vscode.ExtensionContext) {
    // Load snippets from storage on init
    this.loadSnippets();
  }

  /**
   * Register this provider with VS Code
   */
  static register(context: vscode.ExtensionContext): SharedCodeProvider {
    const provider = new SharedCodeProvider(context);
    
    context.subscriptions.push(
      vscode.window.createTreeView('discord-vscode.sharedCode', {
        treeDataProvider: provider,
        showCollapseAll: true,
        canSelectMany: false
      })
    );

    // Register open command
    context.subscriptions.push(
      vscode.commands.registerCommand('discord-vscode.viewSharedCode', (item: SharedCodeItem) => {
        provider.openSnippet(item.id);
      })
    );

    // Register copy command
    context.subscriptions.push(
      vscode.commands.registerCommand('discord-vscode.copySharedCode', (item: SharedCodeItem) => {
        const snippet = provider.snippets.get(item.id);
        if (snippet) {
          vscode.env.clipboard.writeText(snippet.code);
          vscode.window.showInformationMessage(`✅ Code from ${snippet.from} copied to clipboard`);
        }
      })
    );

    // Register delete command
    context.subscriptions.push(
      vscode.commands.registerCommand('discord-vscode.deleteSharedCode', (item: SharedCodeItem) => {
        provider.deleteSnippet(item.id);
      })
    );

    console.log('✓ SharedCodeProvider registered');
    return provider;
  }

  /**
   * Add a new code snippet to the view
   */
  addSnippet(from: string, code: string, language: string, description?: string): void {
    const id = `${from}-${Date.now()}`;
    const snippet: SharedCodeSnippet = {
      id,
      from,
      code,
      language,
      timestamp: Date.now(),
      description
    };

    this.snippets.set(id, snippet);
    console.log(`[SharedCodeProvider] Added code snippet from ${from} (total: ${this.snippets.size})`);
    
    this.saveSnippets();
    
    // Force tree view refresh
    this._onDidChangeTreeData.fire(null);
    console.log(`[SharedCodeProvider] Fired refresh event (snippets: ${this.snippets.size})`);
  }

  /**
   * Open a snippet in the editor
   */
  private async openSnippet(snippetId: string): Promise<void> {
    const snippet = this.snippets.get(snippetId);
    if (!snippet) return;

    try {
      const doc = await vscode.workspace.openTextDocument({
        language: snippet.language,
        content: snippet.code
      });

      await vscode.window.showTextDocument(doc, {
        viewColumn: vscode.ViewColumn.Beside,
        preview: true
      });

      console.log(`[SharedCodeProvider] Opened snippet from ${snippet.from}`);
    } catch (error) {
      console.error('[SharedCodeProvider] Failed to open snippet:', error);
    }
  }

  /**
   * Delete a snippet
   */
  private deleteSnippet(snippetId: string): void {
    this.snippets.delete(snippetId);
    this.saveSnippets();
    this._onDidChangeTreeData.fire(null);
    console.log(`[SharedCodeProvider] Deleted snippet (remaining: ${this.snippets.size})`);
  }

  /**
   * Save snippets to workspace storage
   */
  private saveSnippets(): void {
    const snippetArray = Array.from(this.snippets.values());
    this.context.globalState.update('discord-shared-code-snippets', snippetArray).then(
      () => {
        // Success
      },
      (e: any) => {
        console.error('[SharedCodeProvider] Failed to save snippets:', e);
      }
    );
  }

  /**
   * Load snippets from storage
   */
  private loadSnippets(): void {
    const stored = this.context.globalState.get<SharedCodeSnippet[]>('discord-shared-code-snippets', []);
    stored.forEach(snippet => {
      this.snippets.set(snippet.id, snippet);
    });
    console.log(`[SharedCodeProvider] Loaded ${stored.length} code snippets`);
  }

  /**
   * Get tree item
   */
  getTreeItem(element: SharedCodeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get children
   */
  async getChildren(element?: SharedCodeItem): Promise<SharedCodeItem[]> {
    if (element) {
      return [];
    }

    // Return all snippets as tree items
    return Array.from(this.snippets.values()).map(snippet => {
      const timestamp = new Date(snippet.timestamp).toLocaleTimeString();
      const label = `${snippet.from} - ${snippet.language}`;
      const description = `${snippet.code.split('\n').length} lines @ ${timestamp}`;
      
      return new SharedCodeItem(
        snippet.id,
        label,
        description,
        vscode.TreeItemCollapsibleState.None,
        snippet
      );
    });
  }
}

/**
 * Tree item for shared code snippet
 */
class SharedCodeItem extends vscode.TreeItem {
  constructor(
    public readonly id: string,
    label: string,
    description: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly snippet: SharedCodeSnippet
  ) {
    super(label, collapsibleState);
    this.description = description;
    this.tooltip = `Code from ${snippet.from}\nLanguage: ${snippet.language}\n${snippet.code.split('\n').length} lines`;
    
    // Set icon
    this.iconPath = new vscode.ThemeIcon('code');
    
    // Add context menu commands
    this.contextValue = 'sharedCode';
  }
}
