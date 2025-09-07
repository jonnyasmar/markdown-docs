# Typing Performance Deep Dive (Targeted on Keystroke Side‑Effects)

This investigation focuses narrowly on side‑effects of typing: immediate onChange work, rerender paths, and event bindings that run per keystroke (or near it). It builds on prior analysis and your new observations.

Key observations to incorporate:
- Narrowing the MutationObserver scope had no effect; removing too much breaks view-mode detection.
- Forcing `usePlugins` to initialize only once had no effect.
- File size (even massive) doesn’t change the pattern: fast at first, then latency slowly grows as you type.
- Many comments have some cost but don’t explain the accumulating latency.

The following findings concentrate on per-keystroke code paths that do work proportional to the entire document and/or accumulate indirect costs.


## 1) Webview-side string processing on every keystroke (O(n))

- File: `webview-ui/src/components/MDXEditorWrapper.tsx`
- Lines: 664–707 (handler)

```ts
const handleMarkdownChange = useCallback((newMarkdown: string) => {
  // ...
  // Apply postprocessing in all modes to clean up unwanted escaping
  const processedMarkdown = postprocessAngleBrackets(newMarkdown);
  // ...
  sendEditTimeoutRef.current = setTimeout(() => {
    postContentEdit(processedMarkdown);
  }, 200);
}, [markdown]);
```

- File: `webview-ui/src/components/plugins/escapeCharPlugin.tsx`
- Lines: 89–118

```ts
export const postprocessAngleBrackets = (markdown: string): string => {
  // 1) Restore curly brace patterns (regex with global matches)
  // 2) Unescape underscores in curly braces (regex)
  // 3) Remove backslash escaping from '<' (regex)
  // 4) Remove backslash escaping from '[', ']', '|' (regex)
  return result;
};
```

Why this matters:
- `postprocessAngleBrackets` traverses the entire string multiple times with global regex/replace. It runs on every keystroke inside `handleMarkdownChange`.
- As the document grows, per-keystroke cost rises proportionally to content length (O(n)). This produces the “starts great, degrades gradually as I keep typing” pattern, even on already-large files.
- Extension also postprocesses on `edit` (see Section 4), so the webview is duplicating work already done server-side.

Recommendation:
- Stop running `postprocessAngleBrackets` in the webview on every keystroke. Send raw `newMarkdown` to the extension and let the extension perform its postprocess before writing to the TextDocument (it already does).
- If any client-side rendering requires postprocessing, add a fast pre-check (indexOf) to avoid regex when not needed:

```ts
const needsPost = newMarkdown.includes('\\<') || newMarkdown.includes('{{') || newMarkdown.includes('\\_')
  || newMarkdown.includes('\\[') || newMarkdown.includes('\\]') || newMarkdown.includes('\\|');
const processedMarkdown = needsPost ? postprocessAngleBrackets(newMarkdown) : newMarkdown;
```

Impact: Eliminates the heaviest webview work per keystroke.


## 2) StatusBar stats compute on full content (O(n)) during/after typing

- File: `webview-ui/src/components/StatusBar.tsx`
- Lines: 9–20

```ts
const stats = useEditorStatus(
  content,
  selectedText,
  isTyping,
  editorRef as React.RefObject<{ getMarkdown?: () => string }>,
);
```

- File: `webview-ui/src/hooks/editor/useEditorStatus.ts`
- Lines: 28–62, 74–99

```ts
const calculateStats = useCallback(() => {
  const markdownContent = editorRef?.current?.getMarkdown?.() ?? content;
  // charCount = content.length, words = split/regex (O(n))
  setStats({ wordCount, charCount, readingTime });
}, [content, editorRef]);

useEffect(() => {
  if (statsTimeoutRef.current) clearTimeout(statsTimeoutRef.current);
  statsTimeoutRef.current = setTimeout(calculateStats, 250);
  return () => { clearTimeout(statsTimeoutRef.current); };
}, [content, calculateStats, isTyping]);
```

Why this matters:
- Although debounced, it processes the entire content string. As text grows, this cost grows. When you pause briefly while typing, the 250ms job runs and can introduce jank.

Recommendations:
- Gate heavy stats when `isTyping` is true; compute only after a longer idle period, e.g., 500–800ms.
- Optimize word counting (you already improved it); consider only computing `charCount` during typing and delay `wordCount/readingTime` until idle.
- If acceptable, compute against `content` (the prop) instead of pulling `editorRef.getMarkdown()` every time to avoid extra DOM/bridge costs; or add a fast length-only branch while typing.


## 3) Selectionchange path and layout queries

- File: `webview-ui/src/components/MDXEditorWrapper.tsx`
- Lines: 711–812 (handler)

Highlights:
- Listener attached to `document` for `selectionchange`.
- Runs on every caret move (every keystroke), but early-bails when there is no selection.
- When text is selected, it does layout work: `range.getBoundingClientRect()`, `.querySelector`, `.getBoundingClientRect()` and then sets floating button state.

Why this matters:
- The no-selection case is fast. The expensive path is selection present. This doesn’t explain a per‑keystroke accumulation but contributes when users select text and keep typing.

Recommendations:
- Keep the early bail; consider temporarily disabling the selection handler while the comment modal is hidden and `isTyping` is true, or coalesce with a throttle bigger than one RAF (e.g., 100–150ms) when selection is non-empty.


## 4) Extension also postprocesses content (duplicate work)

- File: `src/extension.ts`
- Lines: 180–212

```ts
case 'edit': {
  const content = message.content;
  if (content) {
    const editContent = postprocessAngleBrackets(content);
    await this.updateTextDocument(document, editContent);
  }
}
```

- File: `src/extension.ts`
- Lines: 392–420 (sending updates)

```ts
// Preprocess content when sending to webview
const displayContent = preprocessAngleBrackets(content);
void webviewPanel.webview.postMessage({ command: 'update', content: displayContent, ... });
```

Why this matters:
- With (1), the webview postprocesses on every keystroke. The extension then postprocesses again. That’s a complete duplication of O(n) processing. Removing the webview-side postprocess helps both ends (webview thread latency and extension side load frequency due to debounce pressure).

Recommendation:
- Make the extension the single source for postprocess/preprocess. Webview should keep typing light and local.


## 5) Rerender cycles: what re-renders per keystroke?

- `MDXEditorWrapper` state updates on every change: `isTyping` toggles true immediately (then false at 300ms), and `liveMarkdown` updates at 300ms.
- `MDXEditor` receives `markdown={markdown}` (prop from EditorApp), not `liveMarkdown`, so MDXEditor doesn’t re-render due to text on keystrokes from this prop (good). It re-renders due to parent rerender but likely shallow.
- `plugins={plugins}` are memoized and not rebuilt per keystroke in your test (usePlugins dep array emptying confirmed no effect), so plugin init isn’t churning.
- `StatusBar` props change with `isTyping` and `selectedText` and calls into `useEditorStatus`, which does the heavy work noted above.

Takeaway:
- The dominant rerender-linked cost is StatusBar stats computation; otherwise, the keystroke path is dominated by string processing in (1).


## 6) Event binding: potential accumulation?

Audit summary:
- `selectionchange`, `keydown`, `keyup`, `click`, `mousedown/mousemove/mouseup` are all added with React effects that clean up previous handlers on dependency change or unmount. No obvious leaks detected.
- `customSearchPlugin` attaches a capture `keydown` listener once on init and cleans it in `destroy()`. You reported forcing plugins to init once had no effect, which reduces suspicion here.

Notes:
- Consolidating keyboard listeners can reduce overhead, but given your tests, it likely won’t cure the accumulating latency alone.


## 7) Comments: positions and parsing

- `commentPositions` now caches regex (good), but it still does `markdown.search` per comment (cheap when comments are few, acceptable).
- Parsing runs after 800ms of idle and is now deduped (by content string), so it shouldn’t affect steady typing.

Conclusion on comments:
- Matches your observation: some impact with many comments but not the primary driver of progressive typing latency.


## Concrete Fix Plan (targeted to the keystroke path)

1) Remove webview-side `postprocessAngleBrackets` from `handleMarkdownChange` and send raw `newMarkdown` to the extension.
- File: `webview-ui/src/components/MDXEditorWrapper.tsx:664–707`
- Replace:

```ts
const processedMarkdown = postprocessAngleBrackets(newMarkdown);
...
postContentEdit(processedMarkdown);
```

with:

```ts
// Only post raw markdown; extension handles postprocessing
postContentEdit(newMarkdown);
```

Optionally, add a guarded version if you must keep it client-side for edge cases (see Section 1 pre-check).

2) Defer heavy StatusBar stats until idle and/or split work
- File: `webview-ui/src/hooks/editor/useEditorStatus.ts`
- Only compute `charCount` while `isTyping` (fast), delay `wordCount`/`readingTime` until `isTyping` has been false for 500–800ms.
- Or increase the debounce to 500ms+ and skip if `isTyping` is true.

3) Keep selection work cheap on text selection
- Ensure no selection → fast bail.
- When selection exists, maintain the RAF throttle; optional: add a 100–150ms throttle when selection exists to avoid bursts.

4) Keep regex caching and comment parsing dedupe (already done) and in-place sort fix (done).


## Why this matches your observations
- If mutation observer scope changes and plugin re-inits don’t affect the pattern, the problem isn’t those.
- If massive docs still feel great at the beginning and degrade as you continue typing, it means the per-keystroke cost grows with the content you’re actively editing (or the amount of processed text), not just static file size or comment count.
- Continuous O(n) transforms of the entire string on every keystroke (Section 1) exactly fit this pattern and are the biggest lever.


## Suggested Validation
- Temporarily bypass `postprocessAngleBrackets` in the webview and post raw edits; measure input latency. You should see a step-change improvement and much flatter degradation.
- Profile the main thread while typing to confirm heavy time in regex replaces when the current path is active.
- Increase StatusBar debounce to 800ms and/or compute only `charCount` during typing; confirm reduced stutter when pausing.


## References
- Webview typing handler: `webview-ui/src/components/MDXEditorWrapper.tsx:664–707`
- Postprocess implementation: `webview-ui/src/components/plugins/escapeCharPlugin.tsx:89–118`
- StatusBar stats: `webview-ui/src/hooks/editor/useEditorStatus.ts`
- Extension edit postprocess: `src/extension.ts:180–212`
- Extension preprocess (webview update): `src/extension.ts:392–420`


## Final Takeaway
The accumulating latency is primarily explained by per‑keystroke, full‑document string processing in the webview, compounded by postprocessing duplication in the extension and background stats computation. Shifting postprocessing entirely to the extension and making StatusBar computations more idle‑biased should stabilize typing performance and eliminate the progressive slow‑down you’re experiencing.
