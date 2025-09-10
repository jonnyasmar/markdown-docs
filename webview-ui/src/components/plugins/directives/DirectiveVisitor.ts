import { LexicalExportVisitor } from '@mdxeditor/editor';
import { LeafDirective } from 'mdast-util-directive';

import { $isCommentDirectiveNode } from './CommentDirectiveNode';
import { $isDirectiveNode, DirectiveNode } from './DirectiveNode';

export const DirectiveVisitor: LexicalExportVisitor<DirectiveNode, LeafDirective> = {
  // Ensure we run before the default Text visitor
  priority: 100,
  testLexicalNode: node => {
    // Only handle directive nodes (including our CommentDirectiveNode)
    const isDirective = $isDirectiveNode(node) || $isCommentDirectiveNode(node);
    return isDirective;
  },
  visitLexicalNode({ actions, mdastParent, lexicalNode }) {
    console.log('DirectiveVisitor: Processing node', lexicalNode?.constructor?.name);

    if ($isCommentDirectiveNode(lexicalNode)) {
      console.log('DirectiveVisitor: Found CommentDirectiveNode, exporting directive syntax');
      // Handle CommentDirectiveNode - update text content and export directive
      const mdastNode = lexicalNode.getMdastNode();
      const currentText = lexicalNode.getTextContent();

      // Create updated directive with current text content
      const exportNode = {
        ...mdastNode,
        children: [
          {
            type: 'text',
            value: currentText,
          },
        ],
      };

      console.log('DirectiveVisitor: Exporting CommentDirectiveNode as:', exportNode);
      actions.appendToParent(mdastParent, exportNode);
    } else {
      console.log('DirectiveVisitor: Regular DirectiveNode');
      // Regular DirectiveNode
      actions.appendToParent(mdastParent, lexicalNode.getMdastNode());
    }
  },
};
