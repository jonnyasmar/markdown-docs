import { $isFrontmatterNode, FrontmatterNode, LexicalExportVisitor } from '@mdxeditor/editor';
import * as Mdast from 'mdast';

export const LexicalFrontmatterVisitor: LexicalExportVisitor<FrontmatterNode, Mdast.YAML> = {
  testLexicalNode: $isFrontmatterNode,
  visitLexicalNode: ({ actions, lexicalNode }) => {
    actions.addAndStepInto('yaml', { value: lexicalNode.getYaml() });
  },
};
