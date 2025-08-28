import React from 'react';

// Simple and reliable approach: escape ALL angle brackets AND protect curly brace patterns
// Since suppressHtmlProcessing doesn't work reliably, we'll escape everything

// Check if we're inside backticks (inline code)
const isInInlineCode = (text: string, position: number): boolean => {
  const beforeText = text.substring(0, position);
  const backticksBefore = (beforeText.match(/`/g) || []).length;
  return backticksBefore % 2 === 1;
};

// Check if we're inside a code block
const isInCodeBlock = (text: string, position: number): boolean => {
  const beforeText = text.substring(0, position);
  
  // Check for fenced code blocks (```)
  const codeBlockStart = /```/g;
  let match;
  let inCodeBlock = false;
  
  codeBlockStart.lastIndex = 0;
  while ((match = codeBlockStart.exec(beforeText)) !== null) {
    inCodeBlock = !inCodeBlock;
  }
  
  return inCodeBlock;
};

// Main preprocessing function - escape ALL angle brackets AND protect curly braces
export const preprocessAngleBrackets = (markdown: string): string => {
  // First protect curly brace patterns
  let result = preprocessCurlyBraces(markdown);
  
  // Then process character by character to respect code contexts for angle brackets
  let finalResult = '';
  let i = 0;
  
  while (i < result.length) {
    const char = result[i];
    
    // Only escape < brackets, not > brackets (which are used for blockquotes)
    if (char === '<') {
      // Check if we're in a code context
      if (isInInlineCode(result, i) || isInCodeBlock(result, i)) {
        // Preserve as-is in code contexts
        finalResult += char;
      } else {
        // Escape < brackets outside of code
        finalResult += '\\' + char;
      }
    } else {
      finalResult += char;
    }
    i++;
  }
  
  return finalResult;
};

// Preprocessing function to protect underscores in curly brace patterns
export const preprocessCurlyBraces = (markdown: string): string => {
  // Replace underscores only inside {{ }} patterns with a placeholder
  // This prevents MDX from treating them as italic markdown syntax
  return markdown.replace(/\{\{([^}]*)\}\}/g, (match, content) => {
    // Only replace if we're not in a code context
    const matchIndex = markdown.indexOf(match);
    if (isInInlineCode(markdown, matchIndex) || isInCodeBlock(markdown, matchIndex)) {
      return match; // Preserve as-is in code contexts
    }
    
    // Replace underscores with placeholder
    const protectedContent = content.replace(/_/g, '___UNDERSCORE___');
    return `{{${protectedContent}}}`;
  });
};

// Postprocessing function - remove escaping and restore curly braces
export const postprocessAngleBrackets = (markdown: string): string => {
  // First restore curly brace patterns
  let result = postprocessCurlyBraces(markdown);
  
  // Then remove backslash escaping from < characters (we no longer escape >)
  return result.replace(/\\</g, '<');
};

// Postprocessing function to restore underscores in curly brace patterns
export const postprocessCurlyBraces = (markdown: string): string => {
  // Restore underscores that were protected as placeholders
  return markdown.replace(/\{\{([^}]*)\}\}/g, (match, content) => {
    // Replace placeholders back to underscores
    const restoredContent = content.replace(/___UNDERSCORE___/g, '_');
    return `{{${restoredContent}}}`;
  });
};

// Component for rendering angle bracket text (optional visual enhancement)
export const AngleBracketText: React.FC<{ children: string }> = ({ children }) => {
  return (
    <span 
      className="angle-bracket-text"
      style={{
        fontFamily: 'monospace',
        backgroundColor: 'rgba(100, 150, 200, 0.15)',
        padding: '1px 3px',
        borderRadius: '3px',
        fontSize: '0.9em'
      }}
    >
      {children}
    </span>
  );
};