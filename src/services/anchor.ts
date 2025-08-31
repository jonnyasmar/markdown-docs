import { Comment } from '../common/types';

export interface AnchorInfo {
    id: string;
    startIndex: number;
    endIndex: number;
    anchoredText: string;
}

export class AnchorService {
  /**
     * Find all anchor pairs in the document content
     */
  static findAllAnchors(content: string): AnchorInfo[] {
    const anchors: AnchorInfo[] = [];
    const startPattern = /<!--\s*anchor-start:([^-]+)-->/g;
    const endPattern = /<!--\s*anchor-end:([^-]+)-->/g;
        
    const startMatches = Array.from(content.matchAll(startPattern));
    const endMatches = Array.from(content.matchAll(endPattern));
        
    // Match start and end anchors by ID
    for (const startMatch of startMatches) {
      const id = startMatch[1];
      const endMatch = endMatches.find(end => end[1] === id);
            
      if (endMatch && startMatch.index !== undefined && endMatch.index !== undefined) {
        const startIndex = startMatch.index + startMatch[0].length;
        const endIndex = endMatch.index;
        const anchoredText = content.substring(startIndex, endIndex);
                
        anchors.push({
          id,
          startIndex,
          endIndex,
          anchoredText: anchoredText.trim(),
        });
      }
    }
        
    return anchors;
  }

  /**
     * Wrap selected text with anchor tags
     */
  static wrapSelection(content: string, selection: { start: number; end: number }, commentId: string): string {
    const before = content.substring(0, selection.start);
    const selectedText = content.substring(selection.start, selection.end);
    const after = content.substring(selection.end);
        
    const startAnchor = `<!-- anchor-start:${commentId}-->`;
    const endAnchor = `<!-- anchor-end:${commentId}-->`;
        
    return before + startAnchor + selectedText + endAnchor + after;
  }

  /**
     * Remove anchor tags for a specific comment ID
     */
  static removeAnchor(content: string, commentId: string): string {
    const startPattern = new RegExp(`<!--\\s*anchor-start:${commentId}-->`, 'g');
    const endPattern = new RegExp(`<!--\\s*anchor-end:${commentId}-->`, 'g');
        
    return content.replace(startPattern, '').replace(endPattern, '');
  }

  /**
     * Convert markdown with anchor comments to displayable format with highlights
     */
  static addHighlights(content: string, comments: Comment[], _onAnchorClick?: (commentId: string) => void): string {
    let result = content;
    const anchors = this.findAllAnchors(content);
        
    // Sort anchors by start position in reverse order to avoid index shifting
    anchors.sort((a, b) => b.startIndex - a.startIndex);
        
    for (const anchor of anchors) {
      const comment = comments.find(c => c.id === anchor.id);
      if (comment) {
        // Remove the HTML comment anchors
        const beforeAnchor = result.substring(0, anchor.startIndex - `<!-- anchor-start:${anchor.id}-->`.length);
        const anchoredText = anchor.anchoredText;
        const afterAnchor = result.substring(anchor.endIndex + `<!-- anchor-end:${anchor.id}-->`.length);
                
        // Create a highlighted span
        const highlightClass = `comment-highlight comment-highlight-${anchor.id}`;
        const highlightedText = `<span class="${highlightClass}" data-comment-id="${anchor.id}" style="background-color: rgba(255, 215, 0, 0.3); cursor: pointer; border-bottom: 2px solid #ffd700;" title="Comment: ${comment.content}">${anchoredText}</span>`;
                
        result = beforeAnchor + highlightedText + afterAnchor;
      }
    }
        
    return result;
  }
}