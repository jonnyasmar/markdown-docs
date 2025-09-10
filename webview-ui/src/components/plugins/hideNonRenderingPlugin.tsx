import { MdastImportVisitor, addImportVisitor$, addMdastExtension$, realmPlugin } from '@mdxeditor/editor';
import { visit } from 'unist-util-visit';

/**
 * Custom remark plugin to remove frontmatter patterns from the AST for display
 */
function hideFrontmatterExtension() {
  return (tree: any) => {
    console.log('HIDE_PLUGIN: Processing tree with', tree.children?.length, 'children');

    if (!tree.children || tree.children.length === 0) {
      return tree;
    }

    // Log the structure
    console.log(
      'HIDE_PLUGIN: Tree structure:',
      tree.children.slice(0, 5).map((child: any) => ({
        type: child.type,
        value: child.value?.slice?.(0, 50),
        children: child.children?.length,
      })),
    );

    // Look for frontmatter pattern: thematicBreak at start
    if (tree.children[0]?.type === 'thematicBreak') {
      console.log('HIDE_PLUGIN: Found thematic break at start, looking for pattern');

      // Find the next thematic break (closing ---)
      let endIndex = -1;
      for (let i = 1; i < tree.children.length; i++) {
        if (tree.children[i].type === 'thematicBreak') {
          endIndex = i;
          break;
        }
      }

      if (endIndex > 0) {
        console.log('HIDE_PLUGIN: Found frontmatter pattern, removing nodes 0 to', endIndex);
        // Remove everything from start through the closing thematic break
        tree.children.splice(0, endIndex + 1);
        console.log('HIDE_PLUGIN: After removal, tree has', tree.children.length, 'children');
      }
    }

    return tree;
  };
}

/**
 * Simple plugin to strip non-rendering content from the editor view
 * while preserving it in the source using a remark plugin
 */
export const hideNonRenderingPlugin = realmPlugin({
  init(realm) {
    console.log('HIDE_PLUGIN: Plugin initializing...');
    realm.pubIn({
      [addMdastExtension$]: hideFrontmatterExtension,
    });
    console.log('HIDE_PLUGIN: Plugin setup complete (proper pattern)');
  },
});
