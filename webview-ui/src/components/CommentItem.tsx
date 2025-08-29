import React from 'react';
import { CommentWithAnchor } from '../types';
import './CommentItem.css';

interface CommentItemProps {
    comment: CommentWithAnchor;
    onNavigate: (commentId: string) => void;
    onEdit: (commentId: string) => void;
    onDelete: (commentId: string) => void;
}

export function CommentItem({ comment, onNavigate, onEdit, onDelete }: CommentItemProps) {
    const formatDate = (timestamp: string) => {
        return new Date(timestamp).toLocaleString();
    };

    return (
        <div className="comment-item">
            <div className="comment-header">
                <span className="comment-author">{comment.author}</span>
                <span className="comment-date">{formatDate(comment.timestamp)}</span>
            </div>

            <div className="comment-content">
                {comment.content}
            </div>

            <div className="comment-anchor">
                <strong>Anchored text:</strong> "{comment.anchoredText}"
            </div>

            <div className="comment-actions" style={{ textAlign: 'right' }}>
                <button
                    className="btn btn-danger"
                    onClick={() => onDelete(comment.id)}
                    title="Delete comment"
                >
                    Delete
                </button>
                <button
                    className="btn btn-secondary"
                    onClick={() => onEdit(comment.id)}
                    title="Edit comment"
                >
                    Edit
                </button>
                <button
                    className="btn btn-primary"
                    onClick={() => onNavigate(comment.id)}
                    title="Go to comment in editor"
                >
                    Go to
                </button>
            </div>
        </div>
    );
}