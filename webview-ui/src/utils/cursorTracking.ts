/**
 * Cursor position tracking utilities with performance optimization
 */

export interface CursorPosition {
  line: number;
  column: number;
}

/**
 * Calculates cursor position from content and selection offset
 * Optimized to run in O(n) time only when needed
 */
export const calculateCursorPosition = (content: string, selectionStart: number): CursorPosition => {
  if (!content || selectionStart === 0) {
    return { line: 1, column: 1 };
  }

  let line = 1;
  let column = 1;

  // Fast iteration using substring instead of charAt for better performance
  for (let i = 0; i < Math.min(selectionStart, content.length); i++) {
    if (content[i] === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }
  }

  return { line, column };
};

/**
 * Gets cursor position from MDX editor selection
 * Works with contenteditable elements safely
 */
export const getCursorPositionFromSelection = (): number => {
  try {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return 0;
    }

    const range = selection.getRangeAt(0);

    // Find the main MDX editor container (not individual paragraphs)
    let editableElement: Node | null = range.startContainer;
    while (editableElement && editableElement.nodeType !== Node.ELEMENT_NODE) {
      editableElement = editableElement.parentNode;
    }

    // Look for the main editor container class, not just any contenteditable
    while (
      editableElement &&
      !(
        (editableElement as Element).classList?.contains('mdxeditor-root-contenteditable') ||
        (editableElement as Element).classList?.contains('mdxeditor')
      )
    ) {
      editableElement = editableElement.parentNode;
    }

    if (!editableElement) {
      return 0;
    }

    // Create range from start of editable to cursor
    const preCaretRange = document.createRange();
    preCaretRange.selectNodeContents(editableElement);
    preCaretRange.setEnd(range.startContainer, range.startOffset);

    const offset = preCaretRange.toString().length;

    return offset;
  } catch (error) {
    return 0;
  }
};

/**
 * Debounced cursor position tracker
 * Only updates position after user stops interacting for specified delay
 */
export class CursorTracker {
  private position: CursorPosition = { line: 1, column: 1 };
  private timeoutId: number | null = null;
  private readonly debounceMs: number;
  private readonly callback: (position: CursorPosition) => void;

  constructor(callback: (position: CursorPosition) => void, debounceMs = 150) {
    this.callback = callback;
    this.debounceMs = debounceMs;
  }

  updatePosition(content: string): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = window.setTimeout(() => {
      const selectionStart = getCursorPositionFromSelection();
      const newPosition = calculateCursorPosition(content, selectionStart);

      // Only update if position actually changed
      if (newPosition.line !== this.position.line || newPosition.column !== this.position.column) {
        this.position = newPosition;
        this.callback(newPosition);
      }
    }, this.debounceMs);
  }

  destroy(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
  }
}
