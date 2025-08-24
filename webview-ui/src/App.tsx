import React, { useState, useEffect } from 'react';
import { CommentWithAnchor, WebviewMessage } from './types';
import { CommentList } from './components/CommentList';
import './App.css';

// VS Code API for webview - use pre-acquired API
declare global {
  interface Window {
    vscodeApi?: any;
  }
}

// Use ONLY the pre-acquired VS Code API from HTML template
let vscode: any;
if (typeof window !== 'undefined' && window.vscodeApi) {
  vscode = window.vscodeApi;
  console.log('App.tsx using pre-acquired VS Code API:', !!vscode);
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
          setComments(message.comments || []);
          break;
        case 'hello':
          console.log('Received hello from extension:', message.message);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Request initial data
    vscode.postMessage({ type: 'requestComments' });

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const handleNavigateToComment = (commentId: string) => {
    vscode.postMessage({ 
      type: 'navigateToComment', 
      commentId 
    });
  };

  const handleEditComment = (commentId: string) => {
    vscode.postMessage({ 
      type: 'editComment', 
      commentId 
    });
  };

  const handleDeleteComment = (commentId: string) => {
    vscode.postMessage({ 
      type: 'deleteComment', 
      commentId 
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