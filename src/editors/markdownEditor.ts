import * as vscode from 'vscode';
import { logger } from '../utils/logger';

export class MarkdownEditorProvider implements vscode.CustomTextEditorProvider {
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new MarkdownEditorProvider(context);
    const providerRegistration = vscode.window.registerCustomEditorProvider(
      MarkdownEditorProvider.viewType,
      provider,
    );
    return providerRegistration;
  }

  private static readonly viewType = 'markdown-docs.editor';

  constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
    };

    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    function updateWebview() {
      webviewPanel.webview.postMessage({
        type: 'update',
        content: document.getText(),
      });
    }

    // Hook up event handlers so that we can synchronize the webview with the text document
    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.uri.toString() === document.uri.toString()) {
        updateWebview();
      }
    });

    // Make sure we get rid of the listener when our editor is closed
    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
    });

    // Receive message from the webview
    webviewPanel.webview.onDidReceiveMessage(e => {
      switch (e.type) {
        case 'edit':
          this.updateTextDocument(document, e.content);
          return;
        case 'addComment':
          this.addComment(document, e.range, e.comment);
          return;
        case 'navigateToComment':
          this.navigateToComment(document, e.commentId);
          return;
        case 'editComment':
          this.editComment(document, e.commentId);
          return;
        case 'deleteComment':
          this.deleteComment(document, e.commentId);
                    
      }
    });

    updateWebview();
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(
      this.context.extensionUri, 'dist', 'webview-ui', 'index.js',
    ));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(
      this.context.extensionUri, 'dist', 'webview-ui', 'index.css',
    ));

    return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleUri}" rel="stylesheet">
                <title>Markdown Docs Editor</title>
            </head>
            <body>
                <div id="editor-root"></div>
                <script src="${scriptUri}"></script>
            </body>
            </html>
        `;
  }

  private updateTextDocument(document: vscode.TextDocument, content: string) {
    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      document.uri,
      new vscode.Range(0, 0, document.lineCount, 0),
      content,
    );
    return vscode.workspace.applyEdit(edit);
  }

  private navigateToComment(document: vscode.TextDocument, commentId: string) {
    // TODO: Implement comment navigation
    logger.debug('Navigate to comment:', commentId);
  }

  private editComment(document: vscode.TextDocument, commentId: string) {
    // TODO: Implement comment editing
    logger.debug('Edit comment:', commentId);
  }

  private deleteComment(document: vscode.TextDocument, commentId: string) {
    // TODO: Implement comment deletion
    logger.debug('Delete comment:', commentId);
  }

  private addComment(document: vscode.TextDocument, range: { start: number, end: number }, comment: string) {
    // This would integrate with your comment system
    // For now, just log the comment
    logger.debug('Adding comment:', comment, 'at range:', range);
  }
}