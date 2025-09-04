// Enhanced type definitions for Markdown Docs extension

/**
 * Represents a single comment attached to a text selection in a markdown document.
 * Used with inline directive-based comment system.
 */
export interface DocsComment {
  /** Unique identifier for the comment */
  id: string;
  /** Author of the comment */
  author: string;
  /** Timestamp when the comment was created (ISO 8601 format) */
  timestamp: string;
  /** Content/text of the comment */
  content: string;
  /** The text content that this comment is anchored to */
  anchoredText?: string;
}

export interface CommentWithAnchor extends DocsComment {
  anchor?: string;
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
  hasUnsavedChanges?: boolean;
  fontSize?: number;
  textAlign?: string;
  bookView?: boolean;
  bookViewWidth?: string;
  bookViewMargin?: string;
  isInteracting?: boolean;
  url?: string;
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
  setCode?: (code: string) => void;
  focusEmitter?: unknown;
  parentEditor?: unknown;
  isDarkTheme?: boolean;
  meta?: string;
  nodeKey?: string;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

// Utility types for better type safety
export type FontFamily =
  | 'Default'
  | 'Arial'
  | 'Times New Roman'
  | 'Roboto'
  | 'Georgia'
  | 'Calibri'
  | 'Garamond'
  | 'Book Antiqua'
  | 'Courier New'
  | 'Open Sans'
  | 'Lato'
  | 'Montserrat'
  | 'Source Sans Pro';

// Global interface extensions
declare global {
  interface Window {
    vscodeApi?: VSCodeAPI;
    vscodeApiAcquired?: boolean;
  }

  // CSS Custom Highlight API types - augment existing CSS interface
  interface CSS {
    highlights?: Map<string, unknown>;
  }
}
