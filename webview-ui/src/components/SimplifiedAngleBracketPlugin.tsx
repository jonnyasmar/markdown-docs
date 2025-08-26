import React from 'react';

// Simple and reliable approach: escape ALL angle brackets
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

// Main preprocessing function - escape ALL angle brackets with backslashes
export const preprocessAngleBrackets = (markdown: string): string => {
  // Process character by character to respect code contexts
  let result = '';
  let i = 0;
  
  while (i < markdown.length) {
    const char = markdown[i];
    
    // Only escape < brackets, not > brackets (which are used for blockquotes)
    if (char === '<') {
      // Check if we're in a code context
      if (isInInlineCode(markdown, i) || isInCodeBlock(markdown, i)) {
        // Preserve as-is in code contexts
        result += char;
      } else {
        // Escape < brackets outside of code
        result += '\\' + char;
      }
    } else {
      result += char;
    }
    i++;
  }
  
  return result;
};

// Postprocessing function - remove any backslash escaping from < only
export const postprocessAngleBrackets = (markdown: string): string => {
  // Only remove backslash escaping from < characters (we no longer escape >)
  return markdown.replace(/\\</g, '<');
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