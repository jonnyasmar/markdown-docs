import { AnchoredComment } from '../common/types';
import { FrontmatterService } from './frontmatter';
import { AnchorService } from './anchor';

/**
 * Service for parsing comments from markdown documents.
 * Combines frontmatter metadata with anchor information to create full comment objects.
 */
export class DocumentParserService {
    
  /**
     * Parses all comments from a document, combining frontmatter data with anchor positions.
     * @param documentContent Full document content as string
     * @returns Array of anchored comments
     */
  public static parseDocumentComments(documentContent: string): AnchoredComment[] {
    const frontmatter = FrontmatterService.parse(documentContent);
    const anchors = AnchorService.findAllAnchors(documentContent);
        
    const anchoredComments: AnchoredComment[] = [];
        
    // Match comments from frontmatter with their anchors
    for (const comment of frontmatter.aiDocReviewerComments) {
      const anchor = anchors.find(a => a.id === comment.id);
            
      if (anchor) {
        anchoredComments.push({
          ...comment,
          anchoredText: anchor.anchoredText,
          startPosition: anchor.startIndex,
          endPosition: anchor.endIndex,
        });
      }
    }
        
    return anchoredComments;
  }
    
  /**
     * Finds a specific comment by ID in the document.
     * @param documentContent Full document content as string
     * @param commentId ID of the comment to find
     * @returns The anchored comment or undefined if not found
     */
  public static findCommentById(documentContent: string, commentId: string): AnchoredComment | undefined {
    const comments = this.parseDocumentComments(documentContent);
    return comments.find(comment => comment.id === commentId);
  }
}