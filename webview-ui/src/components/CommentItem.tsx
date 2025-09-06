import { CommentWithAnchor } from '@/types';
import React from 'react';

import './CommentItem.css';

interface CommentItemProps {
  comment: CommentWithAnchor;
  isFocused: boolean;
  onCommentClick: (id: string) => void;
  onDeleteComment: (id: string) => void;
  onEditComment: (id: string) => void;
}

export const CommentItem = React.memo(
  ({ comment, isFocused, onCommentClick, onDeleteComment, onEditComment }: CommentItemProps) => (
    <div
      className={`comment-item ${isFocused ? 'focused' : ''}`}
      data-comment-id={comment.id}
      onClick={() => onCommentClick(comment.id)}
      style={{ cursor: 'pointer' }}
    >
      <div className="comment-content">{comment.content}</div>
      <div className="comment-anchor">On: "{comment.anchoredText?.substring(0, 50) ?? 'Selected text'}..."</div>
      <div className="comment-actions">
        <button
          onClick={() => onDeleteComment(comment.id)}
          className="comment-action-btn delete"
          title="Delete this comment"
        >
          Delete
        </button>
        <button onClick={() => onEditComment(comment.id)} className="comment-action-btn" title="Edit this comment">
          Edit
        </button>
      </div>
    </div>
  ),
);
