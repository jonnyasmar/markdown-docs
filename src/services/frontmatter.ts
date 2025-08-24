import * as yaml from 'yaml';
import { CommentFrontmatter } from '../common/types';

/**
 * Service for parsing and managing YAML frontmatter in markdown documents.
 * Handles extraction, parsing, and serialization of comment metadata.
 */
export class FrontmatterService {
    private static readonly FRONTMATTER_DELIMITER = '---';
    
    /**
     * Extracts and parses YAML frontmatter from a document string.
     * @param documentContent Full document content as string
     * @returns Parsed frontmatter object or empty structure if none exists
     */
    public static parse(documentContent: string): CommentFrontmatter {
        const frontmatterMatch = this.extractFrontmatterBlock(documentContent);
        
        if (!frontmatterMatch) {
            return { aiDocReviewerComments: [] };
        }
        
        try {
            const parsed = yaml.parse(frontmatterMatch);
            
            // Ensure the structure contains our comment array
            if (parsed && typeof parsed === 'object' && Array.isArray(parsed.aiDocReviewerComments)) {
                return parsed as CommentFrontmatter;
            }
            
            // If frontmatter exists but doesn't have our comments, preserve it and add our array
            return {
                ...parsed,
                aiDocReviewerComments: []
            };
        } catch (error) {
            console.warn('Failed to parse YAML frontmatter:', error);
            return { aiDocReviewerComments: [] };
        }
    }
    
    /**
     * Serializes comment frontmatter and injects it back into document content.
     * @param documentContent Full document content as string
     * @param frontmatter Comment frontmatter object to serialize
     * @returns Updated document content with new frontmatter
     */
    public static stringify(documentContent: string, frontmatter: CommentFrontmatter): string {
        const frontmatterYaml = yaml.stringify(frontmatter);
        const existingFrontmatterMatch = this.extractFrontmatterBlock(documentContent);
        
        const newFrontmatterBlock = `${this.FRONTMATTER_DELIMITER}\n${frontmatterYaml}${this.FRONTMATTER_DELIMITER}\n`;
        
        if (existingFrontmatterMatch) {
            // Replace existing frontmatter (handles both --- and *** delimiters)
            const frontmatterRegex = this.getFrontmatterReplacementRegex();
            return documentContent.replace(frontmatterRegex, newFrontmatterBlock);
        } else {
            // Add new frontmatter at the beginning
            return newFrontmatterBlock + documentContent;
        }
    }
    
    /**
     * Extracts the raw YAML content from frontmatter block (without delimiters).
     * @param documentContent Full document content as string
     * @returns Raw YAML string or null if no frontmatter found
     */
    private static extractFrontmatterBlock(documentContent: string): string | null {
        // Try standard --- delimiters first
        let frontmatterRegex = new RegExp(
            `^---\\n([\\s\\S]*?)\\n---\\n?`,
            'm'
        );
        
        let match = documentContent.match(frontmatterRegex);
        if (match) {
            return match[1];
        }
        
        // Try *** delimiters (corrupted format)
        frontmatterRegex = new RegExp(
            `^\\*\\*\\*\\n([\\s\\S]*?)\\n\\*\\*\\*\\n?`,
            'm'
        );
        
        match = documentContent.match(frontmatterRegex);
        return match ? match[1] : null;
    }

    /**
     * Gets the frontmatter regex pattern for replacement
     */
    private static getFrontmatterReplacementRegex(): RegExp {
        // Match both --- and *** delimiters for replacement
        return new RegExp(
            `^(---|\\*\\*\\*)\\n[\\s\\S]*?\\n(---|\\*\\*\\*)\\n?`,
            'm'
        );
    }
}