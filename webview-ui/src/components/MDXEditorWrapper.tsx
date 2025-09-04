import {
  AdmonitionDirectiveDescriptor,
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CodeMirrorEditor,
  ConditionalContents,
  CreateLink,
  DiffSourceToggleWrapper,
  GenericDirectiveEditor,
  InsertAdmonition,
  InsertCodeBlock,
  InsertFrontmatter,
  InsertTable,
  InsertThematicBreak,
  ListsToggle,
  MDXEditor,
  type MDXEditorMethods,
  Select,
  Separator,
  codeBlockPlugin,
  codeMirrorPlugin,
  diffSourcePlugin,
  directivesPlugin,
  frontmatterPlugin,
  headingsPlugin,
  imagePlugin,
  insertDirective$,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  realmPlugin,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import {
  AArrowDown,
  AArrowUp,
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  BookOpen,
  List,
  Undo,
} from 'lucide-react';
import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';

import { DirectiveService } from '../services/directive';
import { CommentWithAnchor } from '../types';
// import { SyncManager, SyncState } from '../utils/syncManager'; // REMOVED: SyncManager causing memory leaks
import {
  postBookViewMarginSetting,
  postBookViewSetting,
  postBookViewWidthSetting,
  postContentEdit,
  postContentSave,
  postDirtyState,
  postError,
  postExternalLink,
  postFontSetting,
  postFontSizeSetting,
  postGetFont,
  postImageUri,
  postReady,
  postTextAlignSetting,
  postUserInteraction,
} from '../utils/extensionMessaging';
import { logger } from '../utils/logger';
import { escapeDirectiveContent } from '../utils/textNormalization';
import { CommentModal } from './CommentModal';
import { CustomSearchInput, customSearchPlugin } from './CustomSearchPlugin';
import './MDXEditorWrapper.css';
import { MermaidEditor } from './MermaidEditor';
import './MermaidEditor.css';
import { postprocessAngleBrackets, preprocessAngleBrackets } from './SimplifiedAngleBracketPlugin';
import StatusBar from './StatusBar';
import TableOfContents from './TableOfContents';

// No longer using portal - overflow menu is within toolbar context

// Common toolbar groups component to reduce duplication
const ToolbarGroups = React.memo(
  ({
    selectedFont,
    handleFontChange,
    availableFonts,
    isOverflow = false,
    hiddenGroups = [],
    currentViewMode,
    fontSize,
    handleFontSizeChange,
    textAlign,
    handleTextAlignChange,
    bookView,
    handleBookViewToggle,
    localBookViewWidth,
    localBookViewMargin,
    handleBookViewWidthChange,
    handleBookViewMarginChange,
  }: {
    selectedFont: string;
    handleFontChange: (font: string) => void;
    availableFonts: string[];
    isOverflow?: boolean;
    hiddenGroups?: string[];
    currentViewMode?: 'rich-text' | 'source' | 'diff';
    fontSize?: number;
    handleFontSizeChange?: (delta: number) => void;
    textAlign?: string;
    handleTextAlignChange?: (align: string) => void;
    bookView?: boolean;
    localBookViewWidth?: string;
    localBookViewMargin?: string;
    handleBookViewToggle: () => void;
    handleBookViewWidthChange: (width: string) => void;
    handleBookViewMarginChange: (margin: string) => void;
  }) => {
    const groupClass = isOverflow ? 'overflow-group' : 'toolbar-group';

    const shouldShowGroup = (groupName: string) => {
      return currentViewMode !== 'source' && isOverflow
        ? hiddenGroups.includes(groupName)
        : !hiddenGroups.includes(groupName);
    };

    return (
      <>
        {/* Block Type (text style) - before font selection */}
        {shouldShowGroup('display-font') && (
          <>
            <div
              className={`${groupClass} ${isOverflow ? 'overflow-group verflow-display-font' : 'display-font-group'}`}
            >
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
                  className: `font-option-${font.toLowerCase().replace(/\s+/g, '-')}`,
                }))}
              />
              {!isOverflow && <Separator />}
            </div>
          </>
        )}

        {/* Font Size Controls */}
        {shouldShowGroup('font-size') && handleFontSizeChange && (
          <>
            <div className={`${groupClass} ${isOverflow ? 'overflow-group overflow-font-size' : 'font-size-group'}`}>
              <button
                className="custom-button _toolbarToggleItem_1e2ox_208"
                title="Decrease Font Size"
                onClick={() => handleFontSizeChange(-1)}
              >
                <AArrowDown size={16} />
              </button>
              <button
                className="custom-button _toolbarToggleItem_1e2ox_208"
                title="Increase Font Size"
                onClick={() => handleFontSizeChange(1)}
              >
                <AArrowUp size={16} />
              </button>
              <button
                className="custom-button _toolbarToggleItem_1e2ox_208"
                title="Reset Font Size"
                onClick={() => handleFontSizeChange?.(14 - (fontSize ?? 14))}
              >
                <Undo size={16} />
              </button>
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

        {shouldShowGroup('admonition') && (
          <>
            <div
              className={`${groupClass} ${isOverflow ? 'overflow-admonition overflow-admonition' : 'admonition-group'}`}
            >
              <InsertAdmonition />
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
                    when: editor => editor?.editorType === 'codeblock',
                    contents: () => null,
                  },
                  {
                    fallback: () => <InsertCodeBlock />,
                  },
                ]}
              />
              <CreateLink />
              <InsertFrontmatter />
              <InsertTable />
              <InsertThematicBreak />
              {!isOverflow && <Separator />}
            </div>
          </>
        )}

        {/* Text Justification Controls */}
        {shouldShowGroup('text-align') && handleTextAlignChange && (
          <>
            <div className={`${groupClass} ${isOverflow ? 'overflow-group overflow-text-align' : 'text-align-group'}`}>
              <button
                className={`custom-button _toolbarToggleItem_1e2ox_208 ${textAlign === 'left' ? 'active' : ''}`}
                title="Align Left"
                onClick={() => handleTextAlignChange('left')}
              >
                <AlignLeft size={16} />
              </button>
              <button
                className={`custom-button _toolbarToggleItem_1e2ox_208 ${textAlign === 'center' ? 'active' : ''}`}
                title="Align Center"
                onClick={() => handleTextAlignChange('center')}
              >
                <AlignCenter size={16} />
              </button>
              <button
                className={`custom-button _toolbarToggleItem_1e2ox_208 ${textAlign === 'right' ? 'active' : ''}`}
                title="Align Right"
                onClick={() => handleTextAlignChange('right')}
              >
                <AlignRight size={16} />
              </button>
              <button
                className={`custom-button _toolbarToggleItem_1e2ox_208 ${textAlign === 'justify' ? 'active' : ''}`}
                title="Justify"
                onClick={() => handleTextAlignChange('justify')}
              >
                <AlignJustify size={16} />
              </button>
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

        {/* Book View Toggle */}
        {shouldShowGroup('book-view') && handleBookViewToggle && (
          <>
            <div className={`${groupClass} ${isOverflow ? 'overflow-group overflow-book-view' : 'book-view-group'}`}>
              <button
                className={`custom-button _toolbarToggleItem_1e2ox_208 ${bookView ? 'active' : ''}`}
                title="Toggle book view mode"
                onClick={handleBookViewToggle}
              >
                <BookOpen size={16} />
              </button>
              <input
                type="number"
                placeholder="5.5"
                title="Book view content width in inches (e.g., 5.5)"
                value={localBookViewWidth}
                onChange={e => handleBookViewWidthChange(e.target.value)}
                step="0.1"
                min="1"
                style={{
                  width: '50px',
                  padding: '3px 2px',
                  margin: '0 2px',
                  fontSize: '17px',
                  border: '1px solid var(--vscode-input-border)',
                  background: 'var(--vscode-input-background)',
                  color: 'var(--vscode-input-foreground)',
                  borderRadius: '2px',
                }}
              />
              <input
                type="number"
                placeholder="0.5"
                title="Book view horizontal margins in inches (e.g., 0.5)"
                value={localBookViewMargin}
                onChange={e => handleBookViewMarginChange(e.target.value)}
                step="0.1"
                min="0"
                style={{
                  width: '50px',
                  padding: '3px 2px',
                  margin: '0 2px',
                  fontSize: '17px',
                  border: '1px solid var(--vscode-input-border)',
                  background: 'var(--vscode-input-background)',
                  color: 'var(--vscode-input-foreground)',
                  borderRadius: '2px',
                }}
              />
              {!isOverflow && <Separator />}
            </div>
          </>
        )}
      </>
    );
  },
);

const DiffViewWrapper = React.memo(
  ({
    children,
    shouldShow = false,
    currentViewMode,
  }: {
    children: React.ReactNode;
    shouldShow?: boolean;
    currentViewMode?: 'rich-text' | 'source' | 'diff';
  }): React.ReactElement => {
    return shouldShow || currentViewMode !== 'rich-text' ? (
      <DiffSourceToggleWrapper options={['rich-text', 'source']}>{children}</DiffSourceToggleWrapper>
    ) : (
      <>{children}</>
    );
  },
);

// Memoized custom toolbar component to prevent unnecessary re-renders
const ToolbarWithCommentButton = React.memo(
  ({
    selectedFont,
    handleFontChange,
    availableFonts,
    currentViewMode,
    fontSize,
    handleFontSizeChange,
    textAlign,
    handleTextAlignChange,
    bookView,
    handleBookViewToggle,
    localBookViewWidth,
    localBookViewMargin,
    handleBookViewWidthChange,
    handleBookViewMarginChange,
  }: {
    selectedFont: string;
    handleFontChange: (font: string) => void;
    availableFonts: string[];
    bookView: boolean;
    bookViewWidth: string;
    bookViewMargin: string;
    currentViewMode: 'rich-text' | 'source' | 'diff';
    onViewModeChange: (mode: 'rich-text' | 'source' | 'diff') => void;
    searchInputRef: React.RefObject<HTMLInputElement | null>;
    fontSize: number;
    handleFontSizeChange: (delta: number) => void;
    textAlign: string;
    handleTextAlignChange: (align: string) => void;
    handleBookViewToggle: () => void;
    localBookViewWidth: string;
    localBookViewMargin: string;
    handleBookViewWidthChange: (width: string) => void;
    handleBookViewMarginChange: (margin: string) => void;
  }) => {
    const [isOverflowOpen, setIsOverflowOpen] = useState(false);
    const [hiddenGroups, setHiddenGroups] = useState<string[]>([]);
    const overflowTriggerRef = useRef<HTMLButtonElement>(null);
    const toolbarRef = useRef<HTMLDivElement>(null);

    const handleOverflowToggle = () => {
      setIsOverflowOpen(!isOverflowOpen);
    };

    const updateResponsiveState = useCallback(() => {
      if (!toolbarRef.current) {
        return;
      }

      const width = toolbarRef.current.offsetWidth;
      const newHidden: string[] = [];

      // Use the same thresholds from CSS variables - updated for new groups
      if (width < 1160 + 25 + 100) {
        newHidden.push('diff-view');
      }
      if (width < 1120 + 25 + 100) {
        newHidden.push('book-view');
      }
      if (width < 1085 + 25) {
        newHidden.push('lists');
      }
      if (width < 980 + 25) {
        newHidden.push('text-align');
      }
      if (width < 870 + 25) {
        newHidden.push('blocks');
      }
      if (width < 740) {
        newHidden.push('admonition');
      }
      if (width < 660) {
        newHidden.push('formatting');
      }
      if (width < 560) {
        newHidden.push('font-size');
      }
      if (width < 475) {
        newHidden.push('font-style');
      }
      if (width < 320) {
        newHidden.push('display-font');
      }
      // Removed undo-redo group - VS Code handles undo/redo

      setHiddenGroups(newHidden);
    }, []);

    // Handle click outside to close overflow menu
    React.useEffect(() => {
      if (!isOverflowOpen) {
        return;
      }

      const handleClickOutside = (event: MouseEvent) => {
        if (
          overflowTriggerRef.current &&
          !overflowTriggerRef.current.contains(event.target as Node) &&
          !(event.target as Element).closest('.overflow-menu')
        ) {
          setIsOverflowOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOverflowOpen]);

    // Set up ResizeObserver to watch toolbar width changes
    React.useEffect(() => {
      if (!toolbarRef.current) {
        return;
      }

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
        {/* Main toolbar content - conditional based on view mode */}
        <div className={`toolbar-main ${currentViewMode !== 'rich-text' ? 'source-toolbar' : ''}`}>
          <DiffViewWrapper shouldShow={!hiddenGroups.includes('diff-view')} currentViewMode={currentViewMode}>
            <ToolbarGroups
              selectedFont={selectedFont}
              handleFontChange={handleFontChange}
              availableFonts={availableFonts}
              isOverflow={false}
              hiddenGroups={hiddenGroups}
              currentViewMode={currentViewMode}
              fontSize={fontSize}
              handleFontSizeChange={handleFontSizeChange}
              textAlign={textAlign}
              handleTextAlignChange={handleTextAlignChange}
              bookView={bookView}
              handleBookViewToggle={handleBookViewToggle}
              localBookViewWidth={localBookViewWidth}
              localBookViewMargin={localBookViewMargin}
              handleBookViewWidthChange={handleBookViewWidthChange}
              handleBookViewMarginChange={handleBookViewMarginChange}
            />
          </DiffViewWrapper>

          {/* Search - only in rich-text mode */}
          {currentViewMode !== 'source' && (
            <div className="toolbar-search">
              <CustomSearchInput />
            </div>
          )}
        </div>

        {/* Overflow menu trigger - only in rich-text mode */}
        {currentViewMode !== 'source' && (
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
                <DiffViewWrapper shouldShow={hiddenGroups.includes('diff-view')} currentViewMode={currentViewMode}>
                  <ToolbarGroups
                    selectedFont={selectedFont}
                    handleFontChange={handleFontChange}
                    availableFonts={availableFonts}
                    isOverflow={true}
                    hiddenGroups={hiddenGroups}
                    currentViewMode={currentViewMode}
                    fontSize={fontSize}
                    handleFontSizeChange={handleFontSizeChange}
                    textAlign={textAlign}
                    handleTextAlignChange={handleTextAlignChange}
                    bookView={bookView}
                    handleBookViewToggle={handleBookViewToggle}
                    localBookViewWidth={localBookViewWidth}
                    localBookViewMargin={localBookViewMargin}
                    handleBookViewWidthChange={handleBookViewWidthChange}
                    handleBookViewMarginChange={handleBookViewMarginChange}
                  />
                </DiffViewWrapper>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  },
);

// View mode tracking using DOM observation since viewMode$ might not be available
const useViewModeTracking = (onViewModeChange: (mode: 'rich-text' | 'source' | 'diff') => void) => {
  React.useEffect(() => {
    let lastViewMode: 'rich-text' | 'source' | 'diff' = 'rich-text';

    const checkViewMode = () => {
      const sourceEditor: HTMLElement | null = document.querySelector('.mdxeditor-source-editor');
      const diffEditor: HTMLElement | null = document.querySelector('.mdxeditor-diff-editor');
      const richTextEditor: HTMLElement | null = document.querySelector('.mdxeditor-rich-text-editor');

      let currentMode: 'rich-text' | 'source' | 'diff' = 'rich-text';

      if (sourceEditor && sourceEditor.style.display !== 'none') {
        currentMode = 'source';
      } else if (diffEditor && diffEditor.style.display !== 'none') {
        currentMode = 'diff';
      } else if (richTextEditor && richTextEditor.style.display !== 'none') {
        currentMode = 'rich-text';
      }

      if (currentMode !== lastViewMode) {
        logger.debug('View mode changed from', lastViewMode, 'to', currentMode);
        lastViewMode = currentMode;
        onViewModeChange(currentMode);
      }
    };

    // Check immediately
    checkViewMode();

    // Set up observer for DOM changes
    const observer = new MutationObserver(() => {
      checkViewMode();
    });

    const editorContainer = document.querySelector('.mdxeditor');
    if (editorContainer) {
      observer.observe(editorContainer, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class'],
      });
    }

    return () => {
      observer.disconnect();
    };
  }, [onViewModeChange]);
};

// Memoized comment item to prevent unnecessary re-renders with many comments
const CommentItem = React.memo(
  ({
    comment,
    isFocused,
    onCommentClick,
    onDeleteComment,
    onEditComment,
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
      <div className="comment-anchor">On: "{comment.anchoredText?.substring(0, 50) ?? 'Selected text'}..."</div>
      <div className="comment-actions">
        <button
          onClick={() => onDeleteComment(comment.id)}
          className="comment-action-btn delete"
          title="Delete this comment"
        >
          Delete
        </button>
        <button onClick={() => onEditComment(comment.id)} className="comment-action-btn" title="Edit this comment">
          Edit
        </button>
      </div>
    </div>
  ),
);

// Create a custom plugin for comment insertion that uses native insertDirective$
const commentInsertionPlugin = realmPlugin<{
  pendingComment?: {
    comment: string;
    commentId: string;
    selectedText: string;
    strategy: 'inline' | 'container';
  } | null;
  onInsertComment?: (comment: {
    comment: string;
    commentId: string;
    selectedText: string;
    strategy: 'inline' | 'container';
  }) => void;
}>({
  init(_realm, _params) {
    logger.debug('Comment insertion plugin initialized with native insertDirective$ support');
  },

  update(realm, params) {
    // React to pending comment updates and insert directives using native MDX Editor signals
    if (params?.pendingComment) {
      const pendingComment = params.pendingComment;
      logger.debug('=== PLUGIN UPDATE CALLED ===');
      logger.debug('Plugin received comment to insert using native insertDirective$:', pendingComment);

      // PERFORMANCE FIX: Prevent duplicate insertions by checking if comment already exists
      // Use a flag to track if we've already inserted this comment
      if ((pendingComment as any)._alreadyInserted) {
        logger.debug('Comment already processed, skipping insertion to prevent duplicates');
        return;
      }
      (pendingComment as any)._alreadyInserted = true;

      try {
        // Use MDX Editor's native insertDirective$ signal - this is the key!
        const directiveConfig = {
          name: 'comment',
          type: (pendingComment.strategy === 'container' ? 'containerDirective' : 'textDirective') as 'containerDirective' | 'textDirective' | 'leafDirective',
          children:
            pendingComment.strategy === 'container'
              ? [{ type: 'paragraph', children: [{ type: 'text', value: pendingComment.selectedText }] }]
              : [{ type: 'text', value: pendingComment.selectedText }],
          attributes: {
            id: pendingComment.commentId,
            text: escapeDirectiveContent(pendingComment.comment, pendingComment.strategy === 'container'),
          },
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
        logger.error('Error details:', error instanceof Error ? error.stack : String(error));
      }
    }
  },
});

// Comment directive configuration supporting all directive types
const createCommentDirectiveDescriptor = (
  focusedCommentId: string | null,
  setFocusedCommentId: (id: string | null) => void,
) => ({
  name: 'comment',
  testNode(node: any): boolean {
    logger.debug('Comment directive test - node:', node);
    const isComment = Boolean(node && node.name === 'comment');
    logger.debug('Is comment directive?', isComment);
    return isComment;
  },
  attributes: ['id', 'text'],
  hasChildren: true, // All directive types can have children (the [content] part)
  Editor: ({ mdastNode }: any) => {
    const commentId = String(mdastNode.attributes?.id ?? '');
    const commentText = String(mdastNode.attributes?.text ?? 'Comment');
    const directiveType = mdastNode.type; // 'textDirective', 'leafDirective', or 'containerDirective'

    logger.debug('Rendering comment directive:', { commentId, commentText, directiveType, mdastNode });

    // Render differently for inline vs block directives
    const renderContent = (): string => {
      if (!mdastNode.children || mdastNode.children.length === 0) {
        return 'No content';
      }

      const result = mdastNode.children
        .map((child: any): string => {
          if (child.type === 'text') {
            return String(child.value ?? '');
          } else if (child.type === 'paragraph') {
            // For paragraphs, preserve the line break after each one
            const content =
              child.children?.map((grandchild: any): string => String(grandchild.value ?? '')).join('') ?? '';
            return String(content);
          } else {
            return String(child.value ?? child.data ?? '');
          }
        })
        .join('\n\n'); // Use double newlines to preserve paragraph breaks
      return String(result);
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
          {renderContent()
            .split('\n\n')
            .map((paragraph: string, index: number) => (
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
  },
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
      shouldHandle,
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
  },
};

interface EditorConfig {
  wordWrap: string; // 'off' | 'on' | 'wordWrapColumn' | 'bounded'
}

interface MDXEditorWrapperProps {
  markdown: string;
  onMarkdownChange: (markdown: string) => void;
  comments?: CommentWithAnchor[];
  onNavigateToComment?: (commentId: string) => void;
  onEditComment?: (commentId: string) => void;
  onDeleteComment?: (commentId: string) => void;
  defaultFont?: string;
  fontSize?: number;
  textAlign?: string;
  bookView?: boolean;
  bookViewWidth?: string;
  bookViewMargin?: string;
  onDirtyStateChange?: (isDirty: boolean) => void;
  editorConfig?: EditorConfig;
}

export const MDXEditorWrapper: React.FC<MDXEditorWrapperProps> = ({
  markdown,
  onMarkdownChange,
  comments = [],
  onNavigateToComment,
  defaultFont = 'Default',
  fontSize = 14,
  textAlign = 'left',
  bookView = false,
  bookViewWidth = '5.5in',
  bookViewMargin = '0.5in',
  onDirtyStateChange,
  editorConfig = { wordWrap: 'off' },
}) => {
  logger.debug('🚀 MDXEditorWrapper rendered with markdown length:', markdown?.length || 0);
  if (markdown?.includes('![')) {
    logger.debug('🖼️ Markdown contains images!');
    const imageMatches = markdown.match(/!\[([^\]]*)\]\(([^)]+)\)/g);
    logger.debug('🖼️ Image matches found:', imageMatches);
  }

  logger.debug('=== MDXEditorWrapper RENDER START ===');
  logger.debug('Props received:', {
    markdownLength: markdown?.length,
    commentsLength: comments?.length,
    defaultFont,
    hasOnMarkdownChange: !!onMarkdownChange,
  });
  logger.debug(
    'MDXEditorWrapper received markdown ending:',
    `...${markdown?.substring((markdown?.length || 0) - 100)}`,
  );
  logger.debug('MDXEditorWrapper markdown contains code blocks?', markdown?.includes('```javascript'));
  logger.debug('MDXEditorWrapper markdown ends with expected?', markdown?.includes('explore all the features!'));
  // UI state
  const [showCommentSidebar, setShowCommentSidebar] = useState(false);
  const [showTOCSidebar, setShowTOCSidebar] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [, setCurrentSelection] = useState<{ start: number; end: number } | null>(null);
  const [showFloatingButton, setShowFloatingButton] = useState(false);
  const [floatingButtonPosition, setFloatingButtonPosition] = useState<{ x: number; y: number } | null>(null);

  // Comment insertion state
  const [pendingComment, setPendingComment] = useState<{
    comment: string;
    commentId: string;
    selectedText: string;
    strategy: 'inline' | 'container';
  } | null>(null);
  const [selectedFont, setSelectedFont] = useState(defaultFont);
  const [editingComment, setEditingComment] = useState<CommentWithAnchor | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [focusedCommentId, setFocusedCommentId] = useState<string | null>(null);

  // Local state for book view inputs to prevent cursor jumping (numbers only, default to 'in' units)
  const [localBookViewWidth, setLocalBookViewWidth] = useState<string>((bookViewWidth || '5.5in').replace('in', ''));
  const [localBookViewMargin, setLocalBookViewMargin] = useState<string>((bookViewMargin || '0.5in').replace('in', ''));

  // View mode tracking for hiding comments in source/diff view
  const [currentViewMode, setCurrentViewMode] = useState<'rich-text' | 'source' | 'diff'>('rich-text');
  const currentViewModeRef = useRef<'rich-text' | 'source' | 'diff'>('rich-text');

  // Live content tracking for real-time TOC updates
  const [liveMarkdown, setLiveMarkdown] = useState(markdown);

  // Update live markdown when prop changes (initial load)
  useEffect(() => {
    setLiveMarkdown(markdown);
  }, [markdown]);

  // Refs for debouncing book view input changes
  const bookViewWidthTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const bookViewMarginTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Performance optimization: Track typing state to prevent expensive operations during typing
  const [isTyping, setIsTyping] = useState(false);
  const [,] = useTransition();
  const typingTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const deferredMessageTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Theme detection - detect VS Code theme
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(true); // Default to dark

  // Detect VS Code theme on mount and when it changes
  useEffect(() => {
    const detectTheme = () => {
      const computedStyle = getComputedStyle(document.body);
      const bgColor = computedStyle.getPropertyValue('--vscode-editor-background') || '#1e1e1e';
      // Parse RGB values to determine if theme is dark
      const isDark = bgColor.includes('#')
        ? parseInt(bgColor.slice(1, 3), 16) < 128
        : bgColor.includes('rgb') && bgColor.match(/\d+/)?.[0] && parseInt(bgColor.match(/\d+/)?.[0] ?? '0') < 128;
      setIsDarkTheme(isDark as boolean);
    };

    detectTheme();

    // Listen for theme changes via mutation observer
    const observer = new MutationObserver(detectTheme);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-vscode-theme-kind'] });

    return () => observer.disconnect();
  }, []);

  // Sync local book view state with props when they change externally
  useEffect(() => {
    setLocalBookViewWidth((bookViewWidth || '5.5in').replace('in', ''));
  }, [bookViewWidth]);

  useEffect(() => {
    setLocalBookViewMargin((bookViewMargin || '0.5in').replace('in', ''));
  }, [bookViewMargin]);

  // Store the content before entering source mode for proper restoration
  const preSourceContentRef = useRef<string | null>(null);

  // Handle view mode changes to hide comments in source/diff view
  const handleViewModeChange = useCallback(
    (mode: 'rich-text' | 'source' | 'diff') => {
      logger.debug('View mode changed to:', mode);

      // When entering source mode: store current escaped content and show clean version
      if (currentViewMode !== 'source' && mode === 'source' && editorRef.current) {
        try {
          const currentContent = editorRef.current.getMarkdown();
          preSourceContentRef.current = currentContent; // Store escaped version

          // Reset escaping flag for source mode
          hasAppliedInitialEscapingRef.current = false;

          // Show clean content in source view
          const cleanContent = postprocessAngleBrackets(currentContent);
          // Find the specific part with curly braces for debugging
          const curlyBraceMatch = currentContent.match(/\{\{[^}]*\}\}/);
          const curlyBraceMatchAfter = cleanContent.match(/\{\{[^}]*\}\}/);
          logger.debug('Source mode - curly brace before:', curlyBraceMatch?.[0] ?? 'none');
          logger.debug('Source mode - curly brace after:', curlyBraceMatchAfter?.[0] ?? 'none');
          editorRef.current.setMarkdown(cleanContent);
          logger.debug('Entered source mode: showing clean content');
        } catch (error) {
          logger.error('Error entering source mode:', error);
        }
      }

      // When leaving source mode: always restore original escaped content, let sync handle changes
      if (currentViewMode === 'source' && mode !== 'source' && editorRef.current) {
        try {
          const sourceContent = editorRef.current.getMarkdown();
          logger.debug('Source content before switching back:', sourceContent.substring(0, 100));

          if (preSourceContentRef.current) {
            const originalCleanContent = postprocessAngleBrackets(preSourceContentRef.current);

            if (sourceContent === originalCleanContent) {
              // Source wasn't edited, restore original escaped content
              logger.debug('Source unchanged, restoring original escaped content');
              editorRef.current.setMarkdown(preSourceContentRef.current);
            } else {
              // Source was edited, preprocess the new clean content
              logger.debug('Source was edited, preprocessing new content');
              const processedContent = preprocessAngleBrackets(sourceContent);
              editorRef.current.setMarkdown(processedContent);
            }
          }

          // Reset escaping flag for rich-text mode
          hasAppliedInitialEscapingRef.current = false;
          preSourceContentRef.current = null;
          logger.debug('Left source mode: content properly handled');
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
        setCurrentSelection(null);
      }
    },
    [currentViewMode],
  );

  // Use the view mode tracking hook
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

  // Update selected font when defaultFont prop changes
  React.useEffect(() => {
    setSelectedFont(defaultFont);
  }, [defaultFont]);

  // Load saved font preference from VS Code settings on mount and signal ready
  React.useEffect(() => {
    // Signal that webview is ready to receive updates
    postReady();

    // Request font settings
    postGetFont();
  }, []);

  // Handle font changes and save to VS Code settings
  const handleFontChange = useCallback(
    (fontName: string) => {
      logger.debug('Font changed to:', fontName);
      logger.debug('Current selected font:', selectedFont);
      const fontClassName = fontName.toLowerCase().replace(/\s+/g, '-');
      logger.debug('Font class name will be:', `font-${fontClassName}`);

      setSelectedFont(fontName);

      // Save to VS Code settings
      postFontSetting(fontName);
    },
    [selectedFont],
  );

  // Keep track of current fontSize for increment/decrement operations
  const currentFontSizeRef = useRef(fontSize);

  // Update ref when prop changes
  useEffect(() => {
    currentFontSizeRef.current = fontSize;
  }, [fontSize]);

  // Handle font size changes
  const handleFontSizeChange = useCallback((delta: number) => {
    const newSize = Math.max(8, Math.min(48, currentFontSizeRef.current + delta));
    // Save to VS Code settings
    postFontSizeSetting(newSize);
  }, []);

  // Handle text alignment changes
  const handleTextAlignChange = useCallback((align: string) => {
    // Save to VS Code settings
    postTextAlignSetting(align);
  }, []);

  // Handle Book View toggle
  const handleBookViewToggle = useCallback(() => {
    const newBookView = !bookView;
    // Save to VS Code settings
    postBookViewSetting(newBookView);
  }, [bookView]);

  // Debounced handlers for book view inputs to prevent cursor jumping
  const handleBookViewWidthChange = useCallback(
    (value: string) => {
      console.log('handleBookViewWidthChange called with:', value);
      console.log('Current localBookViewWidth:', localBookViewWidth);

      // Update local state immediately for responsive UI
      setLocalBookViewWidth(value);

      // Debounce the VSCode config update
      clearTimeout(bookViewWidthTimeoutRef.current);
      bookViewWidthTimeoutRef.current = setTimeout(() => {
        postBookViewWidthSetting(`${value}in`);
      }, 500);
    },
    [localBookViewWidth],
  );

  const handleBookViewMarginChange = useCallback(
    (value: string) => {
      console.log('handleBookViewMarginChange called with:', value);
      console.log('Current localBookViewMargin:', localBookViewMargin);

      // Update local state immediately for responsive UI
      setLocalBookViewMargin(value);

      // Debounce the VSCode config update
      clearTimeout(bookViewMarginTimeoutRef.current);
      bookViewMarginTimeoutRef.current = setTimeout(() => {
        postBookViewMarginSetting(`${value}in`);
      }, 500);
    },
    [localBookViewMargin],
  );

  // Apply dynamic styles to the editor content
  useEffect(() => {
    const applyDynamicStyles = () => {
      const editorContent = document.querySelector('.mdx-content[contenteditable="true"]') as HTMLElement;
      if (!editorContent) {
        return;
      }

      // Apply font size (affects base font size, headings will scale proportionally)
      editorContent.style.fontSize = `${fontSize}px`;

      // Ensure paragraphs inherit the font size properly
      const paragraphs = editorContent.querySelectorAll('p');
      paragraphs.forEach(p => {
        (p as HTMLElement).style.fontSize = 'inherit';
      });

      // Apply text alignment
      editorContent.style.textAlign = textAlign;

      // Apply Book View styles
      if (bookView) {
        editorContent.style.maxWidth = bookViewWidth || '5.5in';
        editorContent.style.paddingLeft = bookViewMargin || '0.5in';
        editorContent.style.paddingRight = bookViewMargin || '0.5in';
        editorContent.style.margin = '0 auto';
      } else {
        editorContent.style.maxWidth = '';
        editorContent.style.paddingLeft = '';
        editorContent.style.paddingRight = '';
        editorContent.style.margin = '';
      }
    };

    // Apply styles immediately
    applyDynamicStyles();

    // Set up observer to reapply styles when editor content changes
    const observer = new MutationObserver(() => {
      applyDynamicStyles();
    });

    // Watch for changes to the document body (when editor content is added/removed)
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
    };
  }, [fontSize, textAlign, bookView, bookViewWidth, bookViewMargin]);

  // Available fonts with their CSS font-family values
  const fontFamilyMap = {
    Default:
      'var(--vscode-editor-font-family, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif)',
    Arial: 'Arial, sans-serif',
    'Times New Roman': '"Times New Roman", Times, serif',
    Roboto: 'Roboto, Arial, sans-serif',
    Georgia: 'Georgia, serif',
    Calibri: 'Calibri, Arial, sans-serif',
    Garamond: 'Garamond, serif',
    'Book Antiqua': '"Book Antiqua", serif',
    'Courier New': '"Courier New", "Monaco", "Menlo", monospace',
    'Open Sans': '"Open Sans", Arial, sans-serif',
    Lato: '"Lato", Arial, sans-serif',
    Montserrat: '"Montserrat", Arial, sans-serif',
    'Source Sans Pro': '"Source Sans Pro", Arial, sans-serif',
  };

  const availableFonts = Object.keys(fontFamilyMap);
  const editorRef = useRef<MDXEditorMethods>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const hasInitiallyFocusedRef = useRef(false);

  // Allow VS Code to handle undo/redo keyboard shortcuts naturally
  // We're not intercepting them anymore since VS Code is the single source of truth

  // Apply font styles to dropdown options
  /* React.useEffect(() => {
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
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          const addedNodes = Array.from(mutation.addedNodes);
          const hasDropdown = addedNodes.some(
            node => node instanceof Element && node.querySelector('.mdxeditor-select-content'),
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
  }, [availableFonts, fontFamilyMap]); */

  // Parse comments from markdown
  const [parsedComments, setParsedComments] = useState<CommentWithAnchor[]>([]);

  // PERFORMANCE CRITICAL: Comment position cache - ONLY recalculate when comments change
  // NOT when markdown changes (which happens on every keystroke)
  const commentPositions = useMemo(() => {
    const positions = new Map<string, number>();
    if (!markdown || parsedComments.length === 0) {
      return positions;
    }

    // Memory leak prevention: Limit cache size to prevent unbounded growth
    const MAX_CACHE_SIZE = 1000;

    // Performance optimization: Pre-compile regex patterns to avoid recreation
    const createPatterns = (commentId: string) => [
      new RegExp(`:comment\\[([^\\]]*)\\]\\{[^}]*(?:id="${commentId}"|#${commentId})[^}]*\\}`),
      new RegExp(`::comment\\[([^\\]]*)\\]\\{[^}]*(?:id="${commentId}"|#${commentId})[^}]*\\}`),
      new RegExp(`:::comment\\{[^}]*(?:id="${commentId}"|#${commentId})[^}]*\\}`),
    ];

    // Cache positions of all comment directives for fast sorting
    parsedComments.forEach(comment => {
      // Skip caching if we've hit the limit
      if (positions.size >= MAX_CACHE_SIZE) {
        return;
      }

      const patterns = createPatterns(comment.id);

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

  // Comment action handlers - must be defined before sortedCommentItems useMemo
  const handleEditComment = useCallback(
    (commentId: string) => {
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
    },
    [parsedComments],
  );

  const handleDeleteComment = useCallback(
    (commentId: string) => {
      logger.debug('=== DELETE COMMENT DEBUG START ===');
      logger.debug('Attempting to delete comment:', commentId);
      logger.debug('Current markdown length:', markdown?.length);
      logger.debug('Current parsed comments count:', parsedComments.length);

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
          logger.debug('Trying pattern:', pattern);
          const regex = new RegExp(pattern, 'g');
          const matches = [...currentMarkdown.matchAll(regex)];
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
                return String(capturedContent || '');
              }
            });
            found = true;
            logger.debug('Successfully replaced comment directive, preserving original content');
            break;
          }
        }
      }

      if (!found) {
        logger.error('Could not find comment directive to delete for ID:', commentId);
        logger.debug(
          'Available comment IDs in parsed comments:',
          parsedComments.map(c => c.id),
        );
        // Try a more generic search to see what's in the markdown
        const genericPattern = new RegExp(`${commentId}`, 'g');
        const genericMatches = [...currentMarkdown.matchAll(genericPattern)];
        logger.debug('Generic ID matches in markdown:', genericMatches.length);
        if (genericMatches.length > 0) {
          logger.debug('Found ID in markdown but not in directive format - manual cleanup may be needed');
        }
      } else {
        logger.debug('Updated markdown length after deletion:', updatedMarkdown.length);
        logger.debug('Calling onMarkdownChange - letting normal sync handle editor update');

        if (editorRef.current) {
          editorRef.current.setMarkdown(updatedMarkdown);
        }

        // Only notify parent component of the change - let normal sync handle editor update
        // This prevents breaking Lexical's undo coalescing
        onMarkdownChange(updatedMarkdown);
      }
      logger.debug('=== DELETE COMMENT DEBUG END ===');
    },
    [markdown, parsedComments, commentPositions, onMarkdownChange],
  );

  const handleCommentClick = useCallback(
    (commentId: string) => {
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
      const containerElement = containerRef.current ?? document;
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
        commentElement.classList.add('editor-highlighted');

        // Remove highlight after animation completes
        setTimeout(() => {
          if (commentElement.classList.contains('editor-highlighted')) {
            commentElement.classList.remove('editor-highlighted');
          }
        }, 2000);
      }
    },
    [onNavigateToComment],
  );

  const stableHandleEditComment = useCallback(handleEditComment, [handleEditComment]);
  const stableHandleDeleteComment = useCallback(handleDeleteComment, [handleDeleteComment]);
  const stableHandleCommentClick = useCallback(handleCommentClick, [handleCommentClick]);

  // Memoized sorted comments using cached positions - MASSIVE performance improvement
  const sortedCommentItems = useMemo(() => {
    if (parsedComments.length === 0) {
      return [];
    }

    const sortedComments = parsedComments.sort((a, b) => {
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
        onCommentClick={stableHandleCommentClick}
        onDeleteComment={stableHandleDeleteComment}
        onEditComment={stableHandleEditComment}
      />
    ));
  }, [
    parsedComments,
    commentPositions,
    focusedCommentId,
    stableHandleCommentClick,
    stableHandleDeleteComment,
    stableHandleEditComment,
  ]);

  const parseCommentTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  React.useEffect(() => {
    if (!liveMarkdown && !markdown) {
      setParsedComments([]);
      return;
    }

    if (parseCommentTimeoutRef.current) {
      clearTimeout(parseCommentTimeoutRef.current);
    }

    // Heavy debounce - only after user completely stops typing for 800ms
    parseCommentTimeoutRef.current = setTimeout(() => {
      try {
        const comments = DirectiveService.parseCommentDirectives(editorRef.current?.getMarkdown() ?? '');
        const commentsWithAnchor: CommentWithAnchor[] = comments.map(comment => ({
          ...comment,
          anchoredText: comment.anchoredText ?? 'Selected text',
          startPosition: 0,
          endPosition: 0,
        }));
        setParsedComments(commentsWithAnchor);
      } catch (error) {
        logger.error('Error parsing comments:', error);
        setParsedComments([]);
      }
    }, 800); // Heavy debounce - only after complete typing pause

    return () => clearTimeout(parseCommentTimeoutRef.current);
  }, [liveMarkdown, markdown]);

  // Cleanup timeouts on unmount - Enhanced memory leak fix
  React.useEffect(() => {
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
      if (deferredMessageTimeoutRef.current) {
        clearTimeout(deferredMessageTimeoutRef.current);
        deferredMessageTimeoutRef.current = undefined;
      }
      // Clear book view timeouts as well
      if (bookViewWidthTimeoutRef.current) {
        clearTimeout(bookViewWidthTimeoutRef.current);
        bookViewWidthTimeoutRef.current = undefined;
      }
      if (bookViewMarginTimeoutRef.current) {
        clearTimeout(bookViewMarginTimeoutRef.current);
        bookViewMarginTimeoutRef.current = undefined;
      }
    };
  }, []);

  // Track if we just saved to prevent unnecessary reloads
  // REMOVED: justSavedRef echo prevention - consolidated to extension level

  // Timeout ref for debouncing dirty state notifications
  const dirtyStateTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // REMOVED: const [syncState, setSyncState] = useState<SyncState>(SyncState.IDLE); - SyncState no longer needed

  // Handle external updates ONLY when they come from VS Code (not from user typing)
  React.useEffect(() => {
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
      logger.debug('External update detected, applying to editor');
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
            logger.debug('Editor focused on initial load');
          }
        } catch (err) {
          logger.error('Error focusing editor on initial load:', err);
        }
      }, 200);

      return () => clearTimeout(timer);
    }
  }, [markdown]);

  // Track unsaved changes state
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  // REMOVED: const syncManagerRef = useRef<SyncManager | null>(null); - SyncManager no longer used
  const hasAppliedInitialEscapingRef = useRef(false);

  // Sync editorConfig prop with local state
  useEffect(() => {
    if (editorConfig) {
      logger.debug('Editor config updated:', editorConfig);
    }
  }, [editorConfig]);

  // Generate simple CodeMirror extensions without direct CodeMirror imports
  // This avoids multiple CodeMirror instance conflicts
  const createCodeMirrorExtensions = useMemo(() => {
    // Return empty array to avoid instanceof conflicts
    // Word wrap and other styling is handled via CSS
    // VS Code keymap is handled by MDXEditor internally
    return [];
  }, []);
  // Custom wrapper for CodeMirrorEditor that handles save shortcuts
  const CodeMirrorEditorWithSave: React.FC<any> = props => {
    return <CodeMirrorEditor {...props} />;
  };

  // REMOVED: SyncManager initialization - replaced with direct postMessage calls

  // Function to handle modifier key tracking (defined outside useEffect)
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Check if vscodeApi is available
    if (!window.vscodeApi) {
      return;
    }

    // Set interaction flag when Ctrl or Cmd key is pressed
    if (event.ctrlKey || event.metaKey) {
      postUserInteraction(true);
    }
  }, []);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    // Check if vscodeApi is available
    if (!window.vscodeApi) {
      return;
    }

    // Clear interaction flag when Ctrl or Cmd key is released
    if (event.key === 'Control' || event.key === 'Meta') {
      postUserInteraction(false);
    }
  }, []);

  // Track modifier keys to prevent cursor jumping during undo/redo
  useEffect(() => {
    // Listen for keydown/keyup to track modifier key state
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  const handleMarkdownChange = useCallback(
    (newMarkdown: string) => {
      console.log('MARKDOWNCHANGE');

      // REMOVED: SyncManager external update checks - no longer needed with direct messaging

      // On first edit, apply escaping to the editor content invisibly (but only in rich-text mode)
      if (!hasAppliedInitialEscapingRef.current && editorRef.current && currentViewModeRef.current === 'rich-text') {
        const currentContent = editorRef.current.getMarkdown();
        const needsEscaping = currentContent.includes('<') && !currentContent.includes('\\<');

        if (needsEscaping) {
          logger.debug('PREPROCESSING: Applying initial escaping in rich-text mode');
          hasAppliedInitialEscapingRef.current = true;
          const escapedContent = preprocessAngleBrackets(currentContent);
          editorRef.current.setMarkdown(escapedContent);
          return; // Let the next change handle the actual sync
        }
      }

      // Debug: log if we're trying to process in source mode
      if (!hasAppliedInitialEscapingRef.current && currentViewModeRef.current === 'source') {
        logger.debug('SKIPPING: Would apply initial escaping but in source mode');
      }

      // Apply postprocessing in all modes to clean up unwanted escaping
      const processedMarkdown = postprocessAngleBrackets(newMarkdown);

      // Check if this is actually a change
      const hasChanges = processedMarkdown !== markdown;
      if (!hasChanges) {
        return;
      }

      // PERFORMANCE FIX: Batch all state updates to prevent multiple re-renders per keystroke
      startTransition(() => {
        // Update live markdown for real-time TOC updates
        setLiveMarkdown(newMarkdown);
        // Mark as typing for performance optimizations
        setIsTyping(true);
        // Update UI state for immediate feedback
        setHasUnsavedChanges(hasChanges);
      });
      // Clear and reset typing timeout
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 300);

      // Mark that user has interacted with editor to prevent auto-focus
      hasInitiallyFocusedRef.current = true;

      // Notify parent of dirty state
      onDirtyStateChange?.(hasChanges);

      // Send content to VS Code using consolidated messaging utility
      postContentEdit(processedMarkdown);

      // Send dirty state notification
      postDirtyState(true);
    },
    [markdown, onDirtyStateChange], // State setters should be stable
  );

  // Handle VS Code messages including theme changes
  React.useEffect(() => {
    const handleVSCodeMessage = (event: MessageEvent) => {
      const { data } = event;
      console.log('Received VS Code message:', data);

      if (data.type === 'open-search') {
        logger.debug('Received open-search message, triggering search');
        // Find search button and click it programmatically
        const searchButton = document.querySelector('button[title*="Search"]');
        if (searchButton) {
          (searchButton as HTMLButtonElement).click();
        }
      }

      if (data.type === 'init' && data.theme) {
        console.log('Received theme from VS Code init:', data.theme);
        const isDark = data.theme === 'dark';
        setIsDarkTheme(isDark);
      }

      if (data.command === 'themeChanged' && data.theme) {
        console.log('Received theme change from VS Code:', data.theme);
        const isDark = data.theme === 'dark';
        setIsDarkTheme(isDark);
      }
    };

    window.addEventListener('message', handleVSCodeMessage);
    return () => window.removeEventListener('message', handleVSCodeMessage);
  }, []);

  // Manual save only - removed auto-save after comment operations

  // Function to convert webview URIs back to relative paths for saving
  const convertWebviewUrisToRelativePaths = useCallback((content: string): string => {
    // Convert vscode-webview:// URIs back to relative paths for file storage
    const webviewUriRegex = /!\[([^\]]*)\]\(vscode-webview:\/\/[^/]+\/([^)]+)\)/g;

    return content.replace(webviewUriRegex, (match, alt, encodedPath) => {
      try {
        // Decode the URI path
        const decodedPath = decodeURIComponent(encodedPath);
        logger.debug(`Converting webview URI back to relative path: ${decodedPath}`);

        // Extract just the relative portion if it's an absolute path
        // This assumes the current document is in the same directory structure
        const relativePath = decodedPath.includes('media/')
          ? decodedPath.substring(decodedPath.lastIndexOf('media/'))
          : decodedPath;

        return `![${String(alt)}](${String(relativePath)})`;
      } catch (error) {
        logger.error('Error converting webview URI:', error);
        return match; // Return original if conversion fails
      }
    });
  }, []);

  // Handle Ctrl+F / Cmd+F for search only - let VS Code handle save natively
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle search shortcuts, let VS Code handle save naturally
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        logger.debug('Search keyboard shortcut pressed, focusing search input');
        // Focus the inline search input
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
      }
    };

    // Use capture phase to intercept events before CodeMirror gets them
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [hasUnsavedChanges, markdown, convertWebviewUrisToRelativePaths]);

  // Text selection handling for floating comment button
  React.useEffect(() => {
    const handleSelectionChange = () => {
      // Don't update selection if comment modal is open - lock the selection
      if (showCommentModal || showEditModal) {
        return;
      }

      // Don't show floating button in source or diff view
      if (currentViewMode !== 'rich-text') {
        setShowFloatingButton(false);
        return;
      }

      const selection = window.getSelection();
      if (selection?.toString().trim() && containerRef.current) {
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
              if (
                element.classList.contains('mdx-content') ||
                element.classList.contains('mdx-editor-content') ||
                element.closest('.mdx-content') ||
                element.closest('.mdx-editor-content') ||
                element.closest('[contenteditable="true"]')
              ) {
                return true;
              }
              // Exclude search input and other UI elements
              if (
                element.classList.contains('inline-search-input') ||
                element.closest('.inline-search-container') ||
                element.closest('.comments-sidebar') ||
                element.closest('.toolbar')
              ) {
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
        const rightEdgeX = editorContentRect
          ? editorContentRect.right - containerRect.left - 50
          : containerRect.width - 60;

        setFloatingButtonPosition({
          x: rightEdgeX,
          y: rect.top - containerRect.top + rect.height / 2 - 20,
        });
        setSelectedText(selectedTextContent);
        setShowFloatingButton(true);

        // Store the actual selected text range
        setCurrentSelection({
          start: range.startOffset,
          end: range.endOffset,
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
  }, [showCommentModal, showEditModal, currentViewMode]);

  // Handle clicks on highlighted text to highlight corresponding comment
  React.useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Clear focus if clicking outside comments
      if (!target.closest('.comment-highlight') && !target.closest('.comment-item')) {
        setFocusedCommentId(null);
      }

      if (target?.classList.contains('comment-highlight')) {
        const commentId = target.getAttribute('data-comment-id');
        if (commentId) {
          logger.debug('Clicked on highlighted text for comment:', commentId);

          // Open sidebar if it's not already open
          if (!showCommentSidebar) {
            logger.debug('Opening comments sidebar for clicked highlight');
            setShowCommentSidebar(true);
          }

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
              tagName: commentsContainer?.tagName,
            });

            if (commentsContainer) {
              logger.debug('Found scrollable comments container, checking scroll properties:', {
                scrollHeight: commentsContainer.scrollHeight,
                clientHeight: commentsContainer.clientHeight,
                isScrollable: commentsContainer.scrollHeight > commentsContainer.clientHeight,
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
                const targetScrollTop = relativeTop - containerRect.height / 2 + commentRect.height / 2;

                logger.debug('Scrolling sidebar only to position:', targetScrollTop);

                // Scroll ONLY the sidebar, not the whole page
                commentsContainer.scrollTo({
                  top: Math.max(0, targetScrollTop),
                  behavior: 'smooth',
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
  }, [showCommentSidebar, setShowCommentSidebar]);

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

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      // Cleanup handled by component unmounting - sync manager disposes itself
    };
  }, []);

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
        selectedTextLength: selectedText.length,
      });

      if (isInCodeBlock) {
        // Code blocks can't be reliably commented - show error
        logger.debug('Detected code block content, showing error message');
        postError(
          'Sorry, code blocks cannot be commented on directly. If you have ideas how to make this work, please let us know on our GitHub repo!',
        );
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
      postError('Failed to add comment. Please try selecting different text or report this issue on our GitHub repo.');
    }

    // Close modal
    setShowCommentModal(false);
    setSelectedText('');
    setCurrentSelection(null);
  };

  // Handle standard inline comments using MDX Editor's native directive insertion
  const handleInlineComment = (comment: string, commentId: string, _currentMarkdown: string) => {
    logger.debug('Creating inline comment using native directive insertion');

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
  };

  // Handle hybrid comments (container directive for complex selections)
  const handleHybridComment = (comment: string, commentId: string, _currentMarkdown: string) => {
    logger.debug('Creating hybrid comment using native container directive insertion');

    // Trigger plugin to insert comment directive
    if (editorRef.current) {
      setCommentPendingForPlugin({
        comment,
        commentId,
        selectedText,
        strategy: 'container',
      });
    }
  };

  // Function to trigger comment insertion via plugin
  const setCommentPendingForPlugin = (commentData: {
    comment: string;
    commentId: string;
    selectedText: string;
    strategy: 'inline' | 'container';
  }) => {
    logger.debug('Setting comment pending for plugin insertion');
    // The plugin will handle this through the cell subscription
    // We need to publish to the cell from outside the plugin context
    // This will be handled when the editor mounts
    setPendingComment(commentData);
  };

  // Callback for when comment insertion is complete
  const handleCommentInserted = useCallback(() => {
    logger.debug('=== COMMENT INSERTION COMPLETED ===');
    logger.debug('Pending comment before clearing:', pendingComment);
    setPendingComment(null);

    // Force immediate comment parsing by temporarily clearing isTyping
    setIsTyping(false);

    // Wait for MDX Editor to update its internal state, then get the markdown
    setTimeout(() => {
      if (editorRef.current) {
        const updatedMarkdown = editorRef.current.getMarkdown();
        logger.debug('Markdown after insertion delay:', `${updatedMarkdown.substring(0, 200)}...`);
        logger.debug('Calling onMarkdownChange with updated markdown');
        onMarkdownChange(updatedMarkdown);

        // Force comment parsing immediately to show new comment in sidebar
        try {
          logger.debug('Force parsing comments after insertion');
          const comments = DirectiveService.parseCommentDirectives(updatedMarkdown);
          const commentsWithAnchor: CommentWithAnchor[] = comments.map(comment => ({
            ...comment,
            anchoredText: comment.anchoredText ?? 'Selected text',
            startPosition: 0,
            endPosition: 0,
          }));
          setParsedComments(commentsWithAnchor);
          logger.debug('Forced comment parsing completed, found comments:', commentsWithAnchor.length);
        } catch (error) {
          logger.error('Error in forced comment parsing:', error);
        }

        // Notify extension about changes
        postDirtyState(true);
      } else {
        logger.error('No editor ref available in handleCommentInserted');
      }
    }, 200); // Increased delay to ensure MDX Editor has processed the directive
  }, [onMarkdownChange, pendingComment]); // PERFORMANCE FIX: Stable callback to prevent plugin recreation

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

  // Save interception for Cmd+S/Ctrl+S inside CodeMirror
  useEffect(() => {
    const handleSaveKeyboard = (e: KeyboardEvent) => {
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
    };

    // Use capture phase to intercept before CodeMirror gets the event
    document.addEventListener('keydown', handleSaveKeyboard, true);

    return () => {
      document.removeEventListener('keydown', handleSaveKeyboard, true);
    };
  }, []);

  // Function to detect if selected text is within a code block
  const detectCodeBlockSelection = (markdown: string, selectedText: string): boolean => {
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
  };

  const handleCloseModal = () => {
    logger.debug('handleCloseModal called');
    setShowCommentModal(false);
    setSelectedText('');
    setCurrentSelection(null);
  };

  // Comment action handlers
  // handleEditComment is already defined earlier in the file

  const handleEditSubmit = useCallback(
    (newComment: string) => {
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
        new RegExp(':comment\\[([^\\]]*)\\]\\{([^}]*?)text="([^"]*)"([^}]*)\\}', 'g'),
        new RegExp('::comment\\[([^\\]]*)\\]\\{([^}]*?)text="([^"]*)"([^}]*)\\}', 'g'),
        // Container comment patterns
        new RegExp(':::comment\\{([^}]*?)text="([^"]*)"([^}]*)\\}', 'g'),
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
            if (
              String(match[0]).includes(`id="${String(commentId)}"`) ||
              String(match[0]).includes(`#${String(commentId)}`)
            ) {
              logger.debug('Found matching comment with our ID');
            }
          });

          updatedMarkdown = updatedMarkdown.replace(pattern, (match, ..._groups) => {
            // Check if this match is for our specific comment ID
            if (match.includes(`id="${String(commentId)}"`) || match.includes(`#${String(commentId)}`)) {
              logger.debug('Replacing comment text for ID:', commentId);
              logger.debug('Original match:', match);

              // Replace just the text attribute
              const newMatch = match.replace(
                /text="[^"]*"/,
                `text="${escapeDirectiveContent(newComment, match.includes(':::'))}"`,
              );
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
    },
    [markdown, onMarkdownChange, editingComment],
  );

  const handleEditClose = () => {
    setShowEditModal(false);
    setEditingComment(null);
  };

  // Define plugins array with useMemo BEFORE the return statement to follow React hooks rules
  const plugins = useMemo(
    () => [
      // Core editing plugins
      headingsPlugin(),
      quotePlugin(),
      listsPlugin(),
      linkPlugin(),
      linkDialogPlugin(),
      tablePlugin(),
      thematicBreakPlugin(),
      markdownShortcutPlugin(),
      customSearchPlugin({}),
      frontmatterPlugin(),
      diffSourcePlugin({
        // Use VS Code editor configuration for word wrap behavior
        diffMarkdown: '',
        codeMirrorExtensions: createCodeMirrorExtensions,
      }),
      // Use default MDXEditor history behavior - our fix is to avoid setMarkdown() calls
      imagePlugin({
        imageUploadHandler: async (image: File) => {
          return new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = e => {
              const data = e.target?.result;
              if (data) {
                postImageUri(data);

                const handleUri = (event: any) => {
                  if (event.data.command === 'imageUri') {
                    window.removeEventListener('message', handleUri);
                    resolve(event.data.uri);
                  }
                };

                window.addEventListener('message', handleUri);
              }
            };
            reader.readAsDataURL(image);
          });
        },
        imageAutocompleteSuggestions: ['media/', './media/', '../media/'],
      }),

      // Custom comment insertion plugin using native insertDirective$
      commentInsertionPlugin({
        pendingComment,
        onInsertComment: _commentData => {
          logger.debug('Comment inserted via plugin, triggering UI update');
          handleCommentInserted();
        },
      }),

      // Removed angle bracket plugin for better performance

      directivesPlugin({
        directiveDescriptors: [
          AdmonitionDirectiveDescriptor,
          createCommentDirectiveDescriptor(focusedCommentId, setFocusedCommentId),
          genericDirectiveDescriptor,
        ],
        // Disable escaping of unknown text directives
        escapeUnknownTextDirectives: false,
      }),

      // Toolbar with our custom comment button and responsive design
      toolbarPlugin({
        toolbarContents: () => (
          <ToolbarWithCommentButton
            selectedFont={selectedFont}
            handleFontChange={handleFontChange}
            availableFonts={availableFonts}
            bookView={bookView}
            bookViewWidth={bookViewWidth}
            bookViewMargin={bookViewMargin}
            currentViewMode={currentViewMode}
            onViewModeChange={handleViewModeChange}
            fontSize={fontSize}
            handleFontSizeChange={handleFontSizeChange}
            textAlign={textAlign}
            handleTextAlignChange={handleTextAlignChange}
            handleBookViewToggle={handleBookViewToggle}
            localBookViewWidth={localBookViewWidth}
            localBookViewMargin={localBookViewMargin}
            handleBookViewWidthChange={handleBookViewWidthChange}
            handleBookViewMarginChange={handleBookViewMarginChange}
            searchInputRef={searchInputRef}
          />
        ),
      }),

      // Enhanced code block plugin with Mermaid support
      codeBlockPlugin({
        defaultCodeBlockLanguage: 'js',
        codeBlockEditorDescriptors: [
          // Mermaid diagram editor - highest priority
          {
            priority: 10,
            match: (language, _code) => language === 'mermaid',
            Editor: props => (
              <MermaidEditor
                {...props}
                isDarkTheme={isDarkTheme}
              />
            ),
          },
          // Specific mappings for common aliases
          {
            priority: 5,
            match: (language, _code) => language === 'javascript',
            Editor: props => <CodeMirrorEditorWithSave {...props} language="js" />,
          },
          {
            priority: 5,
            match: (language, _code) => language === 'python',
            Editor: props => <CodeMirrorEditorWithSave {...props} language="py" />,
          },
          {
            priority: 5,
            match: (language, _code) => language === 'typescript',
            Editor: props => <CodeMirrorEditorWithSave {...props} language="ts" />,
          },
          {
            priority: 5,
            match: (language, _code) => language === 'markdown',
            Editor: props => <CodeMirrorEditorWithSave {...props} language="md" />,
          },
          {
            priority: 5,
            match: (language, _code) => language === 'yml',
            Editor: props => <CodeMirrorEditorWithSave {...props} language="yaml" />,
          },
          {
            priority: 5,
            match: (language, _code) => language === 'text',
            Editor: props => <CodeMirrorEditorWithSave {...props} language="txt" />,
          },
          {
            priority: 5,
            match: (language, _code) => language === 'shell',
            Editor: props => <CodeMirrorEditorWithSave {...props} language="sh" />,
          },
          // Top 10 additional language mappings
          {
            priority: 5,
            match: (language, _code) => language === 'rust',
            Editor: props => <CodeMirrorEditorWithSave {...props} language="rust" />,
          },
          {
            priority: 5,
            match: (language, _code) => language === 'go',
            Editor: props => <CodeMirrorEditorWithSave {...props} language="go" />,
          },
          {
            priority: 5,
            match: (language, _code) => language === 'cpp' || language === 'c++',
            Editor: props => <CodeMirrorEditorWithSave {...props} language="cpp" />,
          },
          {
            priority: 5,
            match: (language, _code) => language === 'c',
            Editor: props => <CodeMirrorEditorWithSave {...props} language="c" />,
          },
          {
            priority: 5,
            match: (language, _code) => language === 'java',
            Editor: props => <CodeMirrorEditorWithSave {...props} language="java" />,
          },
          {
            priority: 5,
            match: (language, _code) => language === 'kotlin',
            Editor: props => <CodeMirrorEditorWithSave {...props} language="kotlin" />,
          },
          {
            priority: 5,
            match: (language, _code) => language === 'swift',
            Editor: props => <CodeMirrorEditorWithSave {...props} language="swift" />,
          },
          {
            priority: 5,
            match: (language, _code) => language === 'php',
            Editor: props => <CodeMirrorEditorWithSave {...props} language="php" />,
          },
          {
            priority: 5,
            match: (language, _code) => language === 'ruby',
            Editor: props => <CodeMirrorEditorWithSave {...props} language="ruby" />,
          },
          {
            priority: 5,
            match: (language, _code) => language === 'dart',
            Editor: props => <CodeMirrorEditorWithSave {...props} language="dart" />,
          },
          // Fallback editor for any other unknown languages
          {
            priority: -10,
            match: _ => true,
            Editor: CodeMirrorEditor,
          },
        ],
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
          mermaid: 'Mermaid',
          // Top 10 additional languages
          rust: 'Rust',
          go: 'Go',
          cpp: 'C++',
          c: 'C',
          java: 'Java',
          kotlin: 'Kotlin',
          swift: 'Swift',
          php: 'PHP',
          ruby: 'Ruby',
          dart: 'Dart',
        },
        // Add better syntax theme configuration
      }),
    ],
    [
      availableFonts,
      bookView,
      bookViewMargin,
      bookViewWidth,
      createCodeMirrorExtensions,
      currentViewMode,
      focusedCommentId,
      fontSize,
      handleBookViewMarginChange,
      handleBookViewToggle,
      handleBookViewWidthChange,
      handleCommentInserted,
      handleFontChange,
      handleFontSizeChange,
      handleTextAlignChange,
      handleViewModeChange,
      isDarkTheme,
      localBookViewMargin,
      localBookViewWidth,
      pendingComment,
      selectedFont,
      textAlign,
    ],
  );

  // Let MDX editor handle undo/redo natively - no keyboard interception needed

  logger.debug('=== MDXEditorWrapper RENDER END - returning JSX ===');
  logger.debug('Editor state:', {
    showCommentSidebar,
    bookView,
    selectedFont,
    parsedCommentsCount: parsedComments.length,
    editorRefExists: !!editorRef.current,
  });

  return (
    <div
      className={`mdx-editor-container ${bookView ? 'book-view' : ''} ${currentViewMode === 'source' ? 'source-mode' : ''}`}
      ref={containerRef}
    >
      {/* Normal view: Top section with editor */}
      <div className="mdx-editor-with-sidebar">
        <div className="mdx-editor-content">
          {(() => {
            logger.debug('=== MDXEDITOR COMPONENT RENDER START ===');
            logger.debug('About to render MDXEditor with:', {
              markdown: `${markdown?.substring(0, 100)}...`,
              markdownLength: markdown?.length,
              selectedFont,
              className: `mdx-editor ${isDarkTheme ? 'dark-theme' : 'light-theme'} font-${selectedFont.toLowerCase().replace(/\s+/g, '-')}`,
              contentEditableClassName: `mdx-content prose font-${selectedFont.toLowerCase().replace(/\s+/g, '-')}`,
            });

            // Plugins are now defined outside the JSX to follow React hooks rules
            logger.debug('Plugins array length:', plugins.length);
            logger.debug(
              'Plugin names:',
              plugins.map(p => p.constructor?.name || 'Unknown'),
            );
            logger.debug('NOTE: Both codeBlockPlugin and codeMirrorPlugin enabled for fenced block support');

            try {
              const editorElement = (
                <MDXEditor
                  ref={ref => {
                    editorRef.current = ref;
                    // Add debugging when editor mounts
                    if (ref) {
                      logger.debug('MDXEditor component mounted, will focus after content loads...');

                      setTimeout(() => {
                        try {
                          const content = ref.getMarkdown();
                          logger.debug('Editor content length after mount:', content.length);
                          logger.debug('Editor content preview:', `${content.substring(0, 500)}...`);

                          // Check DOM structure
                          const editorDOM =
                            document.querySelector('.mdx-content') ??
                            document.querySelector('[contenteditable="true"]');
                          if (editorDOM) {
                            logger.debug('Editor DOM found, innerHTML length:', editorDOM.innerHTML.length);
                            logger.debug('Editor DOM preview:', `${editorDOM.innerHTML.substring(0, 500)}...`);

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
                  onError={error => {
                    logger.error('MDXEditor parsing error:', error);
                    logger.debug(
                      'This error might be caused by angle brackets. Try using the source mode if available.',
                    );
                  }}
                  className={`mdx-editor ${isDarkTheme ? 'dark-theme' : 'light-theme'} font-${selectedFont.toLowerCase().replace(/\s+/g, '-')}`}
                  contentEditableClassName={`mdx-content prose font-${selectedFont.toLowerCase().replace(/\s+/g, '-')}`}
                  plugins={plugins}
                />
              );
              logger.debug('About to return MDXEditor element');
              return editorElement;
            } catch (error) {
              logger.error('=== MDXEDITOR RENDER ERROR ===', error);
              return (
                <div
                  style={{
                    padding: '20px',
                    background: '#ffe6e6',
                    border: '1px solid #ff0000',
                    borderRadius: '4px',
                  }}
                >
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
              <button onClick={() => setShowCommentSidebar(false)} className="sidebar-close" title="Hide Comments">
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

        {/* Table of Contents Sidebar */}
        {showTOCSidebar && (
          <div className="toc-sidebar" style={{ width: `${sidebarWidth}px` }}>
            <div className="sidebar-resize-handle"></div>
            <div className="toc-header-wrapper">
              <h3>Table of Contents</h3>
              <button onClick={() => setShowTOCSidebar(false)} className="sidebar-close" title="Hide Table of Contents">
                ✕
              </button>
            </div>
            <TableOfContents content={liveMarkdown} onHeadingClick={handleHeadingNavigation} />
          </div>
        )}

        {/* Show comments button when sidebar is hidden */}
        {!showCommentSidebar && (
          <button className="show-comments-btn" onClick={() => setShowCommentSidebar(true)} title="Show Comments">
            💬 {parsedComments.length}
          </button>
        )}

        {/* Show TOC button when sidebar is hidden */}
        {!showTOCSidebar && (
          <button className="show-toc-btn" onClick={() => setShowTOCSidebar(true)} title="Show Table of Contents">
            <List size={16} />
          </button>
        )}
      </div>

      {/* Floating comment button */}
      {showFloatingButton && floatingButtonPosition && currentViewMode === 'rich-text' && (
        <div
          className={`floating-comment-button ${showFloatingButton ? 'visible' : ''}`}
          title="Add comment"
          style={{
            left: `${floatingButtonPosition.x + 34}px`,
            top: `${floatingButtonPosition.y}px`,
          }}
          onMouseDown={e => {
            e.preventDefault();
            e.stopPropagation();
            logger.debug('Floating button mousedown with selected text:', selectedText);
            if (selectedText) {
              setShowCommentModal(true);
              setShowFloatingButton(false);
            }
          }}
          onClick={e => {
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
        selectedText={editingComment?.anchoredText || ''}
        initialText={editingComment?.content || ''}
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
