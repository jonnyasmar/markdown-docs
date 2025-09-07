# MDXEditor Typing Performance Analysis

This report details a deep analysis of typing latency that increases over time in the MDXEditor-based webview. It traces the full flow from the webview to the VS Code extension and back, identifies accumulating side-effects, and proposes focused fixes.

## Executive Summary

- The editor performs well initially but degrades as content and DOM grow.
- The largest contributors are broad DOM observation (MutationObserver) and repeated heavy work per content change (regex scans and duplicate parsing), amplified as the document and DOM size increase.
- Several document-level listeners run for every keystroke/selection, which compounds with the above under load.
- Extension-side applies full-document replaces for each edit which is expensive for large files and forces downstream work in the editor/view.

Key fixes:
- Narrow MutationObserver scope; avoid subtree/childList observation during typing.
- Cache regexes and avoid in-place sorting of state arrays.
- Parse comments once per content change; remove double triggers.
- Consolidate high-frequency document listeners.
- Consider minimizing extension-side full-document replacements or increasing debounce.


## Data Flow Overview (Typing)

1) User types in MDXEditor (Lexical). The MDXEditor component in the wrapper calls `handleMarkdownChange`.

- File: `webview-ui/src/components/MDXEditorWrapper.tsx`
- Lines: 664–707

```ts
const handleMarkdownChange = useCallback((newMarkdown: string) => {
  // one-time escaping guard ...
  const processedMarkdown = postprocessAngleBrackets(newMarkdown);
  const hasChanges = processedMarkdown !== markdown;
  if (!hasChanges) return;

  setIsTyping(true);
  clearTimeout(typingTimeoutRef.current);
  typingTimeoutRef.current = setTimeout(() => {
    setIsTyping(false);
    setLiveMarkdown(newMarkdown);
  }, 300);

  // Debounced post to extension
  if (sendEditTimeoutRef.current) clearTimeout(sendEditTimeoutRef.current);
  sendEditTimeoutRef.current = setTimeout(() => {
    postContentEdit(processedMarkdown);
  }, 200);
}, [markdown]);
```

2) Webview posts `edit` → Extension receives and replaces the entire document content via `WorkspaceEdit`.

- File: `src/extension.ts`
- Lines: 180–212 (message handler), 338–366 (apply edit)

```ts
case 'edit': {
  const content = message.content;
  if (content) {
    const editContent = postprocessAngleBrackets(content);
    await this.updateTextDocument(document, editContent); // full replace
  }
  break;
}
...
private async updateTextDocument(document: vscode.TextDocument, newContent: string): Promise<void> {
  if (this.lastWebviewContent === newContent) return;
  this.updatingFromWebview = true;
  this.lastWebviewContent = newContent;
  this.lastSentToWebview = null;
  try {
    const edit = new vscode.WorkspaceEdit();
    const lastLine = document.lineCount - 1;
    const lastChar = document.lineAt(lastLine).text.length;
    edit.replace(document.uri, new vscode.Range(0, 0, lastLine, lastChar), newContent);
    await vscode.workspace.applyEdit(edit);
  } finally {
    setTimeout(() => { this.updatingFromWebview = false; }, 50);
  }
}
```

3) Extension’s onDidChangeTextDocument will often skip sending content back during `updatingFromWebview` or when the document is dirty (unsaved). The editor continues to show the locally typed content (Lexical state), while the wrapper’s `markdown` prop updates mainly on external edits/saves.

- File: `src/extension.ts`
- Lines: 95–143

```ts
if (this.updatingFromWebview) return;          // skip echo while updating
if (document.isDirty) return;                  // skip when dirty
if (webviewPanel.active && isUserInteracting) return; // avoid cursor jumps
this.sendContentToWebview(document, webviewPanel);
```

Net effect: On each typing burst (debounced ~200ms), the full document is updated in the TextDocument. The webview does heavy local work on each debounced change and also when extension-originated updates arrive.


## Findings and Hotspots

### 1) Over-broad MutationObserver in view-mode tracking

- File: `webview-ui/src/hooks/useViewModeTracking.ts`
- Lines: 28–40

```ts
const observer = new MutationObserver(() => { checkViewMode(); });
const editorContainer = document.querySelector('.mdxeditor');
if (editorContainer) {
  observer.observe(editorContainer, {
    childList: true,
    subtree: true,            // observes all subtree changes
    attributes: true,
    attributeFilter: ['style', 'class'],
  });
}
```

Why it hurts:
- Lexical updates the DOM heavily during typing; with `subtree: true` + `childList: true`, this observer fires on most mutations. `checkViewMode()` runs repeatedly and scales with DOM size as the document grows.

Recommendation:
- Observe only attribute changes on just the top-level elements that toggle visibility (rich-text/source/diff), and avoid `childList`/`subtree` while typing.

Proposed change:

```ts
if (editorContainer) {
  observer.observe(editorContainer, {
    attributes: true,
    attributeFilter: ['style', 'class'],
    // childList: false,
    // subtree: false,
  });
}
```

Also consider wiring to MDXEditor’s own view-mode toggles (plugin options/events) if available, avoiding DOM observation entirely.


### 2) Re-compilation of regexes + full-document scans on every update

- File: `webview-ui/src/components/MDXEditorWrapper.tsx`
- Lines: 263–300 (commentPositions useMemo)

```ts
const createPatterns = (commentId: string) => [
  new RegExp(`:comment\\[([^\\]]*)\\]\\{[^}]*(?:id=\"${commentId}\"|#${commentId})[^}]*\\}`),
  new RegExp(`::comment\\[([^\\]]*)\\]\\{[^}]*(?:id=\"${commentId}\"|#${commentId})[^}]*\\}`),
  new RegExp(`:::comment\\{[^}]*(?:id=\"${commentId}\"|#${commentId})[^}]*\\}`),
];
...
for (const regex of patterns) {
  const match = markdown.search(regex); // full scan per pattern
  if (match !== -1) { positions.set(comment.id, match); break; }
}
```

Why it hurts:
- For each update, 3 new regex objects per comment are compiled and run over the entire document. As document length (m) and comment count (n) grow, this becomes O(n·m) and increases GC pressure.

Recommendation:
- Cache regex arrays per comment ID (`Map<string, RegExp[]>`) in a ref outside the hook, reuse across runs.
- Prefer a single combined regex per ID if possible, or locate anchors via precomputed indices when feasible.

Sketch:

```ts
const regexCacheRef = useRef(new Map<string, RegExp[]>());
const getPatterns = (id: string) => {
  const cached = regexCacheRef.current.get(id);
  if (cached) return cached;
  const patterns = [ /* the 3 RegExps */ ];
  regexCacheRef.current.set(id, patterns);
  return patterns;
};
```


### 3) Duplicate comment parsing triggers

- File: `webview-ui/src/components/MDXEditorWrapper.tsx`
- Lines: 487–515

```ts
useEffect(() => {
  if (parseCommentTimeoutRef.current) clearTimeout(parseCommentTimeoutRef.current);
  parseCommentTimeoutRef.current = setTimeout(() => {
    const comments = DirectiveService.parseCommentDirectives(editorRef.current?.getMarkdown() ?? '');
    setParsedComments(...);
  }, 800);
  return () => clearTimeout(parseCommentTimeoutRef.current);
}, [liveMarkdown, markdown]); // double source of truth
```

Why it hurts:
- This effect runs when `liveMarkdown` changes (the local debounced typing state) and again when `markdown` from the extension updates. That results in redundant parses of the same content, doubling the cost.

Recommendation:
- Use a single content source to drive parsing (prefer the editor’s current content), and store a `lastParsed` ref to avoid re-parsing when unchanged.


### 4) Selection-change handler does heavy DOM work per event

- File: `webview-ui/src/components/MDXEditorWrapper.tsx`
- Lines: 711–812

```ts
const isWithinEditor = (node: Node): boolean => {
  let current: Node | null = node;
  while (current) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const element = current as Element;
      if (
        element.classList.contains('mdx-content') ||
        element.classList.contains('mdx-editor-content') ||
        element.closest('.mdx-content') ||
        element.closest('.mdx-editor-content') ||
        element.closest('[contenteditable=\"true\"]')
      ) return true;
      if (
        element.classList.contains('inline-search-input') ||
        element.closest('.inline-search-container') ||
        element.closest('.comments-sidebar') ||
        element.closest('.toolbar')
      ) return false;
    }
    current = current.parentNode;
  }
  return false;
};
```

Why it hurts:
- Selection change events fire frequently. The tree-walk with multiple `closest()` calls and layout-dependent queries can be expensive as the DOM grows.

Recommendation:
- Cache editor bounds (rect) per frame, do a quick geometric check first; bound the parent traversal depth (e.g., ≤10 steps) with an early exit. Also avoid work when view mode isn’t rich-text (already partially in place).


### 5) In-place sort of state array

- File: `webview-ui/src/components/MDXEditorWrapper.tsx`
- Lines: 451–473

```ts
const sortedComments = parsedComments.sort((a, b) => { /* ... */ });
```

Why it hurts:
- `Array.sort()` mutates `parsedComments` (state), which can cause subtle re-render churn and stale memoization.

Recommendation:
- Use a copied array: `const sorted = [...parsedComments].sort(...)`.


### 6) Multiple document-level listeners on each keystroke path

- Files: `MDXEditorWrapper.tsx`, `customSearchPlugin.tsx`, others.
- Notable registrations:
  - Keydown/keyup (tracking): `MDXEditorWrapper.tsx` (Lines 644–655)
  - Keydown (save intercept): `MDXEditorWrapper.tsx` (Lines 1069–1077; capture)
  - Keydown (Cmd/Ctrl+F): `customSearchPlugin.tsx` (Lines 296–304; capture)
  - Selectionchange, click, mousedown/mousemove/mouseup (various)

Why it hurts:
- Each keystroke bubbles through multiple global handlers. While each does modest work, combined with the above hotspots and a growing DOM, it contributes to cumulative latency.

Recommendation:
- Consolidate document handlers into a single delegated handler where possible (especially for keyboard), or scope listeners to the editor container.


### 7) Extension-side full document replace per edit

- File: `src/extension.ts`
- Lines: 338–366

Why it hurts:
- For larger files, full `WorkspaceEdit` replace on each debounced edit is expensive. Even with 200ms debounce, this grows with file size and can increase extension-side latency.

Recommendations:
- Consider increasing debounce for long documents.
- Optionally compute minimal diffs (e.g., range-based TextEdits) to reduce cost.
- Only send updates back to webview when necessary (already mostly handled by dirty/updating flags).


## Recommended Fixes (Prioritized)

1) Narrow MutationObserver scope (high impact)
- Change `useViewModeTracking` to observe only attribute changes without `childList`/`subtree`.
- Tie into explicit view-mode change events if the MDXEditor API allows.

2) Cache regex patterns and avoid full scans (high impact)
- Cache per-comment regex arrays in a ref to prevent re-compilation.
- Consider a single combined regex or anchor index heuristics to avoid scanning entire content for each comment on every update.

3) Single-source comment parsing (high impact)
- Drive parsing from one source (editorRef content) and remove `[markdown]` from the deps (or keep `[liveMarkdown]` only).
- Track `lastParsed` string to skip redundant runs.

4) Optimize selection-change path (medium impact)
- Use shallow, bounded parent traversal and optional bounding box checks.
- Keep the `requestAnimationFrame` throttle.

5) Avoid in-place sort of state arrays (medium impact)
- Use `const sorted = [...parsedComments].sort(...)`.

6) Consolidate document-level listeners (medium impact)
- Combine keyboard listeners and scope to the editor container where possible.

7) Consider extension-side edit optimization (medium impact)
- For very large documents, incrementally apply edits or increase debounce thresholds from the webview side based on content size.


## Additional Notes and Validations

- Theme detection observer in `MDXEditorWrapper.tsx` (Lines 99–113) is scoped to body attributes and is fine.
- Image upload message listener in `usePlugins` removes the handler upon receipt – no accumulation.
- Timeouts for typing, parsing, and edits are cleared correctly; general cleanup is in place (Lines 517–542). Include `parseCommentTimeoutRef` in cleanup (it is cleared in the parsing effect; consider centralizing).
- Webview → extension `edit` messages for comment operations are not duplicated on typical keystroke paths; the wrapper posts edits on typing, while `EditorApp` posts edits for explicit programmatic changes (comment insert/edit/delete).


## Appendix: Exact Code References

- `webview-ui/src/components/MDXEditorWrapper.tsx`
  - `handleMarkdownChange`: Lines 664–707
  - Comment parsing effect: Lines 487–515
  - Comment position cache: Lines 263–300
  - Selection handling: Lines 711–812
  - Sorted comments (in-place sort): Lines 451–473

- `webview-ui/src/hooks/useViewModeTracking.ts`
  - MutationObserver setup: Lines 28–40

- `src/extension.ts`
  - Edit handler: Lines 180–212
  - onDidChangeTextDocument filter flow: Lines 95–143
  - Full document replace: Lines 338–366


## Conclusion

The accumulating latency comes from the combination of:
- Broad DOM observation that scales with document/DOM growth (MutationObserver).
- Heavy per-update work (regex scans and duplicate parsing) that scales with document length and comment count.
- Multiple global listeners that add overhead for every input event.
- Full-document replacements in the extension that become costlier as files grow.

The proposed fixes are targeted, minimally invasive, and focus on eliminating repeated or unnecessary work. Implementing the high‑impact items should stabilize typing performance and prevent latency from increasing over time.

