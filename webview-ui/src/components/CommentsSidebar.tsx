import { CommentWithAnchor } from '@/types';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { JSX } from 'react';

interface CommentsSidebarProps {
  sidebarWidth: number;
  setShowCommentSidebar: (show: boolean) => void;
  parsedComments: CommentWithAnchor[];
  sortedCommentItems: JSX.Element[];
  focusedCommentId: string | null;
  onNavigateToPrevComment: () => void;
  onNavigateToNextComment: () => void;
}

export const CommentsSidebar = ({
  sidebarWidth,
  setShowCommentSidebar,
  parsedComments,
  sortedCommentItems,
  focusedCommentId,
  onNavigateToPrevComment,
  onNavigateToNextComment,
}: CommentsSidebarProps) => {
  return (
    <div className="comments-sidebar" style={{ width: `${sidebarWidth}px` }}>
      <div className="sidebar-resize-handle"></div>
      <div className="comments-header">
        <h3>Comments ({parsedComments.length})</h3>
        <div className="comment-navigation">
          <button
            onClick={onNavigateToPrevComment}
            className="nav-button"
            title="Previous Comment"
            disabled={parsedComments.length === 0}
          >
            <ChevronUp size={16} />
          </button>
          <button
            onClick={onNavigateToNextComment}
            className="nav-button"
            title="Next Comment"
            disabled={parsedComments.length === 0}
          >
            <ChevronDown size={16} />
          </button>
        </div>
        <div className="comment-close-wrapper">
          <button onClick={() => setShowCommentSidebar(false)} className="sidebar-close" title="Hide Comments">
            ✕
          </button>
        </div>
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
