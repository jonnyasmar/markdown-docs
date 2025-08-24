import * as vscode from 'vscode';
import * as path from 'path';
import { DirectiveService } from './services/directive';
// OLD: Removed unused imports: FrontmatterService, AnchorService, Comment

function debug(...args: any[]) {
  console.log(...args);
}

function showError(msg: string) {
  vscode.window.showErrorMessage(`[markdown-docs] ${msg}`);
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Markdown Docs extension is now active!');

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'markdown-docs.openEditor',
      (uri?: vscode.Uri, ...args) => {
        debug('command', uri, args);
        EditorPanel.createOrShow(context, uri);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'markdown-docs.openStandalone',
      () => {
        debug('standalone command');
        EditorPanel.createOrShow(context, undefined, true); // Pass standalone flag
      }
    )
  );
}

/**
 * Manages markdown editor webview panels
 */
class EditorPanel {
  /**
   * Track the currently panel. Only allow a single panel to exist at a time.
   */
  public static currentPanel: EditorPanel | undefined;

  public static readonly viewType = 'markdown-docs';

  private _disposables: vscode.Disposable[] = [];
  private _isUpdatingFromWebview = false;
  private _isDirtyFromWebview = false;

  public static async createOrShow(
    context: vscode.ExtensionContext,
    uri?: vscode.Uri,
    standalone?: boolean
  ) {
    const { extensionUri } = context;
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;
    
    if (EditorPanel.currentPanel && uri !== EditorPanel.currentPanel?._uri) {
      EditorPanel.currentPanel.dispose();
    }
    
    // If we already have a panel, show it.
    if (EditorPanel.currentPanel) {
      EditorPanel.currentPanel._panel.reveal(column);
      return;
    }
    
    let doc: undefined | vscode.TextDocument;
    
    if (standalone) {
      // Standalone mode - create a new untitled document
      doc = await vscode.workspace.openTextDocument({
        language: 'markdown',
        content: '# New Markdown Document\n\nStart writing here...\n'
      });
    } else if (uri) {
      // From right-click: open document first then enable auto sync
      doc = await vscode.workspace.openTextDocument(uri);
    } else {
      if (!vscode.window.activeTextEditor) {
        showError(`Did not open markdown file!`);
        return;
      }
      doc = vscode.window.activeTextEditor?.document;
      // from command mode
      if (doc && doc.languageId !== 'markdown') {
        showError(
          `Current file language is not markdown, got ${doc.languageId}`
        );
        return;
      }
    }

    if (!doc) {
      showError(`Cannot find markdown file!`);
      return;
    }

    // Create a new panel
    const panel = vscode.window.createWebviewPanel(
      EditorPanel.viewType,
      'Markdown Docs',
      column || vscode.ViewColumn.One,
      EditorPanel.getWebviewOptions(uri)
    );

    EditorPanel.currentPanel = new EditorPanel(
      context,
      panel,
      extensionUri,
      doc,
      uri
    );
  }

  private static getFolders(): vscode.Uri[] {
    const data = [];
    for (let i = 65; i <= 90; i++) {
      data.push(vscode.Uri.file(`${String.fromCharCode(i)}:/`));
    }
    return data;
  }

  static getWebviewOptions(
    uri?: vscode.Uri
  ): vscode.WebviewOptions & vscode.WebviewPanelOptions {
    return {
      // Enable javascript in the webview
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file("/"), ...this.getFolders()],
      retainContextWhenHidden: true,
      enableCommandUris: true,
    };
  }

  private get _fsPath() {
    return this._uri.fsPath;
  }

  private constructor(
    private readonly _context: vscode.ExtensionContext,
    private readonly _panel: vscode.WebviewPanel,
    private readonly _extensionUri: vscode.Uri,
    public _document: vscode.TextDocument,
    public _uri = _document.uri
  ) {
    // Set the webview's initial html content
    this._init();

    // Listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    
    let textEditTimer: NodeJS.Timeout | undefined;
    
    // DISABLED: close EditorPanel when vsc editor is close
    // Allow webview to persist independently of source file
    /*
    vscode.workspace.onDidCloseTextDocument((e) => {
      if (e.fileName === this._fsPath) {
        this.dispose();
      }
    }, this._disposables);
    */
    
    // update EditorPanel when vsc editor changes
    vscode.workspace.onDidChangeTextDocument((e) => {
      // Only sync if the document is actually open in VS Code
      const isDocumentOpen = vscode.workspace.textDocuments.some(
        doc => doc.uri.fsPath === this._uri?.fsPath
      );
      
      if (!isDocumentOpen || e.document.fileName !== this._document.fileName) {
        return;
      }
      
      // Don't sync external changes if we're currently updating from webview
      if (this._isUpdatingFromWebview) {
        console.log('Ignoring external change during webview update');
        return;
      }
      
      // For true realtime 2-way sync, update webview immediately with minimal debounce
      textEditTimer && clearTimeout(textEditTimer);
      textEditTimer = setTimeout(() => {
        console.log('External file change detected (file is open), updating webview');
        this._update();
        this._updateEditTitle();
      }, 50); // Small delay to ensure webview flag is reset first
    }, this._disposables);

    // Watch for external file saves to sync back to webview
    vscode.workspace.onDidSaveTextDocument((savedDocument) => {
      if (savedDocument.fileName === this._document.fileName) {
        console.log('=== EXTERNAL SAVE EVENT DEBUG ===');
        console.log('File saved externally, syncing to webview');
        console.log('Document isDirty:', this._document.isDirty);
        console.log('IsUpdatingFromWebview flag:', this._isUpdatingFromWebview);
        
        // Don't sync back if we're in the middle of a webview update
        // This prevents circular updates and race conditions
        if (this._isUpdatingFromWebview) {
          console.log('Skipping external save sync - webview update in progress');
          return;
        }
        
        setTimeout(() => {
          console.log('Executing delayed external save sync');
          this._update();
        }, 75); // Ensure this runs after webview flag reset (25ms + buffer)
      }
    }, this._disposables);
    
    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        debug('msg from webview', message, this._panel.active);

        const syncToEditor = async () => {
          debug('sync to editor', this._document, this._uri);
          
          // Check if document is actually open in VS Code with detailed logging
          const openDocuments = vscode.workspace.textDocuments.map(doc => doc.uri.fsPath);
          const isDocumentOpen = openDocuments.includes(this._uri?.fsPath || '');
          
          console.log('=== SYNC TO EDITOR DEBUG ===');
          console.log('Target URI:', this._uri?.fsPath);
          console.log('Open documents:', openDocuments);
          console.log('Is document open:', isDocumentOpen);
          console.log('Document exists:', !!this._document);
          console.log('Document is closed:', this._document?.isClosed);
          
          // ALWAYS use direct file write to avoid opening files
          if (this._uri) {
            await vscode.workspace.fs.writeFile(
              this._uri, 
              Buffer.from(message.content, 'utf8')
            );
            console.log('Synced via direct file write (avoiding VS Code document operations)');
          } else {
            showError(`Cannot find original file to save!`);
          }
        };
        
        console.log('Extension received message:', message.command, message);
        
        switch (message.command) {
          case 'ready':
            console.log('Received ready message, sending initial content');
            this._update({
              type: 'init',
              theme: vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark
                ? 'dark' 
                : 'light',
            });
            break;
          case 'info':
            vscode.window.showInformationMessage(message.content);
            break;
          case 'error':
            showError(message.content);
            break;
          case 'edit': {
            console.log('Edit message received - DISABLED auto-save to prevent cursor jumping');
            // DISABLED: Real-time sync disabled to prevent cursor jumping during typing
            // Only save when user explicitly presses Ctrl+S/Cmd+S
            console.log('Edit command ignored - use save command instead');
            break;
          }
          case 'save': {
            console.log('Save message received');
            console.log('Document exists:', !!this._document);
            console.log('Document URI:', this._uri?.fsPath);
            
            // Set flag to prevent circular sync
            this._isUpdatingFromWebview = true;
            
            try {
              // Check if document is still open in VS Code
              const isDocumentOpen = vscode.workspace.textDocuments.some(
                doc => doc.uri.fsPath === this._uri?.fsPath
              );
              
              if (isDocumentOpen && this._document && !this._document.isClosed) {
                console.log('Document is open in VS Code, using document reference');
                await syncToEditor();
                await this._document.save();
                console.log('Document saved via VS Code document');
              } else {
                console.log('Document not open in VS Code, using direct file write');
                // Direct file write without opening the document in VS Code
                if (this._uri) {
                  await vscode.workspace.fs.writeFile(
                    this._uri, 
                    Buffer.from(message.content, 'utf8')
                  );
                  console.log('Direct file write successful');
                } else {
                  throw new Error('No URI available for file write');
                }
              }
              this._updateEditTitle();
            } finally {
              // Clear flag after minimal delay for realtime sync
              setTimeout(() => {
                this._isUpdatingFromWebview = false;
              }, 25); // Small delay to prevent race conditions with file change detection
            }
            break;
          }
          // OLD: Extension-side comment handling removed

          // OLD: Extension-side navigation removed

          // OLD: Extension-side edit handling removed

          // OLD: Extension-side update handling removed

          // OLD: Extension-side delete handling removed

          case 'getFont': {
            console.log('Get font requested');
            const config = vscode.workspace.getConfiguration('markdown-docs');
            const defaultFont = config.get<string>('defaultFont', 'Arial');
            console.log('Sending font to webview:', defaultFont);
            this._panel.webview.postMessage({
              command: 'fontUpdate',
              font: defaultFont
            });
            break;
          }

          case 'setFont': {
            console.log('Set font requested:', message.font);
            if (message.font) {
              const config = vscode.workspace.getConfiguration('markdown-docs');
              await config.update('defaultFont', message.font, vscode.ConfigurationTarget.Global);
              console.log('Font saved to settings:', message.font);
            }
            break;
          }

          case 'dirtyStateChanged': {
            console.log('Dirty state changed:', message.isDirty);
            this._isDirtyFromWebview = message.isDirty;
            this._updateEditTitle();
            break;
          }
        }
      },
      null,
      this._disposables
    );
  }

  public dispose() {
    EditorPanel.currentPanel = undefined;

    // Clean up our resources
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private _init() {
    const webview = this._panel.webview;
    this._panel.webview.html = this._getHtmlForWebview(webview);
    this._panel.title = path.basename(this._fsPath);
  }
  
  private _isEdit = false;
  private _updateEditTitle() {
    // Check if webview panel is still active to prevent disposal errors
    if (this._panel.visible === false && this._panel.active === false) {
      return;
    }
    
    try {
      // Use webview dirty state instead of document.isDirty since we disabled auto-sync
      const isEdit = this._isDirtyFromWebview;
      if (isEdit !== this._isEdit) {
        this._isEdit = isEdit;
        this._panel.title = `${path.basename(
          this._fsPath
        )}${isEdit ? `  ●` : ''}`;
        console.log('Updated tab title with dirty state:', isEdit);
      }
    } catch (error) {
      console.log('Webview panel disposed, skipping title update');
    }
  }

  private async _update(
    props: {
      type?: 'init' | 'update';
      theme?: 'dark' | 'light';
    } = {}
  ) {
    console.log('=== _UPDATE DEBUG START ===');
    console.log('_update called with props:', props);
    console.log('Document:', this._document?.fileName);
    console.log('URI:', this._uri?.fsPath);
    console.log('IsUpdatingFromWebview flag:', this._isUpdatingFromWebview);
    
    const md = this._document
      ? this._document.getText()
      : (await vscode.workspace.fs.readFile(this._uri)).toString();
    
    console.log('Extension: File content length:', md.length);
    console.log('Extension: File content preview:', md.substring(0, 200));
    console.log('Extension: File content ending:', '...' + md.substring(md.length - 100));
    console.log('Extension: Contains code blocks?', md.includes('```javascript'));
    console.log('Extension: Ends with expected?', md.includes('explore all the features!'));
    
    // Count directives in the content we're about to send
    const directiveMatches = md.match(/(:+)comment(?:\[[^\]]*\])?\{[^}]*\}/g);
    console.log('Directives found in content:', directiveMatches?.length || 0);
    if (directiveMatches) {
      console.log('Directive samples:', directiveMatches.slice(0, 3));
    }
    
    const messageToSend = {
      command: 'update',
      content: md,
      ...props,
    };
    
    console.log('Sending message to webview with', md.length, 'characters');
    this._panel.webview.postMessage(messageToSend);
    console.log('=== _UPDATE DEBUG END ===');
    
    // Comments are now parsed directly in webview from markdown content
  }

  // OLD: _sendCommentsToWebview removed - comments parsed directly in webview

  private _getHtmlForWebview(webview: vscode.Webview) {
    const toUri = (f: string) =>
      webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, f));
    
    const baseHref = path.dirname(
      webview.asWebviewUri(vscode.Uri.file(this._fsPath)).toString()
    ) + '/';
    
    const scriptUri = toUri('dist/webview-ui/index.js');
    const styleUri = toUri('dist/webview-ui/index.css');
    
    // Generate a unique nonce for this webview instance
    const nonce = Math.random().toString(36).substring(2, 15);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline' https://fonts.googleapis.com; script-src 'nonce-${nonce}' 'unsafe-eval'; font-src ${webview.cspSource} https://fonts.gstatic.com; img-src ${webview.cspSource} data:;">
  <link href="${styleUri}" rel="stylesheet">
  <title>Markdown Docs</title>
</head>
<body>
  <div id="editor-root"></div>
  <script nonce="${nonce}">
    // Make VS Code API globally available before loading the main script
    window.vscodeApi = acquireVsCodeApi();
    console.log('VS Code API acquired in HTML:', !!window.vscodeApi);
    
    // Define environment for Vite compatibility
    window.__VITE_ENV__ = {
      MODE: 'production',
      DEV: false,
      PROD: true
    };
  </script>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

export function deactivate() {}