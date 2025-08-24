import React, { useState, useRef, useEffect } from 'react';
import { CommentList } from './CommentList';
import { CommentWithAnchor } from '../types';
import './RichTextEditor.css';

interface RichTextEditorProps {
  content: string;
  onContentChange: (content: string) => void;
  onFormat: (format: string, range: { start: number, end: number }) => void;
  onAddComment: (range: { start: number, end: number }, comment: string) => void;
  comments?: CommentWithAnchor[];
  onNavigateToComment?: (commentId: string) => void;
  onEditComment?: (commentId: string) => void;
  onDeleteComment?: (commentId: string) => void;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  content,
  onContentChange,
  onFormat,
  onAddComment,
  comments = [],
  onNavigateToComment,
  onEditComment,
  onDeleteComment
}) => {
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [selectedRange, setSelectedRange] = useState<{ start: number, end: number } | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const handleFormat = (format: string) => {
    const selection = window.getSelection();
    if (selection && selection.toString() && editorRef.current) {
      const range = selection.getRangeAt(0);
      const startOffset = getTextOffset(editorRef.current, range.startContainer, range.startOffset);
      const endOffset = getTextOffset(editorRef.current, range.endContainer, range.endOffset);
      
      onFormat(format, { start: startOffset, end: endOffset });
    }
  };

  const handleAddComment = () => {
    const selection = window.getSelection();
    if (selection && selection.toString() && editorRef.current) {
      const range = selection.getRangeAt(0);
      const startOffset = getTextOffset(editorRef.current, range.startContainer, range.startOffset);
      const endOffset = getTextOffset(editorRef.current, range.endContainer, range.endOffset);
      
      setSelectedRange({ start: startOffset, end: endOffset });
      setShowCommentDialog(true);
    }
  };

  const submitComment = () => {
    if (selectedRange && commentText.trim()) {
      onAddComment(selectedRange, commentText);
      setShowCommentDialog(false);
      setCommentText('');
      setSelectedRange(null);
    }
  };

  const getTextOffset = (root: Element, node: Node, offset: number): number => {
    let textOffset = 0;
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT
    );

    let currentNode;
    while (currentNode = walker.nextNode()) {
      if (currentNode === node) {
        return textOffset + offset;
      }
      textOffset += currentNode.textContent?.length || 0;
    }
    return textOffset;
  };

  useEffect(() => {
    if (editorRef.current && editorRef.current.textContent !== content) {
      editorRef.current.textContent = content;
    }
  }, [content]);

  return (
    <div className="rich-text-editor">
      <div className="toolbar">
        <button onClick={() => handleFormat('bold')} className="toolbar-btn" title="Bold">
          <strong>B</strong>
        </button>
        <button onClick={() => handleFormat('italic')} className="toolbar-btn" title="Italic">
          <em>I</em>
        </button>
        <button onClick={() => handleFormat('header')} className="toolbar-btn" title="Header">
          H
        </button>
        <div className="toolbar-separator"></div>
        <button onClick={handleAddComment} className="toolbar-btn comment-btn" title="Add Comment">
          💬
        </button>
      </div>

      <div className="editor-layout">
        <div
          ref={editorRef}
          className="editor-content"
          contentEditable
          suppressContentEditableWarning={true}
          onInput={(e) => {
            const target = e.target as HTMLDivElement;
            onContentChange(target.textContent || '');
          }}
          onMouseUp={() => {
            const selection = window.getSelection();
            if (selection && selection.toString()) {
              // Show contextual comment button
              const range = selection.getRangeAt(0);
              const rect = range.getBoundingClientRect();
              // You could show a floating comment button here
            }
          }}
        />
        
        <div className="comments-sidebar">
          <h3>Comments</h3>
          <CommentList
            comments={comments}
            onNavigate={onNavigateToComment || (() => {})}
            onEdit={onEditComment || (() => {})}
            onDelete={onDeleteComment || (() => {})}
          />
        </div>
      </div>

      {showCommentDialog && (
        <div className="comment-dialog-overlay">
          <div className="comment-dialog">
            <h3>Add Comment</h3>
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Enter your comment..."
              rows={4}
            />
            <div className="comment-dialog-actions">
              <button onClick={submitComment} disabled={!commentText.trim()}>
                Add Comment
              </button>
              <button onClick={() => {
                setShowCommentDialog(false);
                setCommentText('');
                setSelectedRange(null);
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