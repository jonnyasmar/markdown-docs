import React, { useState, useEffect } from 'react';
import { MDXEditorWrapper } from './components/MDXEditorWrapper';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CommentWithAnchor } from './types';

// VS Code API for webview - use pre-acquired API
declare global {
  interface Window {
    vscodeApi?: any;
    vscodeApiAcquired?: boolean;
  }
}

// Use ONLY the pre-acquired VS Code API from HTML template
let vscode: any;
if (typeof window !== 'undefined' && window.vscodeApi) {
  vscode = window.vscodeApi;
  console.log('Using pre-acquired VS Code API:', !!vscode);
} else {
  console.error('Pre-acquired VS Code API not found on window.vscodeApi');
}

function EditorApp() {
  console.log('=== EDITORAPP FUNCTION START ===');
  const [markdown, setMarkdown] = useState('');
  const [comments, setComments] = useState<CommentWithAnchor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [defaultFont, setDefaultFont] = useState<string>('Arial');
  
  console.log('EditorApp state initialized:', {
    markdownLength: markdown.length,
    commentsCount: comments.length,
    error,
    isLoading,
    defaultFont
  });

  useEffect(() => {
    console.log('EditorApp useEffect starting');
    console.log('VS Code API available:', !!vscode);
    
    if (!vscode) {
      console.error('VS Code API not available, cannot communicate with extension');
      setError('VS Code API not available. Make sure this webview is running inside VS Code.');
      setIsLoading(false);
      return;
    }
    
    try {
    // Ref to hold timeout IDs so they can be cleared
    let timeout1: NodeJS.Timeout;
    let timeout2: NodeJS.Timeout;
    let loadingTimeout: NodeJS.Timeout;
    
    // Listen for messages from the extension
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      console.log('EditorApp received message:', message);
      
      switch (message.command) {
        case 'update':
          console.log('Setting markdown content length:', message.content?.length);
          console.log('Setting markdown content preview:', message.content?.substring(0, 100) + '...');
          console.log('Setting markdown content ending:', '...' + message.content?.substring(message.content.length - 100));
          console.log('Full content contains code blocks?', message.content?.includes('```javascript'));
          console.log('Content ends with expected text?', message.content?.includes('explore all the features!'));
          setMarkdown(message.content || '');
          setIsLoading(false);
          
          // IMPORTANT: Clear the loading timeout when content is received
          console.log('Content received, clearing loading timeout');
          clearTimeout(loadingTimeout);
          break;
        case 'updateComments':
          setComments(message.comments || []);
          break;
        case 'fontUpdate':
          // Font setting received from extension, pass to editor
          if (message.font) {
            console.log('Received font update:', message.font);
            // We'll pass this through props or context to MDXEditorWrapper
            setDefaultFont(message.font);
          }
          break;
        default:
          console.log('Unknown message command:', message.command);
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Send ready message to request initial content
    console.log('EditorApp setting up ready message');
    const sendReady = () => {
      console.log('Sending ready message to extension');
      vscode.postMessage({ command: 'ready' });
    };
    
    // Send ready message immediately and also after short delays as fallback
    sendReady();
    timeout1 = setTimeout(sendReady, 100);
    timeout2 = setTimeout(sendReady, 500);
    
    // Set a maximum loading timeout to prevent infinite loading
    loadingTimeout = setTimeout(() => {
      console.warn('Loading timeout reached, proceeding with fallback content');
      console.warn('This suggests the extension failed to send initial content within 10 seconds');
      setMarkdown('# Document Loading Issues\n\nThe markdown document could not be loaded from the extension.\n\n## Possible Issues:\n- Extension communication failure\n- File permissions\n- Path resolution problems\n\n## Debug Info:\n- Ready message sent: Yes\n- VS Code API available: ' + (!!vscode) + '\n\nTry reloading the webview or reopening the file.');
      setIsLoading(false);
    }, 10000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      clearTimeout(loadingTimeout);
    };
    } catch (err) {
      console.error('Error setting up EditorApp:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsLoading(false);
    }
  }, []);

  const handleMarkdownChange = (newMarkdown: string) => {
    setMarkdown(newMarkdown);
    // DISABLED: Don't send edit messages on every keystroke for better performance
    // Only save messages are sent when user explicitly saves (Ctrl+S/Cmd+S)
  };

  const handleAddComment = (range: { start: number, end: number }, comment: string) => {
    if (vscode) {
      vscode.postMessage({
        command: 'addComment',
        range,
        comment
      });
    }
  };

  const handleNavigateToComment = (commentId: string) => {
    if (vscode) {
      vscode.postMessage({
        command: 'navigateToComment',
        commentId
      });
    }
  };

  const handleEditComment = (commentId: string) => {
    if (vscode) {
      vscode.postMessage({
        command: 'editComment',
        commentId
      });
    }
  };

  const handleDeleteComment = (commentId: string) => {
    if (vscode) {
      vscode.postMessage({
        command: 'deleteComment',
        commentId
      });
    }
  };

  // Handle font messages
  const handleFontMessage = (message: any) => {
    if (vscode) {
      switch (message.command) {
        case 'getFont':
          vscode.postMessage({
            command: 'getFont'
          });
          break;
        case 'setFont':
          vscode.postMessage({
            command: 'setFont',
            font: message.font
          });
          break;
      }
    }
  };

  // Set up font message listener
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === 'getFont' || message.command === 'setFont') {
        handleFontMessage(message);
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  if (error) {
    return (
      <div style={{ padding: '20px', color: 'red' }}>
        <h2>Error</h2>
        <p>{error}</p>
        <p>Check the console for more details.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{
        padding: '20px',
        color: 'var(--vscode-editor-foreground)',
        background: 'var(--vscode-editor-background)',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <p>Loading document...</p>
      </div>
    );
  }

  console.log('=== EDITORAPP RENDERING MDXEDITORWRAPPER ===');
  console.log('Final render state:', {
    markdownLength: markdown.length,
    markdownPreview: markdown.substring(0, 100),
    commentsCount: comments.length,
    defaultFont,
    error,
    isLoading
  });

  return (
    <ErrorBoundary>
      <MDXEditorWrapper
        markdown={markdown}
        onMarkdownChange={handleMarkdownChange}
        comments={comments}
        onNavigateToComment={handleNavigateToComment}
        onEditComment={handleEditComment}
        onDeleteComment={handleDeleteComment}
        defaultFont={defaultFont}
      />
    </ErrorBoundary>
  );
}

export default EditorApp;