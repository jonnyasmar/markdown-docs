import { NestedEditorsContext, VoidEmitter, directiveDescriptors$, voidEmitter } from '@mdxeditor/editor';
import { useCellValues } from '@mdxeditor/gurx';
import {
  DecoratorNode,
  type EditorConfig,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical';
import { Directives } from 'mdast-util-directive';
import React from 'react';

import { $createCommentDirectiveNode, CommentDirectiveNode } from './CommentDirectiveNode';

/**
 * A serialized representation of an {@link DirectiveNode}.
 * @group Directive
 */
export type SerializedDirectiveNode = Spread<
  {
    mdastNode: Directives;
    type: 'directive';
    version: 1;
  },
  SerializedLexicalNode
>;

/**
 * A lexical node that represents an image. Use {@link "$createDirectiveNode"} to construct one.
 * @group Directive
 */
export class DirectiveNode extends DecoratorNode<React.JSX.Element> {
  /** @internal */
  __mdastNode: Directives;
  /** @internal */
  __focusEmitter = voidEmitter();

  __focusedCommentId: string | null;
  __setFocusedCommentId: (id: string | null) => void;

  /** @internal */
  static getType(): string {
    return 'text';
  }

  /** @internal */
  static clone(node: DirectiveNode): DirectiveNode {
    return new DirectiveNode(
      structuredClone(node.__mdastNode), 
      node.__key,
      node.__focusedCommentId,
      node.__setFocusedCommentId
    );
  }

  /** @internal */
  static importJSON(serializedNode: SerializedDirectiveNode): DirectiveNode {
    // Note: Focus state will be set by the plugin when it has access to the focus context
    return $createDirectiveNode(serializedNode.mdastNode);
  }

  /**
   * Constructs a new {@link DirectiveNode} with the specified MDAST directive node as the object to edit.
   */
  constructor(
    mdastNode: Directives, 
    key?: NodeKey,
    focusedCommentId?: string | null,
    setFocusedCommentId?: (id: string | null) => void
  ) {
    super(key);
    this.__mdastNode = mdastNode;
    this.__focusedCommentId = focusedCommentId || null;
    this.__setFocusedCommentId = setFocusedCommentId || (() => {});
  }

  /**
   * Returns the MDAST node that is being edited.
   */
  getMdastNode(): Directives {
    return this.__mdastNode;
  }

  /** @internal */
  exportJSON(): SerializedDirectiveNode {
    return {
      mdastNode: structuredClone(this.__mdastNode),
      type: 'directive',
      version: 1,
    };
  }

  /** @internal */
  createDOM(): HTMLElement {
    return document.createElement(this.__mdastNode.type === 'textDirective' ? 'mark' : 'div');
  }

  /** @internal */
  updateDOM(): false {
    return false;
  }

  /**
   * Sets a new MDAST node to edit.
   */
  setMdastNode(mdastNode: Directives): void {
    this.getWritable().__mdastNode = mdastNode;
  }

  /**
   * Focuses the direcitive editor.
   */
  select = () => {
    this.__focusEmitter.publish();
  };

  /** @internal */
  decorate(parentEditor: LexicalEditor, config: EditorConfig): JSX.Element {
    return (
      <DirectiveEditorContainer
        lexicalNode={this}
        mdastNode={this.getMdastNode()}
        parentEditor={parentEditor}
        config={config}
        focusEmitter={this.__focusEmitter}
      />
    );
  }

  /** @internal */
  isInline(): boolean {
    return this.__mdastNode.type === 'textDirective';
  }

  /** @internal */
  isKeyboardSelectable(): boolean {
    return true;
  }
}

const DirectiveEditorContainer: React.FC<{
  parentEditor: LexicalEditor;
  lexicalNode: DirectiveNode;
  mdastNode: Directives;
  config: EditorConfig;
  focusEmitter: VoidEmitter;
}> = props => {
  const { mdastNode } = props;
  const [directiveDescriptors] = useCellValues(directiveDescriptors$);
  const descriptor = directiveDescriptors.find(descriptor => descriptor.testNode(mdastNode));
  if (!descriptor) {
    throw new Error(`No descriptor found for directive ${mdastNode.name}`);
  }

  const Editor = descriptor.Editor;

  return (
    <NestedEditorsContext.Provider value={props}>
      <Editor
        descriptor={descriptor}
        mdastNode={mdastNode}
        lexicalNode={props.lexicalNode}
        parentEditor={props.parentEditor}
      />
    </NestedEditorsContext.Provider>
  );
};

/**
 * Creates an {@link DirectiveNode}. Use this instead of the constructor to follow the Lexical conventions.
 * For comment directives, this will create a CommentDirectiveNode instead.
 * @group Directive
 */
export function $createDirectiveNode(
  mdastNode: Directives,
  key?: NodeKey,
  focusedCommentId?: string | null,
  setFocusedCommentId?: (id: string | null) => void,
): DirectiveNode | CommentDirectiveNode {
  // Special handling for comment directives - create TextNode-based nodes
  if (mdastNode.name === 'comment' && mdastNode.type === 'textDirective') {
    const commentId = mdastNode.attributes?.id || '';
    const commentText = mdastNode.attributes?.text || 'Comment';

    // Extract text content from children
    let textContent = '';
    if (mdastNode.children && mdastNode.children.length > 0) {
      textContent = mdastNode.children.map((child: any) => child.value || '').join('');
    }

    console.log('Creating CommentDirectiveNode for:', { commentId, commentText, textContent });

    return $createCommentDirectiveNode(
      textContent,
      mdastNode,
      commentId,
      commentText,
      focusedCommentId || null,
      setFocusedCommentId || (() => {}),
    );
  }

  // For all other directives, create regular DirectiveNode
  return new DirectiveNode(mdastNode, key);
}

/**
 * Returns true if the node is an {@link DirectiveNode} or {@link CommentDirectiveNode}.
 * @group Directive
 */
export function $isDirectiveNode(node: LexicalNode | null | undefined): node is DirectiveNode | CommentDirectiveNode {
  return node instanceof DirectiveNode || node instanceof CommentDirectiveNode;
}

/**
 * Returns true if the node is specifically a {@link CommentDirectiveNode}.
 * @group Directive
 */
export function $isCommentDirectiveNode(node: LexicalNode | null | undefined): node is CommentDirectiveNode {
  return node instanceof CommentDirectiveNode;
}
