import React from 'react';
import { logger } from '../utils/logger';
import { realmPlugin } from '@mdxeditor/editor';
import { Cell } from '@mdxeditor/gurx';
import { $createTextNode } from 'lexical';

// Debugging flag
const DEBUG_PLUGIN = true;

// Create a cell to control plugin behavior
const angleBracketEnabled$ = Cell(true);

// Enhanced pattern to match various generic type patterns
// Matches: Arc<T>, Vec<String>, HashMap<K, V>, std::vector<T>, Promise<Result<T, E>>, etc.
// Updated to better handle nested generics
const ANGLE_BRACKET_PATTERN = /\b([A-Za-z_][A-Za-z0-9_]*(?:::?[A-Za-z_][A-Za-z0-9_]*)*)\s*<([^<>]*(?:<[^<>]*>[^<>]*)*[^<>]*)>/g;

// Function to check if we're inside a code context
const isInCodeContext = (text: string, position: number): boolean => {
  const beforeText = text.substring(0, position);
  const afterText = text.substring(position);
  
  // Check for inline code (backticks)
  const backticksBefore = (beforeText.match(/`/g) || []).length;
  const backticksAfter = (afterText.match(/`/g) || []).length;
  
  // If odd number of backticks before, we're inside inline code
  return backticksBefore % 2 === 1;
};

// Function to avoid processing HTML tags
const isLikelyHtmlTag = (identifier: string): boolean => {
  const htmlTags = ['div', 'span', 'p', 'a', 'img', 'br', 'hr', 'input', 'button', 'form', 'table', 'tr', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'strong', 'em', 'i', 'b'];
  return htmlTags.includes(identifier.toLowerCase());
};

// Custom text visitor for import (MDAST → Lexical)
const AngleBracketImportVisitor = {
  testNode: 'text',
  priority: 100, // High priority to process before default text visitor
  
  visitNode({ mdastNode, actions }: any) {
    if (DEBUG_PLUGIN) {
      logger.debug('AngleBracketPlugin: Processing text node:', mdastNode.value);
    }
    
    let processedText = mdastNode.value;
    let hasChanges = false;
    
    // Only process if enabled and contains angle brackets
    if (angleBracketEnabled$.getValue() && ANGLE_BRACKET_PATTERN.test(processedText)) {
      if (DEBUG_PLUGIN) {
        logger.debug('AngleBracketPlugin: Found angle brackets in text:', processedText);
      }
      
      // Reset the regex for fresh matching
      ANGLE_BRACKET_PATTERN.lastIndex = 0;
      
      processedText = processedText.replace(ANGLE_BRACKET_PATTERN, (match, identifier, contents, offset) => {
        if (DEBUG_PLUGIN) {
          logger.debug('AngleBracketPlugin: Processing match:', { match, identifier, contents });
        }
        
        // Skip if it's likely an HTML tag
        if (isLikelyHtmlTag(identifier)) {
          if (DEBUG_PLUGIN) {
            logger.debug('AngleBracketPlugin: Skipping HTML tag:', identifier);
          }
          return match;
        }
        
        // Skip if we're inside a code context (between backticks)
        if (isInCodeContext(mdastNode.value, offset)) {
          if (DEBUG_PLUGIN) {
            logger.debug('AngleBracketPlugin: Skipping code context');
          }
          return match;
        }
        
        hasChanges = true;
        
        // Use mathematical angle brackets (⟨⟩) for safe display
        // These won't be interpreted as HTML by the browser
        const result = `${identifier}⟨${contents}⟩`;
        if (DEBUG_PLUGIN) {
          logger.debug('AngleBracketPlugin: Transformed:', match, '->', result);
        }
        return result;
      });
    }
    
    if (DEBUG_PLUGIN && hasChanges) {
      logger.debug('AngleBracketPlugin: Final processed text:', processedText);
    }
    
    // Create the text node with processed content
    const node = $createTextNode(processedText);
    
    // Preserve formatting from parent
    try {
      const formatting = actions.getParentFormatting();
      if (formatting) {
        node.setFormat(formatting);
      }
      
      const style = actions.getParentStyle();
      if (style !== "") {
        node.setStyle(style);
      }
    } catch (error) {
      // Ignore formatting errors to prevent plugin from breaking
      if (DEBUG_PLUGIN) {
        console.debug('AngleBracketPlugin: Could not apply formatting:', error);
      }
    }
    
    actions.addAndStepInto(node);
  }
};

// Custom text visitor for export (Lexical → MDAST)
const AngleBracketExportVisitor = {
  testLexicalNode: (node: any) => node.getType() === 'text',
  priority: 100,
  
  visitLexicalNode({ lexicalNode, actions }: any) {
    let textContent = lexicalNode.getTextContent();
    
    // Convert back to original angle brackets for saving to markdown
    // Replace mathematical angle brackets (⟨⟩) with regular ones (<>)
    // This ensures the saved markdown has the original syntax
    textContent = textContent.replace(
      /([A-Za-z_][A-Za-z0-9_]*(?:::?[A-Za-z_][A-Za-z0-9_]*)*)\s*⟨([^⟨⟩]*(?:⟨[^⟨⟩]*⟩[^⟨⟩]*)*[^⟨⟩]*)⟩/g, 
      '$1<$2>'
    );
    
    actions.addAndStepInto({
      type: 'text',
      value: textContent
    });
  }
};

// Custom React component to render angle bracket text with proper styling
const AngleBracketText: React.FC<{ children: string }> = ({ children }) => {
  return (
    <span 
      className="angle-bracket-text"
      style={{
        fontFamily: 'monospace',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        padding: '1px 3px',
        borderRadius: '3px',
        fontSize: '0.9em'
      }}
    >
      {children}
    </span>
  );
};

// Plugin definition
export const angleBracketPlugin = realmPlugin({
  init(realm) {
    // Register our custom visitors
    realm.pubIn({
      addImportVisitor$: [AngleBracketImportVisitor],
      addExportVisitor$: [AngleBracketExportVisitor]
    });
  },
  
  update(realm, params?: { enabled?: boolean }) {
    realm.pub(angleBracketEnabled$, params?.enabled ?? true);
  }
});

// Export utility functions for manual preprocessing if needed
export const preprocessAngleBrackets = (markdown: string): string => {
  // Reset regex for fresh matching
  ANGLE_BRACKET_PATTERN.lastIndex = 0;
  
  return markdown.replace(ANGLE_BRACKET_PATTERN, (match, identifier, contents, offset) => {
    // Skip if it's likely an HTML tag
    if (isLikelyHtmlTag(identifier)) {
      return match;
    }
    
    // Skip if inside code context
    if (isInCodeContext(markdown, offset)) {
      return match;
    }
    
    return `${identifier}⟨${contents}⟩`;
  });
};

export const postprocessAngleBrackets = (markdown: string): string => {
  return markdown.replace(
    /\b([A-Za-z_][A-Za-z0-9_]*(?:::?[A-Za-z_][A-Za-z0-9_]*)*)\s*⟨([^⟨⟩]*(?:⟨[^⟨⟩]*⟩[^⟨⟩]*)*[^⟨⟩]*)⟩/g, 
    '$1<$2>'
  );
};

// Export the component for potential reuse
export { AngleBracketText };