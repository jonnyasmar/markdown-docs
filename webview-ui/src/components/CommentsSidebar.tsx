import { CommentWithAnchor } from '@/types';
import { JSX } from 'react';

interface CommentsSidebarProps {
  sidebarWidth: number;
  setShowCommentSidebar: (show: boolean) => void;
  parsedComments: CommentWithAnchor[];
  sortedCommentItems: JSX.Element[];
}

export const CommentsSidebar = ({
  sidebarWidth,
  setShowCommentSidebar,
  parsedComments,
  sortedCommentItems,
}: CommentsSidebarProps) => {
  return (
    <div className="comments-sidebar" style={{ width: `${sidebarWidth}px` }}>
      <div className="sidebar-resize-handle"></div>
      <div className="comments-header">
        <h3>Comments</h3>
        <button onClick={() => setShowCommentSidebar(false)} className="sidebar-close" title="Hide Comments">
          ✕
        </button>
      </div>

      <div className="comments-list">
        {parsedComments.length === 0 ? (
          <div className="no-comments">
            <p>No comments yet.</p>
            <p className="help-text">Select text and click the 💬 Add comment button to add comments.</p>
          </div>
        ) : (
          sortedCommentItems
        )}
      </div>
    </div>
  );
};
