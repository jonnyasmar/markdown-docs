import { $getNodeByKey, LexicalEditor } from 'lexical';
import React, { useCallback, useEffect, useRef } from 'react';

interface FrontmatterInlineEditorProps {
  yaml: string;
  nodeKey: string;
  editor: LexicalEditor;
}

function applyHighlight(el: HTMLElement, text: string) {
  // Clear existing content
  while (el.firstChild) el.removeChild(el.firstChild);

  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (i > 0) el.appendChild(document.createTextNode('\n'));

    const match = line.match(/^(\s*)([\w][\w.-]*)(\s*:\s*)(.*)/);
    if (match) {
      const [, indent, key, colon, value] = match;
      if (indent) el.appendChild(document.createTextNode(indent));

      const keySpan = document.createElement('span');
      keySpan.className = 'fm-key';
      keySpan.textContent = key;
      el.appendChild(keySpan);

      const colonSpan = document.createElement('span');
      colonSpan.className = 'fm-colon';
      colonSpan.textContent = colon;
      el.appendChild(colonSpan);

      const valueSpan = document.createElement('span');
      valueSpan.className = 'fm-value';
      valueSpan.textContent = value;
      el.appendChild(valueSpan);
    } else if (line.trimStart().startsWith('#')) {
      const commentSpan = document.createElement('span');
      commentSpan.className = 'fm-comment';
      commentSpan.textContent = line;
      el.appendChild(commentSpan);
    } else {
      el.appendChild(document.createTextNode(line));
    }
  });
}

function getCaretOffset(element: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);
  const preRange = range.cloneRange();
  preRange.selectNodeContents(element);
  preRange.setEnd(range.startContainer, range.startOffset);
  return preRange.toString().length;
}

function setCaretOffset(element: HTMLElement, offset: number) {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let currentOffset = 0;
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    const nodeLen = node.textContent?.length ?? 0;
    if (currentOffset + nodeLen >= offset) {
      range.setStart(node, offset - currentOffset);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    currentOffset += nodeLen;
  }
}

export const FrontmatterInlineEditor: React.FC<FrontmatterInlineEditorProps> = ({ yaml, nodeKey, editor }) => {
  const preRef = useRef<HTMLPreElement>(null);
  const isLocalEdit = useRef(false);
  const [collapsed, setCollapsed] = React.useState(true);

  // Apply highlight when pre mounts (initial or after expanding)
  useEffect(() => {
    if (!collapsed && preRef.current) {
      applyHighlight(preRef.current, yaml);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed]);

  // Sync external changes (undo/redo) — skip if we just typed
  useEffect(() => {
    if (isLocalEdit.current) {
      isLocalEdit.current = false;
      return;
    }
    if (preRef.current && preRef.current.textContent !== yaml) {
      applyHighlight(preRef.current, yaml);
    }
  }, [yaml]);

  const handleInput = useCallback(() => {
    const el = preRef.current;
    if (!el) return;
    const text = el.textContent ?? '';
    isLocalEdit.current = true;

    // Re-highlight with cursor preservation
    const offset = getCaretOffset(el);
    applyHighlight(el, text);
    setCaretOffset(el, offset);

    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (node && 'setYaml' in node) {
        (node as any).setYaml(text);
      }
    });
  }, [editor, nodeKey]);

  // Prevent Lexical from intercepting keyboard events
  const stopPropagation = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div className={`frontmatter-inline ${collapsed ? 'frontmatter-collapsed' : ''}`} contentEditable={false}>
      <div className="frontmatter-inline-label" onClick={() => setCollapsed(c => !c)}>
        <span className="frontmatter-toggle">{collapsed ? '▶' : '▼'}</span>
        Frontmatter
      </div>
      {!collapsed && (
        <pre
          ref={preRef}
          className="frontmatter-inline-code"
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={stopPropagation}
          onKeyUp={stopPropagation}
          spellCheck={false}
        />
      )}
    </div>
  );
};
