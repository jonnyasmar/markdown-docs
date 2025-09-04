/**
 * Service for parsing and managing MDX directives in markdown content
 */
import { DocsComment } from '../types';

export interface DirectiveComment {
  id: string;
  text: string;
  timestamp: string;
}

export class DirectiveService {
  /**
   * Parse comment directives from markdown content
   */
  static parseCommentDirectives(markdown: string): DocsComment[] {
    const comments: DocsComment[] = [];

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
        const idMatch = attributes.match(/(?:id\\?=|#)["']?([^"'\s]+)["']?/);
        const textMatch = attributes.match(/text\\?="((?:[^"\\]|\\.)*)"/);
        const timestampMatch = attributes.match(/timestamp\\?=["']([^"']+)["']/);

        if (idMatch && textMatch) {
          const colonsCount = colons.length;
          let anchoredText = content || 'Selected text';

          // For container directives (:::), extract content between opening and closing tags
          if (colonsCount >= 3 && !content) {
            const containerStart = (match.index ?? 0) + match[0].length;
            const closingTag = new RegExp(`^:{${colonsCount},}$`, 'm');
            const closingMatch = closingTag.exec(markdown.slice(containerStart));
            if (closingMatch) {
              const containerEnd = containerStart + (closingMatch.index ?? 0);
              anchoredText = markdown.slice(containerStart, containerEnd).trim();
            }
          }

          const replacements = [
            {
              regex: /__BSLASH__/g,
              replacement: '\\',
            },
            {
              regex: /__DQUOTE__/g,
              replacement: '"',
            },
            {
              regex: /__SQUOTE__/g,
              replacement: "'",
            },
            {
              regex: /__NEWLINE__/g,
              replacement: '\n',
            },
            {
              regex: /__VTAB__/g,
              replacement: '\v',
            },
            {
              regex: /__CR__/g,
              replacement: '\r',
            },
          ];

          const unescapedContent = replacements.reduce((acc, replacement) => {
            return acc.replace(replacement.regex, replacement.replacement);
          }, textMatch[1]);

          comments.push({
            id: idMatch[1],
            content: unescapedContent,
            timestamp: timestampMatch ? timestampMatch[1] : new Date().toISOString(),
            author: 'User', // Default author
            anchoredText,
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
  static findDirectivePositions(markdown: string): Array<{ id: string; start: number; end: number }> {
    const positions: Array<{ id: string; start: number; end: number }> = [];
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
            end: match.index + match[0].length,
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
    const textDirectiveRegex = new RegExp(`:comment\\[[^\\]]*\\]\\{[^}]*#?\\\\?${commentId}[^}]*\\}`, 'g');
    const containerDirectiveRegex = new RegExp(`:::comment\\{[^}]*#?\\\\?${commentId}[^}]*\\}[\\s\\S]*?:::`, 'g');

    let result = markdown;
    result = result.replace(textDirectiveRegex, '');
    result = result.replace(containerDirectiveRegex, '');
    return result;
  }

  /**
   * Update a comment directive's text content
   */
  static updateDirective(markdown: string, commentId: string, newText: string): string {
    const replacements = [
      {
        regex: /\\/g,
        replacement: '__BSLASH__',
      },
      {
        regex: /"/g,
        replacement: '__DQUOTE__',
      },
      {
        regex: /'/g,
        replacement: '__SQUOTE__',
      },
      {
        regex: /\n/g,
        replacement: '__NEWLINE__',
      },
      {
        regex: /\v/g,
        replacement: '__VTAB__',
      },
      {
        regex: /\r/g,
        replacement: '__CR__',
      },
    ];

    const escapedNewText = replacements.reduce((acc, replacement) => {
      return acc.replace(replacement.regex, replacement.replacement);
    }, newText);

    // Handle both text directives and container directives (with escaped equals)
    const textDirectiveRegex = new RegExp(`:comment\\[([^\\]]*)\\]\\{([^}]*#?\\\\?${commentId}[^}]*)\\}`, 'g');
    const containerDirectiveRegex = new RegExp(`:::comment\\{([^}]*#?\\\\?${commentId}[^}]*)\\}`, 'g');

    let result = markdown;

    // Update text directives
    result = result.replace(textDirectiveRegex, (match, content, attributes) => {
      const updatedAttributes = (attributes as string).replace(/text="(?:[^"\\]|\\.)*"/, `text="${escapedNewText}"`);
      return `:comment[${String(content)}]{${updatedAttributes}}`;
    });

    // Update container directives
    result = result.replace(containerDirectiveRegex, (match, attributes) => {
      const updatedAttributes = (attributes as string).replace(/text="(?:[^"\\]|\\.)*"/, `text="${escapedNewText}"`);
      return `:::comment{${String(updatedAttributes)}}`;
    });

    return result;
  }
}
