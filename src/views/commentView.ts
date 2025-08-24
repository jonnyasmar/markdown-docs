import * as vscode from 'vscode';
import * as path from 'path';
import { DocumentParserService } from '../services/documentParser';
import { CommentService } from '../services/comment';

/**
 * Provider for the comment management webview panel.
 * Handles the React-based UI for displaying and managing comments.
 */
export class CommentViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'aiDocReviewer.commentView';
    
    private _view?: vscode.WebviewView;
    
    constructor(private readonly _extensionUri: vscode.Uri) {}
    
    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;
        
        webviewView.webview.options = {
            // Allow scripts in the webview
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri
            ]
        };
        
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        
        // Set up message passing between webview and extension
        webviewView.webview.onDidReceiveMessage(
            message => {
                switch (message.type) {
                    case 'requestComments':
                        this._updateComments();
                        break;
                    case 'navigateToComment':
                        this._navigateToComment(message.commentId);
                        break;
                    case 'editComment':
                        this._editComment(message.commentId);
                        break;
                    case 'deleteComment':
                        this._deleteComment(message.commentId);
                        break;
                    case 'hello':
                        vscode.window.showInformationMessage('Hello from webview!');
                        break;
                }
            },
            undefined,
            []
        );
        
        // Listen for active editor changes to update comments
        vscode.window.onDidChangeActiveTextEditor(() => {
            this._updateComments();
        });
        
        // Listen for document changes to update comments
        vscode.workspace.onDidChangeTextDocument(event => {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor && event.document === activeEditor.document) {
                this._updateComments();
            }
        });
        
        // Send initial data
        this._updateComments();
    }
    
    /**
     * Posts a message to the webview.
     * @param message Message to send
     */
    private _postMessage(message: any) {
        if (this._view) {
            this._view.webview.postMessage(message);
        }
    }
    
    /**
     * Updates the comments displayed in the webview by parsing the active document.
     */
    private _updateComments() {
        const activeEditor = vscode.window.activeTextEditor;
        
        if (!activeEditor || activeEditor.document.languageId !== 'markdown') {
            this._postMessage({ type: 'updateComments', comments: [] });
            return;
        }
        
        const documentContent = activeEditor.document.getText();
        const comments = DocumentParserService.parseDocumentComments(documentContent);
        
        this._postMessage({ type: 'updateComments', comments });
    }
    
    /**
     * Navigates to a specific comment in the editor.
     * @param commentId ID of the comment to navigate to
     */
    private _navigateToComment(commentId: string) {
        const activeEditor = vscode.window.activeTextEditor;
        
        if (!activeEditor || activeEditor.document.languageId !== 'markdown') {
            return;
        }
        
        const documentContent = activeEditor.document.getText();
        const comment = DocumentParserService.findCommentById(documentContent, commentId);
        
        if (comment) {
            const startPosition = activeEditor.document.positionAt(comment.startPosition);
            const endPosition = activeEditor.document.positionAt(comment.endPosition);
            const range = new vscode.Range(startPosition, endPosition);
            
            // Reveal and select the range
            activeEditor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
            activeEditor.selection = new vscode.Selection(startPosition, endPosition);
        }
    }
    
    /**
     * Initiates editing of a comment.
     * @param commentId ID of the comment to edit
     */
    private async _editComment(commentId: string) {
        const activeEditor = vscode.window.activeTextEditor;
        
        if (!activeEditor || activeEditor.document.languageId !== 'markdown') {
            return;
        }
        
        await CommentService.editComment(activeEditor, commentId);
    }
    
    /**
     * Deletes a comment.
     * @param commentId ID of the comment to delete
     */
    private async _deleteComment(commentId: string) {
        const activeEditor = vscode.window.activeTextEditor;
        
        if (!activeEditor || activeEditor.document.languageId !== 'markdown') {
            return;
        }
        
        await CommentService.deleteComment(activeEditor, commentId);
    }
    
    /**
     * Generates the HTML content for the webview.
     * @param webview The webview instance
     * @returns HTML string
     */
    private _getHtmlForWebview(webview: vscode.Webview) {
        // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview-ui', 'index.js'));
        const stylesUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview-ui', 'index.css'));
        
        // Use a nonce to only allow a specific script to be run.
        const nonce = getNonce();
        
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <!--
                    Use a content security policy to only allow loading images from https or from our extension directory,
                    and only allow scripts that have a specific nonce.
                -->
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${stylesUri}" rel="stylesheet">
                <title>Markdown Docs</title>
            </head>
            <body>
                <div id="root"></div>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}