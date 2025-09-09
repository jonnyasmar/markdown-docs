import { CommentItem } from '@/components/CommentItem';
import { CommentModal } from '@/components/CommentModal';
import { CommentsSidebar } from '@/components/CommentsSidebar';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { FloatingCommentButton } from '@/components/FloatingCommentButton';
import { StatusBar } from '@/components/StatusBar';
import { TableOfContents } from '@/components/TableOfContents';
import { postprocessAngleBrackets, preprocessAngleBrackets } from '@/components/plugins/escapeCharPlugin';
import { usePlugins } from '@/hooks/usePlugins';
import { useViewModeTracking } from '@/hooks/useViewModeTracking';
import { MDXEditor, type MDXEditorMethods } from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import { TableOfContents as TableOfContentsIcon } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { DirectiveService } from '../services/directive';
import { CommentWithAnchor, FontFamily } from '../types';
import {
  postContentEdit,
  postContentSave,
  postError,
  postExternalLink,
  postGetFont,
  postReady,
  postUserInteraction,
} from '../utils/extensionMessaging';
import { logger } from '../utils/logger';
import { escapeDirectiveContent } from '../utils/textNormalization';
import './MDXEditorWrapper.css';
import './MermaidEditor.css';

interface EditorConfig {
  wordWrap: string; // 'off' | 'on' | 'wordWrapColumn' | 'bounded'
}

interface MDXEditorWrapperProps {
  markdown: string;
  onMarkdownChange: (markdown: string) => void;
  onNavigateToComment?: (commentId: string) => void;
  onEditComment?: (commentId: string) => void;
  onDeleteComment?: (commentId: string) => void;
  defaultFont?: FontFamily;
  fontSize?: number;
  textAlign?: string;
  bookView?: boolean;
  bookViewWidth?: string;
  bookViewMargin?: string;
  editorConfig?: EditorConfig;
}

export const MDXEditorWrapper: React.FC<MDXEditorWrapperProps> = ({
  markdown,
  onMarkdownChange,
  onNavigateToComment,
  defaultFont = 'Default',
  fontSize = 14,
  textAlign = 'left',
  bookView = false,
  bookViewWidth = '5.5in',
  bookViewMargin = '0.5in',
}) => {
  const editorRef = useRef<MDXEditorMethods>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const hasInitiallyFocusedRef = useRef(false);
  const preSourceContentRef = useRef<string | null>(null);
  const currentViewModeRef = useRef<'rich-text' | 'source' | 'diff'>('rich-text');
  const typingTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const sendEditTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const deferredMessageTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const parseCommentTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const hasAppliedInitialEscapingRef = useRef(false);
  const dirtyStateTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const selectionRafRef = useRef<number | null>(null);
  const regexCacheRef = useRef<Map<string, RegExp[]>>(new Map());
  const lastParsedContentRef = useRef<string>('');

  const [selectedFont, setSelectedFont] = useState(defaultFont);
  const [showCommentSidebar, setShowCommentSidebar] = useState(false);
  const [showTOCSidebar, setShowTOCSidebar] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [showFloatingButton, setShowFloatingButton] = useState(false);
  const [floatingButtonPosition, setFloatingButtonPosition] = useState<{ x: number; y: number } | null>(null);
  const [pendingComment, setPendingComment] = useState<{
    comment: string;
    commentId: string;
    selectedText: string;
    strategy: 'inline' | 'container';
  } | null>(null);
  const [editingComment, setEditingComment] = useState<CommentWithAnchor | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [focusedCommentId, setFocusedCommentId] = useState<string | null>(null);
  const [currentViewMode, setCurrentViewMode] = useState<'rich-text' | 'source' | 'diff'>('rich-text');
  const [liveMarkdown, setLiveMarkdown] = useState(markdown);
  const [isTyping, setIsTyping] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(true);
  const [parsedComments, setParsedComments] = useState<CommentWithAnchor[]>([]);

  // Detect VS Code theme on mount and when it changes
  useEffect(() => {
    const detectTheme = () => {
      const isDark = document.querySelector('[data-vscode-theme-kind="vscode-dark"]') !== null;
      console.log('isDark', isDark);
      setIsDarkTheme(isDark);
    };

    detectTheme();

    // Listen for theme changes via mutation observer
    const observer = new MutationObserver(detectTheme);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-vscode-theme-kind'] });

    return () => observer.disconnect();
  }, []);

  // Handle view mode changes to hide comments in source/diff view
  const handleViewModeChange = useCallback(
    (mode: 'rich-text' | 'source' | 'diff') => {
      // When entering source mode: store current escaped content and show clean version
      if (currentViewMode !== 'source' && mode === 'source' && editorRef.current) {
        try {
          const currentContent = editorRef.current.getMarkdown();
          preSourceContentRef.current = currentContent; // Store escaped version

          // Reset escaping flag for source mode
          hasAppliedInitialEscapingRef.current = false;

          // Show clean content in source view
          const cleanContent = postprocessAngleBrackets(currentContent);
          editorRef.current.setMarkdown(cleanContent);
        } catch (error) {
          logger.error('Error entering source mode:', error);
        }
      }

      // When leaving source mode: always restore original escaped content, let sync handle changes
      if (currentViewMode === 'source' && mode !== 'source' && editorRef.current) {
        try {
          const sourceContent = editorRef.current.getMarkdown();

          if (preSourceContentRef.current) {
            const originalCleanContent = postprocessAngleBrackets(preSourceContentRef.current);

            if (sourceContent === originalCleanContent) {
              // Source wasn't edited, restore original escaped content
              editorRef.current.setMarkdown(preSourceContentRef.current);
            } else {
              // Source was edited, preprocess the new clean content
              const processedContent = preprocessAngleBrackets(sourceContent);
              editorRef.current.setMarkdown(processedContent);
            }
          }

          // Reset escaping flag for rich-text mode
          hasAppliedInitialEscapingRef.current = false;
          preSourceContentRef.current = null;
        } catch (error) {
          logger.error('Error leaving source mode:', error);
        }
      }

      // Update both state and ref immediately to prevent timing issues
      currentViewModeRef.current = mode;
      setCurrentViewMode(mode);

      // Hide floating button and comment selection when not in rich-text mode
      if (mode !== 'rich-text') {
        setShowFloatingButton(false);
        setSelectedText('');
      }
    },
    [currentViewMode],
  );

  useViewModeTracking(handleViewModeChange);

  // Handle TOC heading navigation
  const handleHeadingNavigation = useCallback((headingId: string) => {
    // Find the heading element in the editor
    const editorContainer = document.querySelector('.mdxeditor-root-contenteditable');
    if (!editorContainer) {
      return;
    }

    // Generate the same IDs as the TOC component to find the correct heading
    const headings = editorContainer.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const idCounts: Record<string, number> = {};

    for (let i = 0; i < headings.length; i++) {
      const heading = headings[i];
      const headingText = heading.textContent?.trim() ?? '';
      const baseId = headingText
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');

      // Generate ID using same logic as TOC
      let generatedId = baseId;
      if (idCounts[baseId]) {
        idCounts[baseId]++;
        generatedId = `${baseId}-${idCounts[baseId]}`;
      } else {
        idCounts[baseId] = 1;
      }

      if (generatedId === headingId) {
        // Add some offset to prevent overscroll
        const rect = heading.getBoundingClientRect();
        const editorRect = editorContainer.getBoundingClientRect();
        const offset = rect.top - editorRect.top - 20; // 20px padding from top

        editorContainer.scrollBy({
          top: offset,
          behavior: 'smooth',
        });
        break;
      }
    }
  }, []);

  // Handle link clicks in the editor
  useEffect(() => {
    const handleLinkClick = (event: Event) => {
      const target = event.target as HTMLElement;

      // Check if clicked element is a link
      if (target.tagName === 'A' || target.closest('a')) {
        const link =
          target.tagName === 'A' ? (target as HTMLAnchorElement) : (target.closest('a') as HTMLAnchorElement);
        const href = link?.getAttribute('href');

        if (!href) {
          return;
        }

        (event as MouseEvent).preventDefault();

        // Handle internal anchor links (e.g., #heading)
        if (href.startsWith('#')) {
          const headingId = href.substring(1);
          handleHeadingNavigation(headingId);
        }
        // Handle external links
        else if (href.startsWith('http://') || href.startsWith('https://')) {
          postExternalLink(href);
        }
      }
    };

    const editorContainer = document.querySelector('.mdxeditor-root-contenteditable');
    if (editorContainer) {
      editorContainer.addEventListener('click', handleLinkClick);
      return () => editorContainer.removeEventListener('click', handleLinkClick);
    }
  }, [handleHeadingNavigation]);

  // Load saved font preference from VS Code settings on mount and signal ready
  useEffect(() => {
    postReady();
    postGetFont();
  }, []);

  // PERFORMANCE CRITICAL: Comment position cache - ONLY recalculate when comments change
  // NOT when markdown changes (which happens on every keystroke)
  const commentPositions = useMemo(() => {
    const positions = new Map<string, number>();
    if (!markdown || parsedComments.length === 0) {
      return positions;
    }

    // Memory leak prevention: Limit cache size to prevent unbounded growth
    const MAX_CACHE_SIZE = 1000;

    // Performance optimization: Pre-compile and cache regex patterns per comment id
    const getPatterns = (commentId: string): RegExp[] => {
      const cached = regexCacheRef.current.get(commentId);
      if (cached) {
        return cached;
      }
      const compiled = [
        new RegExp(`:comment\\[([^\\]]*)\\]\\{[^}]*(?:id="${commentId}"|#${commentId})[^}]*\\}`),
        new RegExp(`::comment\\[([^\\]]*)\\]\\{[^}]*(?:id="${commentId}"|#${commentId})[^}]*\\}`),
        new RegExp(`:::comment\\{[^}]*(?:id="${commentId}"|#${commentId})[^}]*\\}`),
      ];
      regexCacheRef.current.set(commentId, compiled);
      return compiled;
    };

    // Cache positions of all comment directives for fast sorting
    parsedComments.forEach(comment => {
      // Skip caching if we've hit the limit
      if (positions.size >= MAX_CACHE_SIZE) {
        return;
      }

      const patterns = getPatterns(comment.id);

      for (const regex of patterns) {
        const match = markdown.search(regex);
        if (match !== -1) {
          positions.set(comment.id, match);
          break;
        }
      }
    });

    return positions;
  }, [markdown, parsedComments]);

  const handleEditComment = useCallback(
    (commentId: string) => {
      // Find the comment to edit in our parsed comments
      const commentToEdit = parsedComments.find(c => c.id === commentId);
      if (commentToEdit) {
        setEditingComment(commentToEdit);
        setShowEditModal(true);
      } else {
        logger.error('Comment not found for editing:', commentId);
      }
    },
    [parsedComments],
  );

  const handleDeleteComment = useCallback(
    (commentId: string) => {
      // PERFORMANCE FIX: Get current markdown from editor ref instead of stale prop
      const currentMarkdown = editorRef.current?.getMarkdown() ?? markdown;
      if (!currentMarkdown) {
        logger.error('No markdown content to delete comment from');
        return;
      }

      // Performance optimization: Use cached position for faster comment deletion
      const cachedPosition = commentPositions.get(commentId);
      let updatedMarkdown = currentMarkdown;
      let found = false;

      if (cachedPosition !== undefined) {
        // Fast path: Use cached position to find comment more efficiently
        const beforeComment = currentMarkdown.substring(0, cachedPosition);
        const afterCommentStart = currentMarkdown.substring(cachedPosition);

        // Find comment directive end using minimal regex
        const inlineMatch = afterCommentStart.match(/^(::|:)?comment\[([^\]]*)\]\{[^}]*\}/);
        const containerMatch = afterCommentStart.match(/^:::comment\{[^}]*\}[\s\S]*?:::/);

        if (inlineMatch) {
          const originalText = inlineMatch[2] || '';
          updatedMarkdown = beforeComment + originalText + afterCommentStart.substring(inlineMatch[0].length);
          found = true;
        } else if (containerMatch) {
          const containerContent = containerMatch[0];
          const contentMatch = containerContent.match(/:::comment\{[^}]*\}([\s\S]*?):::/);
          const innerContent = contentMatch ? contentMatch[1].trim() : '';
          updatedMarkdown = beforeComment + innerContent + afterCommentStart.substring(containerMatch[0].length);
          found = true;
        }
      }

      // Fallback: Original regex patterns if cached position lookup failed
      if (!found) {
        const patterns = [
          // Inline comment patterns - try multiple formats
          `:comment\\[([^\\]]*)\\]\\{[^}]*(?:id="${commentId}"|#${commentId})[^}]*\\}`,
          `::comment\\[([^\\]]*)\\]\\{[^}]*(?:id="${commentId}"|#${commentId})[^}]*\\}`,
          // Container comment patterns
          `:::comment\\{[^}]*(?:id="${commentId}"|#${commentId})[^}]*\\}[\\s\\S]*?:::`,
          `:::comment\\{[^}]*(?:id="${commentId}"|#${commentId})[^}]*\\}.*?\\n\\s*:::`,
        ];

        for (const pattern of patterns) {
          const regex = new RegExp(pattern, 'g');
          const matches = [...currentMarkdown.matchAll(regex)];

          if (matches.length > 0) {
            updatedMarkdown = updatedMarkdown.replace(regex, (match, capturedContent) => {
              // For inline comments, return the captured content (the original text)
              // For container comments, we need to extract the content between the directives
              if (match.includes(':::')) {
                // Container comment - extract content between opening and closing :::
                const contentMatch = match.match(/:::comment\{[^}]*\}([\s\S]*?):::/);
                return contentMatch ? contentMatch[1].trim() : '';
              } else {
                // Inline comment - return the captured content in brackets
                return String(capturedContent || '');
              }
            });
            found = true;
            break;
          }
        }
      }

      if (found) {
        if (editorRef.current) {
          editorRef.current.setMarkdown(updatedMarkdown);
        }

        // Immediately update parsedComments to reflect deletion in the sidebar
        try {
          const comments = DirectiveService.parseCommentDirectives(updatedMarkdown);
          const commentsWithAnchor: CommentWithAnchor[] = comments.map(comment => ({
            ...comment,
            anchoredText: comment.anchoredText ?? 'Selected text',
            startPosition: 0,
            endPosition: 0,
          }));
          setParsedComments(commentsWithAnchor);
          // Keep the debounce effect from skipping the next parse
          lastParsedContentRef.current = updatedMarkdown;
        } catch (error) {
          logger.error('Error parsing comments after deletion:', error);
        }

        // Clear focus if we deleted the focused comment
        if (focusedCommentId === commentId) {
          setFocusedCommentId(null);
        }

        onMarkdownChange(updatedMarkdown);
      }
    },
    [markdown, commentPositions, focusedCommentId, onMarkdownChange],
  );

  const handleCommentClick = useCallback(
    (commentId: string) => {
      document.querySelectorAll('.comment-highlight.focused').forEach(el => {
        el.classList.remove('focused');
      });
      // Set focus state for this comment
      setFocusedCommentId(commentId);

      // Call external navigation handler if provided
      if (onNavigateToComment) {
        onNavigateToComment(commentId);
      }

      // Find comment directive element in the editor - try multiple selectors
      const containerElement = containerRef.current ?? document;
      let commentElement = containerElement.querySelector(`[data-comment-id="${commentId}"]`) as HTMLElement;

      // Fallback selectors if the first doesn't work
      if (!commentElement) {
        commentElement = containerElement.querySelector(`[data-directive-key*="${commentId}"]`) as HTMLElement;
      }
      if (!commentElement) {
        commentElement = containerElement.querySelector(`.comment-highlight[title*="${commentId}"]`) as HTMLElement;
      }

      if (commentElement) {
        // Use nearest scroll behavior to minimize view jumping
        commentElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest', // This will minimize scrolling if element is already visible
          inline: 'nearest',
        });

        // Add highlight class for visual feedback
        // First, force a reflow to ensure the scroll completes
        commentElement.offsetHeight;

        // Add the highlight class immediately
        commentElement.classList.add('focused');

        // Remove highlight after animation completes
        setTimeout(() => {
          if (commentElement.classList.contains('focused')) {
            //commentElement.classList.remove('editor-highlighted');
            //commentElement.classList.add('focused');
          }
        }, 2000);
      }
    },
    [onNavigateToComment],
  );

  // Memoized sorted comments using cached positions - MASSIVE performance improvement
  const sortedCommentItems = useMemo(() => {
    if (parsedComments.length === 0) {
      return [];
    }

    const sortedComments = [...parsedComments].sort((a, b) => {
      // Use cached positions for O(1) sorting instead of O(n*m) regex searches
      const aPos = commentPositions.get(a.id) ?? -1;
      const bPos = commentPositions.get(b.id) ?? -1;

      // Both positions found - sort by cached position (ultra-fast)
      if (aPos !== -1 && bPos !== -1) {
        return aPos - bPos;
      }

      // One position missing - prioritize found position
      if (aPos !== -1 && bPos === -1) {
        return -1;
      }
      if (bPos !== -1 && aPos === -1) {
        return 1;
      }

      // Both missing - fallback to timestamp
      const aTime = new Date(a.timestamp).getTime();
      const bTime = new Date(b.timestamp).getTime();
      return aTime - bTime;
    });

    return sortedComments.map(comment => (
      <CommentItem
        key={comment.id}
        comment={comment}
        isFocused={focusedCommentId === comment.id}
        onCommentClick={handleCommentClick}
        onDeleteComment={handleDeleteComment}
        onEditComment={handleEditComment}
      />
    ));
  }, [commentPositions, focusedCommentId, handleCommentClick, handleDeleteComment, handleEditComment, parsedComments]);

  // Comment navigation handlers
  const handleNavigateToPrevComment = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (parsedComments.length === 0) {
        return;
      }

      console.log('Navigate to previous - focusedCommentId:', focusedCommentId);

      // Sort comments by position to get consistent ordering (same as sidebar)
      const sortedComments = [...parsedComments].sort((a, b) => {
        const aPos = commentPositions.get(a.id) ?? -1;
        const bPos = commentPositions.get(b.id) ?? -1;
        if (aPos !== -1 && bPos !== -1) {
          return aPos - bPos;
        }
        if (aPos !== -1 && bPos === -1) {
          return -1;
        }
        if (bPos !== -1 && aPos === -1) {
          return 1;
        }
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      });

      let targetCommentId: string;

      if (!focusedCommentId) {
        // No focused comment - go to last comment
        targetCommentId = sortedComments[sortedComments.length - 1].id;
        console.log('No focused comment, going to last:', targetCommentId);
      } else {
        // Find current focused comment index in sorted array
        const currentIndex = sortedComments.findIndex(c => c.id === focusedCommentId);
        console.log('Current index in sorted array:', currentIndex);

        if (currentIndex > 0) {
          // Go to previous comment
          targetCommentId = sortedComments[currentIndex - 1].id;
          console.log('Going to previous comment:', targetCommentId);
        } else {
          // At first comment - go to last comment (wrap around)
          targetCommentId = sortedComments[sortedComments.length - 1].id;
          console.log('At first comment, wrapping to last:', targetCommentId);
        }
      }

      handleCommentClick(targetCommentId);
    },
    [parsedComments, commentPositions, focusedCommentId, handleCommentClick],
  );

  const handleNavigateToNextComment = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (parsedComments.length === 0) {
        return;
      }

      console.log('Navigate to next - focusedCommentId:', focusedCommentId);

      // Sort comments by position to get consistent ordering (same as sidebar)
      const sortedComments = [...parsedComments].sort((a, b) => {
        const aPos = commentPositions.get(a.id) ?? -1;
        const bPos = commentPositions.get(b.id) ?? -1;
        if (aPos !== -1 && bPos !== -1) {
          return aPos - bPos;
        }
        if (aPos !== -1 && bPos === -1) {
          return -1;
        }
        if (bPos !== -1 && aPos === -1) {
          return 1;
        }
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      });

      let targetCommentId: string;

      if (!focusedCommentId) {
        // No focused comment - go to first comment
        targetCommentId = sortedComments[0].id;
        console.log('No focused comment, going to first:', targetCommentId);
      } else {
        // Find current focused comment index in sorted array
        const currentIndex = sortedComments.findIndex(c => c.id === focusedCommentId);
        console.log('Current index in sorted array:', currentIndex);

        if (currentIndex < sortedComments.length - 1) {
          // Go to next comment
          targetCommentId = sortedComments[currentIndex + 1].id;
          console.log('Going to next comment:', targetCommentId);
        } else {
          // At last comment - go to first comment (wrap around)
          targetCommentId = sortedComments[0].id;
          console.log('At last comment, wrapping to first:', targetCommentId);
        }
      }

      handleCommentClick(targetCommentId);
    },
    [parsedComments, commentPositions, focusedCommentId, handleCommentClick],
  );

  useEffect(() => {
    const currentContent = liveMarkdown ?? markdown ?? '';

    if (!currentContent) {
      setParsedComments([]);
      lastParsedContentRef.current = '';
      return;
    }

    // Skip redundant parsing when content hasn't changed
    if (currentContent === lastParsedContentRef.current) {
      return;
    }

    if (parseCommentTimeoutRef.current) {
      clearTimeout(parseCommentTimeoutRef.current);
    }

    // Heavy debounce - only after user completely stops typing for 800ms
    parseCommentTimeoutRef.current = setTimeout(() => {
      try {
        const comments = DirectiveService.parseCommentDirectives(currentContent);
        const commentsWithAnchor: CommentWithAnchor[] = comments.map(comment => ({
          ...comment,
          anchoredText: comment.anchoredText ?? 'Selected text',
          startPosition: 0,
          endPosition: 0,
        }));
        lastParsedContentRef.current = currentContent;
        setParsedComments(commentsWithAnchor);
      } catch (error) {
        logger.error('Error parsing comments:', error);
        setParsedComments([]);
      }
    }, 800);

    return () => {
      if (parseCommentTimeoutRef.current) {
        clearTimeout(parseCommentTimeoutRef.current);
      }
    };
  }, [liveMarkdown, markdown]);

  // Cleanup timeouts on unmount - Enhanced memory leak fix
  useEffect(() => {
    return () => {
      // Clear all timeout refs to prevent memory leaks
      if (dirtyStateTimeoutRef.current) {
        clearTimeout(dirtyStateTimeoutRef.current);
        dirtyStateTimeoutRef.current = undefined;
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = undefined;
      }
      if (sendEditTimeoutRef.current) {
        clearTimeout(sendEditTimeoutRef.current);
        sendEditTimeoutRef.current = undefined;
      }
      if (deferredMessageTimeoutRef.current) {
        clearTimeout(deferredMessageTimeoutRef.current);
        deferredMessageTimeoutRef.current = undefined;
      }
      if (parseCommentTimeoutRef.current) {
        clearTimeout(parseCommentTimeoutRef.current);
        parseCommentTimeoutRef.current = undefined;
      }
      if (selectionRafRef.current) {
        cancelAnimationFrame(selectionRafRef.current);
        selectionRafRef.current = null;
      }
    };
  }, []);

  // Handle external updates ONLY when they come from VS Code (not from user typing)
  useEffect(() => {
    // REMOVED: justSavedRef check - extension-level echo prevention handles this

    // Only process if this is a genuine external update (not from user typing)
    if (editorRef.current && markdown !== undefined) {
      // Get current editor content to compare
      const currentContent = editorRef.current.getMarkdown();

      // Check if update is actually needed
      if (currentContent === markdown) {
        return;
      }

      // Apply external update directly
      editorRef.current.setMarkdown(markdown);

      // REMOVED: justSavedRef.current = true; - echo prevention handled at extension level
    }
  }, [markdown]);

  // Focus editor on initial load
  useEffect(() => {
    if (editorRef.current && !hasInitiallyFocusedRef.current) {
      const timer = setTimeout(() => {
        try {
          const editorDOM = document.querySelector('[contenteditable="true"]') as HTMLElement;
          if (editorDOM) {
            editorDOM.focus();

            // Set cursor position based on content type
            const selection = window.getSelection();
            const range = document.createRange();

            // Check if this is standalone mode (has welcome message)
            const isStandalone = markdown.includes('Welcome to Markdown Docs!');

            if (editorDOM.textContent?.trim() === '') {
              // Empty editor - position at beginning
              const firstParagraph = editorDOM.querySelector('p');
              if (firstParagraph) {
                range.setStart(firstParagraph, 0);
                range.setEnd(firstParagraph, 0);
              } else {
                range.setStart(editorDOM, 0);
                range.setEnd(editorDOM, 0);
              }
            } else if (isStandalone) {
              // Standalone editor with welcome content - position at end
              const lastElement = editorDOM.lastElementChild;
              if (lastElement && lastElement.tagName === 'P') {
                // Position at end of last paragraph
                range.setStart(lastElement, lastElement.childNodes.length);
                range.setEnd(lastElement, lastElement.childNodes.length);
              } else {
                // Fallback to end of editor
                range.selectNodeContents(editorDOM);
                range.collapse(false);
              }
            } else {
              // Regular editor with content - position at beginning
              const firstParagraph = editorDOM.querySelector('p');
              if (firstParagraph) {
                range.setStart(firstParagraph, 0);
                range.setEnd(firstParagraph, 0);
              } else {
                range.setStart(editorDOM, 0);
                range.setEnd(editorDOM, 0);
              }
            }

            if (selection) {
              selection.removeAllRanges();
              selection.addRange(range);
            }

            hasInitiallyFocusedRef.current = true;
          }
        } catch (err) {
          logger.error('Error focusing editor on initial load:', err);
        }
      }, 200);

      return () => clearTimeout(timer);
    }
  }, [markdown]);

  // Function to handle modifier key tracking (defined outside useEffect)
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey) {
      postUserInteraction(true);
    }
  }, []);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
      event.preventDefault();
      // Focus the inline search input
      if (searchInputRef.current) {
        searchInputRef.current.focus();
        searchInputRef.current.select();
      }
    } else if (event.key === 'Control' || event.key === 'Meta') {
      postUserInteraction(false);
    }
  }, []);

  // Track modifier keys to prevent cursor jumping during undo/redo
  useEffect(() => {
    // Prefer scoping to the editor container if available
    const target: EventTarget = containerRef.current ?? document;
    target.addEventListener('keydown', handleKeyDown as EventListener);
    target.addEventListener('keyup', handleKeyUp as EventListener);

    // Cleanup
    return () => {
      target.removeEventListener('keydown', handleKeyDown as EventListener);
      target.removeEventListener('keyup', handleKeyUp as EventListener);
    };
    // Intentionally not depending on containerRef to avoid re-binding churn
  }, [handleKeyDown, handleKeyUp]);

  const handleMarkdownChange = useCallback(
    (newMarkdown: string) => {
      // On first edit, apply escaping to the editor content invisibly (but only in rich-text mode)
      if (!hasAppliedInitialEscapingRef.current && editorRef.current && currentViewModeRef.current === 'rich-text') {
        const currentContent = editorRef.current.getMarkdown();
        const needsEscaping = currentContent.includes('<') && !currentContent.includes('\\<');

        if (needsEscaping) {
          hasAppliedInitialEscapingRef.current = true;
          const escapedContent = preprocessAngleBrackets(currentContent);
          editorRef.current.setMarkdown(escapedContent);
          return; // Let the next change handle the actual sync
        }
      }

      // Apply postprocessing in all modes to clean up unwanted escaping
      const processedMarkdown = postprocessAngleBrackets(newMarkdown);

      // Check if this is actually a change
      const hasChanges = processedMarkdown !== markdown;
      if (!hasChanges) {
        return;
      }

      setIsTyping(true);

      // Clear and reset typing timeout
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        setLiveMarkdown(newMarkdown);
      }, 300);

      // Mark that user has interacted with editor to prevent auto-focus
      hasInitiallyFocusedRef.current = true;

      // Debounce sending content to VS Code to reduce churn
      if (sendEditTimeoutRef.current) {
        clearTimeout(sendEditTimeoutRef.current);
      }
      sendEditTimeoutRef.current = setTimeout(() => {
        postContentEdit(processedMarkdown);
      }, 200);
    },
    [markdown], // State setters should be stable
  );

  const handleSelectionChange = useCallback(() => {
    // Don't update selection if comment modal is open - lock the selection
    if (showCommentModal || showEditModal) {
      return;
    }

    // Don't show floating button in source or diff view
    if (currentViewMode !== 'rich-text') {
      if (showFloatingButton) {
        setShowFloatingButton(false);
      }
      return;
    }

    const selection = window.getSelection();
    const selected = selection?.toString().trim() ?? '';

    // Fast bail-out for caret-only/no selection to avoid layout work
    if (!selected) {
      if (showFloatingButton) {
        setShowFloatingButton(false);
      }
      if (!showCommentModal && !showEditModal && selectedText) {
        setSelectedText('');
      }
      return;
    }

    // Ignore selections inside CodeMirror code blocks to avoid disrupting clipboard behavior
    const isInCodeMirror = (node: Node | null) =>
      !!(node && (node as Element).parentElement && (node as Element).parentElement!.closest('.cm-editor'));
    if (selection && (isInCodeMirror(selection.anchorNode) || isInCodeMirror(selection.focusNode))) {
      if (showFloatingButton) {
        setShowFloatingButton(false);
      }
      return;
    }

    // Throttle heavy DOM work to the next animation frame
    if (selectionRafRef.current !== null) {
      return;
    }
    selectionRafRef.current = requestAnimationFrame(() => {
      selectionRafRef.current = null;
      if (!containerRef.current) {
        return;
      }
      if (!selection || selection.rangeCount === 0) {
        return;
      }
      const range = selection.getRangeAt(0);

      // Check if the selection is within the editor content area, not in search input or other UI elements
      const startContainer = range.startContainer;
      const endContainer = range.endContainer;

      const editorRoot = containerRef.current.querySelector('.mdxeditor-root-contenteditable');

      const editorBounds = editorRoot?.getBoundingClientRect();

      const rectsOverlap = (a: DOMRect, b: DOMRect) =>
        !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);

      const isWithinEditor = (node: Node): boolean => {
        let current: Node | null = node;
        let depth = 0;
        while (current && depth < 10) {
          if (current.nodeType === Node.ELEMENT_NODE) {
            const el = current as Element;
            // Quick geometry check to avoid expensive tree walks
            if (editorBounds) {
              const elRect = (el as HTMLElement).getBoundingClientRect?.();
              if (elRect && !rectsOverlap(elRect, editorBounds)) {
                return false;
              }
            }

            if (el.getAttribute('contenteditable') === 'true') {
              return true;
            }
            if (el.classList.contains('mdx-content') || el.classList.contains('mdx-editor-content')) {
              return true;
            }
            if (
              el.classList.contains('inline-search-input') ||
              el.closest('.inline-search-container') ||
              el.closest('.comments-sidebar') ||
              el.closest('.toolbar')
            ) {
              return false;
            }
          }
          current = current.parentNode;
          depth += 1;
        }
        return false;
      };

      if (!isWithinEditor(startContainer) || !isWithinEditor(endContainer)) {
        if (showFloatingButton) {
          setShowFloatingButton(false);
        }
        if (!showCommentModal && !showEditModal && selectedText) {
          setSelectedText('');
        }
        return;
      }

      const rect = range.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();

      const editorContentRect = containerRef.current.querySelector('.mdx-editor-content')?.getBoundingClientRect();
      const rightEdgeX = editorContentRect
        ? editorContentRect.right - containerRect.left - 50
        : containerRect.width - 60;

      setFloatingButtonPosition({
        x: rightEdgeX,
        y: rect.top - containerRect.top + rect.height / 2 - 20,
      });
      setSelectedText(selected);
      if (!showFloatingButton) {
        setShowFloatingButton(true);
      }
    });
  }, [currentViewMode, showCommentModal, showEditModal, showFloatingButton, selectedText]);

  // Text selection handling for floating comment button
  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [handleSelectionChange]);

  useEffect(() => {
    if (focusedCommentId && !showCommentSidebar) {
      setShowCommentSidebar(true);
    }
    if (focusedCommentId && showCommentSidebar) {
      document.querySelector(`.comment-item[data-comment-id="${focusedCommentId}"]`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest', // This will minimize scrolling if element is already visible
        inline: 'nearest',
      });
    }
  }, [focusedCommentId, showCommentSidebar]);

  const handleDocumentClick = useCallback(
    (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Clear focus if clicking outside comments
      if (!target.closest('.comment-highlight') && !target.closest('.comment-item')) {
        setFocusedCommentId(null);
      }

      if (target?.classList.contains('comment-highlight')) {
        const commentId = target.getAttribute('data-comment-id');
        if (commentId) {
          // Open sidebar if it's not already open
          if (!showCommentSidebar) {
            setShowCommentSidebar(true);
          }

          // Find and highlight the comment in the sidebar
          const commentElements = document.querySelectorAll('.comment-item');
          commentElements.forEach(el => el.classList.remove('highlighted'));

          // Find the comment in the sidebar using the comment ID
          const sidebarCommentElement = document.querySelector(`.comment-item[data-comment-id="${commentId}"]`);
          if (sidebarCommentElement) {
            // Add highlight animation
            sidebarCommentElement.classList.add('highlighted');

            // Find the scrollable comments container - .comments-list is the actual scrollable part
            const commentsContainer = document.querySelector('.comments-list');

            if (commentsContainer) {
              // Check if we need to scroll (comment is outside viewport)
              const containerRect = commentsContainer.getBoundingClientRect();
              const commentRect = sidebarCommentElement.getBoundingClientRect();

              const isAboveViewport = commentRect.top < containerRect.top;
              const isBelowViewport = commentRect.bottom > containerRect.bottom;
              const needsScroll = isAboveViewport || isBelowViewport;

              if (needsScroll) {
                // Calculate scroll position to center the comment
                const relativeTop = (sidebarCommentElement as HTMLElement).offsetTop;
                const targetScrollTop = relativeTop - containerRect.height / 2 + commentRect.height / 2;

                // Scroll ONLY the sidebar, not the whole page
                commentsContainer.scrollTo({
                  top: Math.max(0, targetScrollTop),
                  behavior: 'smooth',
                });
              }
            }
          }
        }
      }
    },
    [showCommentSidebar, setShowCommentSidebar],
  );

  // Handle clicks on highlighted text to highlight corresponding comment
  useEffect(() => {
    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [handleDocumentClick]);

  // Sidebar resizing logic
  useEffect(() => {
    let isResizing = false;

    const handleMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).classList.contains('sidebar-resize-handle')) {
        isResizing = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const newWidth = containerRect.right - e.clientX;
        setSidebarWidth(Math.max(240, Math.min(600, newWidth)));
      }
    };

    const handleMouseUp = () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Function to trigger comment insertion via plugin
  const setCommentPendingForPlugin = useCallback(
    (commentData: { comment: string; commentId: string; selectedText: string; strategy: 'inline' | 'container' }) => {
      setPendingComment(commentData);
    },
    [setPendingComment],
  );

  // Handle standard inline comments using MDX Editor's native directive insertion
  const handleInlineComment = useCallback(
    (comment: string, commentId: string, _currentMarkdown: string) => {
      // Trigger plugin to insert comment directive
      if (editorRef.current) {
        // We'll use the plugin's signal to insert the directive
        // This will be handled by the plugin within the MDX Editor's context
        setCommentPendingForPlugin({
          comment,
          commentId,
          selectedText,
          strategy: 'inline',
        });
      }
    },
    [selectedText, setCommentPendingForPlugin],
  );

  // Handle hybrid comments (container directive for complex selections)
  const handleHybridComment = useCallback(
    (comment: string, commentId: string, _currentMarkdown: string) => {
      // Trigger plugin to insert comment directive
      if (editorRef.current) {
        setCommentPendingForPlugin({
          comment,
          commentId,
          selectedText,
          strategy: 'container',
        });
      }
    },
    [selectedText, setCommentPendingForPlugin],
  );

  // Function to detect if selected text is within a code block
  const detectCodeBlockSelection = useCallback((markdown: string, selectedText: string): boolean => {
    // Look for the selected text in the markdown and check if it's within ``` blocks
    const textIndex = markdown.indexOf(selectedText);
    if (textIndex === -1) {
      return false;
    }

    // Count code block markers before the selection
    const beforeSelection = markdown.substring(0, textIndex);
    const codeBlockMarkers = (beforeSelection.match(/```/g) ?? []).length;

    // If odd number of markers, we're inside a code block
    return codeBlockMarkers % 2 === 1;
  }, []);

  const handleSubmitComment = useCallback(
    (comment: string) => {
      if (!comment.trim() || !selectedText) {
        logger.warn('Missing comment or selected text');
        setShowCommentModal(false);
        return;
      }

      if (!editorRef.current) {
        logger.error('Editor ref not available');
        setShowCommentModal(false);
        return;
      }

      const commentId = `comment-${Date.now()}`;
      const currentMarkdown = editorRef.current.getMarkdown();

      try {
        // With native directive insertion, we can handle most text reliably
        // Check for problematic content that can't be commented on
        const isInCodeBlock = detectCodeBlockSelection(currentMarkdown, selectedText);
        const isMultiParagraph = selectedText.includes('\n\n');

        if (isInCodeBlock) {
          // Code blocks can't be reliably commented - show error
          postError(
            'Sorry, code blocks cannot be commented on directly. If you have ideas how to make this work, please let us know on our GitHub repo!',
          );
          return;
        } else if (isMultiParagraph) {
          // Multi-paragraph selections use container directive
          handleHybridComment(comment, commentId, currentMarkdown);
        } else {
          // Regular text (including formatted text) uses inline directive with native insertion
          handleInlineComment(comment, commentId, currentMarkdown);
        }
      } catch (error) {
        logger.error('Error in comment submission:', error);
        // Show error instead of falling back to sidebar
        postError(
          'Failed to add comment. Please try selecting different text or report this issue on our GitHub repo.',
        );
      }

      // Close modal
      setShowCommentModal(false);
      setSelectedText('');
    },
    [detectCodeBlockSelection, handleHybridComment, handleInlineComment, selectedText],
  );

  const handleSaveKeyboard = useCallback(
    (e: KeyboardEvent) => {
      // Fast gate: ignore events outside our editor container
      if (containerRef.current && e.target instanceof Node && !containerRef.current.contains(e.target)) {
        return;
      }
      const isSave = (e.metaKey || e.ctrlKey) && e.key === 's';

      if (isSave) {
        const target = e.target as HTMLElement;
        const isInsideCodeMirror = target?.closest('.cm-editor');

        if (isInsideCodeMirror) {
          console.log('Save keyboard shortcut pressed inside CodeMirror');
          e.preventDefault();
          e.stopImmediatePropagation();

          // Set user interacting to prevent editor reload during save
          postUserInteraction(true);

          // Get current content and send to VS Code for saving
          const currentContent = editorRef.current?.getMarkdown() ?? '';
          const contentToSave = postprocessAngleBrackets(currentContent);

          console.log('Saving content to VS Code', contentToSave);
          postContentSave(contentToSave);

          // Clear user interacting after save completes
          setTimeout(() => {
            postUserInteraction(false);
          }, 100);
        }
      }
    },
    [editorRef],
  );

  // Save interception for Cmd+S/Ctrl+S inside CodeMirror
  useEffect(() => {
    // Use capture phase to intercept before CodeMirror gets the event
    document.addEventListener('keydown', handleSaveKeyboard, true);

    return () => {
      document.removeEventListener('keydown', handleSaveKeyboard, true);
    };
  }, [handleSaveKeyboard]);

  const handleCloseModal = useCallback(() => {
    setShowCommentModal(false);
    setSelectedText('');
  }, [setShowCommentModal, setSelectedText]);

  // Comment action handlers
  // handleEditComment is already defined earlier in the file

  const handleEditSubmit = useCallback(
    (newComment: string) => {
      const handleCommentTextChange = (newMarkdown: string) => {
        try {
          const comments = DirectiveService.parseCommentDirectives(newMarkdown);
          const commentsWithAnchor: CommentWithAnchor[] = comments.map(comment => ({
            ...comment,
            anchoredText: comment.anchoredText ?? 'Selected text',
            startPosition: 0,
            endPosition: 0,
          }));
          setParsedComments(commentsWithAnchor);
          console.log('Updated parsedComments after inline edit:', commentsWithAnchor);
        } catch (error) {
          logger.error('Error parsing comments after inline edit:', error);
        }
      };

      if (!editingComment) {
        logger.error('No comment being edited');
        return;
      }

      const commentId = editingComment.id;

      if (!newComment.trim()) {
        logger.warn('Empty comment submitted for edit');
        return;
      }

      if (!markdown) {
        logger.error('No markdown available for editing comment');
        return;
      }

      // Simple approach: directly modify the comment text in the markdown
      const patterns = [
        // Inline comment patterns - try multiple formats
        new RegExp(':comment\\[([^\\]]*)\\]\\{([^}]*?)text="([^"]*)"([^}]*)\\}', 'g'),
        new RegExp('::comment\\[([^\\]]*)\\]\\{([^}]*?)text="([^"]*)"([^}]*)\\}', 'g'),
        // Container comment patterns
        new RegExp(':::comment\\{([^}]*?)text="([^"]*)"([^}]*)\\}', 'g'),
      ];

      let updatedMarkdown = markdown;
      let found = false;

      for (const pattern of patterns) {
        const matches = [...updatedMarkdown.matchAll(pattern)];

        if (matches.length > 0) {
          updatedMarkdown = updatedMarkdown.replace(pattern, (match, ..._groups) => {
            // Check if this match is for our specific comment ID
            if (match.includes(`id="${String(commentId)}"`) || match.includes(`#${String(commentId)}`)) {
              // Replace just the text attribute
              const newMatch = match.replace(
                /text="[^"]*"/,
                `text="${escapeDirectiveContent(newComment, match.includes(':::'))}"`,
              );
              return newMatch;
            }
            return match; // Return unchanged if not our comment
          });
          found = true;
          break;
        }
      }

      if (found) {
        onMarkdownChange(updatedMarkdown);
        handleCommentTextChange(updatedMarkdown);
        setLiveMarkdown(updatedMarkdown);
        setShowEditModal(false);
        setEditingComment(null);
      } else {
        logger.error('Could not find comment to edit for ID:', commentId);
      }
    },
    [markdown, onMarkdownChange, editingComment],
  );

  const handleEditClose = useCallback(() => {
    setShowEditModal(false);
    setEditingComment(null);
  }, [setShowEditModal, setEditingComment]);

  const plugins = usePlugins({
    defaultFont,
    bookView,
    bookViewMargin,
    bookViewWidth,
    currentViewMode,
    focusedCommentId,
    fontSize,
    handleViewModeChange,
    isDarkTheme,
    pendingComment,
    textAlign,
    setPendingComment,
    setIsTyping,
    editorRef,
    onMarkdownChange,
    setParsedComments,
    setFocusedCommentId,
    selectedFont,
    setSelectedFont,
  });

  return (
    <div
      className={`mdx-editor-container ${bookView ? 'book-view' : ''} ${currentViewMode === 'source' ? 'source-mode' : ''}`}
      ref={containerRef}
    >
      {/* Normal view: Top section with editor */}
      <div className="mdx-editor-with-sidebar">
        <div className="mdx-editor-content">
          <ErrorBoundary>
            <MDXEditor
              ref={editorRef}
              markdown={markdown || ''}
              onChange={handleMarkdownChange}
              suppressHtmlProcessing={true}
              className={`mdx-editor ${isDarkTheme ? 'dark-theme' : 'light-theme'} font-${selectedFont.toLowerCase().replace(/\s+/g, '-')}`}
              contentEditableClassName={`mdx-content prose font-${selectedFont.toLowerCase().replace(/\s+/g, '-')}`}
              plugins={plugins}
            />
          </ErrorBoundary>
        </div>

        {/* Comments Sidebar */}
        {showCommentSidebar && (
          <CommentsSidebar
            sidebarWidth={sidebarWidth}
            setShowCommentSidebar={val => {
              document.querySelectorAll('.comment-highlight.focused').forEach(el => {
                el.classList.remove('focused');
              });
              setFocusedCommentId(null);
              setShowCommentSidebar(val);
            }}
            parsedComments={parsedComments}
            sortedCommentItems={sortedCommentItems}
            focusedCommentId={focusedCommentId}
            onNavigateToPrevComment={handleNavigateToPrevComment}
            onNavigateToNextComment={handleNavigateToNextComment}
          />
        )}

        {/* Table of Contents Sidebar */}
        {showTOCSidebar && (
          <TableOfContents
            content={liveMarkdown}
            onHeadingClick={handleHeadingNavigation}
            sidebarWidth={0}
            setShowTOCSidebar={setShowTOCSidebar}
          />
        )}

        {/* Show comments button when sidebar is hidden */}
        {!showCommentSidebar && (
          <button className="show-comments-btn" onClick={() => setShowCommentSidebar(true)} title="Show Comments">
            <span>💬</span> <span>{parsedComments.length}</span>
          </button>
        )}

        {/* Show TOC button when sidebar is hidden */}
        {!showTOCSidebar && (
          <button className="show-toc-btn" onClick={() => setShowTOCSidebar(true)} title="Show Table of Contents">
            <TableOfContentsIcon size={16} />
          </button>
        )}
      </div>

      {/* Floating comment button */}
      {showFloatingButton && floatingButtonPosition && currentViewMode === 'rich-text' && (
        <FloatingCommentButton
          showFloatingButton={showFloatingButton}
          floatingButtonPosition={floatingButtonPosition}
          selectedText={selectedText}
          setShowCommentModal={setShowCommentModal}
          setShowFloatingButton={setShowFloatingButton}
        />
      )}

      {/* Comment Modal */}
      <CommentModal
        isOpen={showCommentModal}
        onClose={handleCloseModal}
        onSubmit={handleSubmitComment}
        selectedText={selectedText}
      />

      {/* Edit Comment Modal */}
      <CommentModal
        isOpen={showEditModal}
        onClose={handleEditClose}
        onSubmit={handleEditSubmit}
        selectedText={editingComment?.anchoredText ?? ''}
        initialText={editingComment?.content ?? ''}
        isEditing={true}
      />

      {/* Status Bar */}
      <StatusBar
        content={markdown || ''}
        editorRef={editorRef}
        isTyping={isTyping}
        selectedText={selectedText}
        viewMode={currentViewMode}
      />
    </div>
  );
};
