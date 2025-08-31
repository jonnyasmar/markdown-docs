import * as vscode from 'vscode';
import * as path from 'path';
import { DirectiveService } from './services/directive';
import { logger } from './utils/logger';
// OLD: Removed unused imports: FrontmatterService, AnchorService, Comment

/**
 * Custom text editor provider for markdown documents with integrated webview
 */
class MarkdownTextEditorProvider implements vscode.CustomTextEditorProvider {
  private static readonly viewType = 'markdown-docs.editor';
  private updatingFromWebview = false;
  private dirtyStateTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    token: vscode.CancellationToken
  ): void | Thenable<void> {
    logger.debug('Resolving custom text editor for:', document.uri.fsPath);
    
    // Set custom title to show only filename without path
    const path = require('path');
    const filename = path.basename(document.uri.fsPath);
    webviewPanel.title = filename;
    
    // Configure webview
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file("/"), ...this.getFolders()],
      retainContextWhenHidden: true,
      enableCommandUris: true,
    };

    // Set webview content
    webviewPanel.webview.html = this.getWebviewContent(webviewPanel.webview, document.uri);
    
    // Handle messages from webview
    this.setupWebviewMessageHandling(document, webviewPanel);
    
    // Send initial content to webview
    this.sendContentToWebview(document, webviewPanel);
    
    // Listen for document changes and update webview (but not when we're updating from webview)
    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.uri.toString() === document.uri.toString() && !this.updatingFromWebview) {
        this.sendContentToWebview(document, webviewPanel);
      }
    });

    // Listen for file rename/save as events to update the title
    const renameSubscription = vscode.workspace.onDidRenameFiles(e => {
      e.files.forEach(file => {
        if (file.oldUri.toString() === document.uri.toString()) {
          const path = require('path');
          const newFilename = path.basename(file.newUri.fsPath);
          webviewPanel.title = newFilename;
        }
      });
    });

    // Clean up listeners when webview is disposed
    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
      renameSubscription.dispose();
    });
  }


  private getFolders(): vscode.Uri[] {
    const data = [];
    for (let i = 65; i <= 90; i++) {
      data.push(vscode.Uri.file(`${String.fromCharCode(i)}:/`));
    }
    return data;
  }

  private setupWebviewMessageHandling(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel): void {
    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      logger.debug('Custom editor received message:', message.command);
      
      switch (message.command) {
        case 'ready':
          logger.debug('Webview ready, sending initial content');
          this.sendContentToWebview(document, webviewPanel);
          break;
          
        case 'edit':
          logger.debug('Content edited, updating TextDocument');
          if (message.content) {
            const editContent = postprocessAngleBrackets(message.content);
            await this.updateTextDocument(document, editContent);
          }
          break;
          
        case 'save':
          // With CustomTextEditorProvider, VS Code handles saving automatically
          // Just update TextDocument, VS Code will handle the save operation
          if (message.content) {
            const saveContent = postprocessAngleBrackets(message.content);
            await this.updateTextDocument(document, saveContent);
          }
          break;
          
        // Handle other messages like font changes, etc.
        case 'getFont':
          const config = vscode.workspace.getConfiguration('markdown-docs');
          const defaultFont = config.get<string>('defaultFont', 'Arial');
          webviewPanel.webview.postMessage({
            command: 'fontUpdate',
            font: defaultFont
          });
          break;
          
        case 'setFont':
          if (message.font) {
            const config = vscode.workspace.getConfiguration('markdown-docs');
            await config.update('defaultFont', message.font, vscode.ConfigurationTarget.Global);
          }
          break;
          
        case 'addComment':
        case 'navigateToComment':
        case 'editComment':
        case 'deleteComment':
          // Comment operations should also trigger document updates to show dirty state
          logger.debug('Comment operation, updating document');
          if (message.content) {
            const commentContent = postprocessAngleBrackets(message.content);
            await this.updateTextDocument(document, commentContent);
          }
          break;
          
      }
    });
  }

  private async updateTextDocument(document: vscode.TextDocument, newContent: string): Promise<void> {
    this.updatingFromWebview = true;
    
    try {
      const edit = new vscode.WorkspaceEdit();
      
      // Replace the entire document content
      const lastLine = document.lineCount - 1;
      const lastChar = document.lineAt(lastLine).text.length;
      edit.replace(
        document.uri,
        new vscode.Range(0, 0, lastLine, lastChar),
        newContent
      );
      
      await vscode.workspace.applyEdit(edit);
    } finally {
      this.updatingFromWebview = false;
    }
  }

  private sendContentToWebview(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel): void {
    // Get document content, with special handling for untitled documents
    let content = document.getText();
    
    // For untitled documents, provide welcome content if empty
    if (document.uri.scheme === 'untitled' && content.trim() === '') {
      content = '# Welcome to Markdown Docs!\n\n';
    }
    
    // Preprocess content when sending to webview (escape angle brackets for safe rendering)
    const displayContent = preprocessAngleBrackets(content);
    
    webviewPanel.webview.postMessage({
      command: 'update',
      content: displayContent,
      type: 'init',
      theme: vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark ? 'dark' : 'light'
    });
  }

  private getWebviewContent(webview: vscode.Webview, uri: vscode.Uri): string {
    const toUri = (f: string) =>
      webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, f));
    
    const baseHref = path.dirname(
      webview.asWebviewUri(uri).toString()
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
  logger.info('Markdown Docs extension activating with CustomTextEditorProvider...');

  // Register the custom text editor provider
  const provider = new MarkdownTextEditorProvider(context);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      'markdown-docs.editor',
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        }
      }
    )
  );

  // Keep the old commands for backward compatibility and manual opening
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'markdown-docs.openEditor',
      async (uri?: vscode.Uri) => {
        if (uri) {
          // Open the file with our custom editor
          await vscode.commands.executeCommand('vscode.openWith', uri, 'markdown-docs.editor');
        } else if (vscode.window.activeTextEditor) {
          // Use current file
          const currentUri = vscode.window.activeTextEditor.document.uri;
          if (currentUri.scheme === 'file' && currentUri.fsPath.endsWith('.md')) {
            await vscode.commands.executeCommand('vscode.openWith', currentUri, 'markdown-docs.editor');
          } else {
            vscode.window.showErrorMessage('Please select a markdown file to open with Markdown Docs');
          }
        } else {
          vscode.window.showErrorMessage('No markdown file selected');
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'markdown-docs.openStandalone',
      async () => {
        // Create untitled document - VS Code will handle this properly with CustomTextEditorProvider
        const untitledUri = vscode.Uri.parse('untitled:Untitled-1.md');
        
        // Open with our custom editor
        await vscode.commands.executeCommand('vscode.openWith', untitledUri, 'markdown-docs.editor');
      }
    )
  );

  logger.info('Markdown Docs extension activated successfully');
}

export function deactivate() {}
