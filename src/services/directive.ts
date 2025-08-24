/**
 * Service for parsing and managing MDX directives in markdown content
 */

import { Comment } from '../common/types';

export interface DirectiveComment {
  id: string;
  text: string;
  timestamp: string;
}

export class DirectiveService {
  /**
   * Parse comment directives from markdown content
   */
  static parseCommentDirectives(markdown: string): Comment[] {
    const comments: Comment[] = [];
    
    // Regex to match comment directives: 
    // :comment[content]{attributes} - textDirective
    // ::comment[content]{attributes} - leafDirective  
    // :::comment{attributes} - containerDirective (no brackets)
    // Also handle malformed directives missing some parts
    const directiveRegex = /(:+)comment(?:\[([^\]]*)\])?\{([^}]*)\}/g;
    
    let match;
    while ((match = directiveRegex.exec(markdown)) !== null) {
      try {
        const colons = match[1];
        const content = match[2];
        const attributes = match[3];
        
        // Parse attributes
        const idMatch = attributes.match(/(?:id=|#)["']?([^"'\s]+)["']?/);
        const textMatch = attributes.match(/text=["']([^"']+)["']/);
        const timestampMatch = attributes.match(/timestamp=["']([^"']+)["']/);
        
        if (idMatch && textMatch) {
          const colonsCount = colons.length;
          let anchoredText = content || 'Selected text';
          
          // For container directives (:::), extract content between opening and closing tags
          if (colonsCount >= 3 && !content) {
            const containerStart = match.index! + match[0].length;
            const closingTag = new RegExp(`^:{${colonsCount},}$`, 'm');
            const closingMatch = closingTag.exec(markdown.slice(containerStart));
            if (closingMatch) {
              const containerEnd = containerStart + closingMatch.index!;
              anchoredText = markdown.slice(containerStart, containerEnd).trim();
            }
          }
          
          comments.push({
            id: idMatch[1],
            content: textMatch[1],
            timestamp: timestampMatch ? timestampMatch[1] : new Date().toISOString(),
            author: 'User', // Default author
            anchoredText: anchoredText
          });
        }
      } catch (error) {
        console.warn('Failed to parse directive:', match[0], error);
      }
    }
    
    return comments;
  }

  /**
   * Find all comment directive positions in markdown
   */
  static findDirectivePositions(markdown: string): Array<{id: string, start: number, end: number}> {
    const positions: Array<{id: string, start: number, end: number}> = [];
    const directiveRegex = /:comment\[\]\{([^}]+)\}/g;
    
    let match;
    while ((match = directiveRegex.exec(markdown)) !== null) {
      try {
        const attributes = match[1];
        const idMatch = attributes.match(/#([^#\s]+)/);
        
        if (idMatch) {
          positions.push({
            id: idMatch[1],
            start: match.index,
            end: match.index + match[0].length
          });
        }
      } catch (error) {
        console.warn('Failed to parse directive position:', match[0], error);
      }
    }
    
    return positions;
  }

  /**
   * Remove a comment directive from markdown
   */
  static removeDirective(markdown: string, commentId: string): string {
    const directiveRegex = new RegExp(`:comment\\[\\]\\{[^}]*#${commentId}[^}]*\\}`, 'g');
    return markdown.replace(directiveRegex, '');
  }

  /**
   * Update a comment directive's text content
   */
  static updateDirective(markdown: string, commentId: string, newText: string): string {
    const directiveRegex = new RegExp(`:comment\\[\\]\\{([^}]*#${commentId}[^}]*)\\}`, 'g');
    
    return markdown.replace(directiveRegex, (match, attributes) => {
      // Replace the text attribute
      const updatedAttributes = attributes.replace(/text="[^"]*"/, `text="${newText}"`);
      return `:comment[]{${updatedAttributes}}`;
    });
  }
}