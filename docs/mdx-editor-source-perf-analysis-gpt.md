# MDXEditor Source Performance Analysis (Typing Latency)

This report analyzes typing latency in the MDXEditor source (./editor). The behavior reproduces in MDXEditor’s own playground but not in the Lexical playground, indicating the issue lies in MDXEditor’s pipeline built on top of Lexical.

Focus: per‑keystroke side‑effects, re-render cycles, and subscriptions that run as you type, especially work that scales with document size or accumulates over time.


## Executive Summary

- The core design synchronously re‑exports the entire Lexical tree to Markdown on every content update (not just on idle). This is O(n) in document size and grows as you keep typing, matching the “great at first, slowly degrades as I continue typing” pattern.
- The export path does a full mdast rebuild, runs tree fix‑ups (whitespace fixes, HTML collapsing), and then serializes to Markdown with mdast‑util‑to‑markdown, all on the main thread.
- This export is unthrottled and fires on every Lexical update that has dirty nodes; even tiny insertions trigger a full export.
- Secondary work (selection handling, nested editor listeners, code block editors) is comparatively smaller but can compound in specific cases (e.g., editing code blocks).

Primary Recommendation: Debounce or idle‑schedule Markdown export (and onChange) rather than exporting synchronously on each editor update. Optionally provide a configuration to choose eager export (current), idle export, or manual export.


## Root Cause: Eager Full‑Tree Export on Every Content Update

- File: `editor/src/plugins/core/index.ts`
- Lines: 525–569

```ts
return rootEditor.registerUpdateListener(({ dirtyElements, dirtyLeaves, editorState }) => {
  const err = r.getValue(markdownProcessingError$)
  if (err !== null) return
  if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return

  let theNewMarkdownValue!: string

  editorState.read(() => {
    const lastChild = $getRoot().getLastChild()
    if (lastChild instanceof DecoratorNode) {
      rootEditor.update(() => { $getRoot().append($createParagraphNode()) }, { discrete: true })
    }
    theNewMarkdownValue = exportMarkdownFromLexical({
      root: $getRoot(),
      visitors: r.getValue(exportVisitors$),
      jsxComponentDescriptors: r.getValue(jsxComponentDescriptors$),
      toMarkdownExtensions: r.getValue(toMarkdownExtensions$),
      toMarkdownOptions: r.getValue(toMarkdownOptions$),
      jsxIsAvailable: r.getValue(jsxIsAvailable$)
    })
  })

  r.pub(markdown$, theNewMarkdownValue.trim())
  r.pub(initialMarkdownNormalize$, false)
})
```

Why this is costly:
- Runs on every update with any dirty nodes (i.e., most keystrokes).
- Exports the entire tree (O(n)) then serializes to Markdown.
- Includes mdast fixes and transformations on every run.
- The extra `rootEditor.update` when the last node is a DecoratorNode produces an additional update cycle that can trigger a follow‑up export in some scenarios.


## Deep Dive of Export Path

- File: `editor/src/exportMarkdownFromLexical.ts`
- Functions: `exportLexicalTreeToMdast` → `toMarkdown()`

Highlights:
- Rebuilds mdast from scratch by walking the whole Lexical tree every time.
- Sorts visitors (minor cost), performs whitespace fixes (`fixWrappingWhitespace`), collapses nested HTML, and optionally converts underline JSX to HTML.
- Serializes mdast to Markdown via `mdast-util-to-markdown`.

This is all main‑thread work; as content grows, each export takes longer, which shows up as increasing input latency.


## Secondary Contributors (Lower Impact but Notable)

- Selection and active‑editor listeners:
  - File: `editor/src/plugins/core/index.ts` (e.g., Lines 489+, 614+, 624+)
  - Lightweight reads to update selection/UI state; not heavy compared to export.

- Nested editors (e.g., directives/JSX/code blocks) register their own update listeners; these run additional small work on updates.

- CodeMirror code blocks:
  - File: `editor/src/plugins/codemirror/CodeMirrorEditor.tsx`
  - `EditorView.updateListener` calls `setCode` on every keystroke in a code block, which updates the Lexical node → triggers export again. High cost only when editing large code blocks.

- Visitor sorting and join logic:
  - File: `editor/src/exportMarkdownFromLexical.ts` (visitor sorting, `shouldJoin`/`join` passes)
  - Small overhead per export compared to full tree traversal and serialization.


## Why Lexical Playground Doesn’t Show It

Lexical itself does not export the entire document on each change. It updates its internal state incrementally and renders efficiently. MDXEditor adds an eager “serialize everything to Markdown” step on every content update, which is the source of the accumulating cost.


## Recommendations (Actionable)

1) Add an export throttle/idle scheduling layer
- Debounce export+onChange (e.g., 200–300ms) or use `requestIdleCallback`/`setTimeout` to coalesce many keystrokes into a single export. Provide a parameter to corePlugin to select:
  - `onChangeMode: 'eager' | 'idle' | 'manual'`
  - Eager = current behavior (for small docs/tests), Idle = schedule export on idle, Manual = consumers call `getMarkdown()` when needed or subscribe to a debounced signal.
- Implementation sketch (within `registerUpdateListener`):

```ts
let exportScheduled = false
let lastEditorState: any = null

return rootEditor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves }) => {
  if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return
  lastEditorState = editorState
  if (exportScheduled) return
  exportScheduled = true
  ;(window.requestIdleCallback ?? ((cb: any) => setTimeout(cb, 200)))(() => {
    exportScheduled = false
    lastEditorState?.read(() => {
      const md = exportMarkdownFromLexical(/* ... */)
      r.pub(markdown$, md.trim())
      r.pub(initialMarkdownNormalize$, false)
    })
  })
})
```

2) Optional: Skip export for trivial changes
- Inspect tags available in `registerUpdateListener` payload (e.g., history merge vs push) and bail for certain non‑content tags.
- Maintain a fast change detector (e.g., per‑block hash cache) to avoid full export when edits affect only formatting that doesn’t change Markdown, but this is more complex and likely not needed once throttled.

3) Optional: Cache or reuse sorted visitors
- Cache a pre‑sorted `visitors` array to avoid sorting on every export (minor win).

4) Optional: Break export across frames for very large docs
- If exporting still takes too long on huge documents, split the work using `requestIdleCallback` chunks or move export to a Web Worker and post the result back (requires moving mdast utilities to worker‑friendly context).

5) CodeMirror/code blocks
- Acceptable as is, but note that while typing in code blocks, every keystroke also triggers a Lexical update + export. Throttling/idle export as above resolves the user‑perceived latency.


## Validation Plan
- Add simple instrumentation around the export call (performance.now) to log export time as content grows. Expect export time to rise with content size. After throttling/idle, user typing latency should remain flat while export time happens out of the keystroke critical path.
- Test with:
  - Small doc, fast typing → ensure no perceivable lag
  - Large doc (many paragraphs) → ensure typing remains responsive; export time occurs after brief idle
  - Code block editing → ensure responsiveness unchanged (export coalesced)


## Conclusion
The core bottleneck is synchronous, eager full‑tree export to Markdown on every content update. Moving export (and thus `onChange`) off the keystroke path by throttling or idle‑scheduling will remove the progressive input latency while preserving MDXEditor’s functionality. Secondary optimizations (visitor caching, skipping trivial updates, worker offload) can further help for very large documents but are not required to resolve the accumulating latency pattern.
