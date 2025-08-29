import * as vscode from 'vscode';
import * as path from 'path';
import { DirectiveService } from './services/directive';
import { logger } from './utils/logger';
// OLD: Removed unused imports: FrontmatterService, AnchorService, Comment

// Angle bracket preprocessing functions
function isInInlineCode(text: string, position: number): boolean {
  const beforeText = text.substring(0, position);
  const backticksBefore = (beforeText.match(/`/g) || []).length;
  return backticksBefore % 2 === 1;
}

function isInCodeBlock(text: string, position: number): boolean {
  const beforeText = text.substring(0, position);
  
  const codeBlockStart = /```/g;
  let match;
  let inCodeBlock = false;
  
  codeBlockStart.lastIndex = 0;
  while ((match = codeBlockStart.exec(beforeText)) !== null) {
    inCodeBlock = !inCodeBlock;
  }
  
  return inCodeBlock;
}

function preprocessAngleBrackets(markdown: string): string {
  let result = '';
  let i = 0;
  
  while (i < markdown.length) {
    const char = markdown[i];
    
    // Only escape < brackets, not > brackets (which are used for blockquotes)
    if (char === '<') {
      if (isInInlineCode(markdown, i) || isInCodeBlock(markdown, i)) {
        result += char;
      } else {
        result += '\\' + char;
      }
    } else {
      result += char;
    }
    i++;
  }
  
  return result;
}

function postprocessAngleBrackets(markdown: string): string {
  // First clean up escaped underscores inside curly braces
  let result = markdown.replace(/\{\{([^}]*)\}\}/g, (match, content) => {
    // Remove backslash escaping from underscores within curly braces
    const unescapedContent = content.replace(/\\_/g, '_');
    return `{{${unescapedContent}}}`;
  });
  
  // Then remove backslash escaping from < characters (we no longer escape >)
  return result.replace(/\\</g, '<');
}

function debug(...args: any[]) {
  // Debug logging disabled for production
  // logger.debug(...args);
}

function showError(msg: string) {
  vscode.window.showErrorMessage(`[markdown-docs] ${msg}`);
}

export function activate(context: vscode.ExtensionContext) {
  // Extension activated - debug logging disabled
  // logger.debug('Markdown Docs extension is now active!');

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
  private _justSaved = false;

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
      
      // Don't sync external changes if we're currently updating from webview or just saved
      if (this._isUpdatingFromWebview || this._justSaved) {
        logger.debug('Ignoring external change during webview update or just after save');
        if (this._justSaved) {
          this._justSaved = false; // Reset flag
        }
        return;
      }
      
      // For true realtime 2-way sync, update webview immediately with minimal debounce
      textEditTimer && clearTimeout(textEditTimer);
      textEditTimer = setTimeout(() => {
        logger.debug('External file change detected (file is open), updating webview');
        this._update();
        this._updateEditTitle();
      }, 50); // Small delay to ensure webview flag is reset first
    }, this._disposables);

    // Watch for external file saves to sync back to webview
    vscode.workspace.onDidSaveTextDocument((savedDocument) => {
      if (savedDocument.fileName === this._document.fileName) {
        logger.debug('=== EXTERNAL SAVE EVENT DEBUG ===');
        logger.debug('File saved externally, syncing to webview');
        logger.debug('Document isDirty:', this._document.isDirty);
        logger.debug('IsUpdatingFromWebview flag:', this._isUpdatingFromWebview);
        
        // Don't sync back if we're in the middle of a webview update
        // This prevents circular updates and race conditions
        if (this._isUpdatingFromWebview) {
          logger.debug('Skipping external save sync - webview update in progress');
          return;
        }
        
        setTimeout(() => {
          logger.debug('Executing delayed external save sync');
          this._update();
        }, 75); // Ensure this runs after webview flag reset (25ms + buffer)
      }
    }, this._disposables);
    
    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        debug('msg from webview', message, this._panel.active);

        const syncToEditor = async (content?: string) => {
          debug('sync to editor', this._document, this._uri);
          
          // Use provided content or fallback to message content
          const contentToWrite = content || message.content;
          
          // Check if document is actually open in VS Code with detailed logging
          const openDocuments = vscode.workspace.textDocuments.map(doc => doc.uri.fsPath);
          const isDocumentOpen = openDocuments.includes(this._uri?.fsPath || '');
          
          logger.debug('=== SYNC TO EDITOR DEBUG ===');
          logger.debug('Target URI:', this._uri?.fsPath);
          logger.debug('Open documents:', openDocuments);
          logger.debug('Is document open:', isDocumentOpen);
          logger.debug('Document exists:', !!this._document);
          logger.debug('Document is closed:', this._document?.isClosed);
          logger.debug('Content to write length:', contentToWrite.length);
          
          // ALWAYS use direct file write to avoid opening files
          if (this._uri) {
            await vscode.workspace.fs.writeFile(
              this._uri, 
              Buffer.from(contentToWrite, 'utf8')
            );
            logger.debug('Synced via direct file write (avoiding VS Code document operations)');
          } else {
            showError(`Cannot find original file to save!`);
          }
        };
        
        logger.debug('Extension received message:', message.command, message);
        
        switch (message.command) {
          case 'ready':
            logger.debug('Received ready message, sending initial content');
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
            logger.debug('Edit message received - DISABLED auto-save to prevent cursor jumping');
            // DISABLED: Real-time sync disabled to prevent cursor jumping during typing
            // Only save when user explicitly presses Ctrl+S/Cmd+S
            logger.debug('Edit command ignored - use save command instead');
            break;
          }
          case 'save': {
            logger.debug('Save message received');
            logger.debug('Document exists:', !!this._document);
            logger.debug('Document URI:', this._uri?.fsPath);
            
            // Postprocess content to remove angle bracket escaping
            const processedContent = postprocessAngleBrackets(message.content);
            logger.debug('Original content length:', message.content.length);
            logger.debug('Postprocessed content length:', processedContent.length);
            
            // Set flags to prevent circular sync and webview updates
            this._isUpdatingFromWebview = true;
            this._justSaved = true;
            
            try {
              // Check if document is still open in VS Code
              const isDocumentOpen = vscode.workspace.textDocuments.some(
                doc => doc.uri.fsPath === this._uri?.fsPath
              );
              
              if (isDocumentOpen && this._document && !this._document.isClosed) {
                logger.debug('Document is open in VS Code, using document reference');
                await syncToEditor(processedContent); // Pass postprocessed content
                await this._document.save();
                logger.debug('Document saved via VS Code document');
              } else {
                logger.debug('Document not open in VS Code, using direct file write');
                // Direct file write without opening the document in VS Code
                if (this._uri) {
                  await vscode.workspace.fs.writeFile(
                    this._uri, 
                    Buffer.from(processedContent, 'utf8') // Use postprocessed content
                  );
                  logger.debug('Direct file write successful');
                } else {
                  throw new Error('No URI available for file write');
                }
              }
              this._updateEditTitle();
            } finally {
              // Clear flag after minimal delay for realtime sync
              setTimeout(() => {
                this._isUpdatingFromWebview = false;
              }, 100); // Longer delay to prevent unnecessary webview updates after save
            }
            break;
          }
          // OLD: Extension-side comment handling removed

          // OLD: Extension-side navigation removed

          // OLD: Extension-side edit handling removed

          // OLD: Extension-side update handling removed

          // OLD: Extension-side delete handling removed

          case 'getFont': {
            logger.debug('Get font requested');
            const config = vscode.workspace.getConfiguration('markdown-docs');
            const defaultFont = config.get<string>('defaultFont', 'Arial');
            logger.debug('Sending font to webview:', defaultFont);
            this._panel.webview.postMessage({
              command: 'fontUpdate',
              font: defaultFont
            });
            break;
          }

          case 'setFont': {
            logger.debug('Set font requested:', message.font);
            if (message.font) {
              const config = vscode.workspace.getConfiguration('markdown-docs');
              await config.update('defaultFont', message.font, vscode.ConfigurationTarget.Global);
              logger.debug('Font saved to settings:', message.font);
            }
            break;
          }

          case 'dirtyStateChanged': {
            logger.debug('Dirty state changed:', message.isDirty);
            this._isDirtyFromWebview = message.isDirty;
            this._updateEditTitle();
            break;
          }

          case 'getImageUri': {
            const { data } = message;
            const uri = this._panel.webview.asWebviewUri(vscode.Uri.parse(data));
            this._panel.webview.postMessage({
              command: 'imageUri',
              uri: uri.toString(),
            });
            break;
          }
          
          case 'resolveImagePath': {
            const { path: imagePath } = message;
            logger.debug('Resolving image path:', imagePath);
            
            try {
              // Resolve relative path relative to the current document's directory
              const documentDir = this._uri ? vscode.Uri.file(path.dirname(this._uri.fsPath)) : undefined;
              let resolvedPath: vscode.Uri;
              
              if (documentDir) {
                // Join the image path with the document's directory
                resolvedPath = vscode.Uri.joinPath(documentDir, imagePath);
                logger.debug('Resolved absolute path:', resolvedPath.fsPath);
              } else {
                // Fallback to treating as absolute path
                resolvedPath = vscode.Uri.file(imagePath);
              }
              
              // Check if the file exists
              vscode.workspace.fs.stat(resolvedPath).then(
                () => {
                  // File exists, convert to webview URI
                  const webviewUri = this._panel.webview.asWebviewUri(resolvedPath);
                  logger.debug('File exists, webview URI:', webviewUri.toString());
                  
                  this._panel.webview.postMessage({
                    command: 'resolvedImageUri',
                    uri: webviewUri.toString(),
                  });
                },
                (error) => {
                  // File doesn't exist, return original path
                  logger.debug('File does not exist:', resolvedPath.fsPath, error);
                  this._panel.webview.postMessage({
                    command: 'resolvedImageUri',
                    uri: imagePath, // Return original path as fallback
                  });
                }
              );
            } catch (error) {
              console.error('Error resolving image path:', error);
              // Return original path on error
              this._panel.webview.postMessage({
                command: 'resolvedImageUri',
                uri: imagePath,
              });
            }
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
    // Set markdown icon for the tab
    this._panel.iconPath = new vscode.ThemeIcon('markdown');
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
        logger.debug('Updated tab title with dirty state:', isEdit);
      }
    } catch (error) {
      logger.debug('Webview panel disposed, skipping title update');
    }
  }

  private async _update(
    props: {
      type?: 'init' | 'update';
      theme?: 'dark' | 'light';
    } = {}
  ) {
    logger.debug('=== _UPDATE DEBUG START ===');
    logger.debug('_update called with props:', props);
    logger.debug('Document:', this._document?.fileName);
    logger.debug('URI:', this._uri?.fsPath);
    logger.debug('IsUpdatingFromWebview flag:', this._isUpdatingFromWebview);
    
    const rawMd = this._document
      ? this._document.getText()
      : (await vscode.workspace.fs.readFile(this._uri)).toString();
    
    // Preprocess angle brackets for MDXEditor  
    const md = preprocessAngleBrackets(rawMd);
    
    logger.debug('Extension: Raw file content length:', rawMd.length);
    logger.debug('Extension: Processed content length:', md.length);
    logger.debug('Extension: File content preview:', rawMd.substring(0, 200));
    logger.debug('Extension: Processed preview:', md.substring(0, 200));
    logger.debug('Extension: Contains angle brackets?', rawMd.includes('<') && rawMd.includes('>'));
    
    // Count directives in the content we're about to send
    const directiveMatches = rawMd.match(/(:+)comment(?:\[[^\]]*\])?\{[^}]*\}/g);
    logger.debug('Directives found in content:', directiveMatches?.length || 0);
    if (directiveMatches) {
      logger.debug('Directive samples:', directiveMatches.slice(0, 3));
    }
    
    const messageToSend = {
      command: 'update',
      content: md, // Send preprocessed content
      ...props,
    };
    
    logger.debug('Sending message to webview with', md.length, 'characters');
    this._panel.webview.postMessage(messageToSend);
    logger.debug('=== _UPDATE DEBUG END ===');
    
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
  <base href="${baseHref}">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: http: data: blob:; style-src ${webview.cspSource} 'unsafe-inline' https://fonts.googleapis.com; script-src 'nonce-${nonce}' 'unsafe-eval'; font-src ${webview.cspSource} https://fonts.gstatic.com;">
  <link href="${styleUri}" rel="stylesheet">
  <title>Markdown Docs</title>
</head>
<body>
  <div id="editor-root"></div>
  <script nonce="${nonce}">
    // Make VS Code API globally available before loading the main script
    window.vscodeApi = acquireVsCodeApi();
    // Debug: VS Code API acquisition
    // logger.debug('VS Code API acquired in HTML:', !!window.vscodeApi);
    
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