import { MdastImportVisitor } from '@mdxeditor/editor';
import { $createTextNode, ElementNode } from 'lexical';
import * as Mdast from 'mdast';
import { Directives } from 'mdast-util-directive';

import { $createDirectiveNode } from './DirectiveNode';

const DIRECTIVE_TYPES = ['leafDirective', 'containerDirective', 'textDirective'];

/**
 * Determines if the given node is a HTML MDAST node.
 * @group HTML
 */
export function isMdastDirectivesNode(node: Mdast.Nodes): node is Directives {
  return DIRECTIVE_TYPES.includes(node.type);
}

export const MdastDirectiveVisitor: (
  escapeUnknownTextDirectives?: boolean,
  focusedCommentId?: string | null,
  setFocusedCommentId?: (id: string | null) => void,
) => MdastImportVisitor<Directives> = (escapeUnknownTextDirectives, focusedCommentId, setFocusedCommentId) => ({
  testNode: (node, { directiveDescriptors }) => {
    if (isMdastDirectivesNode(node)) {
      const descriptor = directiveDescriptors.find(descriptor => descriptor.testNode(node));
      if (escapeUnknownTextDirectives && !descriptor && node.type === 'textDirective') {
        return true;
      }
      return descriptor !== undefined;
    }
    return false;
  },
  visitNode({ lexicalParent, mdastNode, descriptors }) {
    const isKnown = !escapeUnknownTextDirectives || descriptors.directiveDescriptors.some(d => d.testNode(mdastNode));
    if (isKnown) {
      (lexicalParent as ElementNode).append(
        $createDirectiveNode(mdastNode, undefined, focusedCommentId, setFocusedCommentId),
      );
    } else {
      /**
       * it is a text-directive and can only occur when `escapeUnknownTextDirectives` is true.
       */
      (lexicalParent as ElementNode).append($createTextNode(`:${mdastNode.name}`));
    }
  },
});
