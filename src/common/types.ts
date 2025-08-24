/**
 * Represents a single comment attached to a text selection in a markdown document.
 */
export interface Comment {
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

/**
 * Structure for storing comment data in YAML frontmatter.
 * Contains the root property that holds all comments for the document.
 */
export interface CommentFrontmatter {
    /** Root property containing array of comments */
    aiDocReviewerComments: Comment[];
}

/**
 * In-memory representation of a comment that includes both metadata and position information.
 * Used during runtime to track comments and their anchored positions in the document.
 */
export interface AnchoredComment extends Comment {
    /** The text content that this comment is anchored to */
    anchoredText: string;
    /** Start position of the anchored text in the document */
    startPosition: number;
    /** End position of the anchored text in the document */
    endPosition: number;
}