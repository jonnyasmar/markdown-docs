import { logger } from '@/utils/logger';
import { GenericDirectiveEditor } from '@mdxeditor/editor';

export const createCommentDirectiveDescriptor = (
  focusedCommentId: string | null,
  setFocusedCommentId: (id: string | null) => void,
) => ({
  name: 'comment',
  // MDX AST nodes from third-party library lack proper TypeScript definitions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  testNode(node: any): boolean {
    logger.debug('Comment directive test - node:', node);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const isComment = Boolean(node && node.name === 'comment');
    logger.debug('Is comment directive?', isComment);
    return isComment;
  },
  attributes: ['id', 'text'],
  hasChildren: true, // All directive types can have children (the [content] part)
  // MDX AST nodes from third-party library lack proper TypeScript definitions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Editor: ({ mdastNode }: any) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const commentId = String(mdastNode.attributes?.id ?? '');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const commentText = String(mdastNode.attributes?.text ?? 'Comment');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const directiveType = mdastNode.type; // 'textDirective', 'leafDirective', or 'containerDirective'

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-assignment
    logger.debug('Rendering comment directive:', { commentId, commentText, directiveType, mdastNode });

    // Render differently for inline vs block directives
    const renderContent = (): string => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (!mdastNode.children || mdastNode.children.length === 0) {
        return 'No content';
      }

      // MDX AST nodes from third-party library lack proper TypeScript definitions
      // eslint-disable-next-line max-len
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      const result = mdastNode.children
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((child: any): string => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (child.type === 'text') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            return String(child.value ?? '');
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          } else if (child.type === 'paragraph') {
            // For paragraphs, preserve the line break after each one
            // MDX AST child nodes from third-party library lack proper TypeScript definitions
            // eslint-disable-next-line max-len
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const content =
              // eslint-disable-next-line max-len
              // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
              child.children?.map((grandchild: any): string => String(grandchild.value ?? '')).join('') ?? '';
            return String(content);
          } else {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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

export const genericDirectiveDescriptor = {
  name: 'generic',
  // MDX AST nodes from third-party library lack proper TypeScript definitions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  testNode: (node: any) => {
    logger.debug('Generic directive test - node:', node);

    // If it's not our comment directive, catch it to prevent errors
    // This includes malformed directives with undefined names
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const isNotComment = !node || node.name !== 'comment';
    const shouldHandle = isNotComment;

    logger.debug('Generic directive decision:', {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      nodeName: node?.name,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      nodeType: node?.type,
      isNotComment,
      shouldHandle,
    });

    return shouldHandle;
  },
  attributes: ['id', 'class', 'style', 'name'],
  hasChildren: true,
  // MDX AST nodes from third-party library lack proper TypeScript definitions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Editor: (props: any) => {
    // Custom minimal editor that doesn't show visible UI for malformed directives
    logger.debug('Rendering generic directive with props:', props);

    // If the directive has no name or is malformed, render nothing
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!props.mdastNode?.name || props.mdastNode.name === 'undefined') {
      logger.debug('Rendering invisible placeholder for malformed directive');
      return <span style={{ display: 'none' }} />;
    }

    // For actual named directives, use the generic editor
    return <GenericDirectiveEditor {...props} />;
  },
};
