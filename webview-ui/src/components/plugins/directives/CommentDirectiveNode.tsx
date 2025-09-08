import { logger } from '@/utils/logger';
import {
  $applyNodeReplacement,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedTextNode,
  type Spread,
  TextNode,
} from 'lexical';
import { Directives } from 'mdast-util-directive';

/**
 * A serialized representation of a CommentDirectiveNode.
 */
export type SerializedCommentDirectiveNode = Spread<
  {
    mdastNode: Directives;
    commentId?: string;
    commentText?: string;
    type: 'comment-directive';
    version: 1;
  },
  SerializedTextNode
>;

/**
 * A TextNode that represents a comment directive but behaves like normal editable text.
 */
export class CommentDirectiveNode extends TextNode {
  __mdastNode: Directives;
  __commentId: string;
  __commentText: string;
  __focusedCommentId: string | null;
  __setFocusedCommentId: (id: string | null) => void;

  static getType(): string {
    return 'comment-directive';
  }

  static clone(node: CommentDirectiveNode): CommentDirectiveNode {
    return new CommentDirectiveNode(
      node.__text,
      node.__mdastNode,
      node.__commentId,
      node.__commentText,
      node.__focusedCommentId,
      node.__setFocusedCommentId,
      node.__key,
    );
  }

  static importJSON(serializedNode: SerializedCommentDirectiveNode): CommentDirectiveNode {
    const { text, mdastNode, commentId, commentText } = serializedNode;
    // These will be set by the plugin when it has access to the focus state
    return new CommentDirectiveNode(text, mdastNode, commentId || '', commentText || '', null, () => {});
  }

  constructor(
    text: string,
    mdastNode: Directives,
    commentId: string,
    commentText: string,
    focusedCommentId: string | null,
    setFocusedCommentId: (id: string | null) => void,
    key?: NodeKey,
  ) {
    super(text, key);
    this.__mdastNode = mdastNode;
    this.__commentId = commentId;
    this.__commentText = commentText;
    this.__focusedCommentId = focusedCommentId;
    this.__setFocusedCommentId = setFocusedCommentId;
  }

  exportJSON(): SerializedCommentDirectiveNode {
    console.log('CommentDirectiveNode exportJSON called with:', this.__mdastNode, this.__text);

    // Update the mdast node with current text content
    const updatedMdastNode = {
      ...this.__mdastNode,
      children: [
        {
          type: 'text',
          value: this.__text,
        },
      ],
    };

    return {
      ...super.exportJSON(),
      mdastNode: structuredClone(updatedMdastNode),
      commentId: this.__commentId,
      commentText: this.__commentText,
      type: 'comment-directive',
      version: 1,
    };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = super.createDOM(config);

    // Apply comment styling
    element.classList.add('comment-highlight');
    if (this.__focusedCommentId === this.__commentId) {
      element.classList.add('focused');
    }
    element.setAttribute('data-comment-id', this.__commentId);
    element.setAttribute('title', `Comment: ${this.__commentText}`);

    // Add click handler for focusing
    element.addEventListener('click', e => {
      // Don't interfere with text selection
      if (window.getSelection()?.toString()) {
        return;
      }

      e.stopPropagation(); // Prevent event from bubbling up
      logger.debug('Clicked comment highlight:', this.__commentId);

      // Clear focus from all other comment highlights first
      document.querySelectorAll('.comment-highlight.focused').forEach(el => {
        if (el !== element) {
          el.classList.remove('focused');
        }
      });

      // Set focus state in component
      this.__setFocusedCommentId(this.__commentId);

      // Immediately add focused class to the highlight
      element.classList.add('focused');

      // Find and trigger click on the corresponding sidebar comment
      console.log('Looking for sidebar comment with ID:', this.__commentId);
      const commentElement = document.querySelector(`.comment-item[data-comment-id="${this.__commentId}"]`);
      console.log('Found sidebar comment element:', commentElement);
      
      if (!commentElement) {
        // Try alternative selectors
        const altElement1 = document.querySelector(`[data-comment-id="${this.__commentId}"]`);
        const altElement2 = document.querySelector(`.comment[data-comment-id="${this.__commentId}"]`);
        console.log('Alternative selector 1:', altElement1);
        console.log('Alternative selector 2:', altElement2);
      }
      
      if (commentElement) {
        // Simulate clicking on the sidebar comment item
        logger.debug('Triggering sidebar comment click for:', this.__commentId);
        commentElement.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
          }),
        );

        // Add visual feedback (no timeout to remove it - let the sidebar handle focus)
        commentElement.classList.add('highlighted');
        // Remove the timeout - let the sidebar manage its own focus state
      } else {
        logger.debug('No sidebar comment found for:', this.__commentId);
        // Try to open the sidebar anyway
        console.log('Attempting to open comments sidebar...');
        // Look for sidebar toggle button or similar
        const sidebarToggle = document.querySelector('[data-testid="comments-toggle"], .comments-toggle, .sidebar-toggle');
        if (sidebarToggle) {
          console.log('Found sidebar toggle, clicking it:', sidebarToggle);
          (sidebarToggle as HTMLElement).click();
        }
      }
    });

    // Set up MutationObserver to sync focus state with sidebar
    const setupFocusSync = () => {
      const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            const target = mutation.target as HTMLElement;
            if (target.classList.contains('comment-item')) {
              const commentId = target.getAttribute('data-comment-id');
              if (commentId === this.__commentId) {
                // Sync focus state based on sidebar comment item
                if (target.classList.contains('focused')) {
                  element.classList.add('focused');
                } else {
                  element.classList.remove('focused');
                }
              }
            }
          }
        });
      });

      // Observe changes to all comment items in the sidebar
      const commentItems = document.querySelectorAll('.comment-item');
      commentItems.forEach(item => {
        observer.observe(item, { attributes: true, attributeFilter: ['class'] });
      });

      // Also observe for new comment items being added
      const sidebarContainer = document.querySelector(
        '.comments-sidebar, .comment-list, [data-testid="comments-sidebar"]',
      );
      if (sidebarContainer) {
        observer.observe(sidebarContainer, { childList: true, subtree: true });
      }

      return observer;
    };

    // Set up the observer
    //const observer = setupFocusSync();

    // Add global click handler to blur when clicking elsewhere (only set up once per document)
    if (!document.body.hasAttribute('data-comment-blur-handler-setup')) {
      document.body.setAttribute('data-comment-blur-handler-setup', 'true');
      
      const globalBlurHandler = (e: Event) => {
        const target = e.target as HTMLElement;
        
        // Don't blur if clicking on any comment highlight
        if (target.closest('.comment-highlight')) {
          return;
        }
        
        // Don't blur if clicking in the sidebar
        const isInSidebar = target.closest('.comments-sidebar, .comment-list, [data-testid="comments-sidebar"]');
        if (isInSidebar) {
          return;
        }
        
        // Clear focus from all comment highlights
        const focusedHighlights = document.querySelectorAll('.comment-highlight.focused');
        if (focusedHighlights.length > 0) {
          logger.debug('Blurring all comment highlights');
          focusedHighlights.forEach(el => el.classList.remove('focused'));
          
          // Clear the focus state in the component (use the first one's handler)
          const firstHighlight = focusedHighlights[0] as any;
          if (firstHighlight && firstHighlight.__commentNode) {
            firstHighlight.__commentNode.__setFocusedCommentId(null);
          }
        }
      };
      
      document.addEventListener('click', globalBlurHandler);
    }
    
    // Store reference to this node on the element for the global handler
    (element as any).__commentNode = this;

    // Store cleanup function on the element for later removal
    (element as any).__cleanup = () => {
      // No individual cleanup needed since we're using a global handler
    };

    console.log('Created CommentDirectiveNode DOM:', element, 'with text:', this.__text);

    return element;
  }

  updateDOM(prevNode: CommentDirectiveNode, dom: HTMLElement, config: EditorConfig): boolean {
    const updated = super.updateDOM(prevNode, dom, config);

    // Update comment-specific attributes
    if (
      prevNode.__commentId !== this.__commentId ||
      prevNode.__commentText !== this.__commentText ||
      prevNode.__focusedCommentId !== this.__focusedCommentId
    ) {
      dom.setAttribute('data-comment-id', this.__commentId);
      dom.setAttribute('title', `Comment: ${this.__commentText}`);

      return true;
    }

    return updated;
  }

  // Override destroy to cleanup event listeners
  destroy(): void {
    // Cleanup global event listener if it exists
    const cleanup = (this.getLatest() as any).__element?.__cleanup;
    if (cleanup) {
      cleanup();
    }
    super.destroy();
  }

  getMdastNode(): Directives {
    return this.__mdastNode;
  }

  getCommentId(): string {
    return this.__commentId;
  }

  getCommentText(): string {
    return this.__commentText;
  }

  setFocusState(focusedCommentId: string | null, setFocusedCommentId: (id: string | null) => void): this {
    const writable = this.getWritable();
    writable.__focusedCommentId = focusedCommentId;
    writable.__setFocusedCommentId = setFocusedCommentId;
    return writable;
  }

  // Override text content for export to include directive syntax
  getTextContent(): string {
    const stack = new Error().stack;
    
    // Check if we're in an editing context (avoid export during these)
    const isEditingContext = stack && (
      stack.includes('insertText') ||
      stack.includes('removeText') ||
      stack.includes('splitText') ||
      stack.includes('mergeText') ||
      stack.includes('normalizeSelection') ||
      stack.includes('updateDOM') ||
      stack.includes('reconcileSelection') ||
      stack.includes('setTextContent') ||
      // Avoid during node creation/updates
      stack.includes('createDOM') ||
      stack.includes('clone')
    );
    
    // If we're editing, always return plain text
    if (isEditingContext) {
      console.log('CommentDirectiveNode: Editing context detected, returning plain text');
      return this.__text;
    }
    
    // Check for export context (but be more inclusive than before)
    const isExportContext = stack && (
      stack.includes('toMarkdown') ||
      stack.includes('mdastToMarkdown') ||
      stack.includes('serialize') ||
      stack.includes('markdown') ||
      stack.includes('export') ||
      stack.includes('getMarkdown') ||
      stack.includes('toString')
    );

    if (isExportContext) {
      console.log('CommentDirectiveNode: Export context detected, returning directive syntax');

      // Return directive syntax with special markers to prevent escaping
      const mdast = this.__mdastNode;
      const text = this.__text;
      const attrs = Object.entries(mdast.attributes || {})
        .map(([key, value]) => `${key}="${value}"`)
        .join(' ');

      const directiveSyntax = `__DIRECTIVE_START__:${mdast.name}[${text}]{${attrs}}__DIRECTIVE_END__`;

      console.log('CommentDirectiveNode: Returning marked directive syntax:', directiveSyntax);
      return directiveSyntax;
    }

    console.log('CommentDirectiveNode: Normal context, returning plain text');
    // Normal context, return plain text for editor display
    return this.__text;
  }
}

export function $createCommentDirectiveNode(
  text: string,
  mdastNode: Directives,
  commentId: string,
  commentText: string,
  focusedCommentId: string | null,
  setFocusedCommentId: (id: string | null) => void,
): CommentDirectiveNode {
  return $applyNodeReplacement(
    new CommentDirectiveNode(text, mdastNode, commentId, commentText, focusedCommentId, setFocusedCommentId),
  );
}

export function $isCommentDirectiveNode(node: LexicalNode | null | undefined): node is CommentDirectiveNode {
  return node instanceof CommentDirectiveNode;
}
