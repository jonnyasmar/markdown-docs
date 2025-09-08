import {
  addExportVisitor$,
  addImportVisitor$,
  addLexicalNode$,
  addMdastExtension$,
  addSyntaxExtension$,
  addToMarkdownExtension$,
  directiveDescriptors$,
  insertDecoratorNode$,
  realmPlugin,
} from '@mdxeditor/editor';
import { Signal, map } from '@mdxeditor/gurx';
import { LexicalEditor } from 'lexical';
import { Directives, directiveFromMarkdown, directiveToMarkdown } from 'mdast-util-directive';
import { directive } from 'micromark-extension-directive';

import { CommentDirectiveNode } from './CommentDirectiveNode';
import { CommentDirectiveVisitor } from './CommentDirectiveVisitor';
import { $createDirectiveNode, DirectiveNode } from './DirectiveNode';
import { DirectiveVisitor } from './DirectiveVisitor';
import { MdastDirectiveVisitor } from './MdastDirectiveVisitor';

export * from './DirectiveNode';

/**
 * Implement this interface to create a custom editor for markdown directives.
 * Pass the object in the `directivesPlugin` parameters.
 * @group Directive
 */
export interface DirectiveDescriptor<T extends Directives = Directives> {
  /**
   * Whether the descriptor's Editor should be used for the given node.
   * @param node - The directive mdast node. You can code your logic against the node's name, type, attributes, children, etc.
   */
  testNode(node: Directives): boolean;
  /**
   * The name of the descriptor - use this if you're building UI for the user to select a directive.
   */
  name: string;
  /**
   * The attributes that the directive has. This can be used when building the UI for the user to configure a directive. The {@link GenericDirectiveEditor} uses those to display a property form.
   */
  attributes: string[];
  /**
   * Whether or not the directive has inner markdown content as children. Used by the {@link GenericDirectiveEditor} to determine whether to show the inner markdown editor.
   */
  hasChildren: boolean;
  /**
   * The type of the supported directive. Can be one of: 'leafDirective' | 'containerDirective' | 'textDirective'.
   */
  type?: 'leafDirective' | 'containerDirective' | 'textDirective';
  /**
   * The React component to be used as an Editor. See {@link DirectiveEditorProps} for the props passed to the component.
   */
  Editor: React.ComponentType<DirectiveEditorProps<T>>;
}

/**
 * The properties passed to the {@link DirectiveDescriptor.Editor} component.
 * @group Directive
 */
export interface DirectiveEditorProps<T extends Directives = Directives> {
  /**
   * The mdast directive node.
   */
  mdastNode: T;
  /**
   * The parent lexical editor - use this if you are dealing with the Lexical APIs.
   */
  parentEditor: LexicalEditor;
  /**
   * The Lexical directive node.
   */
  lexicalNode: DirectiveNode;
  /**
   * The descriptor that activated the editor
   */
  descriptor: DirectiveDescriptor;
}

/**
 * A signal that inserts a new directive node with the published payload.
 * @group Directive
 */
export const insertDirective$ = Signal<{
  type: Directives['type'];
  name: string;
  attributes?: Directives['attributes'];
  children?: any[];
}>();

/**
 * A signal specifically for inserting comment directives with focus state support.
 * @group Directive
 */
export const insertCommentDirective$ = Signal<{
  type: Directives['type'];
  name: string;
  attributes?: Directives['attributes'];
  children?: any[];
}>();

/**
 * A plugin that adds support for markdown directives.
 * @group Directive
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
export const commentsPlugin = realmPlugin<{
  /**
   * Use this to register your custom directive editors. You can also use the built-in {@link GenericDirectiveEditor}.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  directiveDescriptors: Array<DirectiveDescriptor<any>>;
  /**
   * Set this option to display unknown text-directives as normal text nodes.
   * This is handy when colons are used to separate words, e.g. in german "Schüler:in"
   */
  escapeUnknownTextDirectives?: boolean;
  focusedCommentId?: string | null;
  setFocusedCommentId?: (id: string | null) => void;
}>({
  update: (realm, params) => {
    realm.pub(directiveDescriptors$, params?.directiveDescriptors ?? []);
  },

  init: (realm, params) => {
    realm.pubIn({
      [directiveDescriptors$]: params?.directiveDescriptors ?? [],
      // import
      [addMdastExtension$]: directiveFromMarkdown(),
      [addSyntaxExtension$]: directive(),
      [addImportVisitor$]: MdastDirectiveVisitor(
        params?.escapeUnknownTextDirectives,
        params?.focusedCommentId,
        params?.setFocusedCommentId
      ),
      // export
      [addLexicalNode$]: [DirectiveNode, CommentDirectiveNode],
      [addToMarkdownExtension$]: [
        directiveToMarkdown(),
        // Post-process to fix comment directive markers
        {
          handlers: {
            text: (node, parent, state, info) => {
              const value = node.value || '';
              // Replace our special markers with proper directive syntax
              const processed = value.replace(/__DIRECTIVE_START__(.*?)__DIRECTIVE_END__/g, '$1');
              return processed;
            },
          },
        },
      ],
    });

    // Wire up the insertDirective$ signal to work with our comment nodes
    realm.link(
      realm.pipe(
        insertDirective$,
        map(payload => {
          console.log('insertDirective$ called with payload:', payload);
          return () => $createDirectiveNode(payload, undefined, params?.focusedCommentId, params?.setFocusedCommentId);
        }),
      ),
      insertDecoratorNode$,
    );

    // Wire up the insertCommentDirective$ signal specifically for comments
    realm.link(
      realm.pipe(
        insertCommentDirective$,
        map(payload => {
          console.log('insertCommentDirective$ called with payload:', payload);
          return () => $createDirectiveNode(payload, undefined, params?.focusedCommentId, params?.setFocusedCommentId);
        }),
      ),
      insertDecoratorNode$,
    );

    // Register a simple test visitor to see if ANY export visitors work
    const testVisitor = {
      testLexicalNode: node => {
        console.log('TEST VISITOR: checking node:', node?.constructor?.name);
        return true; // Accept all nodes
      },
      visitLexicalNode: ({ actions, mdastParent, lexicalNode }) => {
        console.log('TEST VISITOR: processing node:', lexicalNode?.constructor?.name);
        // Just pass through - don't actually modify anything
      },
    };

    console.log('Registering test visitor');
    realm.pub(addExportVisitor$, testVisitor);

    // Also register the original DirectiveVisitor
    realm.pub(addExportVisitor$, DirectiveVisitor);
  },
});
