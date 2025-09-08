import { logger } from '@/utils/logger';
import { escapeDirectiveContent } from '@/utils/textNormalization';
import { realmPlugin, rootEditor$ } from '@mdxeditor/editor';
import { $getSelection, $isRangeSelection } from 'lexical';
import { insertCommentDirective$, $createDirectiveNode } from './directives';

export const commentInsertionPlugin = realmPlugin<{
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
    logger.debug('Comment insertion plugin initialized with insertCommentDirective$ support');
  },

  update(realm, params) {
    // React to pending comment updates and insert directives using native MDX Editor signals
    if (params?.pendingComment) {
      const pendingComment = params.pendingComment;

      try {
        // Build directive mdast payload
        const isContainer = pendingComment.strategy === 'container';
        const children = isContainer
          ? // Split selection into paragraphs on blank lines to preserve structure
            pendingComment.selectedText
              .split(/\n{2,}/)
              .map(p => ({ type: 'paragraph', children: [{ type: 'text', value: p }] }))
          : [{ type: 'text', value: pendingComment.selectedText }];

        const directiveConfig = {
          name: 'comment',
          type: (isContainer ? 'containerDirective' : 'textDirective') as 'containerDirective' | 'textDirective' | 'leafDirective',
          // @ts-expect-error - mdast children are loosely typed here
          children,
          attributes: {
            id: pendingComment.commentId,
            text: escapeDirectiveContent(pendingComment.comment, isContainer),
          },
        };
        logger.debug('Comment directive config to insert:', directiveConfig);

        if (isContainer) {
          // For container directives, wrap the current selection: remove selected content then insert the directive
          const editor = realm.getValue(rootEditor$);
          if (editor) {
            editor.update(() => {
              const selection = $getSelection();
              if (!$isRangeSelection(selection)) {
                // Fallback: just insert at cursor via signal
                realm.pub(insertCommentDirective$, directiveConfig);
                return;
              }

              // Remove the selected content first to avoid duplication
              const selectedNodes = selection.getNodes();
              selection.removeText();

              // Insert the directive node at the collapsed selection
              const directiveNode = $createDirectiveNode(directiveConfig) as unknown as any;
              // selection.insertNodes expects LexicalNodes
              // @ts-expect-error - runtime node type is valid LexicalNode
              selection.insertNodes([directiveNode]);

              // Clean up now-empty paragraphs that were fully selected
              for (const n of selectedNodes) {
                try {
                  const getType = (n as any)?.getType?.bind(n);
                  const getTextContent = (n as any)?.getTextContent?.bind(n);
                  const remove = (n as any)?.remove?.bind(n);
                  if (getType && getTextContent && remove && getType() === 'paragraph' && getTextContent().trim() === '') {
                    remove();
                  }
                } catch {
                  // ignore errors from non-paragraph nodes
                }
              }
            });
          } else {
            // Fallback if no editor available
            realm.pub(insertCommentDirective$, directiveConfig);
          }
        } else {
          // Inline comments: insert via the signal
          realm.pub(insertCommentDirective$, directiveConfig);
        }

        logger.debug('Comment directive inserted successfully via insertCommentDirective$');

        // Call completion callback if provided
        if (params?.onInsertComment) {
          logger.debug('Calling onInsertComment callback');
          params.onInsertComment(pendingComment);
        } else {
          logger.warn('No onInsertComment callback provided');
        }
      } catch (error) {
        logger.error('Error inserting comment directive via insertCommentDirective$:', error);
        logger.error('Error details:', error instanceof Error ? error.stack : String(error));
      }
    }
  },
});
