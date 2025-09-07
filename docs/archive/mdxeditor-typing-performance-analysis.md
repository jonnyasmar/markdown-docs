# **MDXEditor Typing Performance Analysis**

_GPT_

- Repo: `markdown-docs`
- Focus: Typing latency in `MDXEditorWrapper` and related hooks/plugins
- Date: 2025-09-07

This report documents the root causes behind the increasing typing latency observed in the webview MDX editor, with precise references to files and lines, examples, and actionable recommendations.a snjd sahdklsaj dljsa dsadoi jsaodj osadhp

**Summary**

- Primary bottlenecks:
  - Excessive console logging of full document content on every keystroke in the webview (and very verbose logging in the extension).
  - A broad `MutationObserver` on `document.body` running on every DOM mutation, re-applying inline styles and walking paragraphs.
  - High-frequency, full-document updates sent to the extension on every keystroke; the extension applies whole-document edits for each, compounding cost.
  - A global `selectionchange` handler doing layout reads/writes during typing.
- Net effect: Per-keystroke work grows with document size and with logging volume, causing latency to increase over time.

---

**Findings**

- Webview logging of full content on every keystroke
  - File: `webview-ui/src/utils/extensionMessaging.ts`
  - Lines: 12–22 (logger.debug call in `postToExtension`)

```ts
// extensionMessaging.ts
export const postToExtension = (message: WebviewMessage): void => {
  if (!window.vscodeApi) {
    logger.warn('VS Code API not available - message not sent:', message.command);
    return;
  }

  try {
    logger.debug('Posting to extension:', message.command, message); // Logs entire message incl. content
    window.vscodeApi.postMessage(message);
  } catch (error) {
    logger.error('Failed to post message to extension:', error, 'Message:', message);
  }
};
```

Why it hurts:

- `onChange` posts `edit` messages on every keystroke with `content` containing the entire markdown string. Debug logging prints that entire payload to the console each time.
- DevTools console becomes a sink for large strings, increasing memory pressure and GC activity over time, and slowing down the main thread.

Recommendation:

- Remove logging of `message` objects in hot paths or guard with a debug flag that defaults to off in production builds.
- If logging is needed, log only `message.command` and omit `content` length except when specifically diagnosing.

Suggested change:

```ts
// Replace this:
logger.debug('Posting to extension:', message.command, message);

// With this:
logger.debug('Posting to extension:', message.command);
// Optionally: logger.debug('Posting edit (len):', (message as any).content?.length);
```

- Broad MutationObserver re-applying dynamic styles on every DOM change
  - File: `webview-ui/src/components/MDXEditorWrapper.tsx`
  - Lines: 268–314 (approx.) in the “Apply dynamic styles to the editor content” effect

```ts
// MDXEditorWrapper.tsx
useEffect(() => {
  const applyDynamicStyles = () => {
    const editorContent = document.querySelector('.mdx-content[contenteditable="true"]') as HTMLElement;
    if (!editorContent) return;

    editorContent.style.fontSize = `${fontSize}px`;
    const paragraphs = editorContent.querySelectorAll('p');
    paragraphs.forEach(p => {
      (p as HTMLElement).style.fontSize = 'inherit';
    });
    editorContent.style.textAlign = textAlign;
    // ... sets book view paddings/margins ...
  };

  applyDynamicStyles();

  const observer = new MutationObserver(() => {
    applyDynamicStyles(); // runs on every DOM mutation across body
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}, [fontSize, textAlign, bookView, bookViewWidth, bookViewMargin]);
```

Why it hurts:

- Observing `document.body` with `subtree: true` reacts to every DOM mutation anywhere in the webview. Typing produces many micro-mutations.
- In the callback, it queries the editor root and iterates all `p` nodes to set inline styles, re-running layout logic repeatedly.
- As the document grows, each callback becomes costlier; since it runs on every mutation, total per-keystroke cost skyrockets.

Recommendation:

- Observe only the editor’s contenteditable container (e.g., `.mdxeditor-root-contenteditable`) and throttle the callback.
- Prefer CSS over imperative DOM updates: set styles via class/variables on a stable container (`.mdx-content`) and allow cascade to handle children.
- If inline style is necessary, update only when props change (fontSize, textAlign, bookView…), not on arbitrary DOM mutations.

Safer pattern:

```ts
// Observe the specific editor root and throttle to animation frame
useEffect(() => {
  const editorRoot = document.querySelector('.mdxeditor-root-contenteditable');
  if (!editorRoot) return;

  const applyDynamicStyles = () => {
    const content = editorRoot.querySelector('.mdx-content') as HTMLElement | null;
    if (!content) return;
    content.style.fontSize = `${fontSize}px`;
    content.style.textAlign = textAlign;
    if (bookView) {
      content.style.maxWidth = bookViewWidth || '5.5in';
      content.style.paddingLeft = content.style.paddingRight = bookViewMargin || '0.5in';
      content.style.margin = '0 auto';
    } else {
      content.style.maxWidth = content.style.paddingLeft = content.style.paddingRight = content.style.margin = '';
    }
  };

  applyDynamicStyles();

  let raf = 0;
  const observer = new MutationObserver(() => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      // Optionally: no-op here; styles are driven by props, not DOM changes
    });
  });
  observer.observe(editorRoot, { childList: true, subtree: true });
  return () => {
    observer.disconnect();
    if (raf) cancelAnimationFrame(raf);
  };
}, [fontSize, textAlign, bookView, bookViewWidth, bookViewMargin]);
```

Best: eliminate the observer entirely and apply styles only when props change.

- Per-keystroke full-document edits sent to the extension
  - File (webview): `webview-ui/src/components/MDXEditorWrapper.tsx`
  - Lines: \~706–756 `handleMarkdownChange`

```ts
const handleMarkdownChange = useCallback(
  (newMarkdown: string) => {
    // ... escaping/processing ...
    const processedMarkdown = postprocessAngleBrackets(newMarkdown);
    if (processedMarkdown === markdown) return;

    setIsTyping(true);
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      setLiveMarkdown(newMarkdown);
    }, 300);

    postContentEdit(processedMarkdown); // fires on every keystroke
  },
  [markdown],
);
```

- File (extension): `src/extension.ts`
- Lines: \~200–236 `case 'edit'` and \~446–498 `updateTextDocument`

```ts
case 'edit': {
  const content = message.content;
  if (content) {
    const editContent = postprocessAngleBrackets(content);
    await this.updateTextDocument(document, editContent); // applies full replace each time
  }
  break;
}

private async updateTextDocument(document: vscode.TextDocument, newContent: string): Promise<void> {
  if (this.lastWebviewContent === newContent) return;
  this.updatingFromWebview = true;
  this.lastWebviewContent = newContent;
  this.lastSentToWebview = null;
  const edit = new vscode.WorkspaceEdit();
  // full-document replace
  const lastLine = document.lineCount - 1;
  const lastChar = document.lineAt(lastLine).text.length;
  edit.replace(document.uri, new vscode.Range(0, 0, lastLine, lastChar), newContent);
  await vscode.workspace.applyEdit(edit);
  setTimeout(() => { this.updatingFromWebview = false; }, 50);
}
```

Why it hurts:

- Every keystroke triggers: string processing in the webview + postMessage + extension receives + computes a full-document `WorkspaceEdit` replace + VS Code applies it.
- The frequency of this loop is very high; cost scales with document size and number of edits.

Recommendation:

- Debounce or coalesce `postContentEdit` calls by \~150–300ms, keyed by the active document. Only send the latest document state after the user pauses briefly.
- Optionally, send only `content.length` or a hash in debug logs.
- If needed later, explore incremental updates, but simple debouncing provides a large win.

Sketch:

```ts
// MDXEditorWrapper.tsx
const sendEdit = useMemo(() => debounce((content: string) => postContentEdit(content), 200), []);
const handleMarkdownChange = useCallback(
  (newMarkdown: string) => {
    const processedMarkdown = postprocessAngleBrackets(newMarkdown);
    if (processedMarkdown === markdown) return;
    setIsTyping(true);
    // ... typing state debounced update ...
    sendEdit(processedMarkdown); // debounced
  },
  [markdown, sendEdit],
);
```

- Global selectionchange work during typing
  - File: `webview-ui/src/components/MDXEditorWrapper.tsx`
  - Lines: \~750–858 `handleSelectionChange` and effect at \~838–846

```ts
const handleSelectionChange = useCallback(() => {
  if (showCommentModal || showEditModal) return;
  if (currentViewMode !== 'rich-text') {
    setShowFloatingButton(false);
    return;
  }
  const selection = window.getSelection();
  if (selection?.toString().trim() && containerRef.current) {
    const range = selection.getRangeAt(0);
    // ... walk DOM to confirm selection is within editor ...
    const rect = range.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();
    const editorContentRect = containerRef.current.querySelector('.mdx-editor-content')?.getBoundingClientRect();
    // computes positions and sets state
  } else {
    setShowFloatingButton(false);
    if (!showCommentModal && !showEditModal) setSelectedText('');
  }
}, [currentViewMode, showCommentModal, showEditModal]);

useEffect(() => {
  document.addEventListener('selectionchange', handleSelectionChange);
  return () => document.removeEventListener('selectionchange', handleSelectionChange);
}, [handleSelectionChange]);
```

Why it hurts:

- `selectionchange` fires frequently while typing/caret moves. The handler performs DOM queries and layout reads every time.

Recommendation:

- Gate early: if no text is selected (caret only), return immediately before layout work.
- Throttle via `requestAnimationFrame` or a small debounce (\~50ms) and only compute when the selection actually changes (track a lightweight hash of start/end containers/offsets).
- Restrict queries to within the editor container.

Example:

```ts
let pending = false;
const handleSelectionChange = useCallback(() => {
  if (showCommentModal || showEditModal || currentViewMode !== 'rich-text') return;
  const sel = window.getSelection();
  if (!sel || sel.type !== 'Range' || !sel.toString().trim()) {
    setShowFloatingButton(false);
    return;
  }
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    // perform DOM work here
  });
}, [currentViewMode, showCommentModal, showEditModal]);
```

- Additional notes
  - `useViewModeTracking` observer
    - File: `webview-ui/src/hooks/useViewModeTracking.ts` lines \~7–44
    - Observes `.mdxeditor` subtree and attributes; effect re-runs when `onViewModeChange` reference changes. Cleanup disconnects properly. Not a leak, but avoid recreating observer by stabilizing the callback reference (it currently depends on state). This is a minor optimization.
  - Search plugin (`customSearchPlugin.tsx`) avoids re-running search on every content change, and restores `scrollIntoView`. Looks OK.
  - `StatusBar` stats are debounced; minimal impact.

---

**Recommended Fixes (Prioritized)**

1. Remove or reduce per-keystroke logging of full content
   - Change `postToExtension` debug log to avoid logging `message` object. Optionally log only `content.length`.
   - Consider adding a runtime `DEBUG_WEBVIEW` flag to gate verbose logs.
2. Narrow and/or remove the dynamic-styles MutationObserver
   - Prefer applying styles only when the relevant props change.
   - If observation is necessary, observe the editor root only and throttle; avoid per-paragraph updates.
   - Prefer CSS variables/class toggles over DOM writes to many nodes.
3. Debounce webview → extension “edit” messages
   - Debounce `postContentEdit` by \~150–300ms (to match existing `setLiveMarkdown` cadence).
   - This will drastically reduce `WorkspaceEdit` operations in the extension.
4. Throttle selectionchange work
   - Use rAF or a short debounce; bail out early for caret-only.
   - Restrict DOM queries to the editor container.
5. Minor
   - Stabilize `onViewModeChange` (e.g., by referencing a ref or moving mode into the hook) to avoid re-observing.

---

**Why These Fixes Help**

- Logging reduction removes a growing sink of large strings and console rendering costs, which accumulate with time and document size.
- Eliminating the broad MutationObserver prevents an O(mutations × nodes) loop from running on every micro-change, especially costly as content grows.
- Debouncing the “edit” message reduces main thread and extension-side work per keystroke, aligning updates with human-perceptible pauses.
- Throttling selection handling reduces layout thrash and unnecessary DOM reads/writes during typing.

---

**Optional Code Snippets**

- Minimal change to logging (safe default):

```ts
// webview-ui/src/utils/extensionMessaging.ts
try {
  // logger.debug('Posting to extension:', message.command, message);
  logger.debug('Posting to extension:', message.command);
  window.vscodeApi.postMessage(message);
} catch (error) {
  logger.error('Failed to post message to extension:', error);
}
```

- Debounced posting of edits:

```ts
// in MDXEditorWrapper.tsx
const sendEdit = React.useMemo(() => {
  let t: ReturnType<typeof setTimeout> | null = null;
  return (content: string) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => postContentEdit(content), 200);
  };
}, []);

const handleMarkdownChange = useCallback(
  (newMarkdown: string) => {
    const processed = postprocessAngleBrackets(newMarkdown);
    if (processed === markdown) return;
    setIsTyping(true);
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      setLiveMarkdown(newMarkdown);
    }, 300);
    sendEdit(processed);
  },
  [markdown, sendEdit],
);
```

- Remove MutationObserver and rely on prop-driven styles:

```ts
useEffect(() => {
  const el = document.querySelector('.mdx-content') as HTMLElement | null;
  if (!el) return;
  el.style.fontSize = `${fontSize}px`;
  el.style.textAlign = textAlign;
  if (bookView) {
    el.style.maxWidth = bookViewWidth || '5.5in';
    el.style.paddingLeft = el.style.paddingRight = bookViewMargin || '0.5in';
    el.style.margin = '0 auto';
  } else {
    el.style.maxWidth = el.style.paddingLeft = el.style.paddingRight = el.style.margin = '';
  }
}, [fontSize, textAlign, bookView, bookViewWidth, bookViewMargin]);
```

---

**Extension-Side Verbosity (Secondary Concern)**

- File: `src/extension.ts`
  - The message handler writes very verbose lines to `OutputChannel`, including `JSON.stringify(message)` (lines \~184–190), and content-length logs on every edit.
  - While this is less likely to directly affect typing in the webview, it does increase I/O and noise during heavy typing.

Recommendation:

- Disable JSON-stringifying the full message in normal operation; log only the `command` and content length.
- Consider gating verbose logs behind a user setting.

---

**Validation Plan**

- After applying fixes:
  - Verify typing latency over several paragraphs. Expect stable latency with no gradual degradation.
  - Confirm that styles still reflect font size/alignment/book view changes without observing body mutations.
  - Confirm that dirty state and persistence continue to work with debounced edits.
  - Check that selection-based comment UI still appears reliably with throttled selection handling.

---

**Conclusion**

The increasing typing latency stems from compounding per-keystroke work: verbose logging of full content, overly broad mutation observation with style re-application, and unthrottled full-document updates to the extension. The proposed changes are surgical and low-risk, and they directly target the core hot paths. Implementing them should yield an immediate, significant improvement in typing responsiveness.
