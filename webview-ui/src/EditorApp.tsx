import React, { useEffect, useState } from 'react';

import { ErrorBoundary } from './components/ErrorBoundary';
import { MDXEditorWrapper } from './components/MDXEditorWrapper';
import { CommentWithAnchor, FontFamily, VSCodeAPI } from './types';
import { logger } from './utils/logger';

// Get VS Code API synchronously with proper typing and validation
const getVSCodeAPI = (): VSCodeAPI | null => {
  if (typeof window !== 'undefined' && window.vscodeApi) {
    const api = window.vscodeApi;
    if (typeof api.postMessage === 'function') {
      return api;
    } else {
      logger.error('VS Code API missing required postMessage method');
    }
  } else {
    logger.error('VS Code API not available on window object');
  }
  return null;
};

interface EditorAppProps {
  initialSettings: {
    defaultFont: FontFamily;
    fontSize: number;
    textAlign: string;
    bookView: boolean;
    bookViewWidth?: string;
    bookViewMargin?: string;
  };
}

function EditorApp({initialSettings}: EditorAppProps) {
  const [markdown, setMarkdown] = useState('');
  const [comments, setComments] = useState<CommentWithAnchor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [defaultFont, setDefaultFont] = useState<FontFamily>(initialSettings.defaultFont);
  const [fontSize, setFontSize] = useState(initialSettings.fontSize);
  const [textAlign, setTextAlign] = useState(initialSettings.textAlign);
  const [bookView, setBookView] = useState(initialSettings.bookView);
  const [bookViewWidth, setBookViewWidth] = useState(initialSettings.bookViewWidth || '5.5in');
  const [bookViewMargin, setBookViewMargin] = useState(initialSettings.bookViewMargin || '0.5in');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [editorConfig, setEditorConfig] = useState<{ wordWrap: string }>({ wordWrap: 'off' });

  // Get VS Code API once at component initialization
  const vscode = getVSCodeAPI();

  useEffect(() => {
    if (!vscode) {
      logger.error('VS Code API not available, cannot communicate with extension');
      setError('VS Code API not available. Make sure this webview is running inside VS Code.');
      setIsLoading(false);
      return;
    }

    // Webview state no longer needed - TextDocument is the source of truth
    // Initial content will come from 'update' message from extension

    try {
      // Ref to hold timeout IDs so they can be cleared

      // Listen for messages from the extension
      const handleMessage = (event: MessageEvent) => {
        const message = event.data;

        switch (message.command) {
          case 'update':
            setMarkdown(message.content || '');
            if (message.editorConfig) {
              setEditorConfig(message.editorConfig);
            }
            setIsLoading(false);
            clearTimeout(loadingTimeout);
            break;
          case 'updateComments':
            setComments(message.comments || []);
            break;
          case 'fontUpdate':
            if (message.font) {
              setDefaultFont(message.font);
            }
            break;
          case 'requestSave': {
            // Trigger save via keyboard shortcut simulation // Extension is requesting save due to close with unsaved changes
            const saveEvent = new KeyboardEvent('keydown', {
              key: 's',
              ctrlKey: !navigator.platform.includes('Mac'),
              metaKey: navigator.platform.includes('Mac'),
              bubbles: true,
            });
            document.dispatchEvent(saveEvent);
            break;
          }
          case 'saveComplete':
            // Extension confirms save was successful - clear dirty state
            setHasUnsavedChanges(false);
            break;
          case 'configUpdate':
            // Update editor configuration (word wrap, etc.)
            if (message.editorConfig) {
              setEditorConfig(message.editorConfig);
            }
            break;
          case 'settingsUpdate':
            console.log('EditorApp: Received settingsUpdate message:', message);
            if (message.settings) {
              const { 
                defaultFont, 
                fontSize: newFontSize, 
                textAlign: newTextAlign, 
                bookView: newBookView,
                bookViewWidth: newBookViewWidth,
                bookViewMargin: newBookViewMargin 
              } = message.settings;
              if (defaultFont) setDefaultFont(defaultFont);
              if (typeof newFontSize === 'number') setFontSize(newFontSize);
              if (newTextAlign) setTextAlign(newTextAlign);
              if (typeof newBookView === 'boolean') setBookView(newBookView);
              if (newBookViewWidth) setBookViewWidth(newBookViewWidth);
              if (newBookViewMargin) setBookViewMargin(newBookViewMargin);
            }
            break;
          default:
          // Unknown message command
        }
      };

      window.addEventListener('message', handleMessage);

      // Send ready message to request initial content
      const sendReady = () => {
        vscode.postMessage({ command: 'ready' });
      };

      // Send ready message immediately and also after short delays as fallback
      sendReady();
      const timeout1 = setTimeout(sendReady, 100);
      const timeout2 = setTimeout(sendReady, 500);

      // Set a maximum loading timeout to prevent infinite loading
      const loadingTimeout = setTimeout(() => {
        logger.warn('Loading timeout: extension failed to send content');
        setMarkdown(
          '# Document Loading Issues\n\nThe markdown document could not be loaded from the extension.\n\nTry reloading the webview or reopening the file.',
        );
        setIsLoading(false);
      }, 10000);

      return () => {
        window.removeEventListener('message', handleMessage);
        clearTimeout(timeout1);
        clearTimeout(timeout2);
        clearTimeout(loadingTimeout);
      };
    } catch (err) {
      logger.error('Error setting up EditorApp:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsLoading(false);
    }
  }, []);

  const handleMarkdownChange = (newMarkdown: string) => {
    setMarkdown(newMarkdown);

    // Send edit messages to keep TextDocument in sync (TextDocument is source of truth)
    if (vscode) {
      vscode.postMessage({
        command: 'edit',
        content: newMarkdown,
      });
    }
  };

  const handleNavigateToComment = (commentId: string) => {
    if (vscode) {
      vscode.postMessage({
        command: 'navigateToComment',
        commentId,
      });
    }
  };

  const handleEditComment = (commentId: string) => {
    if (vscode) {
      vscode.postMessage({
        command: 'editComment',
        commentId,
      });
    }
  };

  const handleDeleteComment = (commentId: string) => {
    if (vscode) {
      vscode.postMessage({
        command: 'deleteComment',
        commentId,
      });
    }
  };

  // Handle font messages
  const handleFontMessage = (message: any) => {
    if (vscode) {
      switch (message.command) {
        case 'getFont':
          vscode.postMessage({
            command: 'getFont',
          });
          break;
        case 'setFont':
          vscode.postMessage({
            command: 'setFont',
            font: message.font,
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

  // Handle unsaved changes warning on close - send state to extension
  useEffect(() => {
    if (vscode) {
      vscode.postMessage({
        command: 'updateUnsavedChanges',
        hasUnsavedChanges,
      });
    }
  }, [hasUnsavedChanges, vscode]);

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
      <div
        style={{
          padding: '20px',
          color: 'var(--vscode-editor-foreground)',
          background: 'var(--vscode-editor-background)',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <p>Loading document...</p>
      </div>
    );
  }

  // Rendering main editor component

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
        fontSize={fontSize}
        textAlign={textAlign}
        bookView={bookView}
        bookViewWidth={bookViewWidth}
        bookViewMargin={bookViewMargin}
        onDirtyStateChange={setHasUnsavedChanges}
        editorConfig={editorConfig}
      />
    </ErrorBoundary>
  );
}

export default EditorApp;
