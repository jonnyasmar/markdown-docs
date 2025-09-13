import { RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CursorPosition, CursorTracker } from '../../utils/cursorTracking';

interface EditorRef {
  getMarkdown?: () => string;
}

interface EditorStatus {
  cursorPosition: CursorPosition;
  wordCount: number;
  charCount: number;
  readingTime: number;
  selectionLength: number;
}

/**
 * Custom hook for tracking editor status with performance optimization
 * Designed to have zero impact on typing performance
 */
export const useEditorStatus = (
  content: string,
  selectedText?: string,
  isTyping?: boolean,
  editorRef?: RefObject<EditorRef>,
): EditorStatus => {
  const [cursorPosition, setCursorPosition] = useState<CursorPosition>({ line: 1, column: 1 });
  const [stats, setStats] = useState({ wordCount: 0, charCount: 0, readingTime: 0 });

  // Refs for timeout management - critical for proper cleanup
  const statsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cursorTrackerRef = useRef<CursorTracker | null>(null);

  // PERFORMANCE FIX: Stable stats calculation to prevent constant recreation
  const calculateStats = useCallback(() => {
    const markdownContent = editorRef?.current?.getMarkdown?.() ?? content;

    if (!markdownContent) {
      setStats({ wordCount: 0, charCount: 0, readingTime: 0 });
      return;
    }

    // Update cursor position with current content
    cursorTrackerRef.current?.updatePosition(String(markdownContent));

    const charCount = String(markdownContent).length;
    // PERFORMANCE FIX: More efficient word counting - avoid filter()
    const words = String(markdownContent).trim().split(/\s+/);
    const wordCount =
      Array.isArray(words) && words.length === 1 && words[0] === '' ? 0 : Array.isArray(words) ? words.length : 0;
    const readingTime = Math.ceil(Number(wordCount) / 200);

    setStats({ wordCount, charCount, readingTime });
  }, [content, editorRef]); // CRITICAL: Remove content dep to prevent constant recreation

  // Initialize cursor tracker
  useEffect(() => {
    cursorTrackerRef.current = new CursorTracker(setCursorPosition, 250);

    return () => {
      cursorTrackerRef.current?.destroy();
    };
  }, []);

  // Update stats and cursor position (debounced)
  useEffect(() => {
    // Clear existing timeout
    if (statsTimeoutRef.current) {
      clearTimeout(statsTimeoutRef.current);
      statsTimeoutRef.current = null;
    }

    // isTyping in deps to trigger effect, but debounce handles performance
    statsTimeoutRef.current = setTimeout(calculateStats, 250);

    return () => {
      if (statsTimeoutRef.current) {
        clearTimeout(statsTimeoutRef.current);
        statsTimeoutRef.current = null;
      }
    };
  }, [content, calculateStats, isTyping]);

  return useMemo(
    () => ({
      cursorPosition,
      wordCount: stats.wordCount,
      charCount: stats.charCount,
      readingTime: stats.readingTime,
      selectionLength: selectedText?.length ?? 0,
    }),
    [cursorPosition, stats.wordCount, stats.charCount, stats.readingTime, selectedText],
  );
};
