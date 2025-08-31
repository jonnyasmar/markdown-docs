// Text normalization utilities for reliable comment insertion
// Handles formatted text, markdown syntax, and robust text matching
import { logger } from './logger';

export interface FormattingInfo {
  type: 'bold' | 'italic' | 'link' | 'code' | 'strikethrough';
  start: number;
  end: number;
  originalSyntax: string;
  innerText: string;
}

export interface NormalizedSelection {
  cleanText: string;
  originalText: string;
  formatting: FormattingInfo[];
  hasFormatting: boolean;
}

/**
 * Normalize selected text by removing markdown formatting while preserving structure info
 */
export function normalizeSelection(selectedText: string): NormalizedSelection {
  const formatting: FormattingInfo[] = [];
  let cleanText = selectedText;
  let offset = 0;

  // Pattern matching for markdown formatting (order matters for nested formatting)
  const patterns = [
    // Bold (**text** or __text__)
    {
      regex: /(\*\*|__)(.*?)\1/g,
      type: 'bold' as const,
      syntaxLength: 2,
    },
    // Italic (*text* or _text_) - after bold to avoid conflicts
    {
      regex: /(\*|_)(.*?)\1/g,
      type: 'italic' as const,
      syntaxLength: 1,
    },
    // Links [text](url)
    {
      regex: /\[([^\]]+)\]\([^)]+\)/g,
      type: 'link' as const,
      syntaxLength: 0, // Variable length, handle specially
      replacement: '$1',
    },
    // Inline code `text`
    {
      regex: /`([^`]+)`/g,
      type: 'code' as const,
      syntaxLength: 1,
    },
    // Strikethrough ~~text~~
    {
      regex: /~~(.*?)~~/g,
      type: 'strikethrough' as const,
      syntaxLength: 2,
    },
  ];

  // Extract formatting information before cleaning
  patterns.forEach(pattern => {
    let match;
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);

    while ((match = regex.exec(selectedText)) !== null) {
      const originalSyntax = match[0];
      const innerText = pattern.replacement
        ? match[0].replace(regex, pattern.replacement)
        : match[pattern.syntaxLength > 0 ? 2 : 1];

      formatting.push({
        type: pattern.type,
        start: match.index - offset,
        end: match.index - offset + innerText.length,
        originalSyntax,
        innerText,
      });

      // Update offset for next pattern
      offset += originalSyntax.length - innerText.length;
    }
  });

  // Clean the text by removing all formatting
  patterns.forEach(pattern => {
    if (pattern.replacement) {
      cleanText = cleanText.replace(pattern.regex, pattern.replacement);
    } else {
      cleanText = cleanText.replace(pattern.regex, `$${pattern.syntaxLength > 0 ? 2 : 1}`);
    }
  });

  return {
    cleanText: cleanText.trim(),
    originalText: selectedText,
    formatting,
    hasFormatting: formatting.length > 0,
  };
}

/**
 * Robust text matching that handles formatting differences
 */
export function findTextInMarkdown(markdown: string, targetText: string): number {
  logger.debug('Finding text in markdown:', { targetText: targetText.substring(0, 50) });

  // Try exact match first (fastest path)
  const index = markdown.indexOf(targetText);
  if (index !== -1) {
    logger.debug('Found exact match at index:', index);
    return index;
  }

  // Try normalized matching for formatted text
  const normalizedTarget = normalizeSelection(targetText);

  // If target has formatting, search for the clean text and nearby formatting
  if (normalizedTarget.hasFormatting) {
    logger.debug('Target has formatting, searching for clean text:', normalizedTarget.cleanText);

    // Look for the clean text in the markdown
    const cleanMatches = findAllMatches(markdown, normalizedTarget.cleanText);

    for (const match of cleanMatches) {
      // Check if this match is surrounded by the expected formatting
      if (isFormattedMatch(markdown, match, normalizedTarget)) {
        logger.debug('Found formatted match at index:', match.index);
        return match.index;
      }
    }
  }

  // Try fuzzy matching for edge cases
  const fuzzyMatch = findFuzzyMatch(markdown, targetText);
  if (fuzzyMatch !== -1) {
    logger.debug('Found fuzzy match at index:', fuzzyMatch);
    return fuzzyMatch;
  }

  logger.warn('Text not found in markdown:', targetText.substring(0, 50));
  return -1;
}

/**
 * Find all occurrences of text in markdown
 */
function findAllMatches(text: string, search: string): Array<{ index: number; match: string }> {
  const matches = [];
  let index = text.indexOf(search);

  while (index !== -1) {
    matches.push({ index, match: search });
    index = text.indexOf(search, index + 1);
  }

  return matches;
}

/**
 * Check if a text match is surrounded by expected formatting
 */
function isFormattedMatch(
  markdown: string,
  match: { index: number; match: string },
  normalized: NormalizedSelection,
): boolean {
  const start = match.index;
  const end = match.index + match.match.length;

  // Look for formatting markers around the match
  const beforeText = markdown.substring(Math.max(0, start - 10), start);
  const afterText = markdown.substring(end, Math.min(markdown.length, end + 10));

  // Check if the expected formatting markers are present
  for (const format of normalized.formatting) {
    const expectedMarkers = getMarkdownMarkers(format.type);

    for (const marker of expectedMarkers) {
      if (beforeText.endsWith(marker) && afterText.startsWith(marker)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Get possible markdown markers for a formatting type
 */
function getMarkdownMarkers(type: FormattingInfo['type']): string[] {
  switch (type) {
    case 'bold':
      return ['**', '__'];
    case 'italic':
      return ['*', '_'];
    case 'code':
      return ['`'];
    case 'strikethrough':
      return ['~~'];
    case 'link':
      return ['][', ']('];
    default:
      return [];
  }
}

/**
 * Fuzzy matching for edge cases where text might have minor differences
 */
function findFuzzyMatch(markdown: string, targetText: string): number {
  const normalizedMarkdown = markdown.replace(/\s+/g, ' ').trim();
  const normalizedTarget = targetText.replace(/\s+/g, ' ').trim();

  // Try normalized whitespace matching
  let index = normalizedMarkdown.indexOf(normalizedTarget);
  if (index !== -1) {
    // Map back to original markdown position (approximate)
    return mapNormalizedToOriginal(markdown, normalizedMarkdown, index);
  }

  // Try partial matching for very long selections
  if (normalizedTarget.length > 100) {
    const shortTarget = normalizedTarget.substring(0, 50);
    index = normalizedMarkdown.indexOf(shortTarget);
    if (index !== -1) {
      return mapNormalizedToOriginal(markdown, normalizedMarkdown, index);
    }
  }

  return -1;
}

/**
 * Map position from normalized text back to original text
 */
function mapNormalizedToOriginal(original: string, normalized: string, normalizedIndex: number): number {
  // This is a simplified mapping - for production use, you'd want more sophisticated position tracking
  let originalIndex = 0;
  let normalizedTracker = 0;

  while (originalIndex < original.length && normalizedTracker < normalizedIndex) {
    const originalChar = original[originalIndex];
    const normalizedChar = normalized[normalizedTracker];

    if (originalChar === normalizedChar) {
      originalIndex++;
      normalizedTracker++;
    } else if (/\s/.test(originalChar)) {
      // Skip whitespace in original
      originalIndex++;
    } else {
      // Character difference, advance both
      originalIndex++;
      normalizedTracker++;
    }
  }

  return originalIndex;
}

/**
 * Enhanced escaping for directive content that preserves markdown syntax
 */
export function escapeDirectiveContent(text: string, preserveFormatting = false): string {
  const replacements = [
    { regex: /\\/g, replacement: '__BSLASH__' },
    { regex: /"/g, replacement: '__DQUOTE__' },
    { regex: /'/g, replacement: '__SQUOTE__' },
    { regex: /\n/g, replacement: '__NEWLINE__' },
    { regex: /\v/g, replacement: '__VTAB__' },
    { regex: /\r/g, replacement: '__CR__' },
  ];

  // Only escape markdown syntax if not preserving formatting
  if (!preserveFormatting) {
    replacements.push(
      { regex: /\*/g, replacement: '__ASTERISK__' },
      { regex: /\[/g, replacement: '__LBRACKET__' },
      { regex: /\]/g, replacement: '__RBRACKET__' },
      { regex: /#/g, replacement: '__HASH__' },
      { regex: /~/g, replacement: '__TILDE__' },
      { regex: /`/g, replacement: '__BACKTICK__' },
    );
  }

  return replacements.reduce((acc, replacement) => acc.replace(replacement.regex, replacement.replacement), text);
}

/**
 * Check if text selection is within a code block
 */
export function isWithinCodeBlock(markdown: string, selectionStart: number): boolean {
  const beforeSelection = markdown.substring(0, selectionStart);

  // Count code block markers before and after selection
  const codeBlocksBefore = (beforeSelection.match(/```/g) ?? []).length;

  // If odd number of markers before, we're inside a code block
  // Remove unused variable
  return codeBlocksBefore % 2 === 1;
}

/**
 * Detect if selection spans multiple code blocks or mixed content
 */
export function analyzeSelectionContext(
  markdown: string,
  selectedText: string,
): {
  isInCodeBlock: boolean;
  spansCodeBlocks: boolean;
  codeBlockLanguage?: string;
  recommendedStrategy: 'inline' | 'sidebar' | 'hybrid';
} {
  const selectionStart = markdown.indexOf(selectedText);
  if (selectionStart === -1) {
    return { isInCodeBlock: false, spansCodeBlocks: false, recommendedStrategy: 'sidebar' };
  }

  const selectionEnd = selectionStart + selectedText.length;
  const isInCodeBlock = isWithinCodeBlock(markdown, selectionStart);

  // Check if selection spans multiple code blocks
  const selectionContent = markdown.substring(selectionStart, selectionEnd);
  const codeBlockMarkers = (selectionContent.match(/```/g) ?? []).length;
  const spansCodeBlocks = codeBlockMarkers > 0;

  // Extract language if in code block
  let codeBlockLanguage: string | undefined;
  if (isInCodeBlock) {
    const beforeSelection = markdown.substring(0, selectionStart);
    const lastCodeBlockMatch = beforeSelection.match(/```(\w+)?[^\n]*\n[^`]*$/);
    codeBlockLanguage = lastCodeBlockMatch?.[1] ?? 'text';
  }

  // Recommend strategy based on context
  let recommendedStrategy: 'inline' | 'sidebar' | 'hybrid';
  if (isInCodeBlock || spansCodeBlocks) {
    recommendedStrategy = 'sidebar';
  } else if (selectedText.includes('\n\n')) {
    recommendedStrategy = 'hybrid'; // Container directive + sidebar reference
  } else {
    recommendedStrategy = 'inline';
  }

  return {
    isInCodeBlock,
    spansCodeBlocks,
    codeBlockLanguage,
    recommendedStrategy,
  };
}
