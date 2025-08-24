import React, { useState, useRef, useEffect, useCallback } from 'react';
import { marked } from 'marked';
import { CommentWithAnchor } from '../types';
import './WYSIWYGEditor.css';

interface WYSIWYGEditorProps {
  markdown: string;
  onMarkdownChange: (markdown: string) => void;
  onAddComment: (range: { start: number, end: number }, comment: string) => void;
  comments?: CommentWithAnchor[];
  onNavigateToComment?: (commentId: string) => void;
  onEditComment?: (commentId: string) => void;
  onDeleteComment?: (commentId: string) => void;
}

export const WYSIWYGEditor: React.FC<WYSIWYGEditorProps> = ({
  markdown,
  onMarkdownChange,
  onAddComment,
  comments = [],
  onNavigateToComment,
  onEditComment,
  onDeleteComment
}) => {
  const [showFloatingButton, setShowFloatingButton] = useState(false);
  const [buttonPosition, setButtonPosition] = useState({ x: 0, y: 0 });
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [selectedRange, setSelectedRange] = useState<Range | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  
  // Configure marked for clean HTML output
  useEffect(() => {
    marked.setOptions({
      breaks: true,
      gfm: true
    });
  }, []);

  // Convert markdown to HTML for display
  const htmlContent = marked(markdown) as string;

  // Handle text selection
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim() && editorRef.current) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const editorRect = editorRef.current.getBoundingClientRect();
      
      setSelectedRange(range);
      setButtonPosition({
        x: rect.right - editorRect.left + 10,
        y: rect.top - editorRect.top
      });
      setShowFloatingButton(true);
    } else {
      setShowFloatingButton(false);
    }
  }, []);

  // Handle document click to hide floating button
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.floating-comment-btn') && 
          !(e.target as Element).closest('.comment-dialog')) {
        setShowFloatingButton(false);
      }
    };
    
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  // Handle formatting commands
  const handleFormat = (command: string) => {
    const selection = window.getSelection();
    if (!selection || !selection.toString()) return;

    const selectedText = selection.toString();
    let formattedText = '';

    switch (command) {
      case 'bold':
        formattedText = `**${selectedText}**`;
        break;
      case 'italic':
        formattedText = `*${selectedText}*`;
        break;
      case 'header':
        formattedText = `## ${selectedText}`;
        break;
      default:
        return;
    }

    // Replace selection in markdown
    const range = selection.getRangeAt(0);
    const textContent = editorRef.current?.textContent || '';
    const startOffset = getTextOffset(range.startContainer, range.startOffset);
    const endOffset = getTextOffset(range.endContainer, range.endOffset);
    
    const newMarkdown = 
      markdown.substring(0, startOffset) + 
      formattedText + 
      markdown.substring(endOffset);
    
    onMarkdownChange(newMarkdown);
  };

  // Get text offset from DOM position
  const getTextOffset = (node: Node, offset: number): number => {
    if (!editorRef.current) return 0;
    
    const walker = document.createTreeWalker(
      editorRef.current,
      NodeFilter.SHOW_TEXT
    );
    
    let currentOffset = 0;
    let currentNode;
    
    while (currentNode = walker.nextNode()) {
      if (currentNode === node) {
        return currentOffset + offset;
      }
      currentOffset += currentNode.textContent?.length || 0;
    }
    
    return currentOffset;
  };

  // Handle content editing
  const handleInput = () => {
    if (editorRef.current) {
      // For now, just get plain text - we'd need more complex parsing 
      // to convert HTML back to markdown properly
      const text = editorRef.current.innerText || '';
      onMarkdownChange(text);
    }
  };

  // Handle comment creation
  const handleCreateComment = () => {
    if (selectedRange && commentText.trim()) {
      const startOffset = getTextOffset(selectedRange.startContainer, selectedRange.startOffset);
      const endOffset = getTextOffset(selectedRange.endContainer, selectedRange.endOffset);
      
      onAddComment({ start: startOffset, end: endOffset }, commentText);
      setShowCommentDialog(false);
      setCommentText('');
      setSelectedRange(null);
      setShowFloatingButton(false);
    }
  };

  return (
    <div className="wysiwyg-editor">
      {/* Formatting Toolbar */}
      <div className="editor-toolbar">
        <button 
          className="toolbar-btn" 
          onClick={() => handleFormat('bold')}
          title="Bold"
        >
          <strong>B</strong>
        </button>
        <button 
          className="toolbar-btn" 
          onClick={() => handleFormat('italic')}
          title="Italic"
        >
          <em>I</em>
        </button>
        <button 
          className="toolbar-btn" 
          onClick={() => handleFormat('header')}
          title="Header"
        >
          H
        </button>
      </div>

      <div className="editor-container">
        {/* Main Editor */}
        <div className="editor-main">
          <div
            ref={editorRef}
            className="rich-content"
            contentEditable
            suppressContentEditableWarning={true}
            dangerouslySetInnerHTML={{ __html: htmlContent }}
            onInput={handleInput}
            onMouseUp={handleMouseUp}
          />

          {/* Floating Comment Button */}
          {showFloatingButton && (
            <button
              className="floating-comment-btn"
              style={{ 
                left: buttonPosition.x, 
                top: buttonPosition.y 
              }}
              onClick={() => setShowCommentDialog(true)}
            >
              💬
            </button>
          )}
        </div>

        {/* Comments Sidebar */}
        <div className="comments-panel">
          <h3>Comments</h3>
          {comments.length === 0 ? (
            <p className="no-comments">No comments yet</p>
          ) : (
            comments.map(comment => (
              <div key={comment.id} className="comment-item">
                <div className="comment-content">{comment.content}</div>
                <div className="comment-actions">
                  <button onClick={() => onNavigateToComment?.(comment.id)}>
                    Go to
                  </button>
                  <button onClick={() => onEditComment?.(comment.id)}>
                    Edit
                  </button>
                  <button onClick={() => onDeleteComment?.(comment.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Comment Dialog */}
      {showCommentDialog && (
        <div className="comment-dialog-overlay">
          <div className="comment-dialog">
            <h3>Add Comment</h3>
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Enter your comment..."
              rows={4}
              autoFocus
            />
            <div className="dialog-actions">
              <button 
                onClick={handleCreateComment}
                disabled={!commentText.trim()}
              >
                Add Comment
              </button>
              <button onClick={() => {
                setShowCommentDialog(false);
                setCommentText('');
                setShowFloatingButton(false);
              }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};