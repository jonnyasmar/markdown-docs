import React from 'react';

import { useEditorStatus } from '../hooks/useEditorStatus';
import './StatusBar.css';

interface StatusBarProps {
  content: string;
  selectedText?: string;
  viewMode: string;
  isTyping?: boolean;
  editorRef?: React.RefObject<any>;
}

const StatusBar: React.FC<StatusBarProps> = ({ content, selectedText, viewMode, isTyping, editorRef }) => {
  const stats = useEditorStatus(content, selectedText, isTyping, editorRef);

  return (
    <div className="status-bar">
      <div className="status-section">
        <span className="status-item">{stats.wordCount.toLocaleString()} words</span>
        <span className="status-item">{stats.charCount.toLocaleString()} characters</span>
        {stats.readingTime > 0 && <span className="status-item">~{stats.readingTime} min read</span>}
      </div>

      {selectedText && (
        <div className="status-section">
          <span className="status-item selection">{selectedText.length} chars selected</span>
        </div>
      )}

      <div className="status-section">
        <span className="status-item">
          Ln {stats.cursorPosition.line}, Col {stats.cursorPosition.column}
        </span>
        <span className="status-item mode">
          {viewMode === 'rich-text'
            ? 'Rich Text'
            : viewMode === 'source'
              ? 'Source'
              : viewMode === 'diff'
                ? 'Diff'
                : 'Editor'}
        </span>
      </div>
    </div>
  );
};

export default StatusBar;
