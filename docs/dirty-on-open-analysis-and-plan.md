# “Dirty on Open” — Root Cause Analysis and Plan

## Summary

Opening a Markdown file in the custom editor often marks the document dirty without any user edits. Root cause is an early “echo” edit triggered by the webview after the extension sends content on load. The extension then applies a full-document replace, which makes the file dirty even when the text is effectively identical.

## What Happens Today (Open → Update → Edit)

1) Extension sends preprocessed content to the webview on open
   - Source: `src/extension.ts` → `sendContentToWebview()`
   - Behavior: Reads the file, then escapes `<` via `preprocessAngleBrackets(content)` before posting `command: 'update'` to the webview. It also sets `this.lastSentToWebview = content` (the unescaped/original text).

2) Webview receives the `update` and sets editor state
   - Source: `webview-ui/src/EditorApp.tsx` → on `message.command === 'update'` → `setMarkdown(message.content)`.
   - That `markdown` prop (escaped) is passed into `MDXEditorWrapper` which renders `<MDXEditor markdown={markdown} onChange={handleMarkdownChange} … />`.

3) MDXEditor fires an initial onChange (normalization/initialization side-effects)
   - Source: `webview-ui/src/components/MDXEditorWrapper.tsx` → `handleMarkdownChange(newMarkdown)`.
   - The handler always postprocesses MDX content before syncing: `const processedMarkdown = postprocessAngleBrackets(newMarkdown)`.
   - It then checks for changes using: `const hasChanges = processedMarkdown !== markdown` (note: compares unescaped vs escaped).
   - Because `markdown` prop is the preprocessed/escaped version from the extension, this comparison often returns true even if the effective content is identical (e.g., differing only by `\<` vs `<`).
   - Result: The webview sends `command: 'edit'` with the unescaped content back to the extension (`postContentEdit(processedMarkdown)`).

4) Extension applies a full-document edit with identical content
   - Source: `src/extension.ts` → `updateTextDocument()`:
     - Replaces the entire document with `newContent` and calls `workspace.applyEdit(edit)`.
     - There is no early-return guard for “no-op” (when `document.getText() === newContent`).
     - Even if the text is the same, VS Code still records an edit/undo step, marking the file dirty immediately.

## Primary Root Causes

- Preprocess/postprocess mismatch in change detection
  - Webview compares `postprocessAngleBrackets(newMarkdown)` to the raw escaped `markdown` prop, so it sees a “change” where there is none.

- MDXEditor initial normalization triggers onChange on mount
  - MDXEditor and/or plugins may normalize the tree on first render, firing an onChange before the user types.

- Extension applies no-op edits
  - `updateTextDocument()` does not guard against no-op replacements, so it marks the doc dirty even when the text is unchanged.

## Contributing Factors

- Duplicate escaping responsibilities
  - Extension escapes before sending to the webview; the webview also has its own pre/post functions and logic.

- Echo-prevention is incomplete for this path
  - Extension has `lastSentToWebview`/`lastWebviewContent` echo guards, but not a direct “no-op edit” check.

## Plan of Action (Concise)

P0 — Prevent no-op edits from marking files dirty (extension)
- Add an early-return guard in `updateTextDocument()`:
  - If `document.getText() === newContent`, skip the edit entirely.
  - Optional: also skip when `newContent === this.lastSentToWebview`.

P0 — Fix change detection on initial load (webview)
- In `MDXEditorWrapper.handleMarkdownChange` compare normalized forms on both sides:
  - Change `const hasChanges = processedMarkdown !== markdown;` to
    `const hasChanges = postprocessAngleBrackets(newMarkdown) !== postprocessAngleBrackets(markdown);`
  - This treats “escape-only” differences as no-ops.

P1 — Ignore the first onChange after programmatic set (webview)
- Track an `ignoreNextChangeRef` set to `true` when applying external `setMarkdown()` (on receiving `update`).
- In `handleMarkdownChange`, if `ignoreNextChangeRef.current` is true, set it to false and return early (do not send `edit`).
  - This protects against MDXEditor’s initial normalization pass causing a spurious sync.

P1 — Align escaping responsibilities
- Keep extension-side escaping before sending to guarantee safe initial render.
- In the webview, ensure change detection always operates on the same logical representation (postprocessed on both sides) to avoid “escape-only” diffs.

P2 — Instrumentation and verification
- Add debug logs around the first 1–2 seconds after `update`:
  - Log any incoming `edit` events and whether the change is a no-op vs real diff.
- Manual QA: open files containing `<`, directives `{{…}}`, and complex lists; verify no immediate dirty state.

## Implementation Notes (Pointers)

- Extension guard (no-op edit): `src/extension.ts` in `updateTextDocument()`
  ```ts
  private async updateTextDocument(document: vscode.TextDocument, newContent: string): Promise<void> {
    // Skip when no actual change
    if (document.getText() === newContent) {
      logger.debug('Skipping document update - content identical');
      return;
    }
    // Optional: also skip echo of last sent
    if (this.lastSentToWebview && this.lastSentToWebview === newContent) {
      logger.debug('Skipping document update - equals lastSentToWebview');
      return;
    }
    …
  }
  ```

- Webview normalized comparison: `webview-ui/src/components/MDXEditorWrapper.tsx`
  ```ts
  const processedMarkdown = postprocessAngleBrackets(newMarkdown);
  const baseline = postprocessAngleBrackets(markdown);
  const hasChanges = processedMarkdown !== baseline;
  if (!hasChanges) return;
  ```

- Webview ignore-first-change pattern
  ```ts
  const ignoreNextChangeRef = useRef(false);

  // When applying external changes
  useEffect(() => {
    if (editorRef.current && markdown !== undefined) {
      if (editorRef.current.getMarkdown() !== markdown) {
        ignoreNextChangeRef.current = true;
        editorRef.current.setMarkdown(markdown);
      }
    }
  }, [markdown]);

  const handleMarkdownChange = (newMarkdown: string) => {
    if (ignoreNextChangeRef.current) {
      ignoreNextChangeRef.current = false;
      return; // do not post 'edit'
    }
    …
  };
  ```

## Acceptance Criteria

- Opening any .md file no longer marks it dirty unless content truly changes.
- No `edit` message is sent immediately following an `update` unless there is a real semantic diff (not just escaping).
- User edits still sync promptly and mark the file dirty as expected.

## Additional Suspects to Monitor (lower likelihood)

- Plugin-induced normalization on mount (e.g., lists, tables) altering serialization.
- Trailing newline normalization between MDXEditor and VS Code.
- Double-sending `edit` from both wrapper and parent — ensure only one path posts for comment insertions.

These should be covered by the P0/P1 safeguards even if they occur.

