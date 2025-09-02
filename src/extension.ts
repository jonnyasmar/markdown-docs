import * as path from 'path';

import * as vscode from 'vscode';

import { logger } from './utils/logger';

interface WebviewMessage {
  command: string;
  content?: string;
  payload?: {
    content?: string;
  };
  range?: {
    start: number;
    end: number;
  };
  comment?: string;
  commentId?: string;
  font?: string;
  type?: string;
  fontSize?: number;
  textAlign?: string;
  bookView?: boolean;
  bookViewWidth?: string;
  bookViewMargin?: string;
  isInteracting?: boolean;
  settings?: {
    defaultFont: string;
    fontSize: number;
    textAlign: string;
    bookView: boolean;
    bookViewWidth: string;
    bookViewMargin: string;
  };
}

// Global registry to track user interaction state that should block incoming changes
const userInteractionRegistry = new Set<string>();

/**
 * Custom text editor provider for markdown documents with integrated webview
 */
class MarkdownTextEditorProvider implements vscode.CustomTextEditorProvider {
  private updatingFromWebview = false;
  private lastWebviewContent: string | null = null;
  private lastSentToWebview: string | null = null;
  private isExternalFileEdit = false;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly outputChannel: vscode.OutputChannel,
  ) {}

  /**
   * Get current VS Code editor configuration relevant to the markdown editor
   */
  private getEditorConfig(): { wordWrap: string } {
    const editorConfig = vscode.workspace.getConfiguration('editor');
    return {
      wordWrap: editorConfig.get<string>('wordWrap', 'off'),
    };
  }

  resolveCustomTextEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel): void | Thenable<void> {
    this.outputChannel.appendLine(`resolveCustomTextEditor called for: ${document.uri.fsPath}`);

    try {
      this.outputChannel.appendLine('Step 1: Setting title');
      // Set custom title to show only filename without path
      const filename = path.basename(document.uri.fsPath);
      webviewPanel.title = filename;

      this.outputChannel.appendLine('Step 2: Configuring webview options');
      // Configure webview
      webviewPanel.webview.options = {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.file('/'), ...this.getFolders()],
        enableCommandUris: true,
      };

      this.outputChannel.appendLine('Step 3: Setting webview HTML');
      // Set webview content
      webviewPanel.webview.html = this.getWebviewContent(webviewPanel.webview, document.uri);

      this.outputChannel.appendLine('Step 4: Setting up message handling');
      // Handle messages from webview
      this.setupWebviewMessageHandling(document, webviewPanel);

      this.outputChannel.appendLine('Step 5: Sending initial content');
      // Send initial content to webview
      logger.info('About to send initial content to webview');
      this.sendContentToWebview(document, webviewPanel);
      logger.info('Initial content sent to webview');

      // Listen for document changes and update webview with echo prevention
      const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
        if (e.document.uri.toString() === document.uri.toString()) {
          const fileUri = e.document.uri.toString();

          // Don't sync VS Code changes back to webview if we're currently updating from webview
          // This prevents echo loops between webview and VS Code
          if (this.updatingFromWebview) {
            return;
          }

          // Check if user is actively interacting (should block to prevent cursor jumping)
          const isUserInteracting = userInteractionRegistry.has(fileUri);

          // Never allow incoming changes if file is dirty (has unsaved changes)
          if (document.isDirty) {
            return;
          }

          // For active user interaction, respect the active panel to prevent cursor jumping
          // For external edits, always update regardless of focus
          if (webviewPanel.active && isUserInteracting) {
            return;
          }

          this.sendContentToWebview(document, webviewPanel);
        }
      });

      // Listen for file rename/save as events to update the title
      const renameSubscription = vscode.workspace.onDidRenameFiles(e => {
        e.files.forEach(file => {
          if (file.oldUri.toString() === document.uri.toString()) {
            const newFilename = path.basename(file.newUri.fsPath);
            webviewPanel.title = newFilename;
          }
        });
      });

      // Listen for editor configuration changes
      const configChangeSubscription = vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('editor.wordWrap')) {
          // Send updated configuration to webview
          void webviewPanel.webview.postMessage({
            command: 'configUpdate',
            editorConfig: this.getEditorConfig(),
          });
        }
      });

      // Clean up listeners when webview is disposed
      webviewPanel.onDidDispose(() => {
        changeDocumentSubscription.dispose();
        renameSubscription.dispose();
        configChangeSubscription.dispose();
      });

      this.outputChannel.appendLine('resolveCustomTextEditor completed successfully');
    } catch (error) {
      this.outputChannel.appendLine(`ERROR in resolveCustomTextEditor: ${String(error)}`);
      throw error;
    }
  }

  private getFolders(): vscode.Uri[] {
    const data = [];
    for (let i = 65; i <= 90; i++) {
      data.push(vscode.Uri.file(`${String.fromCharCode(i)}:/`));
    }
    return data;
  }

  private setupWebviewMessageHandling(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel): void {
    webviewPanel.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
      this.outputChannel.appendLine(`Received message from webview: ${message.command}`);
      logger.debug('Custom editor received message:', message.command);

      switch (message.command) {
        case 'ready':
          this.outputChannel.appendLine('Webview sent ready message - forcing content send');
          // Reset echo prevention for ready messages since webview is requesting content
          this.lastSentToWebview = null;
          this.sendContentToWebview(document, webviewPanel);
          break;

        case 'edit': {
          // Handle both SyncManager format and direct format
          const content = message.content ?? message.payload?.content;
          this.outputChannel.appendLine(`Edit message received, content length: ${content?.length ?? 0}`);
          this.outputChannel.appendLine(
            `Message format - content: ${String(message.content !== undefined)}, ` +
              `payload.content: ${String(message.payload?.content !== undefined)}`,
          );

          if (content) {
            const editContent = postprocessAngleBrackets(content);
            this.outputChannel.appendLine(`About to update TextDocument with content length: ${editContent.length}`);
            await this.updateTextDocument(document, editContent);
            this.outputChannel.appendLine(`TextDocument updated, isDirty: ${String(document.isDirty)}`);
          }
          break;
        }

        case 'save':
          // With CustomTextEditorProvider, VS Code handles saving automatically
          // Just update TextDocument, VS Code will handle the save operation
          if (message.content) {
            const saveContent = postprocessAngleBrackets(message.content);
            await this.updateTextDocument(document, saveContent);
          }
          break;

        case 'getFont': {
          const config = vscode.workspace.getConfiguration('markdown-docs');
          const defaultFont = config.get<string>('defaultFont', 'Arial');
          void webviewPanel.webview.postMessage({
            command: 'fontUpdate',
            font: defaultFont,
          });
          break;
        }

        case 'getSettings': {
          const config = vscode.workspace.getConfiguration('markdown-docs');
          const settings = {
            defaultFont: config.get<string>('defaultFont', 'Default'),
            fontSize: config.get<number>('fontSize', 14),
            textAlign: config.get<string>('textAlign', 'left'),
            bookView: config.get<boolean>('bookView', false),
            bookViewWidth: config.get<string>('bookViewWidth', '5.5in'),
            bookViewMargin: config.get<string>('bookViewMargin', '0.5in'),
          };
          void webviewPanel.webview.postMessage({
            command: 'settingsUpdate',
            settings,
          });
          break;
        }

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
          this.outputChannel.appendLine(`Comment operation: ${message.command}`);
          this.outputChannel.appendLine(
            `Comment data: range=${JSON.stringify(message.range)}, comment="${message.comment ?? ''}", commentId="${message.commentId ?? ''}"`,
          );

          // Handle comment operations with CommentService and update webview
          await this.handleCommentOperation(message, document);
          break;
        case 'setFontSize':
          console.log('Extension: setFontSize handler reached, fontSize:', message.fontSize);
          if (typeof message.fontSize === 'number') {
            const config = vscode.workspace.getConfiguration('markdown-docs');
            await config.update('fontSize', message.fontSize, vscode.ConfigurationTarget.Global);

            // Send updated settings back to webview
            const settings = {
              defaultFont: config.get<string>('defaultFont', 'Default'),
              fontSize: message.fontSize,
              textAlign: config.get<string>('textAlign', 'left'),
              bookView: config.get<boolean>('bookView', false),
              bookViewWidth: config.get<string>('bookViewWidth', '5.5in'),
              bookViewMargin: config.get<string>('bookViewMargin', '0.5in'),
            };

            console.log('Extension: Sending settingsUpdate for fontSize:', settings);
            void webviewPanel.webview.postMessage({
              command: 'settingsUpdate',
              settings,
            });
          }
          break;

        case 'setTextAlign':
          console.log('Extension: setTextAlign handler reached, textAlign:', message.textAlign);
          if (message.textAlign) {
            const config = vscode.workspace.getConfiguration('markdown-docs');
            await config.update('textAlign', message.textAlign, vscode.ConfigurationTarget.Global);

            // Send updated settings back to webview
            const settings = {
              defaultFont: config.get<string>('defaultFont', 'Default'),
              fontSize: config.get<number>('fontSize', 14),
              textAlign: message.textAlign,
              bookView: config.get<boolean>('bookView', false),
              bookViewWidth: config.get<string>('bookViewWidth', '5.5in'),
              bookViewMargin: config.get<string>('bookViewMargin', '0.5in'),
            };

            console.log('Extension: Sending settingsUpdate for textAlign:', settings);
            void webviewPanel.webview.postMessage({
              command: 'settingsUpdate',
              settings,
            });
          }
          break;

        case 'setBookView':
          console.log('Extension: setBookView handler reached, bookView:', message.bookView);
          if (typeof message.bookView === 'boolean') {
            const config = vscode.workspace.getConfiguration('markdown-docs');
            await config.update('bookView', message.bookView, vscode.ConfigurationTarget.Global);

            // Send updated settings back to webview
            const settings = {
              defaultFont: config.get<string>('defaultFont', 'Default'),
              fontSize: config.get<number>('fontSize', 14),
              textAlign: config.get<string>('textAlign', 'left'),
              bookView: message.bookView,
              bookViewWidth: config.get<string>('bookViewWidth', '5.5in'),
              bookViewMargin: config.get<string>('bookViewMargin', '0.5in'),
            };

            console.log('Extension: Sending settingsUpdate for bookView:', settings);
            void webviewPanel.webview.postMessage({
              command: 'settingsUpdate',
              settings,
            });
          }
          break;

        case 'setBookViewWidth':
          console.log('Extension: setBookViewWidth handler reached, width:', message.bookViewWidth);
          if (typeof message.bookViewWidth === 'string') {
            const config = vscode.workspace.getConfiguration('markdown-docs');
            await config.update('bookViewWidth', message.bookViewWidth, vscode.ConfigurationTarget.Global);

            // Send updated settings back to webview
            const settings = {
              defaultFont: config.get<string>('defaultFont', 'Default'),
              fontSize: config.get<number>('fontSize', 14),
              textAlign: config.get<string>('textAlign', 'left'),
              bookView: config.get<boolean>('bookView', false),
              bookViewWidth: message.bookViewWidth,
              bookViewMargin: config.get<string>('bookViewMargin', '0.5in'),
            };

            console.log('Extension: Sending settingsUpdate for bookViewWidth:', settings);
            void webviewPanel.webview.postMessage({
              command: 'settingsUpdate',
              settings,
            });
          }
          break;

        case 'setBookViewMargin':
          console.log('Extension: setBookViewMargin handler reached, margin:', message.bookViewMargin);
          if (typeof message.bookViewMargin === 'string') {
            const config = vscode.workspace.getConfiguration('markdown-docs');
            await config.update('bookViewMargin', message.bookViewMargin, vscode.ConfigurationTarget.Global);

            // Send updated settings back to webview
            const settings = {
              defaultFont: config.get<string>('defaultFont', 'Default'),
              fontSize: config.get<number>('fontSize', 14),
              textAlign: config.get<string>('textAlign', 'left'),
              bookView: config.get<boolean>('bookView', false),
              bookViewWidth: config.get<string>('bookViewWidth', '5.5in'),
              bookViewMargin: message.bookViewMargin,
            };

            console.log('Extension: Sending settingsUpdate for bookViewMargin:', settings);
            void webviewPanel.webview.postMessage({
              command: 'settingsUpdate',
              settings,
            });
          }
          break;

        case 'setUserInteracting': {
          const fileUri = document.uri.toString();
          if (message.isInteracting) {
            userInteractionRegistry.add(fileUri);
          } else {
            userInteractionRegistry.delete(fileUri);
          }
          break;
        }
      }
    });
  }

  private async handleCommentOperation(message: WebviewMessage, document: vscode.TextDocument): Promise<void> {
    try {
      // Update document content if provided - webview handles comment processing internally via directives
      const commentContent = message.content ?? message.payload?.content;
      if (commentContent) {
        const processedContent = postprocessAngleBrackets(commentContent);
        this.outputChannel.appendLine(`Updating document with comment content length: ${processedContent.length}`);
        await this.updateTextDocument(document, processedContent);
      }

      // Note: Comment data is now handled via inline directives in the webview
      // No need to parse or send separate comment data
      this.outputChannel.appendLine('Comment operation completed');
    } catch (error) {
      this.outputChannel.appendLine(`Error in handleCommentOperation: ${String(error)}`);
      console.error('Comment operation error:', error);
    }
  }

  private async updateTextDocument(document: vscode.TextDocument, newContent: string): Promise<void> {
    // Skip update if content hasn't actually changed
    if (this.lastWebviewContent === newContent) {
      logger.debug('Skipping document update - content unchanged');
      return;
    }


    this.updatingFromWebview = true;
    this.lastWebviewContent = newContent;
    // Clear the last sent to webview so we can send updates back
    this.lastSentToWebview = null;

    try {
      const edit = new vscode.WorkspaceEdit();

      // Replace the entire document content
      const lastLine = document.lineCount - 1;
      const lastChar = document.lineAt(lastLine).text.length;
      edit.replace(document.uri, new vscode.Range(0, 0, lastLine, lastChar), newContent);

      await vscode.workspace.applyEdit(edit);
    } finally {
      // Add a small delay before resetting the flag to handle any async propagation
      setTimeout(() => {
        this.updatingFromWebview = false;
      }, 50);
    }
  }

  private sendContentToWebview(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel): void {
    // Get document content, with special handling for untitled documents
    let content = document.getText();

    // For untitled documents, provide welcome content if empty
    if (document.uri.scheme === 'untitled' && content.trim() === '') {
      content = '# Welcome to Markdown Docs!\n\n';
    }

    this.outputChannel.appendLine(
      `sendContentToWebview called with content length: ${content.length}, ` +
        `panel active: ${String(webviewPanel.active)}`,
    );
    logger.info(
      'sendContentToWebview called with content length:',
      content.length,
      'panel active:',
      webviewPanel.active,
    );

    // Prevent echo - don't send the same content back that we just received
    if (this.lastSentToWebview === content) {
      this.outputChannel.appendLine('BLOCKED: Skipping webview update - content unchanged');
      return;
    }

    this.lastSentToWebview = content;

    // Preprocess content when sending to webview (escape angle brackets for safe rendering)
    const displayContent = preprocessAngleBrackets(content);

    const message = {
      command: 'update',
      content: displayContent,
      type: 'init',
      theme: vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark ? 'dark' : 'light',
      editorConfig: this.getEditorConfig(),
    };

    this.outputChannel.appendLine(`Sending 'update' message to webview with content length: ${displayContent.length}`);
    void webviewPanel.webview.postMessage(message);
  }

  private getWebviewContent(webview: vscode.Webview, uri: vscode.Uri): string {
    const toUri = (f: string): vscode.Uri => webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, f));

    const baseHref = `${path.dirname(webview.asWebviewUri(uri).toString())}/`;

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
  <link href="${styleUri.toString()}" rel="stylesheet">
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
  <script type="module" nonce="${nonce}" src="${scriptUri.toString()}"></script>
</body>
</html>`;
  }
}

// Angle bracket preprocessing functions
function isInInlineCode(text: string, position: number): boolean {
  const beforeText = text.substring(0, position);
  const backticksBefore = (beforeText.match(/`/g) ?? []).length;
  return backticksBefore % 2 === 1;
}

function isInCodeBlock(text: string, position: number): boolean {
  const beforeText = text.substring(0, position);

  const codeBlockStart = /```/g;
  let inCodeBlock = false;

  codeBlockStart.lastIndex = 0;
  while (codeBlockStart.exec(beforeText) !== null) {
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
        result += `\\${char}`;
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
  const result = markdown.replace(/\{\{([^}]*)\}\}/g, (match, content) => {
    // Remove backslash escaping from underscores within curly braces
    const unescapedContent = (content as string).replace(/\\_/g, '_');
    return `{{${unescapedContent}}}`;
  });

  // Then remove backslash escaping from < characters (we no longer escape >)
  return result.replace(/\\</g, '<');
}

export function activate(context: vscode.ExtensionContext): void {
  // Create output channel for debugging
  const outputChannel = vscode.window.createOutputChannel('Markdown Docs Debug');
  outputChannel.appendLine('Markdown Docs extension activating with CustomTextEditorProvider...');

  logger.info('Markdown Docs extension activating with CustomTextEditorProvider...');

  // Register the custom text editor provider
  const provider = new MarkdownTextEditorProvider(context, outputChannel);
  outputChannel.appendLine('Registering custom text editor provider for markdown-docs.editor');

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider('markdown-docs.editor', provider, {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
    }),
  );

  outputChannel.appendLine('Custom text editor provider registered successfully');

  // Keep the old commands for backward compatibility and manual opening
  context.subscriptions.push(
    vscode.commands.registerCommand('markdown-docs.openEditor', async (uri?: vscode.Uri) => {
      if (uri) {
        // Open the file with our custom editor
        await vscode.commands.executeCommand('vscode.openWith', uri, 'markdown-docs.editor');
      } else if (vscode.window.activeTextEditor) {
        // Use current file
        const currentUri = vscode.window.activeTextEditor.document.uri;
        if (currentUri.scheme === 'file' && currentUri.fsPath.endsWith('.md')) {
          await vscode.commands.executeCommand('vscode.openWith', currentUri, 'markdown-docs.editor');
        } else {
          void vscode.window.showErrorMessage('Please select a markdown file to open with Markdown Docs');
        }
      } else {
        void vscode.window.showErrorMessage('No markdown file selected');
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('markdown-docs.openStandalone', async () => {
      // Create untitled document - VS Code will handle this properly with CustomTextEditorProvider
      const untitledUri = vscode.Uri.parse('untitled:Untitled-1.md');

      // Open with our custom editor
      await vscode.commands.executeCommand('vscode.openWith', untitledUri, 'markdown-docs.editor');
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('markdown-docs.openWithTextEditor', async (uri?: vscode.Uri) => {
      if (uri) {
        // Force open with the built-in text editor
        await vscode.commands.executeCommand('vscode.openWith', uri, 'default');
      } else if (vscode.window.activeTextEditor) {
        // Use current file
        const currentUri = vscode.window.activeTextEditor.document.uri;
        if (currentUri.scheme === 'file' && currentUri.fsPath.endsWith('.md')) {
          await vscode.commands.executeCommand('vscode.openWith', currentUri, 'default');
        } else {
          void vscode.window.showErrorMessage('Please select a markdown file to open with the text editor');
        }
      } else {
        void vscode.window.showErrorMessage('No markdown file selected');
      }
    }),
  );

  // Command to set user interaction state from webview
  context.subscriptions.push(
    vscode.commands.registerCommand('markdown-docs.setUserInteracting', (uri: vscode.Uri, isInteracting: boolean) => {
      const fileUri = uri.toString();
      if (isInteracting) {
        userInteractionRegistry.add(fileUri);
      } else {
        userInteractionRegistry.delete(fileUri);
      }
    }),
  );

  logger.info('Markdown Docs extension activated successfully');
}

export function deactivate(): void {
  // Extension cleanup code would go here if needed
  logger.info('Markdown Docs extension deactivated');
}
