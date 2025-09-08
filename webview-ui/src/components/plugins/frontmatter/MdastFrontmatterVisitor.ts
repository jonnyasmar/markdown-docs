import { $createFrontmatterNode, MdastImportVisitor } from '@mdxeditor/editor';
import * as Mdast from 'mdast';

export const MdastFrontmatterVisitor: MdastImportVisitor<Mdast.YAML> = {
  testNode: 'yaml',
  visitNode({ mdastNode, actions }) {
    actions.addAndStepInto($createFrontmatterNode(mdastNode.value));
  },
};
