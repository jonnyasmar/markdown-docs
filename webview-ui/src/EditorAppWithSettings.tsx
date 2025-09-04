import React, { useEffect, useState } from 'react';

import EditorApp from './EditorApp';
import { FontFamily, VSCodeAPI } from './types';
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

interface Settings {
  defaultFont: FontFamily;
  fontSize: number;
  textAlign: string;
  bookView: boolean;
  bookViewWidth?: string;
  bookViewMargin?: string;
}

function EditorAppWithSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get VS Code API once at component initialization
  const vscode = getVSCodeAPI();

  useEffect(() => {
    if (!vscode) {
      logger.error('VS Code API not available, cannot communicate with extension');
      setError('VS Code API not available. Make sure this webview is running inside VS Code.');
      return;
    }

    // Listen for settings response
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      console.log('EditorAppWithSettings: Received message:', message.command);

      if (message.command === 'settingsUpdate' && message.settings) {
        console.log('EditorAppWithSettings: Loading initial settings:', message.settings);
        setSettings({
          defaultFont: message.settings.defaultFont || 'Default',
          fontSize: message.settings.fontSize || 14,
          textAlign: message.settings.textAlign || 'left',
          bookView: message.settings.bookView || false,
          bookViewWidth: message.settings.bookViewWidth || '5.5in',
          bookViewMargin: message.settings.bookViewMargin || '0.5in',
        });
      }
    };

    window.addEventListener('message', handleMessage);

    // Request settings immediately
    console.log('EditorAppWithSettings: Requesting settings');
    vscode.postMessage({ command: 'getSettings' });

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [vscode]);

  if (error) {
    return (
      <div style={{ padding: '20px', color: 'red' }}>
        <h2>Error</h2>
        <p>{error}</p>
        <p>Check the console for more details.</p>
      </div>
    );
  }

  if (!settings) {
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
        <p>Loading settings...</p>
      </div>
    );
  }

  // Render EditorApp with settings as initial values
  return <EditorApp initialSettings={settings} />;
}

export default EditorAppWithSettings;
