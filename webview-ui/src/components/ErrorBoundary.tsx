import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: '20px', 
          background: 'var(--vscode-editor-background)',
          color: 'var(--vscode-errorForeground)',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <h2>Something went wrong with the Markdown Editor</h2>
          <details style={{ marginTop: '10px', color: 'var(--vscode-descriptionForeground)' }}>
            <summary>Error details</summary>
            <pre style={{ 
              marginTop: '10px', 
              padding: '10px', 
              background: 'var(--vscode-textCodeBlock-background)',
              borderRadius: '4px',
              fontSize: '12px',
              whiteSpace: 'pre-wrap'
            }}>
              {this.state.error?.toString()}
            </pre>
          </details>
          <button 
            style={{
              marginTop: '20px',
              padding: '8px 16px',
              background: 'var(--vscode-button-background)',
              color: 'var(--vscode-button-foreground)',
              border: '1px solid var(--vscode-button-border)',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
            onClick={() => window.location.reload()}
          >
            Reload Editor
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}