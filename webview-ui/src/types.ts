// Enhanced type definitions for Markdown Docs extension

export interface CommentWithAnchor {
  id: string;
  content: string;
  range: {
    start: number;
    end: number;
  };
  anchor?: string;
  timestamp?: number;
  author?: string;
  anchoredText?: string;
  startPosition?: number;
  endPosition?: number;
}

export interface WebviewMessage {
  command: string;
  content?: string;
  comments?: CommentWithAnchor[];
  range?: {
    start: number;
    end: number;
  };
  comment?: string;
  commentId?: string;
  font?: string;
  error?: string;
  stack?: string;
  componentStack?: string;
  type?: string;
  message?: string;
  isDirty?: boolean;
  data?: any;
}

export interface VSCodeAPI {
  postMessage(message: WebviewMessage): void;
  getState(): any;
  setState(state: any): void;
}

export type ViewMode = 'preview' | 'edit' | 'split';

export interface MermaidEditorProps {
  code: string;
  language: string;
  setCode: (code: string) => void;
  focusEmitter?: any;
  parentEditor?: any;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

// Utility types for better type safety
export type FontFamily = 'Arial' | 'Times New Roman' | 'Roboto' | 'Georgia' | 'Calibri' | 'Garamond' | 'Book Antiqua';

// Global window interface extension
declare global {
  interface Window {
    vscodeApi?: VSCodeAPI;
    vscodeApiAcquired?: boolean;
  }
}