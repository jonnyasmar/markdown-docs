import React, { useState, useRef } from 'react';
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
  CodeMirrorEditor
} from '@mdxeditor/editor';
import { usePublisher } from '@mdxeditor/gurx';
import '@mdxeditor/editor/style.css';
import { CommentWithAnchor } from '../types';
import { CommentModal } from './CommentModal';
import { DirectiveService } from '../../../src/services/directive';
import './MDXEditorWrapper.css';

// Inline search component for toolbar
const InlineSearchInput = ({ searchInputRef }: { searchInputRef: React.RefObject<HTMLInputElement> }) => {
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



// Custom toolbar component
const ToolbarWithCommentButton = ({
  selectedFont,
  handleFontChange,
  availableFonts,
  setIsBookView,
  isBookView,
  searchInputRef
}: any) => {
  return (
    <>
      <UndoRedo />
      <Separator />
      <BoldItalicUnderlineToggles />
      <Separator />
      <BlockTypeSelect />
      <Separator />
      <ListsToggle />
      <Separator />
      <ConditionalContents
        options={[
          { when: (editor) => editor?.editorType === 'codeblock', contents: () => <ChangeCodeMirrorLanguage /> },
          {
            fallback: () => (
              <InsertCodeBlock />
            )
          }
        ]}
      />
      <CreateLink />
      <InsertTable />
      <InsertThematicBreak />
      <Separator />
      {/* Use the MDX-powered search input for stable focus and highlighting */}
      <MDXInlineSearchInput searchInputRef={searchInputRef} />
      {/* LEAVE THIS OUT FOR NOW -- IT'S BROKEN <Button onClick={() => setIsBookView(!isBookView)}>
        📖 {isBookView ? 'Exit Book' : 'Book View'}
      </Button> */}
      <Separator />
      <Select
        value={selectedFont}
        onChange={handleFontChange}
        triggerTitle="Select Font"
        placeholder="Font"
        items={availableFonts.map((font: string) => ({ value: font, label: font }))}
      />
    </>
  );
};

// Stateless search input with debounced search operation based on ref value
const MDXInlineSearchInput = ({ searchInputRef }: { searchInputRef: React.RefObject<HTMLInputElement> }) => {
  const { setSearch, openSearch } = useEditorSearch();
  const debounceTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const [hasValue, setHasValue] = React.useState(false);

  // Debounced search function that reads from the input ref
  const debouncedSearch = React.useCallback(() => {
    if (debounceTimeoutRef.current !== null) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      const currentValue = searchInputRef.current?.value || '';
      setSearch(currentValue);
    }, 150); // 150ms debounce for responsive but not overwhelming updates
  }, [setSearch, searchInputRef]);

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

// Comment directive configuration supporting all directive types
const createCommentDirectiveDescriptor = (focusedCommentId: string | null, setFocusedCommentId: (id: string | null) => void) => ({
  name: 'comment',
  testNode(node: any) {
    console.log('Comment directive test - node:', node);
    return node && node.name === 'comment';
  },
  attributes: ['id', 'text'],
  hasChildren: true, // All directive types can have children (the [content] part)
  Editor: ({ mdastNode }: any) => {
    const commentId = mdastNode.attributes?.id || '';
    const commentText = mdastNode.attributes?.text || 'Comment';
    const directiveType = mdastNode.type; // 'textDirective', 'leafDirective', or 'containerDirective'

    console.log('Rendering comment directive:', { commentId, commentText, directiveType, mdastNode });

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
      console.log('Clicked comment highlight:', commentId);

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
    console.log('Generic directive test - node:', node);

    // If it's not our comment directive, catch it to prevent errors
    // This includes malformed directives with undefined names
    const isNotComment = !node || node.name !== 'comment';
    const shouldHandle = isNotComment;

    console.log('Generic directive decision:', {
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
    console.log('Rendering generic directive with props:', props);

    // If the directive has no name or is malformed, render nothing
    if (!props.mdastNode?.name || props.mdastNode.name === 'undefined') {
      console.log('Rendering invisible placeholder for malformed directive');
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
  defaultFont = 'Arial'
}) => {
  console.log('=== MDXEditorWrapper RENDER START ===');
  console.log('Props received:', { 
    markdownLength: markdown?.length, 
    commentsLength: comments?.length,
    defaultFont,
    hasOnMarkdownChange: !!onMarkdownChange
  });
  console.log('MDXEditorWrapper received markdown ending:', '...' + markdown?.substring((markdown?.length || 0) - 100));
  console.log('MDXEditorWrapper markdown contains code blocks?', markdown?.includes('```javascript'));
  console.log('MDXEditorWrapper markdown ends with expected?', markdown?.includes('explore all the features!'));
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
  const [selectedFont, setSelectedFont] = useState(defaultFont);
  const [editingComment, setEditingComment] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [focusedCommentId, setFocusedCommentId] = useState<string | null>(null);

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
    console.log('Font changed to:', fontName);
    console.log('Current selected font:', selectedFont);
    const fontClassName = fontName.toLowerCase().replace(/\s+/g, '-');
    console.log('Font class name will be:', `font-${fontClassName}`);

    setSelectedFont(fontName);

    // Save to VS Code settings
    if (typeof window !== 'undefined' && window.vscodeApi) {
      window.vscodeApi.postMessage({
        command: 'setFont',
        font: fontName
      });
    }
  };

  // Available fonts
  const availableFonts = [
    'Arial',
    'Times New Roman',
    'Roboto',
    'Georgia',
    'Calibri',
    'Garamond',
    'Book Antiqua'
  ];
  const editorRef = useRef<MDXEditorMethods>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Parse comments from markdown
  const [parsedComments, setParsedComments] = useState<CommentWithAnchor[]>([]);

  console.log('MDXEditorWrapper rendering with markdown:', markdown?.substring(0, 100));
  console.log('Comments sidebar visible:', showCommentSidebar);
  console.log('Comments count:', parsedComments.length);
  console.log('Comment modal visible:', showCommentModal);
  console.log('Selected text:', selectedText);
  console.log('Show floating button:', showFloatingButton);
  console.log('Current selected font:', selectedFont);
  console.log('Font class applied:', `font-${selectedFont.toLowerCase().replace(/\s+/g, '-')}`);

  // Parse comments whenever markdown changes
  React.useEffect(() => {
    console.log('=== COMMENT PARSING EFFECT TRIGGERED ===');
    console.log('Markdown length:', markdown?.length);
    console.log('Markdown preview:', markdown?.substring(0, 200));
    console.log('isExternalUpdate:', isExternalUpdateRef.current);

    if (markdown) {
      console.log('Parsing comments from markdown...');
      try {
        const comments = DirectiveService.parseCommentDirectives(markdown);
        console.log('Parsed comments count:', comments.length);
        console.log('Parsed comments details:', comments);

        // Convert to CommentWithAnchor format (we don't have positions, so use dummy values)
        const commentsWithAnchor: CommentWithAnchor[] = comments.map(comment => ({
          ...comment,
          anchoredText: comment.anchoredText || 'Selected text',
          startPosition: 0, // Not used in our directive-based approach
          endPosition: 0    // Not used in our directive-based approach
        }));

        setParsedComments(commentsWithAnchor);
        console.log('Comments state updated');
      } catch (error) {
        console.error('Error parsing comments:', error);
        setParsedComments([]);
      }
    } else {
      console.log('No markdown provided, clearing comments');
      setParsedComments([]);
    }
    console.log('=== COMMENT PARSING EFFECT END ===');
  }, [markdown]);

  // Update editor content when markdown prop changes from external sources
  React.useEffect(() => {
    console.log('=== EXTERNAL CONTENT UPDATE EFFECT TRIGGERED ===');
    console.log('Markdown prop changed:', markdown?.substring(0, 100));
    console.log('Editor ref exists:', !!editorRef.current);
    console.log('isExternalUpdate flag:', isExternalUpdateRef.current);

    if (editorRef.current && markdown !== undefined) {
      // Get current editor content to compare
      const currentContent = editorRef.current.getMarkdown();
      console.log('Current editor content length:', currentContent.length);
      console.log('New markdown content length:', markdown.length);

      // Only update if content has actually changed to avoid unnecessary updates
      if (currentContent !== markdown) {
        console.log('Content differs, updating editor...');

        // Set external update flag to prevent circular updates
        isExternalUpdateRef.current = true;

        try {
          // Update the editor content
          editorRef.current.setMarkdown(markdown);
          console.log('Editor content updated successfully');
        } catch (error) {
          console.error('Error updating editor content:', error);
        } finally {
          // Reset the flag after a brief delay to allow for any async operations
          setTimeout(() => {
            isExternalUpdateRef.current = false;
            console.log('External update flag reset');
          }, 100);
        }
      } else {
        console.log('Content is the same, skipping editor update');
      }
    } else {
      console.log('Editor ref not available or markdown is undefined');
    }
    console.log('=== EXTERNAL CONTENT UPDATE EFFECT END ===');
  }, [markdown]);

  // True realtime sync state management
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const isExternalUpdateRef = useRef(false);

  const handleMarkdownChange = (newMarkdown: string) => {
    console.log('MDXEditorWrapper: Markdown changed by user');

    // Skip if this change is from an external update
    if (isExternalUpdateRef.current) {
      console.log('Skipping change - from external update');
      return;
    }

    const hasChanges = newMarkdown !== markdown;
    setHasUnsavedChanges(hasChanges);
    onMarkdownChange(newMarkdown);

    // Notify extension about dirty state for tab title indicator
    if (window.vscodeApi) {
      window.vscodeApi.postMessage({
        command: 'dirtyStateChanged',
        isDirty: hasChanges
      });
    }

    // DISABLED: No auto-save during typing to prevent cursor jumping
    // Real-time sync disabled - only save on explicit save command (Ctrl+S/Cmd+S)
    console.log('Auto-save disabled - changes will be saved on Ctrl+S/Cmd+S');
  };

  // Handle internal search messages
  React.useEffect(() => {
    const handleSearchMessage = (event: MessageEvent) => {
      if (event.data.type === 'open-search') {
        console.log('Received open-search message, triggering search');
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

  // Handle Ctrl+S / Cmd+S for saving and Ctrl+F / Cmd+F for search
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        console.log('Save keyboard shortcut pressed');

        // Get the current markdown from the editor
        let contentToSave = markdown;
        if (editorRef.current) {
          contentToSave = editorRef.current.getMarkdown();
          console.log('Got content from editor:', contentToSave.substring(0, 100));
        }

        if (typeof window !== 'undefined' && window.vscodeApi) {
          console.log('Sending save command with content length:', contentToSave.length);
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
        console.log('Search keyboard shortcut pressed, focusing search input');
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
  }, [hasUnsavedChanges, markdown]);

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
          console.log('Selection not within editor content area, hiding button');
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
        console.log('Text selected in editor:', selectedTextContent);
        console.log('Selection rect:', rect);

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
        console.log('No text selected or selection cleared');
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
          console.log('Clicked on highlighted text for comment:', commentId);

          // Find and highlight the comment in the sidebar
          const commentElements = document.querySelectorAll('.comment-item');
          commentElements.forEach(el => el.classList.remove('highlighted'));

          // Find the comment in the sidebar using the comment ID
          const sidebarCommentElement = document.querySelector(`.comment-item[data-comment-id="${commentId}"]`);
          if (sidebarCommentElement) {
            console.log('Found sidebar comment element for ID:', commentId);

            // Add highlight animation
            sidebarCommentElement.classList.add('highlighted');

            // Find the scrollable comments container - .comments-list is the actual scrollable part
            const commentsContainer = document.querySelector('.comments-list');

            console.log('Comments container search result:', {
              container: commentsContainer,
              classList: commentsContainer?.classList.toString(),
              tagName: commentsContainer?.tagName
            });

            if (commentsContainer) {
              console.log('Found scrollable comments container, checking scroll properties:', {
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

              console.log('Scroll needed:', needsScroll, { isAboveViewport, isBelowViewport });

              if (needsScroll) {
                // Calculate scroll position to center the comment
                const relativeTop = (sidebarCommentElement as HTMLElement).offsetTop;
                const targetScrollTop = relativeTop - (containerRect.height / 2) + (commentRect.height / 2);

                console.log('Scrolling sidebar only to position:', targetScrollTop);

                // Scroll ONLY the sidebar, not the whole page
                commentsContainer.scrollTo({
                  top: Math.max(0, targetScrollTop),
                  behavior: 'smooth'
                });
              }
            } else {
              console.log('Comments container not found for scrolling');
            }
          } else {
            console.log('Sidebar comment element not found for ID:', commentId);
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
    console.log('handleOpenCommentModal called with text:', text);
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
    console.log('Modal should be opening, showCommentModal set to true');
  };

  const handleSubmitComment = (comment: string) => {
    console.log('handleSubmitComment called with:', comment);
    console.log('Selected text:', selectedText);
    console.log('Selected text length:', selectedText.length);
    console.log('Comment length:', comment.trim().length);

    if (comment.trim() && selectedText) {
      const commentId = `comment-${Date.now()}`;

      // Auto-extend selections to block boundaries for proper container directive support
      let processedText = selectedText;
      let isInlineComment = true;

      // Check if selection spans multiple paragraphs
      const hasMultipleParagraphs = selectedText.includes('\n\n');

      if (hasMultipleParagraphs && editorRef.current) {
        // Try to extend selection to full block boundaries for container directive
        const currentMarkdown = editorRef.current.getMarkdown();
        const selectionStartIndex = currentMarkdown.indexOf(selectedText);

        if (selectionStartIndex !== -1) {
          const beforeSelection = currentMarkdown.substring(0, selectionStartIndex);
          const afterSelection = currentMarkdown.substring(selectionStartIndex + selectedText.length);

          // Find the start of the block (last double newline before selection, or start of document)
          const lastBlockBreakBefore = beforeSelection.lastIndexOf('\n\n');
          const blockStart = lastBlockBreakBefore === -1 ? 0 : lastBlockBreakBefore + 2;

          // Find the end of the block (next double newline after selection, or end of document)
          const nextBlockBreakAfter = afterSelection.indexOf('\n\n');
          const blockEnd = nextBlockBreakAfter === -1 ?
            currentMarkdown.length :
            selectionStartIndex + selectedText.length + nextBlockBreakAfter;

          // Extract the full block-aligned content
          const blockAlignedText = currentMarkdown.substring(blockStart, blockEnd);

          // Only use container directive if we successfully extended to clean block boundaries
          if (blockAlignedText !== selectedText &&
            blockAlignedText.trim().length > 0 &&
            !blockAlignedText.startsWith('\n') &&
            !blockAlignedText.endsWith('\n')) {

            processedText = blockAlignedText;
            isInlineComment = false; // Use container directive

            console.log('Extended selection to block boundaries:', {
              originalText: selectedText.substring(0, 50) + '...',
              extendedText: blockAlignedText.substring(0, 50) + '...',
              originalLength: selectedText.length,
              extendedLength: blockAlignedText.length
            });
          }
        }
      }

      console.log('Comment directive logic:', {
        selectedTextLength: selectedText.length,
        isInlineComment,
        selectedTextPreview: selectedText.substring(0, 50) + (selectedText.length > 50 ? '...' : '')
      });

      if (editorRef.current) {
        const currentMarkdown = editorRef.current.getMarkdown();

        // Generate the directive text manually with proper escaping
        let directiveText;
        const escapedComment = comment.replace(/"/g, '\\"').replace(/\n/g, '\\n');

        if (isInlineComment) {
          // For inline comments (single paragraph/block only), clean up whitespace
          const cleanSelectedText = processedText.replace(/[ \t]+/g, ' ').trim();
          directiveText = `:comment[${cleanSelectedText}]{id="${commentId}" text="${escapedComment}"}`;
        } else {
          // For container comments (multiple blocks), use the block-aligned text
          directiveText = `:::comment{id="${commentId}" text="${escapedComment}"}\n${processedText}\n:::`;
        }

        console.log('Generated directive:', directiveText);
        console.log('Original selected text length:', selectedText.length);
        console.log('Selected text preview:', selectedText.substring(0, 100) + (selectedText.length > 100 ? '...' : ''));
        console.log('Is inline comment:', isInlineComment);
        console.log('Selected text contains newlines:', selectedText.includes('\n'));

        // Replace the processed text (which may be extended to block boundaries) with the directive
        const textIndex = currentMarkdown.indexOf(processedText);
        if (textIndex === -1) {
          console.error('Processed text not found in markdown:', processedText.substring(0, 50));
          setShowCommentModal(false);
          setSelectedText('');
          return;
        }

        const updatedMarkdown = currentMarkdown.substring(0, textIndex) +
          directiveText +
          currentMarkdown.substring(textIndex + processedText.length);

        console.log('Replacing selected text with directive:', directiveText);
        console.log('Original text:', selectedText);

        // Update parent state first
        onMarkdownChange(updatedMarkdown);

        // Notify extension about dirty state for tab title indicator
        if (window.vscodeApi) {
          window.vscodeApi.postMessage({
            command: 'dirtyStateChanged',
            isDirty: true
          });
        }

        // Manual save only - removed auto-save after comment creation

        // Force editor to re-render with updated content
        if (editorRef.current) {
          editorRef.current.setMarkdown(updatedMarkdown);
        }
      }
    }

    // Close modal
    setShowCommentModal(false);
    setSelectedText('');
    setCurrentSelection(null);
  };

  const handleCloseModal = () => {
    console.log('handleCloseModal called');
    setShowCommentModal(false);
    setSelectedText('');
    setCurrentSelection(null);
  };

  // Comment action handlers
  const handleNavigateToComment = (commentId: string) => {
    console.log('Navigate to comment:', commentId);
    if (typeof window !== 'undefined' && window.vscodeApi) {
      window.vscodeApi.postMessage({
        command: 'navigateToComment',
        commentId: commentId
      });
    }
  };

  const handleEditComment = (commentId: string) => {
    console.log('Edit comment locally:', commentId);

    // Find the comment to edit in our parsed comments
    const commentToEdit = parsedComments.find(c => c.id === commentId);
    if (commentToEdit) {
      console.log('Found comment to edit:', commentToEdit);
      setEditingComment(commentToEdit);
      setShowEditModal(true);
    } else {
      console.error('Comment not found for editing:', commentId);
    }
  };

  const handleDeleteComment = (commentId: string) => {
    console.log('=== DELETE COMMENT DEBUG START ===');
    console.log('Delete comment ID:', commentId);
    console.log('Editor ref exists:', !!editorRef.current);

    if (editorRef.current) {
      const currentMarkdown = editorRef.current.getMarkdown();
      console.log('Current markdown length:', currentMarkdown.length);
      console.log('Searching for comment ID in markdown:', commentId);

      // Remove the directive from the markdown while preserving the original text
      // Handle different directive patterns (both id="value" and #value formats)
      let updatedMarkdown = currentMarkdown;
      let matchFound = false;

      // Pattern for inline directives: :comment[original text]{id="value" text="comment"} 
      // Replace with just the original text
      const inlinePatterns = [
        {
          regex: new RegExp(`:comment\\[([^\\]]*)\\]\\{[^}]*(?:id="${commentId}"|#${commentId})[^}]*\\}`, 'g'),
          replacement: '$1' // Keep only the bracketed content
        },
        {
          regex: new RegExp(`::comment\\[([^\\]]*)\\]\\{[^}]*(?:id="${commentId}"|#${commentId})[^}]*\\}`, 'g'),
          replacement: '$1' // Keep only the bracketed content  
        }
      ];

      // Pattern for container directives: :::comment{id="value" text="comment"}\noriginal content\n:::
      // Replace with just the original content
      const containerPatterns = [
        {
          regex: new RegExp(`:::comment\\{[^}]*(?:id="${commentId}"|#${commentId})[^}]*\\}\\s*([\\s\\S]*?)\\s*:::`, 'g'),
          replacement: '$1' // Keep only the content between the container tags
        }
      ];

      // Try inline patterns first
      [...inlinePatterns, ...containerPatterns].forEach((patternObj, index) => {
        console.log(`Testing pattern ${index}:`, patternObj.regex);
        const matches = updatedMarkdown.match(patternObj.regex);
        if (matches) {
          console.log(`Pattern ${index} matched:`, matches);
          console.log(`Will replace with:`, patternObj.replacement);
          matchFound = true;
        }
        const beforeReplace = updatedMarkdown.length;
        updatedMarkdown = updatedMarkdown.replace(patternObj.regex, patternObj.replacement);
        const afterReplace = updatedMarkdown.length;
        if (beforeReplace !== afterReplace) {
          console.log(`Pattern ${index} successfully removed ${beforeReplace - afterReplace} characters`);
        }
      });

      if (!matchFound) {
        console.log('No patterns matched for comment ID:', commentId);
        console.log('Available comment IDs in markdown:', currentMarkdown.match(/(id="[^"]*"|#[a-zA-Z0-9-_]+)/g));
      }

      // Clean up extra whitespace
      updatedMarkdown = updatedMarkdown.replace(/\n\n\n+/g, '\n\n');

      console.log('Updated markdown length after deletion:', updatedMarkdown.length);
      console.log('Markdown changed:', currentMarkdown !== updatedMarkdown);
      console.log('Characters removed:', currentMarkdown.length - updatedMarkdown.length);

      if (currentMarkdown !== updatedMarkdown) {
        console.log('Applying changes to editor and saving...');
        // Update editor - manual save only
        onMarkdownChange(updatedMarkdown);
        editorRef.current.setMarkdown(updatedMarkdown);

        // Notify extension about dirty state for tab title indicator
        if (window.vscodeApi) {
          window.vscodeApi.postMessage({
            command: 'dirtyStateChanged',
            isDirty: true
          });
        }

        // Manual save only - removed auto-save after comment editing
      } else {
        console.log('No changes made - comment ID not found or not matched');
      }
    } else {
      console.log('No editor ref available');
    }
    console.log('=== DELETE COMMENT DEBUG END ===');
  };



  // Handle messages from extension (only edit modal - other messages handled by EditorApp)
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      // Only handle messages specific to MDXEditorWrapper
      switch (message.command) {
        case 'openEditModal':
          console.log('Opening edit modal for comment:', message.comment);
          if (message.comment) {
            setEditingComment(message.comment);
            setShowEditModal(true);
          }
          break;
        // Other messages ('update', 'fontUpdate') are now handled by EditorApp
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Advanced VS Code webview scroll containment
  React.useEffect(() => {
    console.log('Setting up advanced VS Code scroll containment...');

    // Method 1: Prevent wheel events from bubbling to VS Code only at scroll boundaries
    const handleWheel = (event: WheelEvent) => {
      const target = event.target as Element;
      const editorContainer = target.closest('.mdx-content') ||
        target.closest('.mdx-editor-content') ||
        target.closest('[contenteditable="true"]') ||
        target.closest('.ProseMirror');

      if (editorContainer) {
        // Check if we're at scroll boundaries
        const { scrollTop, scrollHeight, clientHeight } = editorContainer as HTMLElement;
        const isAtTop = scrollTop <= 1; // Small tolerance for rounding
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1; // Small tolerance

        // Only prevent scroll chaining when at boundaries to avoid passing scroll to VS Code
        if ((event.deltaY > 0 && isAtBottom) || (event.deltaY < 0 && isAtTop)) {
          console.log('Preventing scroll chaining at boundary');
          //event.preventDefault();
          //event.stopPropagation();
        }
        // Otherwise, let normal scrolling work within the editor
      }
    };

    // Apply only to document level with non-passive to allow preventDefault
    document.addEventListener('wheel', handleWheel, { passive: false, capture: false });

    return () => {
      document.removeEventListener('wheel', handleWheel, { capture: false });
    };
  }, []);

  // Handle clicking on comment in sidebar to scroll to highlight in editor
  const handleCommentClick = (commentId: string) => {
    console.log('=== SIDEBAR COMMENT CLICK DEBUG ===');
    console.log('Clicked on comment in sidebar:', commentId);

    // Set focus state for this comment
    setFocusedCommentId(commentId);
    console.log('Editor ref exists:', !!editorRef.current);

    // Get editor root element from ref if available
    let editorRootElement = null;
    if (editorRef.current) {
      // Try to access the editor's internal DOM structure
      const editorInstance = editorRef.current as any;
      console.log('Editor instance methods:', Object.getOwnPropertyNames(editorInstance));

      // Look for common editor properties that might give us the root
      if (editorInstance._rootElement) {
        editorRootElement = editorInstance._rootElement;
      } else if (editorInstance.rootElement) {
        editorRootElement = editorInstance.rootElement;
      } else if (editorInstance.getEditorState) {
        console.log('Editor has getEditorState method');
      }
    }

    console.log('Editor root element from ref:', editorRootElement);

    // Try multiple selectors to find the comment directive in the editor
    const possibleSelectors = [
      `.comment-highlight[data-comment-id="${commentId}"]`, // Old selector
      `[data-comment-id="${commentId}"]`, // Generic data attribute
      `span[data-comment-id="${commentId}"]`, // Directive span
      `div[data-comment-id="${commentId}"]`, // Directive div
      `[id="${commentId}"]`, // ID attribute
      // Try to find by text content as fallback
    ];

    let commentElement = null;
    for (const selector of possibleSelectors) {
      commentElement = document.querySelector(selector);
      console.log(`Trying selector "${selector}":`, !!commentElement);
      if (commentElement) break;
    }

    // If still not found, try searching for elements with matching text or attributes
    if (!commentElement) {
      console.log('Element not found by selectors, searching all elements...');

      // Try to find directive elements using Lexical API if available
      if (editorRef.current) {
        try {
          const editorInstance = editorRef.current as any;

          // Try to get the editor's DOM node
          let editorDOM = null;
          if (editorInstance.getRootElement) {
            editorDOM = editorInstance.getRootElement();
          } else if (editorInstance._rootElement) {
            editorDOM = editorInstance._rootElement;
          }

          console.log('Editor DOM from ref:', editorDOM);

          if (editorDOM) {
            // Search within the editor's DOM
            commentElement = editorDOM.querySelector(`[data-comment-id="${commentId}"]`) ||
              editorDOM.querySelector(`[id="${commentId}"]`) ||
              editorDOM.querySelector(`span[title*="${commentId}"]`) ||
              editorDOM.querySelector(`div[title*="${commentId}"]`);

            if (commentElement) {
              console.log('Found element via editor DOM search:', commentElement);
            }
          }
        } catch (error) {
          console.error('Error accessing Lexical editor DOM:', error);
        }
      }

      // Fallback: broad search through all elements
      if (!commentElement) {
        const allElements = document.querySelectorAll('span, div, [class*="directive"], [data*="comment"]');
        for (const el of allElements) {
          const attrs = Array.from(el.attributes).map(attr => `${attr.name}="${attr.value}"`).join(' ');
          const textContent = el.textContent || '';
          const innerHTML = el.innerHTML || '';

          if (attrs.includes(commentId) || textContent.includes(commentId) || innerHTML.includes(commentId)) {
            console.log('Found element by comprehensive search:', el, {
              attrs,
              textContent: textContent.substring(0, 50),
              innerHTML: innerHTML.substring(0, 100)
            });
            commentElement = el;
            break;
          }
        }
      }
    }

    console.log('Final comment element found:', {
      element: commentElement,
      hasElement: !!commentElement,
      tagName: commentElement?.tagName,
      classes: commentElement?.className,
      id: commentElement?.id,
    });

    if (commentElement) {
      // Remove existing highlights
      const allHighlights = document.querySelectorAll('.comment-highlight, .editor-highlighted');
      allHighlights.forEach(el => el.classList.remove('editor-highlighted'));

      // Add highlight class for animation
      commentElement.classList.add('editor-highlighted');

      // Find the editor container for scrolling - try multiple selectors
      const editorContainer = document.querySelector('.mdx-content') ||
        document.querySelector('.mdx-editor-content') ||
        document.querySelector('[contenteditable="true"]') ||
        document.querySelector('.ProseMirror');

      console.log('Editor container found:', {
        container: editorContainer,
        hasContainer: !!editorContainer,
        tagName: editorContainer?.tagName,
        classes: editorContainer?.className
      });

      if (editorContainer) {
        // Get positions
        const containerRect = editorContainer.getBoundingClientRect();
        const highlightRect = commentElement.getBoundingClientRect();

        console.log('Scroll calculation:', {
          containerRect: { top: containerRect.top, height: containerRect.height },
          highlightRect: { top: highlightRect.top, height: highlightRect.height },
          containerScrollTop: editorContainer.scrollTop
        });

        // Calculate scroll position to center the highlight in the editor
        const targetScrollTop = editorContainer.scrollTop + (highlightRect.top - containerRect.top) - (containerRect.height / 2) + (highlightRect.height / 2);

        console.log('Scrolling to target:', targetScrollTop);

        // Use advanced scroll containment to prevent VS Code editor from scrolling
        try {
          // Method 1: Use scrollIntoView with 'nearest' to prevent parent scroll
          commentElement.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest', // This prevents viewport scrolling
            inline: 'nearest'
          });
        } catch (scrollError) {
          console.warn('scrollIntoView failed, trying manual scroll:', scrollError);

          // Method 2: Manual scroll control as fallback
          const currentScrollTop = editorContainer.scrollTop;
          const targetScroll = Math.max(0, targetScrollTop);

          // Ensure we don't scroll past container bounds
          const maxScroll = editorContainer.scrollHeight - editorContainer.clientHeight;
          const finalScrollTop = Math.min(targetScroll, maxScroll);

          console.log('Manual scroll:', { currentScrollTop, targetScroll, maxScroll, finalScrollTop });

          editorContainer.scrollTo({
            top: finalScrollTop,
            behavior: 'smooth'
          });
        }
      }

      // Remove highlight after animation
      setTimeout(() => {
        commentElement.classList.remove('editor-highlighted');
      }, 2000);
    }
  };

  // Handle edit comment submission
  const handleEditSubmit = (newContent: string) => {
    if (editingComment && editorRef.current) {
      const currentMarkdown = editorRef.current.getMarkdown();
      const commentId = editingComment.id;

      console.log('Editing comment:', commentId, 'with new content:', newContent);

      // Update the directive text attribute in the markdown
      // Handle different directive patterns (both id="value" and #value formats)
      const patterns = [
        {
          regex: new RegExp(`(:comment\\[[^\\]]*\\]\\{[^}]*id="${commentId}"[^}]*text=")([^"]*)(\"[^}]*\\})`, 'g'),
          replacement: `$1${newContent.replace(/"/g, '\\"')}$3`
        },
        {
          regex: new RegExp(`(:comment\\[[^\\]]*\\]\\{[^}]*#${commentId}[^}]*text=")([^"]*)(\"[^}]*\\})`, 'g'),
          replacement: `$1${newContent.replace(/"/g, '\\"')}$3`
        },
        {
          regex: new RegExp(`(::comment\\[[^\\]]*\\]\\{[^}]*id="${commentId}"[^}]*text=")([^"]*)(\"[^}]*\\})`, 'g'),
          replacement: `$1${newContent.replace(/"/g, '\\"')}$3`
        },
        {
          regex: new RegExp(`(::comment\\[[^\\]]*\\]\\{[^}]*#${commentId}[^}]*text=")([^"]*)(\"[^}]*\\})`, 'g'),
          replacement: `$1${newContent.replace(/"/g, '\\"')}$3`
        },
        {
          regex: new RegExp(`(:::comment\\{[^}]*id="${commentId}"[^}]*text=")([^"]*)(\"[^}]*\\})`, 'g'),
          replacement: `$1${newContent.replace(/"/g, '\\"')}$3`
        },
        {
          regex: new RegExp(`(:::comment\\{[^}]*#${commentId}[^}]*text=")([^"]*)(\"[^}]*\\})`, 'g'),
          replacement: `$1${newContent.replace(/"/g, '\\"')}$3`
        }
      ];

      let updatedMarkdown = currentMarkdown;
      patterns.forEach(pattern => {
        updatedMarkdown = updatedMarkdown.replace(pattern.regex, pattern.replacement);
      });

      console.log('Updated markdown after edit:', updatedMarkdown);

      // Update editor - manual save only
      onMarkdownChange(updatedMarkdown);
      editorRef.current.setMarkdown(updatedMarkdown);

      // Notify extension about dirty state for tab title indicator
      if (window.vscodeApi) {
        window.vscodeApi.postMessage({
          command: 'dirtyStateChanged',
          isDirty: true
        });
      }

      // Manual save only - removed auto-save after comment editing
    }
    setShowEditModal(false);
    setEditingComment(null);
  };

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

  console.log('=== MDXEditorWrapper RENDER END - returning JSX ===');
  console.log('Editor state:', {
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
                console.log('=== MDXEDITOR COMPONENT RENDER START ===');
                console.log('About to render MDXEditor with:', {
                  markdown: markdown?.substring(0, 100) + '...',
                  markdownLength: markdown?.length,
                  selectedFont,
                  className: `mdx-editor dark-theme font-${selectedFont.toLowerCase().replace(/\s+/g, '-')}`,
                  contentEditableClassName: `mdx-content font-${selectedFont.toLowerCase().replace(/\s+/g, '-')}`
                });

                const plugins = [
                  // Core editing plugins
                  headingsPlugin(),
                  quotePlugin(),
                  listsPlugin(),
                  linkPlugin(),
                  tablePlugin(),
                  thematicBreakPlugin(),
                  markdownShortcutPlugin(),
                  searchPlugin(),
                  directivesPlugin({
                    directiveDescriptors: [
                      createCommentDirectiveDescriptor(focusedCommentId, setFocusedCommentId),
                      genericDirectiveDescriptor  // Refined version - only catches actual directives
                    ],
                    // Keep escapeUnknownTextDirectives to prevent parsing normal text as directives
                    escapeUnknownTextDirectives: true
                  }),

                  // RE-ENABLED: Basic code block plugin is needed for fenced block parsing
                  (() => {
                    console.log('Initializing codeBlockPlugin with fallback editor...');
                    try {
                      const plugin = codeBlockPlugin({ 
                        defaultCodeBlockLanguage: 'js',
                        codeBlockEditorDescriptors: [
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
                      });
                      console.log('codeBlockPlugin initialized successfully with fallback editor');
                      return plugin;
                    } catch (error) {
                      console.error('Error initializing codeBlockPlugin:', error);
                      throw error;
                    }
                  })(),
                  (() => {
                    console.log('Initializing codeMirrorPlugin (required for fenced block parsing)...');
                    try {
                      const plugin = codeMirrorPlugin({ 
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
                      });
                      console.log('codeMirrorPlugin initialized successfully with Mermaid support');
                      return plugin;
                    } catch (error) {
                      console.error('Error initializing codeMirrorPlugin:', error);
                      throw error;
                    }
                  })(),

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
                      />
                    )
                  })
                ];

                console.log('Plugins array length:', plugins.length);
                console.log('Plugin names:', plugins.map(p => p.constructor?.name || 'Unknown'));
                console.log('NOTE: Both codeBlockPlugin and codeMirrorPlugin enabled for fenced block support');

                try {
                  const editorElement = (
                    <MDXEditor
                      ref={(ref) => {
                        editorRef.current = ref;
                        // Add debugging when editor mounts
                        if (ref) {
                          console.log('MDXEditor component mounted, checking content after 2 seconds...');
                          setTimeout(() => {
                            try {
                              const content = ref.getMarkdown();
                              console.log('Editor content length after mount:', content.length);
                              console.log('Editor content preview:', content.substring(0, 500) + '...');
                              
                              // Check DOM structure
                              const editorDOM = document.querySelector('.mdx-content') || document.querySelector('[contenteditable="true"]');
                              if (editorDOM) {
                                console.log('Editor DOM found, innerHTML length:', editorDOM.innerHTML.length);
                                console.log('Editor DOM preview:', editorDOM.innerHTML.substring(0, 500) + '...');
                                
                                // Check if code blocks exist in DOM
                                const codeBlocks = editorDOM.querySelectorAll('pre, code, .cm-editor');
                                console.log('Code blocks found in DOM:', codeBlocks.length);
                                codeBlocks.forEach((block, index) => {
                                  console.log(`Code block ${index}:`, block.tagName, block.className);
                                });
                              } else {
                                console.log('Editor DOM not found');
                              }
                            } catch (err) {
                              console.error('Error inspecting editor after mount:', err);
                            }
                          }, 2000);
                        }
                      }}
                      markdown={markdown || ''}
                      onChange={handleMarkdownChange}
                      className={`mdx-editor dark-theme font-${selectedFont.toLowerCase().replace(/\s+/g, '-')}`}
                      contentEditableClassName={`mdx-content font-${selectedFont.toLowerCase().replace(/\s+/g, '-')}`}
                      plugins={plugins}
                    />
                  );
                  console.log('About to return MDXEditor element');
                  return editorElement;
                } catch (error) {
                  console.error('=== MDXEDITOR RENDER ERROR ===', error);
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
                    parsedComments
                      .sort((a, b) => {
                        // Sort by actual appearance order in the document
                        if (!markdown) return 0;

                        console.log('Sorting comments:', { aId: a.id, bId: b.id });

                        // Find the position of each comment directive in the markdown
                        // Try multiple patterns to catch different directive formats
                        const aPatterns = [
                          `:comment\\[([^\\]]*)\\]\\{[^}]*(?:id="${a.id}"|#${a.id})[^}]*\\}`,
                          `::comment\\[([^\\]]*)\\]\\{[^}]*(?:id="${a.id}"|#${a.id})[^}]*\\}`,
                          `:::comment\\{[^}]*(?:id="${a.id}"|#${a.id})[^}]*\\}`
                        ];
                        const bPatterns = [
                          `:comment\\[([^\\]]*)\\]\\{[^}]*(?:id="${b.id}"|#${b.id})[^}]*\\}`,
                          `::comment\\[([^\\]]*)\\]\\{[^}]*(?:id="${b.id}"|#${b.id})[^}]*\\}`,
                          `:::comment\\{[^}]*(?:id="${b.id}"|#${b.id})[^}]*\\}`
                        ];

                        let aMatch = -1;
                        let bMatch = -1;

                        // Try each pattern for comment A
                        for (const pattern of aPatterns) {
                          const match = markdown.search(new RegExp(pattern));
                          if (match !== -1) {
                            aMatch = match;
                            break;
                          }
                        }

                        // Try each pattern for comment B
                        for (const pattern of bPatterns) {
                          const match = markdown.search(new RegExp(pattern));
                          if (match !== -1) {
                            bMatch = match;
                            break;
                          }
                        }

                        console.log('Position matches:', {
                          aId: a.id,
                          aMatch,
                          bId: b.id,
                          bMatch,
                          aTimestamp: a.timestamp,
                          bTimestamp: b.timestamp
                        });

                        // If both found, sort by position
                        if (aMatch !== -1 && bMatch !== -1) {
                          return aMatch - bMatch;
                        }

                        // If only one found, put the found one first
                        if (aMatch !== -1 && bMatch === -1) return -1;
                        if (bMatch !== -1 && aMatch === -1) return 1;

                        // Fallback to timestamp if positions not found
                        const aTime = new Date(a.timestamp).getTime();
                        const bTime = new Date(b.timestamp).getTime();
                        console.log('Using timestamp fallback:', { aTime, bTime, result: aTime - bTime });
                        return aTime - bTime;
                      })
                      .map(comment => (
                        <div
                          key={comment.id}
                          className={`comment-item ${focusedCommentId === comment.id ? 'focused' : ''}`}
                          data-comment-id={comment.id}
                          onClick={() => handleCommentClick(comment.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="comment-content">{comment.content}</div>
                          <div className="comment-anchor">
                            On: "{comment.anchoredText?.substring(0, 50) || 'Selected text'}..."
                          </div>
                          <div className="comment-actions">
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              className="comment-action-btn delete"
                              title="Delete this comment"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => handleEditComment(comment.id)}
                              className="comment-action-btn"
                              title="Edit this comment"
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      ))
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
              console.log('Floating button mousedown with selected text:', selectedText);
              if (selectedText) {
                setShowCommentModal(true);
                setShowFloatingButton(false);
              }
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Floating button clicked with selected text:', selectedText);
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
