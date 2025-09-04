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
