import { LexicalExportVisitor } from '@mdxeditor/editor';
import * as Mdast from 'mdast';

import { $isFrontmatterNode, FrontmatterNode } from './FrontmatterNode';

export const LexicalFrontmatterVisitor: LexicalExportVisitor<FrontmatterNode, Mdast.YAML> = {
  testLexicalNode: $isFrontmatterNode,
  visitLexicalNode: ({ actions, lexicalNode }) => {
    actions.addAndStepInto('yaml', { value: lexicalNode.getYaml() });
  },
};
