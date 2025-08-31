import React, { useRef, useState } from 'react';

import './CommentModal.css';

interface CommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (comment: string) => void;
  selectedText?: string;
  initialText?: string;
  isEditing?: boolean;
}

export const CommentModal: React.FC<CommentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  selectedText,
  initialText,
  isEditing = false,
}) => {
  const [commentText, setCommentText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Set initial text when modal opens
  React.useEffect(() => {
    if (isOpen && initialText) {
      setCommentText(initialText);
    } else if (isOpen && !initialText) {
      setCommentText('');
    }
  }, [isOpen, initialText]);

  const handleSubmit = () => {
    if (commentText.trim()) {
      onSubmit(commentText);
      setCommentText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="comment-modal-overlay">
      <div
        className="comment-modal-content"
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        onMouseUp={e => e.stopPropagation()}
      >
        <div className="comment-modal-header">
          <h3>{isEditing ? 'Edit Comment' : 'Add Comment'}</h3>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        {selectedText && (
          <div className="selected-text-display">
            <strong>Selected text:</strong>
            <div className="selected-text-content">"{selectedText}"</div>
          </div>
        )}

        <div className="comment-modal-body">
          <textarea
            ref={textareaRef}
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            onKeyDown={handleKeyDown}
            onMouseDown={e => e.stopPropagation()}
            onMouseUp={e => e.stopPropagation()}
            onFocus={e => e.stopPropagation()}
            placeholder="Enter your comment..."
            rows={4}
            autoFocus
          />
        </div>

        <div className="comment-modal-footer">
          <button onClick={onClose} className="cancel-button">
            Cancel
          </button>
          <button onClick={handleSubmit} className="submit-button" disabled={!commentText.trim()}>
            {isEditing ? 'Edit Comment' : 'Add Comment'}
          </button>
        </div>
      </div>
    </div>
  );
};
