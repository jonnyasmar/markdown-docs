/**
 * Types for the webview UI that mirror the extension types
 */

export interface Comment {
    id: string;
    author: string;
    timestamp: string;
    content: string;
}

export interface CommentWithAnchor extends Comment {
    anchoredText: string;
    startPosition: number;
    endPosition: number;
}

export interface WebviewMessage {
    type: string;
    [key: string]: any;
}