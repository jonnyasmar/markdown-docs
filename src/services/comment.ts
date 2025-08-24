import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import { Comment, CommentFrontmatter } from '../common/types';
import { FrontmatterService } from './frontmatter';
import { AnchorService } from './anchor';

/**
 * Service for managing comment creation, editing, and deletion.
 * Orchestrates frontmatter and anchor services to provide comment functionality.
 */
export class CommentService {
    
    /**
     * Creates a new comment on the selected text in the active editor.
     * @param editor The active text editor
     */
    public static async addComment(editor: vscode.TextEditor): Promise<void> {
        const selection = editor.selection;
        
        if (selection.isEmpty) {
            vscode.window.showWarningMessage('Please select text to comment on.');
            return;
        }
        
        const selectedText = editor.document.getText(selection);
        
        // Prompt user for comment content
        const commentContent = await vscode.window.showInputBox({
            prompt: 'Enter your comment',
            placeHolder: 'Type your comment here...'
        });
        
        if (!commentContent) {
            return; // User cancelled
        }
        
        try {
            // Generate unique ID for the comment
            const commentId = uuidv4();
            
            // Get current document content
            const documentContent = editor.document.getText();
            
            // Parse existing frontmatter
            const currentFrontmatter = FrontmatterService.parse(documentContent);
            
            // Create new comment object
            const newComment: Comment = {
                id: commentId,
                author: 'User', // TODO: Get from VS Code settings or Git config
                timestamp: new Date().toISOString(),
                content: commentContent
            };
            
            // Add comment to frontmatter
            const updatedFrontmatter: CommentFrontmatter = {
                ...currentFrontmatter,
                aiDocReviewerComments: [...currentFrontmatter.aiDocReviewerComments, newComment]
            };
            
            // Calculate selection indices in the document
            const document = editor.document;
            const startOffset = document.offsetAt(selection.start);
            const endOffset = document.offsetAt(selection.end);
            
            // Wrap selection with anchor tags in document body
            const wrappedContent = AnchorService.wrapSelection(
                documentContent,
                { start: startOffset, end: endOffset },
                commentId
            );
            
            // Update frontmatter in the wrapped content
            const finalContent = FrontmatterService.stringify(wrappedContent, updatedFrontmatter);
            
            // Apply the changes to the editor
            await editor.edit(editBuilder => {
                const fullRange = new vscode.Range(
                    document.positionAt(0),
                    document.positionAt(documentContent.length)
                );
                editBuilder.replace(fullRange, finalContent);
            });
            
            vscode.window.showInformationMessage('Comment added successfully!');
            
        } catch (error) {
            console.error('Error adding comment:', error);
            vscode.window.showErrorMessage(`Failed to add comment: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    /**
     * Gets the current user's name for comment authorship.
     * First tries VS Code settings, then Git config, then defaults to 'User'.
     * @returns The user's name
     */
    private static async getUserName(): Promise<string> {
        // Try to get from VS Code settings
        const config = vscode.workspace.getConfiguration('aiDocReviewer');
        let userName = config.get<string>('defaultAuthor');
        
        if (userName) {
            return userName;
        }
        
        // Try to get from Git config
        try {
            const gitConfig = await vscode.workspace.getConfiguration('git');
            userName = gitConfig.get<string>('defaultAuthor');
            if (userName) {
                return userName;
            }
        } catch (error) {
            // Git config not available
        }
        
        // Default fallback
        return 'User';
    }
    
    /**
     * Deletes a comment from the active editor.
     * @param editor The active text editor
     * @param commentId ID of the comment to delete
     */
    public static async deleteComment(editor: vscode.TextEditor, commentId: string): Promise<void> {
        try {
            // Get current document content
            const documentContent = editor.document.getText();
            
            // Parse existing frontmatter and anchors
            const currentFrontmatter = FrontmatterService.parse(documentContent);
            const anchors = AnchorService.findAllAnchors(documentContent);
            
            // Check if comment exists
            const commentExists = currentFrontmatter.aiDocReviewerComments.some(c => c.id === commentId);
            if (!commentExists) {
                vscode.window.showWarningMessage(`Comment with ID ${commentId} not found.`);
                return;
            }
            
            const anchorExists = anchors.some(anchor => anchor.id === commentId);
            if (!anchorExists) {
                vscode.window.showWarningMessage(`Anchor for comment ${commentId} not found in document.`);
                return;
            }
            
            // Confirm deletion
            const confirmation = await vscode.window.showWarningMessage(
                'Are you sure you want to delete this comment?',
                { modal: true },
                'Delete',
                'Cancel'
            );
            
            if (confirmation !== 'Delete') {
                return;
            }
            
            // Remove comment from frontmatter
            const updatedFrontmatter = {
                ...currentFrontmatter,
                aiDocReviewerComments: currentFrontmatter.aiDocReviewerComments.filter(c => c.id !== commentId)
            };
            
            // Remove anchor from document
            const contentWithoutAnchor = AnchorService.removeAnchor(documentContent, commentId);
            
            // Update frontmatter in the document without anchor
            const finalContent = FrontmatterService.stringify(contentWithoutAnchor, updatedFrontmatter);
            
            // Apply the changes to the editor
            await editor.edit(editBuilder => {
                const fullRange = new vscode.Range(
                    editor.document.positionAt(0),
                    editor.document.positionAt(documentContent.length)
                );
                editBuilder.replace(fullRange, finalContent);
            });
            
            vscode.window.showInformationMessage('Comment deleted successfully!');
            
        } catch (error) {
            console.error('Error deleting comment:', error);
            vscode.window.showErrorMessage(`Failed to delete comment: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    /**
     * Edits an existing comment in the active editor.
     * @param editor The active text editor
     * @param commentId ID of the comment to edit
     */
    public static async editComment(editor: vscode.TextEditor, commentId: string): Promise<void> {
        try {
            // Get current document content
            const documentContent = editor.document.getText();
            
            // Parse existing frontmatter
            const currentFrontmatter = FrontmatterService.parse(documentContent);
            
            // Find the comment to edit
            const commentToEdit = currentFrontmatter.aiDocReviewerComments.find(c => c.id === commentId);
            if (!commentToEdit) {
                vscode.window.showWarningMessage(`Comment with ID ${commentId} not found.`);
                return;
            }
            
            // Prompt user for new comment content
            const newContent = await vscode.window.showInputBox({
                prompt: 'Edit your comment',
                placeHolder: 'Type your updated comment here...',
                value: commentToEdit.content
            });
            
            if (newContent === undefined) {
                return; // User cancelled
            }
            
            if (newContent === commentToEdit.content) {
                vscode.window.showInformationMessage('No changes made to comment.');
                return;
            }
            
            // Update the comment in frontmatter
            const updatedFrontmatter = {
                ...currentFrontmatter,
                aiDocReviewerComments: currentFrontmatter.aiDocReviewerComments.map(comment => 
                    comment.id === commentId 
                        ? { ...comment, content: newContent, timestamp: new Date().toISOString() }
                        : comment
                )
            };
            
            // Update frontmatter in the document
            const finalContent = FrontmatterService.stringify(documentContent, updatedFrontmatter);
            
            // Apply the changes to the editor
            await editor.edit(editBuilder => {
                const fullRange = new vscode.Range(
                    editor.document.positionAt(0),
                    editor.document.positionAt(documentContent.length)
                );
                editBuilder.replace(fullRange, finalContent);
            });
            
            vscode.window.showInformationMessage('Comment updated successfully!');
            
        } catch (error) {
            console.error('Error editing comment:', error);
            vscode.window.showErrorMessage(`Failed to edit comment: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}