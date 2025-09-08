import { LexicalExportVisitor } from '@mdxeditor/editor';
import { $isTextNode, TextNode } from 'lexical';
import { Text } from 'mdast';
import { LeafDirective } from 'mdast-util-directive';

import { $isCommentDirectiveNode, CommentDirectiveNode } from './CommentDirectiveNode';

/**
 * Export visitor for CommentDirectiveNode that preserves directive syntax
 */
export const CommentDirectiveVisitor: LexicalExportVisitor<TextNode, Text | LeafDirective> = {
  testLexicalNode: (node) => {
    const isText = $isTextNode(node);
    const isComment = $isCommentDirectiveNode(node);
    console.log('CommentDirectiveVisitor testLexicalNode:', node?.constructor?.name, 'isText:', isText, 'isComment:', isComment);
    return isText; // Catch all text nodes, then filter in visitLexicalNode
  },
  visitLexicalNode({ actions, mdastParent, lexicalNode }) {
    console.log('CommentDirectiveVisitor: Processing text node', lexicalNode?.constructor?.name);
    
    // Check if this is actually a CommentDirectiveNode
    if ($isCommentDirectiveNode(lexicalNode)) {
      console.log('CommentDirectiveVisitor: Found CommentDirectiveNode!');
      
      // Get the original MDAST node with directive syntax
      const mdastNode = lexicalNode.getMdastNode();
      console.log('CommentDirectiveVisitor: Original mdastNode', mdastNode);
      
      // Update the text content in case it was edited
      const currentText = lexicalNode.getTextContent();
      console.log('CommentDirectiveVisitor: Current text content', currentText);
      
      // Create a fresh copy to avoid mutation issues
      const exportNode = {
        ...mdastNode,
        children: [
          {
            type: 'text',
            value: currentText,
          },
        ],
      };
      
      console.log('CommentDirectiveVisitor: Exporting directive node', exportNode);
      
      // Append the directive node with preserved syntax and updated content
      actions.appendToParent(mdastParent, exportNode);
    } else {
      console.log('CommentDirectiveVisitor: Regular text node, creating text mdast node');
      // Regular text node - create standard text mdast node
      actions.appendToParent(mdastParent, {
        type: 'text',
        value: lexicalNode.getTextContent(),
      });
    }
  },
};