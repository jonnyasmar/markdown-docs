import { realmPlugin } from '@mdxeditor/editor';
import type { Realm } from '@mdxeditor/editor';
import React from 'react';

// Custom search plugin that only scrolls on Enter key presses
export interface CustomSearchPluginParams {
  searchInputRef?: React.RefObject<HTMLInputElement>;
}

interface SearchMatch {
  range: Range;
  textContent: string;
}

interface SearchState {
  searchTerm: string;
  matches: SearchMatch[];
  currentMatchIndex: number;
  isHighlighted: boolean;
}

export const customSearchPlugin = realmPlugin<CustomSearchPluginParams>({
  init: (realm, params) => {
    let searchState: SearchState = {
      searchTerm: '',
      matches: [],
      currentMatchIndex: 0,
      isHighlighted: false,
    };

    // Store original scrollIntoView to restore later
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    let scrollingDisabled = false;

    // Override scrollIntoView to control when scrolling happens
    const preventScrollIntoView = () => {
      scrollingDisabled = true;
      Element.prototype.scrollIntoView = function () {
        // Do nothing - prevent automatic scrolling
      };
    };

    const restoreScrollIntoView = () => {
      scrollingDisabled = false;
      Element.prototype.scrollIntoView = originalScrollIntoView;
    };

    // Create text index from editor content
    const createTextIndex = (): { text: string; ranges: Range[] } => {
      const editorContainer = document.querySelector('.mdxeditor-root-contenteditable');
      if (!editorContainer) return { text: '', ranges: [] };

      const ranges: Range[] = [];
      let text = '';

      const walker = document.createTreeWalker(editorContainer, NodeFilter.SHOW_TEXT, {
        acceptNode: node => {
          // Skip nodes in toolbar, buttons, etc.
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;

          if (
            parent.closest('.mdxeditor-toolbar') ||
            parent.closest('button') ||
            parent.closest('.search-input-wrapper')
          ) {
            return NodeFilter.FILTER_REJECT;
          }

          return NodeFilter.FILTER_ACCEPT;
        },
      });

      let textNode: Node | null;
      while ((textNode = walker.nextNode())) {
        const nodeText = textNode.textContent || '';
        if (nodeText.trim()) {
          const range = document.createRange();
          range.selectNodeContents(textNode);
          ranges.push(range);
          text += nodeText;
        }
      }

      return { text, ranges };
    };

    // Find all matches for search term
    const findMatches = (searchTerm: string): SearchMatch[] => {
      if (!searchTerm.trim()) return [];

      const { text, ranges } = createTextIndex();
      const matches: SearchMatch[] = [];

      try {
        const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        let match;
        let textOffset = 0;

        for (const range of ranges) {
          const nodeText = range.toString();
          const nodeMatches = [...nodeText.matchAll(regex)];

          for (const regexMatch of nodeMatches) {
            if (regexMatch.index !== undefined) {
              const startOffset = regexMatch.index;
              const endOffset = startOffset + regexMatch[0].length;

              const matchRange = document.createRange();
              matchRange.setStart(range.startContainer, startOffset);
              matchRange.setEnd(range.startContainer, endOffset);

              matches.push({
                range: matchRange,
                textContent: regexMatch[0],
              });
            }
          }

          textOffset += nodeText.length;
        }
      } catch (error) {
        console.warn('Search regex error:', error);
      }

      return matches;
    };

    // Highlight all matches using CSS Highlights API
    const highlightMatches = (matches: SearchMatch[], currentIndex: number = -1) => {
      // Clear existing highlights
      if (CSS.highlights) {
        CSS.highlights.delete('mdx-search');
        CSS.highlights.delete('mdx-focus-search');
      }

      if (matches.length === 0) return;

      // Prevent scrolling while highlighting
      preventScrollIntoView();

      try {
        // Highlight all matches
        const allRanges = matches.map(match => match.range);
        if (allRanges.length > 0) {
          const searchHighlight = new Highlight(...allRanges);
          CSS.highlights?.set('mdx-search', searchHighlight);
        }

        // Highlight current match
        if (currentIndex >= 0 && currentIndex < matches.length) {
          const focusHighlight = new Highlight(matches[currentIndex].range);
          CSS.highlights?.set('mdx-focus-search', focusHighlight);
        }
      } finally {
        // Restore scrolling after a brief delay
        setTimeout(() => {
          restoreScrollIntoView();
        }, 50);
      }
    };

    // Manually scroll to a specific match (only when explicitly requested)
    const scrollToMatch = (match: SearchMatch) => {
      try {
        const range = match.range;
        const rects = range.getClientRects();
        if (rects.length === 0) return;

        const targetRect = rects[0];
        const editorContainer = document.querySelector('.mdxeditor-root-contenteditable');

        if (editorContainer && targetRect) {
          const containerRect = editorContainer.getBoundingClientRect();
          const relativeTop = targetRect.top - containerRect.top;
          const scrollTop = editorContainer.scrollTop;

          // Calculate target scroll position (center the match in view)
          const targetScrollTop = scrollTop + relativeTop - containerRect.height / 2;

          editorContainer.scrollTo({
            top: Math.max(0, targetScrollTop),
            behavior: 'smooth',
          });
        }
      } catch (error) {
        console.warn('Scroll to match error:', error);
      }
    };

    // Clear all highlights
    const clearHighlights = () => {
      if (CSS.highlights) {
        CSS.highlights.delete('mdx-search');
        CSS.highlights.delete('mdx-focus-search');
      }
      searchState.isHighlighted = false;
    };

    // Public search API
    const searchAPI = {
      search: (term: string, shouldScroll: boolean = false) => {
        searchState.searchTerm = term;
        searchState.matches = findMatches(term);
        searchState.currentMatchIndex = searchState.matches.length > 0 ? 0 : -1;

        if (term.trim()) {
          highlightMatches(searchState.matches, searchState.currentMatchIndex);
          searchState.isHighlighted = true;

          // Only scroll if explicitly requested (e.g., Enter key press)
          if (shouldScroll && searchState.currentMatchIndex >= 0) {
            scrollToMatch(searchState.matches[searchState.currentMatchIndex]);
          }
        } else {
          clearHighlights();
        }
      },

      next: () => {
        if (searchState.matches.length === 0) return;

        searchState.currentMatchIndex = (searchState.currentMatchIndex + 1) % searchState.matches.length;
        highlightMatches(searchState.matches, searchState.currentMatchIndex);
        scrollToMatch(searchState.matches[searchState.currentMatchIndex]);
      },

      previous: () => {
        if (searchState.matches.length === 0) return;

        searchState.currentMatchIndex =
          searchState.currentMatchIndex <= 0 ? searchState.matches.length - 1 : searchState.currentMatchIndex - 1;
        highlightMatches(searchState.matches, searchState.currentMatchIndex);
        scrollToMatch(searchState.matches[searchState.currentMatchIndex]);
      },

      clear: () => {
        searchState = {
          searchTerm: '',
          matches: [],
          currentMatchIndex: 0,
          isHighlighted: false,
        };
        clearHighlights();
      },

      getMatchCount: () => searchState.matches.length,
      getCurrentIndex: () => searchState.currentMatchIndex,
    };

    // Expose search API globally for the input component to access
    (window as any).customSearchAPI = searchAPI;

    // Add keyboard shortcut listener for Cmd+F / Ctrl+F
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        e.stopPropagation();

        // Focus the search input
        const searchInput = document.querySelector('.inline-search-input') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select(); // Select existing text for easy replacement
        }
      }
    };

    // Attach keyboard listener
    document.addEventListener('keydown', handleKeyDown, true);

    return {
      update: () => {
        // Re-run search if we have a term and content has changed
        if (searchState.searchTerm && searchState.isHighlighted) {
          searchAPI.search(searchState.searchTerm, false); // Don't auto-scroll on content updates
        }
      },

      destroy: () => {
        // Clean up keyboard listener
        document.removeEventListener('keydown', handleKeyDown, true);
        // Restore original scrollIntoView
        restoreScrollIntoView();
      },
    };
  },
});

// Custom search input component that works with our controlled search plugin
export const CustomSearchInput: React.FC = () => {
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const debounceTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const [hasValue, setHasValue] = React.useState(false);
  const [matchInfo, setMatchInfo] = React.useState<{ count: number; current: number }>({ count: 0, current: 0 });

  // Get search API from realm
  const getSearchAPI = () => {
    // This will be set up when the plugin is integrated with MDXEditor
    return (window as any).customSearchAPI;
  };

  // Debounced search that doesn't scroll
  const debouncedSearch = React.useCallback(() => {
    if (debounceTimeoutRef.current !== null) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      const currentValue = searchInputRef.current?.value ?? '';
      const searchAPI = getSearchAPI();

      if (searchAPI) {
        // Search and highlight, but don't scroll
        searchAPI.search(currentValue, false);
        setMatchInfo({
          count: searchAPI.getMatchCount(),
          current: searchAPI.getCurrentIndex() + 1,
        });
      }
    }, 150);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const value = e.target.value;
    setHasValue(!!value);
    debouncedSearch();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const searchAPI = getSearchAPI();
    if (!searchAPI) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();

      const currentValue = searchInputRef.current?.value ?? '';
      if (currentValue.trim()) {
        if (e.shiftKey) {
          // Shift+Enter: go to previous match
          searchAPI.previous();
        } else {
          // Enter: go to next match (or first match if none selected)
          if (searchAPI.getMatchCount() === 0) {
            searchAPI.search(currentValue, true); // Initial search with scroll
          } else {
            searchAPI.next();
          }
        }

        setMatchInfo({
          count: searchAPI.getMatchCount(),
          current: searchAPI.getCurrentIndex() + 1,
        });
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      handleClear();
    }
  };

  const handleClear = () => {
    if (searchInputRef.current) {
      searchInputRef.current.value = '';
    }
    setHasValue(false);
    setMatchInfo({ count: 0, current: 0 });

    const searchAPI = getSearchAPI();
    if (searchAPI) {
      searchAPI.clear();
    }

    if (debounceTimeoutRef.current !== null) {
      clearTimeout(debounceTimeoutRef.current);
    }
  };

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current !== null) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="inline-search-container" onMouseDown={e => e.stopPropagation()}>
      <div className="search-input-wrapper">
        <span className="search-icon">🔍</span>
        <input
          ref={searchInputRef}
          type="text"
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Search..."
          className="inline-search-input"
          onMouseDown={e => e.stopPropagation()}
        />
        {hasValue && (
          <button type="button" onClick={handleClear} className="search-clear-btn" title="Clear search">
            ×
          </button>
        )}
        {matchInfo.count > 0 && (
          <span className="search-match-info" title="Current match / Total matches">
            {matchInfo.current}/{matchInfo.count}
          </span>
        )}
      </div>
    </div>
  );
};
