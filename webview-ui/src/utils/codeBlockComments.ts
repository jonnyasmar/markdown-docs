// Enhanced code block commenting system
// Provides alternative commenting approaches for code blocks where directives don't work
import { logger } from './logger';

export interface CodeBlockComment {
  id: string;
  codeBlockIndex: number;
  lineNumber?: number;
  columnRange?: { start: number; end: number };
  content: string;
  language: string;
  timestamp: number;
  renderStrategy: 'html-comment' | 'sidebar-only' | 'line-annotation';
}

export interface CodeBlockInfo {
  index: number;
  language: string;
  content: string;
  startPosition: number;
  endPosition: number;
  lineCount: number;
}

/**
 * Parse all code blocks in markdown content
 */
export function parseCodeBlocks(markdown: string): CodeBlockInfo[] {
  const codeBlocks: CodeBlockInfo[] = [];
  const regex = /```(\w+)?\n(.*?)```/gs;
  let match;
  let index = 0;

  while ((match = regex.exec(markdown)) !== null) {
    const language = match[1] || 'text';
    const content = match[2];
    const startPosition = match.index;
    const endPosition = match.index + match[0].length;
    const lineCount = content.split('\n').length;

    codeBlocks.push({
      index,
      language,
      content,
      startPosition,
      endPosition,
      lineCount,
    });

    index++;
  }

  return codeBlocks;
}

/**
 * Determine the best commenting strategy for a code selection
 */
export function determineCodeCommentStrategy(
  codeBlock: CodeBlockInfo,
  selectedText: string,
  lineNumber?: number,
): 'html-comment' | 'sidebar-only' | 'line-annotation' {
  // For very short selections, use line annotation
  if (selectedText.length < 50 && lineNumber !== undefined) {
    return 'line-annotation';
  }

  // For languages that support HTML comments, use that approach
  const htmlCommentLanguages = ['html', 'xml', 'svg', 'markdown'];
  if (htmlCommentLanguages.includes(codeBlock.language.toLowerCase())) {
    return 'html-comment';
  }

  // For code that might break with comments, use sidebar only
  const sensitiveLanguages = ['json', 'yaml', 'csv'];
  if (sensitiveLanguages.includes(codeBlock.language.toLowerCase())) {
    return 'sidebar-only';
  }

  // Default to line annotation for most programming languages
  return 'line-annotation';
}

/**
 * Create HTML comment within code block (for HTML/XML languages)
 */
export function insertHTMLComment(
  codeContent: string,
  selectedText: string,
  comment: string,
  commentId: string,
): string {
  const commentMarker = `<!-- COMMENT: ${commentId} - ${comment.replace(/--/g, '—')} -->`;

  // Find the selected text in the code
  const index = codeContent.indexOf(selectedText);
  if (index === -1) {
    logger.warn('Selected text not found in code block');
    return codeContent;
  }

  // Insert comment before the selected text
  const before = codeContent.substring(0, index);
  const after = codeContent.substring(index);

  return `${before}${commentMarker}\n${after}`;
}

/**
 * Create line annotation comment (for most programming languages)
 */
export function insertLineAnnotation(
  codeContent: string,
  selectedText: string,
  comment: string,
  commentId: string,
  language: string,
): string {
  const commentSyntax = getCommentSyntax(language);
  if (!commentSyntax) {
    logger.warn('No comment syntax found for language:', language);
    return codeContent;
  }

  const lines = codeContent.split('\n');
  let targetLineIndex = -1;

  // Find the line containing the selected text
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(selectedText)) {
      targetLineIndex = i;
      break;
    }
  }

  if (targetLineIndex === -1) {
    logger.warn('Selected text not found in any line');
    return codeContent;
  }

  // Insert comment line above the target line
  const commentLine = `${commentSyntax.line} COMMENT(${commentId}): ${comment}`;
  lines.splice(targetLineIndex, 0, commentLine);

  return lines.join('\n');
}

/**
 * Get comment syntax for different programming languages
 */
function getCommentSyntax(language: string): { line: string; block?: { start: string; end: string } } | null {
  const syntaxMap: Record<string, { line: string; block?: { start: string; end: string } }> = {
    javascript: { line: '//', block: { start: '/*', end: '*/' } },
    typescript: { line: '//', block: { start: '/*', end: '*/' } },
    java: { line: '//', block: { start: '/*', end: '*/' } },
    c: { line: '//', block: { start: '/*', end: '*/' } },
    cpp: { line: '//', block: { start: '/*', end: '*/' } },
    'c++': { line: '//', block: { start: '/*', end: '*/' } },
    csharp: { line: '//', block: { start: '/*', end: '*/' } },
    go: { line: '//', block: { start: '/*', end: '*/' } },
    rust: { line: '//', block: { start: '/*', end: '*/' } },
    python: { line: '#', block: { start: '"""', end: '"""' } },
    ruby: { line: '#', block: { start: '=begin', end: '=end' } },
    perl: { line: '#' },
    bash: { line: '#' },
    shell: { line: '#' },
    sh: { line: '#' },
    powershell: { line: '#', block: { start: '<#', end: '#>' } },
    sql: { line: '--', block: { start: '/*', end: '*/' } },
    html: { block: { start: '<!--', end: '-->' } },
    xml: { block: { start: '<!--', end: '-->' } },
    css: { block: { start: '/*', end: '*/' } },
    scss: { line: '//', block: { start: '/*', end: '*/' } },
    sass: { line: '//' },
    less: { line: '//', block: { start: '/*', end: '*/' } },
    php: { line: '//', block: { start: '/*', end: '*/' } },
    lua: { line: '--', block: { start: '--[[', end: ']]' } },
    matlab: { line: '%', block: { start: '%{', end: '%}' } },
    r: { line: '#' },
    swift: { line: '//', block: { start: '/*', end: '*/' } },
    kotlin: { line: '//', block: { start: '/*', end: '*/' } },
    scala: { line: '//', block: { start: '/*', end: '*/' } },
    haskell: { line: '--', block: { start: '{-', end: '-}' } },
    clojure: { line: ';' },
    lisp: { line: ';' },
    scheme: { line: ';' },
    erlang: { line: '%' },
    elixir: { line: '#' },
    vim: { line: '"' },
    ini: { line: ';' },
    toml: { line: '#' },
    yaml: { line: '#' },
    dockerfile: { line: '#' },
    makefile: { line: '#' },
    cmake: { line: '#' },
  };

  return syntaxMap[language.toLowerCase()] || null;
}

/**
 * Create sidebar-only comment reference
 */
export function createSidebarComment(
  selectedText: string,
  comment: string,
  commentId: string,
  codeBlockIndex: number,
  lineNumber?: number,
): CodeBlockComment {
  return {
    id: commentId,
    codeBlockIndex,
    lineNumber,
    content: comment,
    language: 'code',
    timestamp: Date.now(),
    renderStrategy: 'sidebar-only',
  };
}

/**
 * Extract line number and column information from selection within code block
 */
export function getSelectionPosition(
  codeContent: string,
  selectedText: string,
): { line: number; startColumn: number; endColumn: number } | null {
  const lines = codeContent.split('\n');

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const startColumn = line.indexOf(selectedText);

    if (startColumn !== -1) {
      return {
        line: lineIndex + 1, // 1-based line numbers
        startColumn: startColumn + 1, // 1-based column numbers
        endColumn: startColumn + selectedText.length + 1,
      };
    }
  }

  return null;
}

/**
 * Remove code block comment by ID
 */
export function removeCodeBlockComment(
  codeContent: string,
  commentId: string,
  renderStrategy: CodeBlockComment['renderStrategy'],
): string {
  switch (renderStrategy) {
    case 'html-comment': {
      // Remove HTML comment
      const htmlCommentRegex = new RegExp(`<!--\\s*COMMENT:\\s*${commentId}[^>]*-->\\s*\n?`, 'g');
      return codeContent.replace(htmlCommentRegex, '');
    }

    case 'line-annotation': {
      // Remove line comment
      const lineCommentRegex = new RegExp(`^.*COMMENT\\(${commentId}\\):.*\n?`, 'gm');
      return codeContent.replace(lineCommentRegex, '');
    }

    case 'sidebar-only':
      // Nothing to remove from code content
      return codeContent;

    default:
      return codeContent;
  }
}

/**
 * Update existing code block comment
 */
export function updateCodeBlockComment(
  codeContent: string,
  commentId: string,
  newComment: string,
  renderStrategy: CodeBlockComment['renderStrategy'],
): string {
  switch (renderStrategy) {
    case 'html-comment': {
      const htmlCommentRegex = new RegExp(`(<!--\\s*COMMENT:\\s*${commentId}\\s*-\\s*)([^>]*)(-->)`, 'g');
      return codeContent.replace(htmlCommentRegex, `$1${newComment.replace(/--/g, '—')}$3`);
    }
    case 'line-annotation': {
      const lineCommentRegex = new RegExp(`(^.*COMMENT\\(${commentId}\\):\\s*)(.*)`, 'gm');
      return codeContent.replace(lineCommentRegex, `$1${newComment}`);
    }

    case 'sidebar-only':
      // Update handled in sidebar component
      return codeContent;

    default:
      return codeContent;
  }
}
