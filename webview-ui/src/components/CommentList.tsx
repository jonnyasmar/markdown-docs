import React from 'react';

import { CommentWithAnchor } from '../types';
import { CommentItem } from './CommentItem';
import './CommentList.css';

interface CommentListProps {
  comments: CommentWithAnchor[];
  onNavigate: (commentId: string) => void;
  onEdit: (commentId: string) => void;
  onDelete: (commentId: string) => void;
}

export function CommentList({ comments, onNavigate, onEdit, onDelete }: CommentListProps) {
  if (comments.length === 0) {
    return (
      <div className="comment-list-empty">
        <p>No comments in this document.</p>
        <p>Select text and right-click to add a comment.</p>
      </div>
    );
  }

  return (
    <div className="comment-list">
      <div className="comment-list-header">
        <h3>Comments ({comments.length})</h3>
      </div>

      <div className="comment-list-items">
        {comments.map(comment => (
          <CommentItem key={comment.id} comment={comment} onNavigate={onNavigate} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}
