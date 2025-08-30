import React, { useState, useRef, useTransition, startTransition, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { logger } from '../utils/logger';
import {
  MDXEditor,
  headingsPlugin,
  quotePlugin,
  listsPlugin,
  linkPlugin,
  tablePlugin,
  thematicBreakPlugin,
  codeBlockPlugin,
  markdownShortcutPlugin,
  toolbarPlugin,
  directivesPlugin,
  GenericDirectiveEditor,
  UndoRedo,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  ListsToggle,
  CreateLink,
  InsertTable,
  searchPlugin,
  searchOpen$,
  InsertThematicBreak,
  Separator,
  Button,
  Select,
  type MDXEditorMethods,
  useEditorSearch,
  sandpackPlugin,
  codeMirrorPlugin,
  InsertCodeBlock,
  ConditionalContents,
  ChangeCodeMirrorLanguage,
  CodeMirrorEditor,
  insertDirective$,
  realmPlugin,
  Cell,
  Signal,
  imagePlugin
} from '@mdxeditor/editor';
import { usePublisher } from '@mdxeditor/gurx';
import '@mdxeditor/editor/style.css';
import { CommentWithAnchor } from '../types';
import { CommentModal } from './CommentModal';
import { DirectiveService } from '../../../src/services/directive';
import { MermaidEditor } from './MermaidEditor';
import { escapeDirectiveContent } from '../utils/textNormalization';
import './MDXEditorWrapper.css';
import './MermaidEditor.css';
import { preprocessAngleBrackets, postprocessAngleBrackets, preprocessCurlyBraces, postprocessCurlyBraces, displayCurlyBraces } from './SimplifiedAngleBracketPlugin';

// Inline search component for toolbar
const InlineSearchInput = ({ searchInputRef, isTyping }: { searchInputRef: React.RefObject<HTMLInputElement>, isTyping?: boolean }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const clearHighlights = () => {
    // Remove existing highlights
    const highlights = document.querySelectorAll('.search-highlight');
    highlights.forEach(highlight => {
      const parent = highlight.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(highlight.textContent || ''), highlight);
        parent.normalize();
      }
    });
  };

  const highlightMatches = (term: string) => {
    // Skip highlighting during typing for performance
    if (isTyping) {
      return;
    }
    clearHighlights();
    if (!term.trim()) {
      return;
    }

    const editorContent = document.querySelector('.mdx-content') || document.querySelector('[contenteditable="true"]');
    if (!editorContent) return;

    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const walker = document.createTreeWalker(editorContent, NodeFilter.SHOW_TEXT, null);

    let node;
    while (node = walker.nextNode()) {
      if (node.parentElement && node.parentElement.className === 'search-highlight') {
        continue;
      }

      const text = node.textContent || '';
      const matches = [...text.matchAll(regex)];

      if (matches.length > 0) {
        const parent = node.parentNode;
        if (!parent) continue;

        let lastIndex = 0;
        const fragment = document.createDocumentFragment();

        matches.forEach(match => {
          const index = match.index || 0;
          // Add text before the match
          if (index > lastIndex) {
            fragment.appendChild(document.createTextNode(text.substring(lastIndex, index)));
          }
          // Add the highlighted match
          const span = document.createElement('span');
          span.className = 'search-highlight';
          span.textContent = match[0];
          fragment.appendChild(span);
          lastIndex = index + match[0].length;
        });

        // Add text after the last match
        if (lastIndex < text.length) {
          fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
        }

        parent.replaceChild(fragment, node);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    highlightMatches(value);
  };

  const handleClear = () => {
    setSearchTerm('');
    clearHighlights();
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  return (
    <div className="inline-search-container">
      <div className="search-input-wrapper">
        <span className="search-icon">🔍</span>
        <input
          ref={searchInputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          placeholder="Search..."
          className="inline-search-input"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={handleClear}
            className="search-clear-btn"
            title="Clear search"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};



// No longer using portal - overflow menu is within toolbar context

// Common toolbar groups component to reduce duplication
const ToolbarGroups = React.memo(({
  selectedFont,
  handleFontChange,
  availableFonts,
  isOverflow = false,
  hiddenGroups = []
}: {
  selectedFont: string;
  handleFontChange: (font: string) => void;
  availableFonts: string[];
  isOverflow?: boolean;
  hiddenGroups?: string[];
}) => {
  const groupClass = isOverflow ? 'overflow-group' : 'toolbar-group';

  const shouldShowGroup = (groupName: string) => {
    return isOverflow ? hiddenGroups.includes(groupName) : !hiddenGroups.includes(groupName);
  };

  return (
    <>
      {shouldShowGroup('undo-redo') && (
        <>
          <UndoRedo />
          {!isOverflow && <Separator />}
        </>
      )}

      {/* Block Type (text style) - before font selection */}
      {shouldShowGroup('display-font') && (
        <>
          <div className={`${groupClass} ${isOverflow ? 'overflow-group verflow-display-font' : 'display-font-group'}`}>
            <BlockTypeSelect />
            {!isOverflow && <Separator />}
          </div>
        </>
      )}

      {/* Font Selection - now properly positioned */}
      {shouldShowGroup('font-style') && (
        <>
          <div className={`${groupClass} ${isOverflow ? 'overflow-group overflow-font-style' : 'font-style-group'}`}>
            <Select
              value={selectedFont}
              onChange={handleFontChange}
              triggerTitle="Select Font"
              placeholder="Font"
              items={availableFonts.map((font: string) => ({ 
                value: font, 
                label: font,
                className: `font-option-${font.toLowerCase().replace(/\s+/g, '-')}`
              }))}
            />
            {!isOverflow && <Separator />}
          </div>
        </>
      )}

      {shouldShowGroup('formatting') && (
        <>
          <div className={`${groupClass} ${isOverflow ? 'overflow-group overflow-formatting' : 'formatting-group'}`}>
            <BoldItalicUnderlineToggles />
            {!isOverflow && <Separator />}
          </div>
        </>
      )}

      {shouldShowGroup('lists') && (
        <>
          <div className={`${groupClass} ${isOverflow ? 'overflow-group overflow-lists' : 'lists-group'}`}>
            <ListsToggle />
            {!isOverflow && <Separator />}
          </div>
        </>
      )}

      {shouldShowGroup('blocks') && (
        <>
          <div className={`${groupClass} ${isOverflow ? 'overflow-group overflow-blocks' : 'blocks-group'}`}>
            <ConditionalContents
              options={[
                {
                  when: (editor) => editor?.editorType === 'codeblock',
                  contents: () => null
                },
                {
                  fallback: () => <InsertCodeBlock />
                }
              ]}
            />
            <CreateLink />
            <InsertTable />
            <InsertThematicBreak />
            {!isOverflow && <Separator />}
          </div>
        </>
      )}
    </>
  );
});

// Memoized custom toolbar component to prevent unnecessary re-renders
const ToolbarWithCommentButton = React.memo(({
  selectedFont,
  handleFontChange,
  availableFonts,
  setIsBookView,
  isBookView,
  searchInputRef,
  isTyping
}: any) => {
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const [hiddenGroups, setHiddenGroups] = useState<string[]>([]);
  const overflowTriggerRef = useRef<HTMLButtonElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const handleOverflowToggle = () => {
    setIsOverflowOpen(!isOverflowOpen);
  };

  const handleOverflowClose = () => {
    setIsOverflowOpen(false);
  };

  const updateResponsiveState = useCallback(() => {
    if (!toolbarRef.current) return;

    const width = toolbarRef.current.offsetWidth;
    const newHidden: string[] = [];

    // Use the same thresholds from CSS variables
    if (width < 930 - 34) newHidden.push('blocks');
    if (width < 810 - 34) newHidden.push('lists');
    if (width < 690 - 34) newHidden.push('formatting');
    if (width < 590 - 34) newHidden.push('font-style');
    if (width < 430 - 34) newHidden.push('display-font');
    if (width < 270 - 34) newHidden.push('undo-redo');

    setHiddenGroups(newHidden);
  }, []);

  // Handle click outside to close overflow menu
  React.useEffect(() => {
    if (!isOverflowOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (overflowTriggerRef.current &&
        !overflowTriggerRef.current.contains(event.target as Node) &&
        !(event.target as Element).closest('.overflow-menu')) {
        setIsOverflowOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOverflowOpen]);

  // Set up ResizeObserver to watch toolbar width changes
  React.useEffect(() => {
    if (!toolbarRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      updateResponsiveState();
    });

    resizeObserver.observe(toolbarRef.current);

    // Initial measurement
    updateResponsiveState();

    return () => resizeObserver.disconnect();
  }, [updateResponsiveState]);

  return (
    <div ref={toolbarRef} className="responsive-toolbar">
      {/* Main toolbar content - always visible */}
      <div className="toolbar-main">
        <ToolbarGroups
          selectedFont={selectedFont}
          handleFontChange={handleFontChange}
          availableFonts={availableFonts}
          isOverflow={false}
          hiddenGroups={hiddenGroups}
        />

        {/* Search - in the flow at the end of toolbar items */}
        <div className="toolbar-search">
          <MDXInlineSearchInput searchInputRef={searchInputRef} isTyping={isTyping} />
        </div>
      </div>

      {/* Overflow menu trigger */}
      <div className="toolbar-overflow">
        <button
          ref={overflowTriggerRef}
          className={`overflow-trigger ${hiddenGroups.length > 0 ? 'visible' : ''}`}
          title="More options"
          onClick={handleOverflowToggle}
        >
          ⋮
        </button>

        <div className={`overflow-menu ${isOverflowOpen ? 'visible' : ''}`}>
          <div className="overflow-menu-content">
            <ToolbarGroups
              selectedFont={selectedFont}
              handleFontChange={handleFontChange}
              availableFonts={availableFonts}
              isOverflow={true}
              hiddenGroups={hiddenGroups}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

// Stateless search input with debounced search operation based on ref value
const MDXInlineSearchInput = ({ searchInputRef, isTyping }: { searchInputRef: React.RefObject<HTMLInputElement>, isTyping?: boolean }) => {
  const { setSearch, openSearch } = useEditorSearch();
  const debounceTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const [hasValue, setHasValue] = React.useState(false);

  // Optimized debounced search function that reads from the input ref
  const debouncedSearch = React.useCallback(() => {
    if (debounceTimeoutRef.current !== null) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Use longer debounce during active typing for better performance
    const debounceTime = isTyping ? 300 : 150;

    debounceTimeoutRef.current = setTimeout(() => {
      const currentValue = searchInputRef.current?.value || '';
      // Use startTransition for non-urgent search updates
      startTransition(() => {
        setSearch(currentValue);
      });
    }, debounceTime);
  }, [setSearch, searchInputRef, isTyping]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const value = e.target.value;
    setHasValue(!!value); // Track if input has value for clear button visibility
    // Don't interfere with the input's natural state - just trigger debounced search
    debouncedSearch();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (searchInputRef.current) {
      searchInputRef.current.value = "";
    }
    setHasValue(false);
    setSearch("");
    if (debounceTimeoutRef.current !== null) {
      clearTimeout(debounceTimeoutRef.current);
    }
    requestAnimationFrame(() => searchInputRef.current?.focus());
  };

  React.useEffect(() => {
    openSearch();
  }, [openSearch]);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current !== null) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="inline-search-container" onMouseDown={(e) => e.stopPropagation()}>
      <div className="search-input-wrapper">
        <span className="search-icon">🔍</span>
        <input
          ref={searchInputRef}
          type="text"
          onChange={handleInputChange}
          placeholder="Search..."
          className="inline-search-input"
          onMouseDown={(e) => e.stopPropagation()}
        />
        {hasValue && (
          <button
            type="button"
            onClick={handleClear}
            className="search-clear-btn"
            title="Clear search"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};

// Memoized comment item to prevent unnecessary re-renders with many comments
const CommentItem = React.memo(({
  comment,
  isFocused,
  onCommentClick,
  onDeleteComment,
  onEditComment
}: {
  comment: CommentWithAnchor;
  isFocused: boolean;
  onCommentClick: (id: string) => void;
  onDeleteComment: (id: string) => void;
  onEditComment: (id: string) => void;
}) => (
  <div
    className={`comment-item ${isFocused ? 'focused' : ''}`}
    data-comment-id={comment.id}
    onClick={() => onCommentClick(comment.id)}
    style={{ cursor: 'pointer' }}
  >
    <div className="comment-content">{comment.content}</div>
    <div className="comment-anchor">
      On: "{comment.anchoredText?.substring(0, 50) || 'Selected text'}..."
    </div>
    <div className="comment-actions">
      <button
        onClick={() => onDeleteComment(comment.id)}
        className="comment-action-btn delete"
        title="Delete this comment"
      >
        Delete
      </button>
      <button
        onClick={() => onEditComment(comment.id)}
        className="comment-action-btn"
        title="Edit this comment"
      >
        Edit
      </button>
    </div>
  </div>
));

// Create a custom plugin for comment insertion that uses native insertDirective$
const commentInsertionPlugin = realmPlugin<{
  pendingComment?: { comment: string, commentId: string, selectedText: string, strategy: 'inline' | 'container' } | null;
  onInsertComment?: (comment: { comment: string, commentId: string, selectedText: string, strategy: 'inline' | 'container' }) => void;
}>({
  init(realm, params) {
    logger.debug('Comment insertion plugin initialized with native insertDirective$ support');
  },

  update(realm, params) {
    // React to pending comment updates and insert directives using native MDX Editor signals
    if (params?.pendingComment) {
      const pendingComment = params.pendingComment;
      logger.debug('=== PLUGIN UPDATE CALLED ===');
      logger.debug('Plugin received comment to insert using native insertDirective$:', pendingComment);

      try {
        // Use MDX Editor's native insertDirective$ signal - this is the key!
        const directiveConfig = {
          name: 'comment',
          type: pendingComment.strategy === 'container' ? 'containerDirective' : 'textDirective',
          children: pendingComment.strategy === 'container'
            ? [{ type: 'paragraph', children: [{ type: 'text', value: pendingComment.selectedText }] }]
            : [{ type: 'text', value: pendingComment.selectedText }],
          attributes: {
            id: pendingComment.commentId,
            text: escapeDirectiveContent(pendingComment.comment, pendingComment.strategy === 'container')
          }
        };
        logger.debug('Directive config to insert:', directiveConfig);
        realm.pub(insertDirective$, directiveConfig);

        logger.debug('Comment directive inserted successfully via native insertDirective$');

        // Call completion callback if provided
        if (params?.onInsertComment) {
          logger.debug('Calling onInsertComment callback');
          params.onInsertComment(pendingComment);
        } else {
          logger.warn('No onInsertComment callback provided');
        }
      } catch (error) {
        logger.error('Error inserting comment directive via insertDirective$:', error);
        logger.error('Error details:', error.stack);
      }
    }
  }
});

// Comment directive configuration supporting all directive types
const createCommentDirectiveDescriptor = (focusedCommentId: string | null, setFocusedCommentId: (id: string | null) => void) => ({
  name: 'comment',
  testNode(node: any) {
    logger.debug('Comment directive test - node:', node);
    const isComment = node && node.name === 'comment';
    logger.debug('Is comment directive?', isComment);
    return isComment;
  },
  attributes: ['id', 'text'],
  hasChildren: true, // All directive types can have children (the [content] part)
  Editor: ({ mdastNode }: any) => {
    const commentId = mdastNode.attributes?.id || '';
    const commentText = mdastNode.attributes?.text || 'Comment';
    const directiveType = mdastNode.type; // 'textDirective', 'leafDirective', or 'containerDirective'

    logger.debug('Rendering comment directive:', { commentId, commentText, directiveType, mdastNode });

    // Render differently for inline vs block directives
    const renderContent = () => {
      if (!mdastNode.children || mdastNode.children.length === 0) {
        return 'No content';
      }

      return mdastNode.children.map((child: any, index: number) => {
        if (child.type === 'text') {
          return child.value || '';
        } else if (child.type === 'paragraph') {
          // For paragraphs, preserve the line break after each one
          const content = child.children?.map((grandchild: any) => grandchild.value || '').join('') || '';
          return content;
        } else {
          return child.value || child.data || '';
        }
      }).join('\n\n'); // Use double newlines to preserve paragraph breaks
    };

    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      logger.debug('Clicked comment highlight:', commentId);

      // Set focus state for inline comment
      setFocusedCommentId(commentId);

      // Focus the comment in sidebar
      const commentElement = document.querySelector(`.comment-item[data-comment-id="${commentId}"]`);
      if (commentElement) {
        //commentElement.scrollIntoView({ behavior: 'smooth' });
        commentElement.classList.add('highlighted');
        setTimeout(() => commentElement.classList.remove('highlighted'), 2000);
      }
    };

    // For container directives (:::), render as block element to preserve line breaks
    if (directiveType === 'containerDirective') {
      return (
        <div
          className={`comment-highlight ${focusedCommentId === commentId ? 'focused' : ''}`}
          data-comment-id={commentId}
          title={`Comment: ${commentText}`}
          onClick={handleClick}
        >
          {renderContent().split('\n\n').map((paragraph: string, index: number) => (
            <p key={index} style={{ margin: '.5em 0' }}>
              {paragraph}
            </p>
          ))}
        </div>
      );
    }

    // For inline directives, render as span
    return (
      <span
        className={`comment-highlight ${focusedCommentId === commentId ? 'focused' : ''}`}
        data-comment-id={commentId}
        title={`Comment: ${commentText}`}
        onClick={handleClick}
      >
        {renderContent()}
      </span>
    );
  }
});

// Robust generic directive descriptor to handle malformed and unknown directives
const genericDirectiveDescriptor = {
  name: 'generic',
  testNode: (node: any) => {
    logger.debug('Generic directive test - node:', node);

    // If it's not our comment directive, catch it to prevent errors
    // This includes malformed directives with undefined names
    const isNotComment = !node || node.name !== 'comment';
    const shouldHandle = isNotComment;

    logger.debug('Generic directive decision:', {
      nodeName: node?.name,
      nodeType: node?.type,
      isNotComment,
      shouldHandle
    });

    return shouldHandle;
  },
  attributes: ['id', 'class', 'style', 'name'],
  hasChildren: true,
  Editor: (props: any) => {
    // Custom minimal editor that doesn't show visible UI for malformed directives
    logger.debug('Rendering generic directive with props:', props);

    // If the directive has no name or is malformed, render nothing
    if (!props.mdastNode?.name || props.mdastNode.name === 'undefined') {
      logger.debug('Rendering invisible placeholder for malformed directive');
      return <span style={{ display: 'none' }} />;
    }

    // For actual named directives, use the generic editor
    return <GenericDirectiveEditor {...props} />;
  }
};

interface MDXEditorWrapperProps {
  markdown: string;
  onMarkdownChange: (markdown: string) => void;
  comments?: CommentWithAnchor[];
  onNavigateToComment?: (commentId: string) => void;
  onEditComment?: (commentId: string) => void;
  onDeleteComment?: (commentId: string) => void;
  defaultFont?: string;
}


export const MDXEditorWrapper: React.FC<MDXEditorWrapperProps> = ({
  markdown,
  onMarkdownChange,
  comments = [],
  onNavigateToComment,
  onEditComment,
  onDeleteComment,
  defaultFont = 'Default'
}) => {
  logger.debug('🚀 MDXEditorWrapper rendered with markdown length:', markdown?.length || 0);
  if (markdown && markdown.includes('![')) {
    logger.debug('🖼️ Markdown contains images!');
    const imageMatches = markdown.match(/!\[([^\]]*)\]\(([^)]+)\)/g);
    logger.debug('🖼️ Image matches found:', imageMatches);
  }

  logger.debug('=== MDXEditorWrapper RENDER START ===');
  logger.debug('Props received:', {
    markdownLength: markdown?.length,
    commentsLength: comments?.length,
    defaultFont,
    hasOnMarkdownChange: !!onMarkdownChange
  });
  logger.debug('MDXEditorWrapper received markdown ending:', '...' + markdown?.substring((markdown?.length || 0) - 100));
  logger.debug('MDXEditorWrapper markdown contains code blocks?', markdown?.includes('```javascript'));
  logger.debug('MDXEditorWrapper markdown ends with expected?', markdown?.includes('explore all the features!'));
  // UI state
  const [showCommentSidebar, setShowCommentSidebar] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [currentSelection, setCurrentSelection] = useState<{ start: number; end: number } | null>(null);
  const [showFloatingButton, setShowFloatingButton] = useState(false);
  const [floatingButtonPosition, setFloatingButtonPosition] = useState<{ x: number; y: number } | null>(null);

  // New state for Book view and Font selection
  const [isBookView, setIsBookView] = useState(false);

  // Comment insertion state
  const [pendingComment, setPendingComment] = useState<{ comment: string, commentId: string, selectedText: string, strategy: 'inline' | 'container' } | null>(null);
  const [selectedFont, setSelectedFont] = useState(defaultFont);
  const [editingComment, setEditingComment] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [focusedCommentId, setFocusedCommentId] = useState<string | null>(null);

  // Performance optimization: Track typing state to prevent expensive operations during typing
  const [isTyping, setIsTyping] = useState(false);
  const [isPending, startTransitionInternal] = useTransition();
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const deferredMessageTimeoutRef = useRef<NodeJS.Timeout>();

  // Update selected font when defaultFont prop changes
  React.useEffect(() => {
    setSelectedFont(defaultFont);
  }, [defaultFont]);

  // Load saved font preference from VS Code settings on mount and signal ready
  React.useEffect(() => {
    if (typeof window !== 'undefined' && window.vscodeApi) {
      // Signal that webview is ready to receive updates
      window.vscodeApi.postMessage({
        command: 'ready'
      });

      // Request font settings
      window.vscodeApi.postMessage({
        command: 'getFont'
      });
    }
  }, []);

  // Handle font changes and save to VS Code settings
  const handleFontChange = (fontName: string) => {
    logger.debug('Font changed to:', fontName);
    logger.debug('Current selected font:', selectedFont);
    const fontClassName = fontName.toLowerCase().replace(/\s+/g, '-');
    logger.debug('Font class name will be:', `font-${fontClassName}`);

    setSelectedFont(fontName);

    // Save to VS Code settings
    if (typeof window !== 'undefined' && window.vscodeApi) {
      window.vscodeApi.postMessage({
        command: 'setFont',
        font: fontName
      });
    }
  };

  // Available fonts with their CSS font-family values
  const fontFamilyMap = {
    'Default': 'var(--vscode-editor-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif)',
    'Arial': 'Arial, sans-serif',
    'Times New Roman': '"Times New Roman", Times, serif',
    'Roboto': 'Roboto, Arial, sans-serif',
    'Georgia': 'Georgia, serif',
    'Calibri': 'Calibri, sans-serif',
    'Garamond': 'Garamond, serif',
    'Book Antiqua': '"Book Antiqua", serif',
    'Courier New': '"Courier New", monospace',
    'Open Sans': '"Open Sans", Arial, sans-serif',
    'Lato': '"Lato", Arial, sans-serif',
    'Montserrat': '"Montserrat", Arial, sans-serif',
    'Source Sans Pro': '"Source Sans Pro", Arial, sans-serif'
  };

  const availableFonts = Object.keys(fontFamilyMap);
  const editorRef = useRef<MDXEditorMethods>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Apply font styles to dropdown options
  React.useEffect(() => {
    const styleDropdownOptions = () => {
      // Wait for dropdown to be rendered
      setTimeout(() => {
        const options = document.querySelectorAll('.mdxeditor-select-content [role="option"] span');
        options.forEach((option, index) => {
          const fontName = availableFonts[index];
          if (fontName && fontFamilyMap[fontName as keyof typeof fontFamilyMap]) {
            (option as HTMLElement).style.fontFamily = fontFamilyMap[fontName as keyof typeof fontFamilyMap];
          }
        });
      }, 50);
    };

    // Watch for dropdown opening
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          const addedNodes = Array.from(mutation.addedNodes);
          const hasDropdown = addedNodes.some(node => 
            node instanceof Element && node.querySelector('.mdxeditor-select-content')
          );
          if (hasDropdown) {
            styleDropdownOptions();
          }
        }
      });
    });

    // Watch for dropdown elements being added to the DOM
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
    };
  }, [availableFonts, fontFamilyMap]);

  // Parse comments from markdown
  const [parsedComments, setParsedComments] = useState<CommentWithAnchor[]>([]);

  // Comment position cache for ultra-fast sorting - prevents O(n²) regex searches
  const commentPositions = useMemo(() => {
    const positions = new Map<string, number>();
    if (!markdown) return positions;

    // Cache positions of all comment directives for fast sorting
    parsedComments.forEach(comment => {
      const patterns = [
        `:comment\\[([^\\]]*)\\]\\{[^}]*(?:id="${comment.id}"|#${comment.id})[^}]*\\}`,
        `::comment\\[([^\\]]*)\\]\\{[^}]*(?:id="${comment.id}"|#${comment.id})[^}]*\\}`,
        `:::comment\\{[^}]*(?:id="${comment.id}"|#${comment.id})[^}]*\\}`
      ];

      for (const pattern of patterns) {
        const match = markdown.search(new RegExp(pattern));
        if (match !== -1) {
          positions.set(comment.id, match);
          break;
        }
      }
    });

    return positions;
  }, [markdown, parsedComments]);

  // Comment action handlers - must be defined before sortedCommentItems useMemo
  const handleEditComment = useCallback((commentId: string) => {
    logger.debug('Edit comment locally:', commentId);

    // Find the comment to edit in our parsed comments
    const commentToEdit = parsedComments.find(c => c.id === commentId);
    if (commentToEdit) {
      logger.debug('Found comment to edit:', commentToEdit);
      setEditingComment(commentToEdit);
      setShowEditModal(true);
    } else {
      logger.error('Comment not found for editing:', commentId);
    }
  }, [parsedComments]);

  const handleDeleteComment = useCallback((commentId: string) => {
    logger.debug('=== DELETE COMMENT DEBUG START ===');
    logger.debug('Attempting to delete comment:', commentId);
    logger.debug('Current markdown length:', markdown?.length);
    logger.debug('Current parsed comments count:', parsedComments.length);

    if (!markdown) {
      logger.error('No markdown content to delete comment from');
      return;
    }

    const patterns = [
      // Inline comment patterns - try multiple formats
      `:comment\\[([^\\]]*)\\]\\{[^}]*(?:id="${commentId}"|#${commentId})[^}]*\\}`,
      `::comment\\[([^\\]]*)\\]\\{[^}]*(?:id="${commentId}"|#${commentId})[^}]*\\}`,
      // Container comment patterns
      `:::comment\\{[^}]*(?:id="${commentId}"|#${commentId})[^}]*\\}[\\s\\S]*?:::`,
      `:::comment\\{[^}]*(?:id="${commentId}"|#${commentId})[^}]*\\}.*?\\n\\s*:::`
    ];

    let updatedMarkdown = markdown;
    let found = false;

    for (const pattern of patterns) {
      logger.debug('Trying pattern:', pattern);
      const regex = new RegExp(pattern, 'g');
      const matches = [...markdown.matchAll(regex)];
      logger.debug('Pattern matches found:', matches.length);

      if (matches.length > 0) {
        matches.forEach((match, index) => {
          logger.debug(`Match ${index}:`, match[0]);
        });

        updatedMarkdown = updatedMarkdown.replace(regex, (match, capturedContent) => {
          // For inline comments, return the captured content (the original text)
          // For container comments, we need to extract the content between the directives
          if (match.includes(':::')) {
            // Container comment - extract content between opening and closing :::
            const contentMatch = match.match(/:::comment\{[^}]*\}([\s\S]*?):::/);
            return contentMatch ? contentMatch[1].trim() : '';
          } else {
            // Inline comment - return the captured content in brackets
            return capturedContent || '';
          }
        });
        found = true;
        logger.debug('Successfully replaced comment directive, preserving original content');
        break;
      }
    }

    if (!found) {
      logger.error('Could not find comment directive to delete for ID:', commentId);
      logger.debug('Available comment IDs in parsed comments:', parsedComments.map(c => c.id));
      // Try a more generic search to see what's in the markdown
      const genericPattern = new RegExp(`${commentId}`, 'g');
      const genericMatches = [...markdown.matchAll(genericPattern)];
      logger.debug('Generic ID matches in markdown:', genericMatches.length);
      if (genericMatches.length > 0) {
        logger.debug('Found ID in markdown but not in directive format - manual cleanup may be needed');
      }
    } else {
      logger.debug('Updated markdown length after deletion:', updatedMarkdown.length);
      logger.debug('Calling onMarkdownChange with updated content');
      onMarkdownChange(updatedMarkdown);
    }
    logger.debug('=== DELETE COMMENT DEBUG END ===');
  }, [markdown, parsedComments, onMarkdownChange]);

  const handleCommentClick = useCallback((commentId: string) => {
    logger.debug('=== SIDEBAR COMMENT CLICK DEBUG ===');
    logger.debug('Clicked on comment in sidebar:', commentId);

    // Set focus state for this comment
    setFocusedCommentId(commentId);
    logger.debug('Editor ref exists:', !!editorRef.current);

    // Call external navigation handler if provided
    if (onNavigateToComment) {
      onNavigateToComment(commentId);
    }

    // Get editor root element from ref if available
    let editorRootElement = null;
    if (editorRef.current) {
      // Try to access the editor's internal DOM structure
      const editorInstance = editorRef.current as any;
      logger.debug('Editor instance methods:', Object.getOwnPropertyNames(editorInstance));

      // Look for common editor properties that might give us the root
      if (editorInstance._rootElement) {
        editorRootElement = editorInstance._rootElement;
      } else if (editorInstance.rootElement) {
        editorRootElement = editorInstance.rootElement;
      } else if (editorInstance.getEditorState) {
        logger.debug('Editor has getEditorState method');
      }
    }

    logger.debug('Editor root element from ref:', editorRootElement);

    // Find comment directive element in the editor - try multiple selectors
    const containerElement = containerRef.current || document;
    let commentElement = containerElement.querySelector(`[data-comment-id="${commentId}"]`) as HTMLElement;

    // Fallback selectors if the first doesn't work
    if (!commentElement) {
      commentElement = containerElement.querySelector(`[data-directive-key*="${commentId}"]`) as HTMLElement;
    }
    if (!commentElement) {
      commentElement = containerElement.querySelector(`.comment-highlight[title*="${commentId}"]`) as HTMLElement;
    }

    logger.debug('Found comment element:', commentElement, 'with selector for ID:', commentId);

    if (commentElement) {
      logger.debug('Scrolling to comment element and highlighting it');

      // Scroll element into view
      commentElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });

      // Add highlight class for visual feedback
      // First, force a reflow to ensure the scroll completes
      commentElement.offsetHeight;

      // Add the highlight class immediately
      commentElement.classList.add('editor-highlighted');

      // Remove highlight after animation completes
      setTimeout(() => {
        if (commentElement.classList.contains('editor-highlighted')) {
          commentElement.classList.remove('editor-highlighted');
        }
      }, 2000);
    }
  }, []);

  // Memoized sorted comments using cached positions - MASSIVE performance improvement
  const sortedCommentItems = useMemo(() => {
    if (parsedComments.length === 0) return [];

    const sortedComments = parsedComments.sort((a, b) => {
      // Use cached positions for O(1) sorting instead of O(n*m) regex searches
      const aPos = commentPositions.get(a.id) ?? -1;
      const bPos = commentPositions.get(b.id) ?? -1;

      // Both positions found - sort by cached position (ultra-fast)
      if (aPos !== -1 && bPos !== -1) {
        return aPos - bPos;
      }

      // One position missing - prioritize found position
      if (aPos !== -1 && bPos === -1) return -1;
      if (bPos !== -1 && aPos === -1) return 1;

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
  }, [parsedComments, commentPositions, focusedCommentId, handleCommentClick, handleDeleteComment, handleEditComment]);

  // Removed logger.debugs for better performance during typing

  // Parse comments with debouncing to improve typing performance
  React.useEffect(() => {
    if (!markdown) {
      setParsedComments([]);
      return;
    }

    // COMPLETELY skip comment parsing during typing for maximum performance
    if (isTyping) {
      return;
    }

    // Heavy debounce - only after user completely stops typing for 800ms
    const timeoutId = setTimeout(() => {
      try {
        const comments = DirectiveService.parseCommentDirectives(markdown);
        const commentsWithAnchor: CommentWithAnchor[] = comments.map(comment => ({
          ...comment,
          anchoredText: comment.anchoredText || 'Selected text',
          startPosition: 0,
          endPosition: 0
        }));
        setParsedComments(commentsWithAnchor);
      } catch (error) {
        logger.error('Error parsing comments:', error);
        setParsedComments([]);
      }
    }, 800); // Heavy debounce - only after complete typing pause

    return () => clearTimeout(timeoutId);
  }, [markdown, isTyping]);

  // Cleanup timeouts on unmount
  React.useEffect(() => {
    return () => {
      if (dirtyStateTimeoutRef.current) {
        clearTimeout(dirtyStateTimeoutRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (deferredMessageTimeoutRef.current) {
        clearTimeout(deferredMessageTimeoutRef.current);
      }
    };
  }, []);

  // Track if we just saved to prevent unnecessary reloads
  const justSavedRef = useRef(false);

  // Timeout ref for debouncing dirty state notifications
  const dirtyStateTimeoutRef = useRef<NodeJS.Timeout>();


  // Update editor content when markdown prop changes from external sources
  React.useEffect(() => {
    // Skip updates immediately after saving to prevent scroll jumping
    if (justSavedRef.current) {
      justSavedRef.current = false;
      logger.debug('Skipping editor update - just saved');
      return;
    }

    if (editorRef.current && markdown !== undefined) {
      // Get current editor content to compare
      const currentContent = editorRef.current.getMarkdown();

      // Check if update is actually needed by comparing processed versions
      const processedIncomingMarkdown = preprocessAngleBrackets(markdown);
      const currentProcessedContent = postprocessAngleBrackets(currentContent);
      
      // Only update if the functional content has actually changed
      if (currentProcessedContent !== markdown && currentContent !== processedIncomingMarkdown) {
        logger.debug('External content change detected, processing images and updating editor...');

        // Set external update flag to prevent circular updates
        isExternalUpdateRef.current = true;

        // Extension-side preprocessing handles images, use content directly
        try {
          // Store current cursor position
          const selection = window.getSelection();
          const range = selection?.rangeCount ? selection.getRangeAt(0) : null;

          // Use clean content for display, handle escaping internally
          const processedMarkdown = markdown;

          // Update the editor content directly (images already preprocessed by extension)
          editorRef.current?.setMarkdown(processedMarkdown);

          // Try to restore cursor position (best effort)
          if (range && selection) {
            try {
              selection.removeAllRanges();
              selection.addRange(range);
            } catch (e) {
              // Ignore cursor restore errors
            }
          }
        } catch (error) {
          logger.error('Error updating editor content:', error);
        } finally {
          // Reset the flag after a brief delay
          setTimeout(() => {
            isExternalUpdateRef.current = false;
          }, 50);
        }
      }
    }
  }, [markdown]);

  // True realtime sync state management
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const isExternalUpdateRef = useRef(false);
  const hasAppliedInitialEscapingRef = useRef(false);

  const handleMarkdownChange = useCallback((newMarkdown: string) => {
    // Skip if this change is from an external update
    if (isExternalUpdateRef.current) {
      return;
    }

    // On first edit, apply escaping to the editor content invisibly
    if (!hasAppliedInitialEscapingRef.current && editorRef.current) {
      const currentContent = editorRef.current.getMarkdown();
      const needsEscaping = currentContent.includes('<') && !currentContent.includes('\\<');
      
      if (needsEscaping) {
        hasAppliedInitialEscapingRef.current = true;
        isExternalUpdateRef.current = true;
        
        const escapedContent = preprocessAngleBrackets(currentContent);
        editorRef.current.setMarkdown(escapedContent);
        
        // Reset flag and continue processing
        setTimeout(() => {
          isExternalUpdateRef.current = false;
        }, 50);
        
        // Process the new content with the escaped version as base
        const processedMarkdown = postprocessAngleBrackets(newMarkdown);
        
        // Continue with normal flow
        const hasChanges = processedMarkdown !== markdown;
        setHasUnsavedChanges(hasChanges);
        
        startTransition(() => {
          onMarkdownChange(processedMarkdown);
        });
        
        return;
      }
    }

    // Mark as typing for performance optimizations
    setIsTyping(true);
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 300);

    // Apply postprocessing to convert mathematical angle brackets back to regular ones and restore curly braces
    const processedMarkdown = postprocessAngleBrackets(newMarkdown);

    // Immediate response: Update the editor state synchronously
    const hasChanges = processedMarkdown !== markdown;
    setHasUnsavedChanges(hasChanges);

    // Use React 18 startTransition for non-urgent updates that can be deferred
    startTransition(() => {
      onMarkdownChange(processedMarkdown);
    });

    // Clear any existing dirty state timeout
    clearTimeout(deferredMessageTimeoutRef.current);

    // Schedule dirty state notification with debouncing
    deferredMessageTimeoutRef.current = setTimeout(() => {
      if (hasChanges && window.vscodeApi) {
        window.vscodeApi.postMessage({
          command: 'dirtyStateChanged',
          isDirty: true
        });
      }
    }, 100); // Short delay to batch rapid changes
  }, [markdown, onMarkdownChange]);


  // Handle internal search messages
  React.useEffect(() => {
    const handleSearchMessage = (event: MessageEvent) => {
      if (event.data.type === 'open-search') {
        logger.debug('Received open-search message, triggering search');
        // Find search button and click it programmatically
        const searchButton = document.querySelector('button[title*="Search"]');
        if (searchButton) {
          (searchButton as HTMLButtonElement).click();
        }
      }
    };

    window.addEventListener('message', handleSearchMessage);
    return () => window.removeEventListener('message', handleSearchMessage);
  }, []);

  // Manual save only - removed auto-save after comment operations

  // Function to convert webview URIs back to relative paths for saving
  const convertWebviewUrisToRelativePaths = useCallback((content: string): string => {
    // Convert vscode-webview:// URIs back to relative paths for file storage
    const webviewUriRegex = /!\[([^\]]*)\]\(vscode-webview:\/\/[^\/]+\/([^)]+)\)/g;

    return content.replace(webviewUriRegex, (match, alt, encodedPath) => {
      try {
        // Decode the URI path
        const decodedPath = decodeURIComponent(encodedPath);
        logger.debug(`Converting webview URI back to relative path: ${decodedPath}`);

        // Extract just the relative portion if it's an absolute path
        // This assumes the current document is in the same directory structure
        const relativePath = decodedPath.includes('media/') ?
          decodedPath.substring(decodedPath.lastIndexOf('media/')) :
          decodedPath;

        return `![${alt}](${relativePath})`;
      } catch (error) {
        logger.error('Error converting webview URI:', error);
        return match; // Return original if conversion fails
      }
    });
  }, []);

  // Handle Ctrl+S / Cmd+S for saving and Ctrl+F / Cmd+F for search
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        logger.debug('Save keyboard shortcut pressed');

        // Get the current markdown from the editor
        let contentToSave = markdown;
        if (editorRef.current) {
          const editorContent = editorRef.current.getMarkdown();

          // Convert webview URIs back to relative paths
          const contentWithRelativePaths = convertWebviewUrisToRelativePaths(editorContent);

          // Apply postprocessing to convert mathematical angle brackets back to regular ones and restore curly braces
          contentToSave = postprocessAngleBrackets(contentWithRelativePaths);
          logger.debug('Got content from editor, converted URIs, and postprocessed:', contentToSave.substring(0, 100));
        }

        if (typeof window !== 'undefined' && window.vscodeApi) {
          logger.debug('Sending save command with content length:', contentToSave.length);

          // Set flag to prevent editor reload after save
          justSavedRef.current = true;

          window.vscodeApi.postMessage({
            command: 'save',
            content: contentToSave
          });
          setHasUnsavedChanges(false);

          // Notify extension that changes are saved for tab title indicator
          if (window.vscodeApi) {
            window.vscodeApi.postMessage({
              command: 'dirtyStateChanged',
              isDirty: false
            });
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        logger.debug('Search keyboard shortcut pressed, focusing search input');
        // Focus the inline search input
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [hasUnsavedChanges, markdown, convertWebviewUrisToRelativePaths]);

  // Text selection handling for floating comment button
  React.useEffect(() => {
    const handleSelectionChange = () => {
      // Don't update selection if comment modal is open - lock the selection
      if (showCommentModal || showEditModal) {
        return;
      }

      const selection = window.getSelection();
      if (selection && selection.toString().trim() && containerRef.current) {
        const range = selection.getRangeAt(0);

        // Check if the selection is within the editor content area, not in search input or other UI elements
        const startContainer = range.startContainer;
        const endContainer = range.endContainer;

        // Find if selection is within editor content
        const isWithinEditor = (node: Node): boolean => {
          let current: Node | null = node;
          while (current) {
            if (current.nodeType === Node.ELEMENT_NODE) {
              const element = current as Element;
              // Check if it's within the MDX editor content area
              if (element.classList.contains('mdx-content') ||
                element.classList.contains('mdx-editor-content') ||
                element.closest('.mdx-content') ||
                element.closest('.mdx-editor-content') ||
                element.closest('[contenteditable="true"]')) {
                return true;
              }
              // Exclude search input and other UI elements
              if (element.classList.contains('inline-search-input') ||
                element.closest('.inline-search-container') ||
                element.closest('.comments-sidebar') ||
                element.closest('.toolbar')) {
                return false;
              }
            }
            current = current.parentNode;
          }
          return false;
        };

        // Only show comment button if selection is within editor content
        if (!isWithinEditor(startContainer) || !isWithinEditor(endContainer)) {
          logger.debug('Selection not within editor content area, hiding button');
          setShowFloatingButton(false);
          if (!showCommentModal && !showEditModal) {
            setSelectedText('');
            setCurrentSelection(null);
          }
          return;
        }

        const rect = range.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();

        const selectedTextContent = selection.toString().trim();
        logger.debug('Text selected in editor:', selectedTextContent);
        logger.debug('Selection rect:', rect);

        // Position button on the right edge of the editor content area
        const editorContentRect = containerRef.current.querySelector('.mdx-editor-content')?.getBoundingClientRect();
        const rightEdgeX = editorContentRect ? editorContentRect.right - containerRect.left - 50 : containerRect.width - 60;

        setFloatingButtonPosition({
          x: rightEdgeX,
          y: rect.top - containerRect.top + rect.height / 2 - 20
        });
        setSelectedText(selectedTextContent);
        setShowFloatingButton(true);

        // Store the actual selected text range
        setCurrentSelection({
          start: range.startOffset,
          end: range.endOffset
        });
      } else {
        logger.debug('No text selected or selection cleared');
        setShowFloatingButton(false);
        // Don't clear selectedText immediately - keep it for the modal
        if (!showCommentModal && !showEditModal) {
          setSelectedText('');
          setCurrentSelection(null);
        }
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [showCommentModal, showEditModal]);

  // Handle clicks on highlighted text to highlight corresponding comment
  React.useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Clear focus if clicking outside comments
      if (!target.closest('.comment-highlight') && !target.closest('.comment-item')) {
        setFocusedCommentId(null);
      }

      if (target && target.classList.contains('comment-highlight')) {
        const commentId = target.getAttribute('data-comment-id');
        if (commentId) {
          logger.debug('Clicked on highlighted text for comment:', commentId);

          // Find and highlight the comment in the sidebar
          const commentElements = document.querySelectorAll('.comment-item');
          commentElements.forEach(el => el.classList.remove('highlighted'));

          // Find the comment in the sidebar using the comment ID
          const sidebarCommentElement = document.querySelector(`.comment-item[data-comment-id="${commentId}"]`);
          if (sidebarCommentElement) {
            logger.debug('Found sidebar comment element for ID:', commentId);

            // Add highlight animation
            sidebarCommentElement.classList.add('highlighted');

            // Find the scrollable comments container - .comments-list is the actual scrollable part
            const commentsContainer = document.querySelector('.comments-list');

            logger.debug('Comments container search result:', {
              container: commentsContainer,
              classList: commentsContainer?.classList.toString(),
              tagName: commentsContainer?.tagName
            });

            if (commentsContainer) {
              logger.debug('Found scrollable comments container, checking scroll properties:', {
                scrollHeight: commentsContainer.scrollHeight,
                clientHeight: commentsContainer.clientHeight,
                isScrollable: commentsContainer.scrollHeight > commentsContainer.clientHeight
              });

              // Check if we need to scroll (comment is outside viewport)
              const containerRect = commentsContainer.getBoundingClientRect();
              const commentRect = sidebarCommentElement.getBoundingClientRect();

              const isAboveViewport = commentRect.top < containerRect.top;
              const isBelowViewport = commentRect.bottom > containerRect.bottom;
              const needsScroll = isAboveViewport || isBelowViewport;

              logger.debug('Scroll needed:', needsScroll, { isAboveViewport, isBelowViewport });

              if (needsScroll) {
                // Calculate scroll position to center the comment
                const relativeTop = (sidebarCommentElement as HTMLElement).offsetTop;
                const targetScrollTop = relativeTop - (containerRect.height / 2) + (commentRect.height / 2);

                logger.debug('Scrolling sidebar only to position:', targetScrollTop);

                // Scroll ONLY the sidebar, not the whole page
                commentsContainer.scrollTo({
                  top: Math.max(0, targetScrollTop),
                  behavior: 'smooth'
                });
              }
            } else {
              logger.debug('Comments container not found for scrolling');
            }
          } else {
            logger.debug('Sidebar comment element not found for ID:', commentId);
          }
        }
      }
    };

    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, []);

  // Sidebar resizing logic
  React.useEffect(() => {
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
        setSidebarWidth(Math.max(280, Math.min(600, newWidth)));
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

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      // Clear external update flag on unmount
      isExternalUpdateRef.current = false;
    };
  }, []);

  const handleOpenCommentModal = (text: string) => {
    logger.debug('handleOpenCommentModal called with text:', text);
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      // Simple range calculation - in a real app you'd want more sophisticated text position tracking
      setCurrentSelection({
        start: range.startOffset,
        end: range.endOffset
      });
    }
    setSelectedText(text);
    setShowCommentModal(true);
    logger.debug('Modal should be opening, showCommentModal set to true');
  };

  const handleSubmitComment = (comment: string) => {
    logger.debug('Enhanced handleSubmitComment called with:', comment);
    logger.debug('Selected text:', selectedText);
    logger.debug('Selected text length:', selectedText.length);
    logger.debug('Comment length:', comment.trim().length);

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

      logger.debug('Smart context analysis:', {
        isInCodeBlock,
        isMultiParagraph,
        selectedTextLength: selectedText.length
      });

      if (isInCodeBlock) {
        // Code blocks can't be reliably commented - show error
        logger.debug('Detected code block content, showing error message');
        if (window.vscodeApi) {
          window.vscodeApi.postMessage({
            command: 'error',
            content: 'Sorry, code blocks cannot be commented on directly. If you have ideas how to make this work, please let us know on our GitHub repo!'
          });
        }
        return;
      } else if (isMultiParagraph) {
        // Multi-paragraph selections use container directive
        logger.debug('Detected multi-paragraph content, using container directive');
        handleHybridComment(comment, commentId, currentMarkdown);
      } else {
        // Regular text (including formatted text) uses inline directive with native insertion
        logger.debug('Using native inline directive insertion for regular content');
        handleInlineComment(comment, commentId, currentMarkdown);
      }

    } catch (error) {
      logger.error('Error in comment submission:', error);
      // Show error instead of falling back to sidebar
      if (window.vscodeApi) {
        window.vscodeApi.postMessage({
          command: 'error',
          content: 'Failed to add comment. Please try selecting different text or report this issue on our GitHub repo.'
        });
      }
    }

    // Close modal
    setShowCommentModal(false);
    setSelectedText('');
    setCurrentSelection(null);
  };


  // Handle standard inline comments using MDX Editor's native directive insertion
  const handleInlineComment = (comment: string, commentId: string, currentMarkdown: string) => {
    logger.debug('Creating inline comment using native directive insertion');

    // Trigger plugin to insert comment directive
    if (editorRef.current) {
      // We'll use the plugin's signal to insert the directive
      // This will be handled by the plugin within the MDX Editor's context
      setCommentPendingForPlugin({
        comment,
        commentId,
        selectedText,
        strategy: 'inline'
      });
    }
  };

  // Handle hybrid comments (container directive for complex selections)
  const handleHybridComment = (comment: string, commentId: string, currentMarkdown: string) => {
    logger.debug('Creating hybrid comment using native container directive insertion');

    // Trigger plugin to insert comment directive
    if (editorRef.current) {
      setCommentPendingForPlugin({
        comment,
        commentId,
        selectedText,
        strategy: 'container'
      });
    }
  };

  // Function to trigger comment insertion via plugin
  const setCommentPendingForPlugin = (commentData: { comment: string, commentId: string, selectedText: string, strategy: 'inline' | 'container' }) => {
    logger.debug('Setting comment pending for plugin insertion');
    // The plugin will handle this through the cell subscription
    // We need to publish to the cell from outside the plugin context
    // This will be handled when the editor mounts
    setPendingComment(commentData);
  };

  // Callback for when comment insertion is complete
  const handleCommentInserted = () => {
    logger.debug('=== COMMENT INSERTION COMPLETED ===');
    logger.debug('Pending comment before clearing:', pendingComment);
    setPendingComment(null);

    // Trigger change event to save the updated markdown  
    if (editorRef.current) {
      const updatedMarkdown = editorRef.current.getMarkdown();
      logger.debug('Markdown after insertion:', updatedMarkdown.substring(0, 200) + '...');
      logger.debug('Calling onMarkdownChange with updated markdown');
      onMarkdownChange(updatedMarkdown);
    } else {
      logger.error('No editor ref available in handleCommentInserted');
    }

    // Notify extension about changes
    if (window.vscodeApi) {
      window.vscodeApi.postMessage({
        command: 'dirtyStateChanged',
        isDirty: true
      });
    }
  };

  // Effect to watch for pending comments and trigger plugin
  React.useEffect(() => {
    if (pendingComment) {
      logger.debug('Triggering plugin comment insertion via cell update');
      // Directly publish to the plugin's cell - the plugin will handle it
      // This simulates what would happen if we published from within the MDX Editor context
      try {
        // We can't directly access the realm from here, but the plugin subscription will handle it
        // For now, we'll use a workaround to communicate with the plugin
        logger.debug('Pending comment set, plugin should pick it up:', pendingComment);
      } catch (error) {
        logger.error('Error triggering plugin comment insertion:', error);
        setPendingComment(null);
      }
    }
  }, [pendingComment]);

  // Function to detect if selected text is within a code block
  const detectCodeBlockSelection = (markdown: string, selectedText: string): boolean => {
    // Look for the selected text in the markdown and check if it's within ``` blocks
    const textIndex = markdown.indexOf(selectedText);
    if (textIndex === -1) return false;

    // Count code block markers before the selection
    const beforeSelection = markdown.substring(0, textIndex);
    const codeBlockMarkers = (beforeSelection.match(/```/g) || []).length;

    // If odd number of markers, we're inside a code block
    return codeBlockMarkers % 2 === 1;
  };

  // Function to trigger plugin comment insertion via cell publish
  const triggerCommentInsertion = useCallback((commentData: any) => {
    logger.debug('Direct cell publish for comment insertion');
    // This will be handled by publishing directly to the cell from the plugin context
    // We need a way to access the realm publisher from outside
    setPendingComment(commentData);
  }, []);

  const handleCloseModal = () => {
    logger.debug('handleCloseModal called');
    setShowCommentModal(false);
    setSelectedText('');
    setCurrentSelection(null);
  };

  // Comment action handlers
  const handleNavigateToComment = useCallback((commentId: string) => {
    logger.debug('Navigate to comment:', commentId);
    if (typeof window !== 'undefined' && window.vscodeApi) {
      window.vscodeApi.postMessage({
        command: 'navigateToComment',
        commentId: commentId
      });
    }
  }, []);

  // handleEditComment is already defined earlier in the file

  const handleEditSubmit = useCallback((newComment: string) => {
    if (!editingComment) {
      logger.error('No comment being edited');
      return;
    }

    const commentId = editingComment.id;
    logger.debug('Edit submit called with:', newComment, 'for comment:', commentId);

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
      new RegExp(`:comment\\[([^\\]]*)\\]\\{([^}]*?)text="([^"]*)"([^}]*)\\}`, 'g'),
      new RegExp(`::comment\\[([^\\]]*)\\]\\{([^}]*?)text="([^"]*)"([^}]*)\\}`, 'g'),
      // Container comment patterns
      new RegExp(`:::comment\\{([^}]*?)text="([^"]*)"([^}]*)\\}`, 'g')
    ];

    let updatedMarkdown = markdown;
    let found = false;

    for (const pattern of patterns) {
      logger.debug('Testing edit pattern:', pattern.source);
      const matches = [...updatedMarkdown.matchAll(pattern)];
      logger.debug('Pattern matches found for edit:', matches.length);

      if (matches.length > 0) {
        matches.forEach((match, index) => {
          logger.debug(`Edit Match ${index}:`, match[0]);
          logger.debug('Match groups:', match.slice(1));
          // Check if this match contains our comment ID
          if (match[0].includes(`id="${commentId}"`) || match[0].includes(`#${commentId}`)) {
            logger.debug('Found matching comment with our ID');
          }
        });

        updatedMarkdown = updatedMarkdown.replace(pattern, (match, ...groups) => {
          // Check if this match is for our specific comment ID
          if (match.includes(`id="${commentId}"`) || match.includes(`#${commentId}`)) {
            logger.debug('Replacing comment text for ID:', commentId);
            logger.debug('Original match:', match);

            // Replace just the text attribute
            const newMatch = match.replace(/text="[^"]*"/, `text="${escapeDirectiveContent(newComment, match.includes(':::'))}"`);
            logger.debug('New match:', newMatch);
            return newMatch;
          }
          return match; // Return unchanged if not our comment
        });
        found = true;
        break;
      }
    }

    if (found) {
      logger.debug('Successfully updated comment text in markdown');
      onMarkdownChange(updatedMarkdown);
      setShowEditModal(false);
      setEditingComment(null);
      logger.debug('=== EDIT COMPLETED ===');
    } else {
      logger.error('Could not find comment to edit for ID:', commentId);
      logger.debug('Available markdown content:', markdown.substring(0, 500));
    }
  }, [markdown, onMarkdownChange, editingComment]);

  const handleEditClose = () => {
    setShowEditModal(false);
    setEditingComment(null);
  };

  // Function to render content as book pages
  const renderBookPages = () => {
    const content = markdown || '';
    const paragraphs = content.split('\n\n');
    const pages: string[] = [];
    let currentPage: string[] = [];
    let currentHeight = 0;
    const maxHeight = 35; // Approximate lines per page for 7.5" content area

    paragraphs.forEach(paragraph => {
      const estimatedLines = Math.max(1, Math.ceil(paragraph.length / 80)); // Rough estimate
      if (currentHeight + estimatedLines > maxHeight && currentPage.length > 0) {
        pages.push(currentPage.join('\n\n'));
        currentPage = [paragraph];
        currentHeight = estimatedLines;
      } else {
        currentPage.push(paragraph);
        currentHeight += estimatedLines;
      }
    });

    if (currentPage.length > 0) {
      pages.push(currentPage.join('\n\n'));
    }

    return pages.map((pageContent, index) => (
      <div key={index} className="book-page">
        <div className="book-page-content">
          <div dangerouslySetInnerHTML={{ __html: pageContent.replace(/\n/g, '<br/>') }} />
        </div>
        <div className="book-page-number">{index + 1}</div>
      </div>
    ));
  };

  // Define plugins array with useMemo BEFORE the return statement to follow React hooks rules
  const plugins = useMemo(() => [
    // Core editing plugins
    headingsPlugin(),
    quotePlugin(),
    listsPlugin(),
    linkPlugin(),
    tablePlugin(),
    thematicBreakPlugin(),
    markdownShortcutPlugin(),
    searchPlugin(),
    imagePlugin({
      imageUploadHandler: async (image: File) => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const data = e.target?.result;
            if (data) {
              window.vscodeApi.postMessage({
                command: 'getImageUri',
                data: data,
              });

              const handleUri = (event: any) => {
                if (event.data.command === 'imageUri') {
                  window.removeEventListener('message', handleUri);
                  resolve(event.data.uri);
                }
              }

              window.addEventListener('message', handleUri);
            }
          };
          reader.readAsDataURL(image);
        });
      },
      imageAutocompleteSuggestions: ['media/', './media/', '../media/']
    }),

    // Custom comment insertion plugin using native insertDirective$
    commentInsertionPlugin({
      pendingComment: pendingComment,
      onInsertComment: (commentData) => {
        logger.debug('Comment inserted via plugin, triggering UI update');
        handleCommentInserted();
      }
    }),

    // Removed angle bracket plugin for better performance

    directivesPlugin({
      directiveDescriptors: [
        createCommentDirectiveDescriptor(focusedCommentId, setFocusedCommentId),
        genericDirectiveDescriptor  // Refined version - only catches actual directives
      ],
      // Try disabling escapeUnknownTextDirectives to see if it causes the equals escaping
      escapeUnknownTextDirectives: false
    }),

    // Toolbar with our custom comment button and responsive design
    toolbarPlugin({
      toolbarContents: () => (
        <ToolbarWithCommentButton
          selectedFont={selectedFont}
          handleFontChange={handleFontChange}
          availableFonts={availableFonts}
          setIsBookView={setIsBookView}
          isBookView={isBookView}
          searchInputRef={searchInputRef}
          isTyping={isTyping}
        />
      )
    }),

    // Enhanced code block plugin with Mermaid support
    codeBlockPlugin({
      defaultCodeBlockLanguage: 'js',
      codeBlockEditorDescriptors: [
        // Mermaid diagram editor - highest priority
        {
          priority: 10,
          match: (language, _code) => language === 'mermaid',
          Editor: MermaidEditor
        },
        // Specific mappings for common aliases
        {
          priority: 5,
          match: (language, _code) => language === 'javascript',
          Editor: (props) => <CodeMirrorEditor {...props} language="js" />
        },
        {
          priority: 5,
          match: (language, _code) => language === 'python',
          Editor: (props) => <CodeMirrorEditor {...props} language="py" />
        },
        {
          priority: 5,
          match: (language, _code) => language === 'typescript',
          Editor: (props) => <CodeMirrorEditor {...props} language="ts" />
        },
        {
          priority: 5,
          match: (language, _code) => language === 'markdown',
          Editor: (props) => <CodeMirrorEditor {...props} language="md" />
        },
        {
          priority: 5,
          match: (language, _code) => language === 'yml',
          Editor: (props) => <CodeMirrorEditor {...props} language="yaml" />
        },
        {
          priority: 5,
          match: (language, _code) => language === 'text',
          Editor: (props) => <CodeMirrorEditor {...props} language="txt" />
        },
        {
          priority: 5,
          match: (language, _code) => language === 'shell',
          Editor: (props) => <CodeMirrorEditor {...props} language="sh" />
        },
        // Fallback editor for any other unknown languages
        {
          priority: -10,
          match: (_) => true,
          Editor: CodeMirrorEditor
        }
      ]
    }),
    codeMirrorPlugin({
      codeBlockLanguages: {
        js: 'JavaScript',
        css: 'CSS',
        txt: 'Text',
        md: 'Markdown',
        ts: 'TypeScript',
        html: 'HTML',
        json: 'JSON',
        yaml: 'YAML',
        ini: 'INI',
        toml: 'TOML',
        xml: 'XML',
        csv: 'CSV',
        sql: 'SQL',
        py: 'Python',
        bash: 'Bash',
        sh: 'Shell',
        mermaid: 'Mermaid'
      },
      // Add better syntax theme configuration
      autocompletion: true,
      branchPrediction: false,
      codeFolding: true
    })
  ], [selectedFont, handleFontChange, availableFonts, setIsBookView, isBookView, searchInputRef, isTyping, focusedCommentId, setFocusedCommentId, pendingComment, handleCommentInserted]);

  logger.debug('=== MDXEditorWrapper RENDER END - returning JSX ===');
  logger.debug('Editor state:', {
    showCommentSidebar,
    isBookView,
    selectedFont,
    parsedCommentsCount: parsedComments.length,
    editorRefExists: !!editorRef.current
  });

  return (
    <div className={`mdx-editor-container ${isBookView ? 'book-view' : ''}`} ref={containerRef}>
      {isBookView ? (
        // Book view: render as paginated content
        <div className="book-pages-container">
          {renderBookPages()}
        </div>
      ) : (
        <>
          {/* Normal view: Top section with editor */}
          <div className="mdx-editor-with-sidebar">
            <div className="mdx-editor-content">
              {(() => {
                logger.debug('=== MDXEDITOR COMPONENT RENDER START ===');
                logger.debug('About to render MDXEditor with:', {
                  markdown: markdown?.substring(0, 100) + '...',
                  markdownLength: markdown?.length,
                  selectedFont,
                  className: `mdx-editor dark-theme font-${selectedFont.toLowerCase().replace(/\s+/g, '-')}`,
                  contentEditableClassName: `mdx-content font-${selectedFont.toLowerCase().replace(/\s+/g, '-')}`
                });

                // Plugins are now defined outside the JSX to follow React hooks rules
                logger.debug('Plugins array length:', plugins.length);
                logger.debug('Plugin names:', plugins.map(p => p.constructor?.name || 'Unknown'));
                logger.debug('NOTE: Both codeBlockPlugin and codeMirrorPlugin enabled for fenced block support');

                try {
                  const editorElement = (
                    <MDXEditor
                      ref={(ref) => {
                        editorRef.current = ref;
                        // Add debugging when editor mounts
                        if (ref) {
                          logger.debug('MDXEditor component mounted, checking content after 2 seconds...');
                          setTimeout(() => {
                            try {
                              const content = ref.getMarkdown();
                              logger.debug('Editor content length after mount:', content.length);
                              logger.debug('Editor content preview:', content.substring(0, 500) + '...');

                              // Check DOM structure
                              const editorDOM = document.querySelector('.mdx-content') || document.querySelector('[contenteditable="true"]');
                              if (editorDOM) {
                                logger.debug('Editor DOM found, innerHTML length:', editorDOM.innerHTML.length);
                                logger.debug('Editor DOM preview:', editorDOM.innerHTML.substring(0, 500) + '...');

                                // Check if code blocks exist in DOM
                                const codeBlocks = editorDOM.querySelectorAll('pre, code, .cm-editor');
                                logger.debug('Code blocks found in DOM:', codeBlocks.length);
                                codeBlocks.forEach((block, index) => {
                                  logger.debug(`Code block ${index}:`, block.tagName, block.className);
                                });
                              } else {
                                logger.debug('Editor DOM not found');
                              }
                            } catch (err) {
                              logger.error('Error inspecting editor after mount:', err);
                            }
                          }, 2000);
                        }
                      }}
                      markdown={markdown || ''}
                      onChange={handleMarkdownChange}
                      suppressHtmlProcessing={true}
                      onError={(error) => {
                        logger.error('MDXEditor parsing error:', error);
                        logger.debug('This error might be caused by angle brackets. Try using the source mode if available.');
                      }}
                      className={`mdx-editor dark-theme font-${selectedFont.toLowerCase().replace(/\s+/g, '-')}`}
                      contentEditableClassName={`mdx-content font-${selectedFont.toLowerCase().replace(/\s+/g, '-')}`}
                      plugins={plugins}
                    />
                  );
                  logger.debug('About to return MDXEditor element');
                  return editorElement;
                } catch (error) {
                  logger.error('=== MDXEDITOR RENDER ERROR ===', error);
                  return (
                    <div style={{ padding: '20px', background: '#ffe6e6', border: '1px solid #ff0000', borderRadius: '4px' }}>
                      <h3>Editor Error</h3>
                      <p>Failed to load MDXEditor component:</p>
                      <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px', fontSize: '12px' }}>
                        {error instanceof Error ? error.message : String(error)}
                      </pre>
                      <details>
                        <summary>Stack trace</summary>
                        <pre style={{ fontSize: '10px' }}>
                          {error instanceof Error ? error.stack : 'No stack trace available'}
                        </pre>
                      </details>
                    </div>
                  );
                }
              })()}
            </div>

            {/* Comments Sidebar */}
            {showCommentSidebar && (
              <div className="comments-sidebar" style={{ width: `${sidebarWidth}px` }}>
                <div className="sidebar-resize-handle"></div>
                <div className="comments-header">
                  <h3>Comments</h3>
                  <button
                    onClick={() => setShowCommentSidebar(false)}
                    className="sidebar-close"
                    title="Hide Comments"
                  >
                    ✕
                  </button>
                </div>

                <div className="comments-list">
                  {parsedComments.length === 0 ? (
                    <div className="no-comments">
                      <p>No comments yet.</p>
                      <p className="help-text">Select text and click the 💬 Add comment button to add comments.</p>
                    </div>
                  ) : (
                    sortedCommentItems
                  )}
                </div>
              </div>
            )}

            {/* Show comments button when sidebar is hidden */}
            {!showCommentSidebar && (
              <button
                className="show-comments-btn"
                onClick={() => setShowCommentSidebar(true)}
                title="Show Comments"
              >
                💬 {parsedComments.length}
              </button>
            )}
          </div>
        </>
      )}

      {/* Floating comment button */}
      {
        showFloatingButton && floatingButtonPosition && (
          <div
            className={`floating-comment-button ${showFloatingButton ? 'visible' : ''}`}
            title="Add comment"
            style={{
              left: `${floatingButtonPosition.x + 34}px`,
              top: `${floatingButtonPosition.y}px`
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              logger.debug('Floating button mousedown with selected text:', selectedText);
              if (selectedText) {
                setShowCommentModal(true);
                setShowFloatingButton(false);
              }
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              logger.debug('Floating button clicked with selected text:', selectedText);
              if (selectedText) {
                setShowCommentModal(true);
                setShowFloatingButton(false);
              }
            }}
          >
            💬
          </div>
        )
      }

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
        selectedText={editingComment?.anchoredText || ''}
        initialText={editingComment?.content || ''}
        isEditing={true}
      />
    </div>
  );
};
