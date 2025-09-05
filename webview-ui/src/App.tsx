import React, { useEffect, useState } from 'react';

import './App.css';
import { CommentList } from './components/ui/comments/CommentList';
import { CommentWithAnchor, VSCodeAPI, WebviewMessage } from './types';
import { logger } from './utils/logger';

// VS Code API for webview - use pre-acquired API
// (Window type is already declared in types.ts)

// Use ONLY the pre-acquired VS Code API from HTML template
let vscode: VSCodeAPI | undefined;
if (typeof window !== 'undefined' && window.vscodeApi) {
  vscode = window.vscodeApi;
  // Debug: VS Code API availability
  // logger.debug('App.tsx using pre-acquired VS Code API:', !!vscode);
} else {
  console.error('App.tsx: Pre-acquired VS Code API not found on window.vscodeApi');
}

function App() {
  const [comments, setComments] = useState<CommentWithAnchor[]>([]);

  useEffect(() => {
    // Listen for messages from the extension
    const handleMessage = (event: MessageEvent<WebviewMessage>) => {
      const message = event.data;

      switch (message.type) {
        case 'updateComments':
          setComments(message.comments ?? []);
          break;
        case 'hello':
          logger.debug('Received hello from extension:', message.message);
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    // Request initial data
    vscode?.postMessage({ command: 'requestComments' });

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const handleNavigateToComment = (commentId: string) => {
    vscode?.postMessage({
      command: 'navigateToComment',
      commentId,
    });
  };

  const handleEditComment = (commentId: string) => {
    vscode?.postMessage({
      command: 'editComment',
      commentId,
    });
  };

  const handleDeleteComment = (commentId: string) => {
    vscode?.postMessage({
      command: 'deleteComment',
      commentId,
    });
  };

  return (
    <div className="app">
      <CommentList
        comments={comments}
        onNavigate={handleNavigateToComment}
        onEdit={handleEditComment}
        onDelete={handleDeleteComment}
      />
    </div>
  );
}

export default App;
