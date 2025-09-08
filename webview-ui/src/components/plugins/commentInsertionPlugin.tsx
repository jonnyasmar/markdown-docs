import { logger } from '@/utils/logger';
import { escapeDirectiveContent } from '@/utils/textNormalization';
import { realmPlugin } from '@mdxeditor/editor';
import { insertCommentDirective$ } from './directives';

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
        // Use our custom insertCommentDirective$ signal - this ensures proper integration with CommentDirectiveNode
        const directiveConfig = {
          name: 'comment',
          type: (pendingComment.strategy === 'container' ? 'containerDirective' : 'textDirective') as
            | 'containerDirective'
            | 'textDirective'
            | 'leafDirective',
          children:
            pendingComment.strategy === 'container'
              ? [{ type: 'paragraph', children: [{ type: 'text', value: pendingComment.selectedText }] }]
              : [{ type: 'text', value: pendingComment.selectedText }],
          attributes: {
            id: pendingComment.commentId,
            text: escapeDirectiveContent(pendingComment.comment, pendingComment.strategy === 'container'),
          },
        };
        logger.debug('Comment directive config to insert:', directiveConfig);
        realm.pub(insertCommentDirective$, directiveConfig);

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
