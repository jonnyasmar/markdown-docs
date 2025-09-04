import React, { Component, ReactNode } from 'react';

import { logger } from '../utils/logger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  private retryCount = 0;
  private readonly maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('ErrorBoundary caught an error:', error, errorInfo);

    // Send error telemetry to extension if available
    if (typeof window !== 'undefined' && window.vscodeApi) {
      try {
        window.vscodeApi.postMessage({
          command: 'error',
          content: `Component error: ${error.message}`,
          stack: error.stack,
          componentStack: errorInfo.componentStack || '',
        });
      } catch (telemetryError) {
        logger.error('Failed to send error telemetry:', telemetryError);
      }
    }
  }

  private handleRetry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      this.setState({ hasError: false, error: undefined });
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '20px',
            background: 'var(--vscode-editor-background)',
            color: 'var(--vscode-errorForeground)',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <h2>Something went wrong with the Markdown Editor</h2>
          <details style={{ marginTop: '10px', color: 'var(--vscode-descriptionForeground)' }}>
            <summary>Error details</summary>
            <pre
              style={{
                marginTop: '10px',
                padding: '10px',
                background: 'var(--vscode-textCodeBlock-background)',
                borderRadius: '4px',
                fontSize: '12px',
                whiteSpace: 'pre-wrap',
              }}
            >
              {this.state.error?.toString()}
            </pre>
          </details>
          <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
            {this.retryCount < this.maxRetries && (
              <button
                style={{
                  padding: '8px 16px',
                  background: 'var(--vscode-button-background)',
                  color: 'var(--vscode-button-foreground)',
                  border: '1px solid var(--vscode-button-border)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
                onClick={this.handleRetry}
              >
                Retry ({this.maxRetries - this.retryCount} attempts left)
              </button>
            )}
            <button
              style={{
                padding: '8px 16px',
                background: 'var(--vscode-button-background)',
                color: 'var(--vscode-button-foreground)',
                border: '1px solid var(--vscode-button-border)',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
              onClick={() => window.location.reload()}
            >
              Reload Editor
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
