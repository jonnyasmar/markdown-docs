# Executable Developer Stories

## Technical Debt Remediation - Ready for Implementation

**Scrum Master**: Bob
**Sprint Planning**: Ready for Assignment
**Story Status**: Draft Complete
**Created**: September 4, 2025

---

# 🎯 **STORY EXECUTION ORDER**

**CRITICAL**: Stories must be executed in this exact sequence to avoid conflicts:

1. **Story 2A** ← Start here (safest, zero dependencies)
2. **Stories 1A → 1B → 1C** (SyncManager removal sequence)
3. **Stories 3A → 3B** (Message handling cleanup)
4. **Story 4A** (Echo prevention enhancement)
5. **Stories 5A, 6A** (Organization improvements - can be done in parallel)

---

# 🟢 **STORY 2A: Remove Legacy MarkdownEditorProvider**

## **Story Details**

- **Story ID**: TDR-2A
- **Epic**: Technical Debt Remediation
- **Priority**: HIGH (safest first implementation)
- **Effort**: 0.5 days
- **Dependencies**: None

## **User Story**

> **As a** developer maintaining the extension codebase
> **I want** the obsolete MarkdownEditorProvider removed
> **So that** the codebase is clean and contributors aren't confused by unused components

## **Business Value**

- **Impact**: Removes confusion for new developers
- **Risk**: ZERO - file is completely unused
- **ROI**: Pure cleanup with immediate maintainability benefit

## **Acceptance Criteria**

### **✅ MUST HAVE**

- [ ] File `src/editors/markdownEditor.ts` is deleted
- [ ] Directory `src/editors/` is removed (if empty after deletion)
- [ ] TypeScript compilation succeeds without errors
- [ ] Extension builds and packages successfully
- [ ] All existing functionality remains intact

### **🔍 VERIFICATION STEPS**

- [ ] Run `rg "MarkdownEditorProvider|markdownEditor" --type ts` returns no results
- [ ] Run `npm run build` completes successfully
- [ ] Extension loads in VS Code without errors
- [ ] Can open markdown files with existing editor

## **Implementation Tasks**

### **Task 1: Verify No References**

```bash
# Exact commands to run:
cd /Users/jonnyasmar/dev/markdown-docs
rg "MarkdownEditorProvider" --type ts
rg "markdownEditor" --type ts
rg "editors/markdownEditor" --type ts
```

**Expected Result**: No matches found

### **Task 2: Safe Delete with Backup**

```bash
# Create backup first
git mv src/editors/markdownEditor.ts src/editors/markdownEditor.ts.BACKUP

# Verify build still works
npm run build

# If build succeeds, permanent delete
rm src/editors/markdownEditor.ts.BACKUP

# If src/editors/ is now empty, remove it
ls src/editors/
# If empty:
rmdir src/editors/
```

### **Task 3: Verification Testing**

```bash
# Verify clean compilation
npm run build
echo "Build exit code: $?"

# Verify TypeScript compilation
npx tsc --noEmit
echo "TypeScript exit code: $?"

# Package extension (final test)
npx vsce package --no-yarn
echo "Package exit code: $?"
```

### **Task 4: Commit Changes**

```bash
git add -A
git commit -m "Remove obsolete MarkdownEditorProvider

- Deleted src/editors/markdownEditor.ts (131 lines)
- File was never used or imported
- Contained only TODO stubs
- Zero functional impact

Refs: TDR-2A"
```

## **Definition of Done**

- [ ] File deleted and committed to git
- [ ] Build pipeline remains green
- [ ] No broken references in codebase
- [ ] Extension functionality unaffected
- [ ] Documentation updated if referenced anywhere

---

# 🔴 **STORY 1A: Remove SyncManager File and Imports**

## **Story Details**

- **Story ID**: TDR-1A
- **Epic**: Technical Debt Remediation
- **Priority**: CRITICAL
- **Effort**: 1 day
- **Dependencies**: Must complete Story 2A first

## **User Story**

> **As a** developer using the Markdown Docs extension
> **I want** SyncManager removed from the codebase
> **So that** memory leaks are eliminated and the architecture is simplified

## **Business Value**

- **Impact**: Eliminates memory leaks causing typing performance degradation
- **Risk**: LOW - SyncManager is redundant to VS Code's native functionality
- **ROI**: HIGH - Fixes major user pain point

## **Acceptance Criteria**

### **✅ MUST HAVE**

- [ ] File `webview-ui/src/utils/syncManager.ts` is deleted (340 lines removed)
- [ ] All SyncManager imports removed from `MDXEditorWrapper.tsx`
- [ ] All SyncManager references removed from codebase
- [ ] TypeScript compilation succeeds
- [ ] Webview bundle builds successfully

### **🔍 VERIFICATION STEPS**

- [ ] `rg "SyncManager|syncManager" --type ts` returns no results
- [ ] `rg "from.*syncManager" --type ts` returns no results
- [ ] `npm run build` in both root and webview-ui succeeds
- [ ] Bundle size reduced by approximately 15KB

## **Implementation Tasks**

### **Task 1: Locate All SyncManager References**

```bash
cd /Users/jonnyasmar/dev/markdown-docs
rg "SyncManager" --type ts -n
rg "syncManager" --type ts -n
rg "from.*syncManager" --type ts -n
```

**Expected locations**:

- `webview-ui/src/utils/syncManager.ts` (definition)
- `webview-ui/src/components/MDXEditorWrapper.tsx` (import and usage)

### **Task 2: Remove SyncManager Imports from MDXEditorWrapper**

**File**: `webview-ui/src/components/MDXEditorWrapper.tsx`

**Find and remove line \~55**:

```typescript
// REMOVE THIS LINE:
import { SyncManager, SyncState } from '../utils/syncManager';
```

### **Task 3: Remove SyncManager State Variables**

**File**: `webview-ui/src/components/MDXEditorWrapper.tsx`

**Find and remove around line 1846**:

```typescript
// REMOVE THESE LINES:
const syncManagerRef = useRef<SyncManager | null>(null);
const [syncState, setSyncState] = useState<SyncState>(SyncState.IDLE);
```

### **Task 4: Remove SyncManager Initialization useEffect**

**File**: `webview-ui/src/components/MDXEditorWrapper.tsx`

**Find and remove entire useEffect block around lines 1869-1895**:

```typescript
// REMOVE THIS ENTIRE useEffect BLOCK:
useEffect(() => {
  if (typeof window !== 'undefined' && window.vscodeApi && !syncManagerRef.current) {
    const syncManager = new SyncManager(window.vscodeApi);
    // ... entire block through cleanup return
  }
}, []);
```

### **Task 5: Delete SyncManager File**

```bash
cd /Users/jonnyasmar/dev/markdown-docs
rm webview-ui/src/utils/syncManager.ts
```

### **Task 6: Verification Build**

```bash
# Build webview
cd webview-ui
npm run build
echo "Webview build exit code: $?"

# Build extension
cd ..
npm run build
echo "Extension build exit code: $?"

# Check bundle size reduction
ls -la dist/webview-ui/index.js
```

### **Task 7: Final Verification**

```bash
# Verify no SyncManager references remain
rg "SyncManager|syncManager" --type ts
# Expected: No matches

# Verify TypeScript compilation
npx tsc --noEmit
echo "TypeScript verification: $?"
```

## **Definition of Done**

- [ ] SyncManager file deleted (340 lines removed)
- [ ] All imports and references removed
- [ ] Clean TypeScript compilation
- [ ] Webview bundle builds and is smaller
- [ ] No "SyncManager" found in codebase search

---

# 🔴 **STORY 1B: Replace SyncManager Usage with Direct Calls**

## **Story Details**

- **Story ID**: TDR-1B
- **Epic**: Technical Debt Remediation
- **Priority**: CRITICAL
- **Effort**: 1 day
- **Dependencies**: Must complete Story 1A first

## **User Story**

> **As a** user typing in the markdown editor
> **I want** direct message posting instead of SyncManager
> **So that** my typing performance is immediate and doesn't degrade over time

## **Business Value**

- **Impact**: Eliminates performance bottleneck in typing experience
- **Risk**: LOW - Direct replacement of existing functionality
- **ROI**: HIGH - Immediate performance improvement for users

## **Acceptance Criteria**

### **✅ MUST HAVE**

- [ ] All `syncManagerRef.current.sendContentToVSCode()` calls replaced with direct `postMessage`
- [ ] All SyncManager state checks removed
- [ ] Editor typing performance maintained
- [ ] Content synchronization still works
- [ ] Save functionality preserved

### **🔍 VERIFICATION STEPS**

- [ ] Open markdown file and type rapidly - no latency increase
- [ ] Make external file changes - verify sync works
- [ ] Save file - verify content persisted
- [ ] Open multiple editors - verify no conflicts

## **Implementation Tasks**

### **Task 1: Locate SyncManager Usage**

**File**: `webview-ui/src/components/MDXEditorWrapper.tsx`

```bash
cd /Users/jonnyasmar/dev/markdown-docs
rg "syncManagerRef\.current" webview-ui/src/components/MDXEditorWrapper.tsx -n
rg "syncState" webview-ui/src/components/MDXEditorWrapper.tsx -n
```

### **Task 2: Replace Primary Content Sending**

**File**: `webview-ui/src/components/MDXEditorWrapper.tsx`
**Location**: Around line 2004

**FIND**:

```typescript
// Use SyncManager for reliable, batched syncing to VS Code
if (syncManagerRef.current) {
  syncManagerRef.current.sendContentToVSCode(processedMarkdown);
} else {
  // Fallback to direct messaging if SyncManager is not available
  if (typeof window !== 'undefined' && window.vscodeApi) {
    window.vscodeApi.postMessage({
      command: 'edit',
      content: processedMarkdown,
    });
  }
}
```

**REPLACE WITH**:

```typescript
// Direct message posting to VS Code
if (typeof window !== 'undefined' && window.vscodeApi) {
  window.vscodeApi.postMessage({
    command: 'edit',
    content: processedMarkdown,
  });
}
```

### **Task 3: Remove SyncState Checks**

**File**: \`webview-ui/src/components/MDXEditorWrapper.tsx\*\*
**Location**: Around line 1945-1951

**FIND**:

```typescript
// Skip if SyncManager is handling external updates
if (syncState === SyncState.RECEIVING_FROM_VSCODE ||
    syncState === SyncState.APPLYING_EXTERNAL ||
    syncState === SyncState.BLOCKED) {
  logger.debug('SyncManager: Ignoring change during external operation');
  return;
}
```

**REPLACE WITH**:

```typescript
// Note: External update handling now managed by VS Code's CustomTextEditor
// No additional state checking needed
```

### **Task 4: Remove SyncState from useEffect Dependencies**

**Throughout the file, find any useEffect with syncState dependency**:

**FIND patterns like**:

```typescript
}, [markdown, syncState, /* other deps */]);
```

**REPLACE WITH**:

```typescript
}, [markdown, /* other deps */]);
```

### **Task 5: Test Content Synchronization**

```bash
# Start extension in debug mode
cd /Users/jonnyasmar/dev/markdown-docs
npm run compile
# Then F5 in VS Code to test
```

**Manual Testing Checklist**:

- [ ] Open a markdown file
- [ ] Type rapidly (500+ characters) - verify no lag
- [ ] Edit file externally - verify changes sync
- [ ] Make edits in multiple tabs - verify behavior
- [ ] Save and reload - verify persistence

### **Task 6: Commit Changes**

```bash
git add webview-ui/src/components/MDXEditorWrapper.tsx
git commit -m "Replace SyncManager usage with direct postMessage calls

- Replaced syncManagerRef.current.sendContentToVSCode() with direct window.vscodeApi.postMessage()
- Removed SyncState checks and dependencies
- Eliminated performance bottleneck in typing experience
- Maintains all synchronization functionality through VS Code native handling

Refs: TDR-1B"
```

## **Definition of Done**

- [ ] All SyncManager method calls replaced
- [ ] SyncState references removed
- [ ] Content sync functionality verified working
- [ ] Typing performance improved (no observable latency)
- [ ] External file sync still functional

---

# 🔴 **STORY 1C: Clean Extension Message Handling**

## **Story Details**

- **Story ID**: TDR-1C
- **Epic**: Technical Debt Remediation
- **Priority**: CRITICAL
- **Effort**: 0.5 days
- **Dependencies**: Must complete Stories 1A and 1B first

## **User Story**

> **As a** developer debugging extension message flow
> **I want** single message format handling in the extension
> **So that** message processing is predictable and maintainable

## **Business Value**

- **Impact**: Simplifies debugging and future development
- **Risk**: VERY LOW - removing unused code paths
- **ROI**: MEDIUM - improves developer experience

## **Acceptance Criteria**

### **✅ MUST HAVE**

- [ ] Remove dual message format support from `src/extension.ts`
- [ ] Extension only handles `message.content` (not `message.payload?.content`)
- [ ] Message handling logic simplified
- [ ] All existing functionality preserved
- [ ] Clean TypeScript compilation

### **🔍 VERIFICATION STEPS**

- [ ] Extension loads without errors
- [ ] Typing in editor updates VS Code document
- [ ] Save operations work correctly
- [ ] Comment operations still function

## **Implementation Tasks**

### **Task 1: Locate Dual Format Handling**

**File**: `src/extension.ts`
**Location**: Lines 204-219 (edit message handler)

```bash
cd /Users/jonnyasmar/dev/markdown-docs
rg "message\.payload\?\.content" src/extension.ts -n
rg "message\.content.*message\.payload" src/extension.ts -A 3 -B 3
```

### **Task 2: Simplify Edit Message Handler**

**File**: `src/extension.ts`
**Location**: Around lines 204-219

**FIND**:

```typescript
case 'edit': {
  // Handle both SyncManager format and direct format
  const content = message.content ?? message.payload?.content;
  this.outputChannel.appendLine(`Edit message received, content length: ${content?.length ?? 0}`);
  this.outputChannel.appendLine(
    `Message format - content: ${String(message.content !== undefined)}, ` +
      `payload.content: ${String(message.payload?.content !== undefined)}`,
  );

  if (content) {
    const editContent = postprocessAngleBrackets(content);
    this.outputChannel.appendLine(`About to update TextDocument with content length: ${editContent.length}`);
    await this.updateTextDocument(document, editContent);
    this.outputChannel.appendLine(`TextDocument updated, isDirty: ${String(document.isDirty)}`);
  }
  break;
}
```

**REPLACE WITH**:

```typescript
case 'edit': {
  this.outputChannel.appendLine(`Edit message received, content length: ${message.content?.length ?? 0}`);

  if (message.content) {
    const editContent = postprocessAngleBrackets(message.content);
    this.outputChannel.appendLine(`About to update TextDocument with content length: ${editContent.length}`);
    await this.updateTextDocument(document, editContent);
    this.outputChannel.appendLine(`TextDocument updated, isDirty: ${String(document.isDirty)}`);
  }
  break;
}
```

### **Task 3: Simplify Save Message Handler**

**File**: `src/extension.ts`
**Location**: Around lines 221-241

**FIND**:

```typescript
case 'save':
  // With CustomTextEditorProvider, VS Code handles saving automatically
  // Just update TextDocument, VS Code will handle the save operation
  this.outputChannel.appendLine(
    `Save message received: ${message.content ? 'with content' : 'without content'}`,
  );
  if (message.content) {
    const saveContent = postprocessAngleBrackets(message.content);
    await this.updateTextDocument(document, saveContent);

    this.outputChannel.appendLine('Save complete');

    // save the file
    await vscode.workspace.save(document.uri);

    // Send confirmation back to webview to clear dirty state
    void webviewPanel.webview.postMessage({
      command: 'saveComplete',
    });
  }
  break;
```

**REPLACE WITH**:

```typescript
case 'save':
  this.outputChannel.appendLine(
    `Save message received: ${message.content ? 'with content' : 'without content'}`,
  );
  if (message.content) {
    const saveContent = postprocessAngleBrackets(message.content);
    await this.updateTextDocument(document, saveContent);

    this.outputChannel.appendLine('Save complete');

    // Save the file
    await vscode.workspace.save(document.uri);

    // Send confirmation back to webview to clear dirty state
    void webviewPanel.webview.postMessage({
      command: 'saveComplete',
    });
  }
  break;
```

### **Task 4: Update Comment Handler (if needed)**

**File**: `src/extension.ts`
**Location**: Around lines 429-446 (handleCommentOperation)

**Find any similar dual-format patterns**:

```bash
rg "payload\?\.content" src/extension.ts -n
```

**If found, apply same simplification pattern**.

### **Task 5: Update WebviewMessage Interface**

**File**: `src/extension.ts`
**Location**: Lines 7-35 (WebviewMessage interface)

**Review interface to ensure payload is optional/removable**:

```typescript
interface WebviewMessage {
  command: string;
  content?: string;
  payload?: {
    // ← This can potentially be removed
    content?: string;
  };
  // ... rest of interface
}
```

**Consider removing payload property entirely if no other usage**.

### **Task 6: Test Extension Functionality**

```bash
npm run compile
# Then F5 in VS Code to test in Extension Development Host
```

**Manual Testing**:

- [ ] Type in editor - changes appear in VS Code
- [ ] Save file - content persisted
- [ ] Add comments - functionality works
- [ ] Check debug console - clean message logs

### **Task 7: Commit Changes**

```bash
git add src/extension.ts
git commit -m "Simplify extension message handling to single format

- Removed dual message format support (content vs payload.content)
- Extension now only handles message.content directly
- Eliminated SyncManager-specific message format handling
- Simplified edit and save message handlers
- Cleaner debugging output and logic flow

Refs: TDR-1C"
```

## **Definition of Done**

- [ ] Dual format support removed from extension
- [ ] Single message.content handling only
- [ ] Extension functionality fully preserved
- [ ] Clean compilation and runtime
- [ ] Simplified message debugging output

---

# 🟡 **STORY 3A: Create Centralized Message Utility**

## **Story Details**

- **Story ID**: TDR-3A
- **Epic**: Technical Debt Remediation
- **Priority**: MAJOR
- **Effort**: 0.5 days
- **Dependencies**: Complete Stories 1A-1C first

## **User Story**

> **As a** developer working on webview messaging
> **I want** a centralized utility for posting messages to the extension
> **So that** message posting is consistent and includes proper error handling

## **Business Value**

- **Impact**: Standardizes message posting across 25+ locations
- **Risk**: VERY LOW - additive change with no breaking modifications
- **ROI**: MEDIUM - improves developer experience and debugging

## **Acceptance Criteria**

### **✅ MUST HAVE**

- [ ] Create `webview-ui/src/utils/extensionMessaging.ts` utility
- [ ] Include TypeScript interfaces for all message types
- [ ] Add error handling and logging
- [ ] Add JSDoc documentation
- [ ] Utility builds without TypeScript errors

### **🔍 VERIFICATION STEPS**

- [ ] Import utility in test file - no compilation errors
- [ ] Call utility function - produces expected console output
- [ ] TypeScript autocomplete works for message interfaces
- [ ] Webview bundle builds successfully with new utility

## **Implementation Tasks**

### **Task 1: Analyze Existing Message Patterns**

```bash
cd /Users/jonnyasmar/dev/markdown-docs
rg "window\.vscodeApi\.postMessage" webview-ui/src/components/MDXEditorWrapper.tsx -A 2 -B 2
```

**Identify message types used**:

- `edit` with content
- `save` with content
- `addComment` with comment data
- `setUserInteracting` with boolean
- Settings-related messages

### **Task 2: Create Message Utility File**

**Create**: `webview-ui/src/utils/extensionMessaging.ts`

```typescript
/**
 * Centralized utility for posting messages from webview to VS Code extension
 * Provides type safety, error handling, and consistent logging
 */

/**
 * Base interface for all extension messages
 */
export interface ExtensionMessage {
  command: string;
  [key: string]: any;
}

/**
 * Specific message interfaces for type safety
 */
export interface EditMessage extends ExtensionMessage {
  command: 'edit';
  content: string;
}

export interface SaveMessage extends ExtensionMessage {
  command: 'save';
  content: string;
}

export interface CommentMessage extends ExtensionMessage {
  command: 'addComment' | 'editComment' | 'deleteComment';
  commentId?: string;
  comment?: string;
  range?: {
    start: number;
    end: number;
  };
  content?: string; // For comment operations that update document
}

export interface UserInteractionMessage extends ExtensionMessage {
  command: 'setUserInteracting';
  isInteracting: boolean;
}

export interface SettingsMessage extends ExtensionMessage {
  command:
    | 'getSettings'
    | 'setFont'
    | 'setFontSize'
    | 'setTextAlign'
    | 'setBookView'
    | 'setBookViewWidth'
    | 'setBookViewMargin';
  font?: string;
  fontSize?: number;
  textAlign?: string;
  bookView?: boolean;
  bookViewWidth?: string;
  bookViewMargin?: string;
}

/**
 * Union type of all possible extension messages
 */
export type AnyExtensionMessage = EditMessage | SaveMessage | CommentMessage | UserInteractionMessage | SettingsMessage;

/**
 * Posts a message to the VS Code extension with error handling and logging
 * @param message - The message to send to the extension
 * @returns void
 */
export const postToExtension = (message: AnyExtensionMessage): void => {
  try {
    if (typeof window !== 'undefined' && window.vscodeApi && typeof window.vscodeApi.postMessage === 'function') {
      console.debug(`[ExtensionMessaging] Sending command: ${message.command}`, message);
      window.vscodeApi.postMessage(message);
    } else {
      console.warn(`[ExtensionMessaging] VS Code API not available for command: ${message.command}`);
    }
  } catch (error) {
    console.error(`[ExtensionMessaging] Error sending message:`, error, message);
  }
};

/**
 * Convenience functions for common message types
 */
export const postEdit = (content: string): void => {
  postToExtension({ command: 'edit', content });
};

export const postSave = (content: string): void => {
  postToExtension({ command: 'save', content });
};

export const postUserInteraction = (isInteracting: boolean): void => {
  postToExtension({ command: 'setUserInteracting', isInteracting });
};

/**
 * Type guard to check if VS Code API is available
 */
export const isVSCodeApiAvailable = (): boolean => {
  return typeof window !== 'undefined' && window.vscodeApi && typeof window.vscodeApi.postMessage === 'function';
};
```

### **Task 3: Add Type Declaration for VS Code API**

**File**: `webview-ui/src/types.ts`

**Add/update VS Code API interface**:

```typescript
declare global {
  interface Window {
    vscodeApi?: {
      postMessage(message: any): void;
      // Add other VS Code API methods if needed
    };
  }
}
```

### **Task 4: Create Barrel Export**

**File**: `webview-ui/src/utils/index.ts` (create if doesn't exist)

```typescript
// Re-export existing utilities
export * from './cursorTracking';
export * from './logger';
export * from './textNormalization';

// Export new messaging utility
export * from './extensionMessaging';
```

### **Task 5: Test the Utility**

**Create temporary test file**: `webview-ui/src/utils/__test-messaging.ts`

```typescript
import { isVSCodeApiAvailable, postEdit, postToExtension } from './extensionMessaging';

// Test the utility (remove this file after verification)
console.log('VS Code API available:', isVSCodeApiAvailable());

if (isVSCodeApiAvailable()) {
  postEdit('Test content');
} else {
  console.log('Testing in non-VS Code environment');
}
```

### **Task 6: Build and Verify**

```bash
cd webview-ui
npm run build
echo "Build exit code: $?"

# Verify TypeScript compilation
npx tsc --noEmit
echo "TypeScript check: $?"

# Remove test file
rm src/utils/__test-messaging.ts
```

### **Task 7: Commit New Utility**

```bash
git add webview-ui/src/utils/extensionMessaging.ts
git add webview-ui/src/utils/index.ts
git add webview-ui/src/types.ts  # if modified
git commit -m "Add centralized extension messaging utility

- Created extensionMessaging.ts with type-safe message interfaces
- Added comprehensive error handling and logging
- Included convenience functions for common message types
- Full TypeScript interface coverage for all message types
- Added VS Code API availability checking

Refs: TDR-3A"
```

## **Definition of Done**

- [ ] Messaging utility created with full TypeScript support
- [ ] Error handling and logging included
- [ ] Convenience functions for common operations
- [ ] Builds successfully with TypeScript
- [ ] Ready for adoption in existing code

---

# 🟡 **STORY 3B: Convert All postMessage Calls**

## **Story Details**

- **Story ID**: TDR-3B
- **Epic**: Technical Debt Remediation
- **Priority**: MAJOR
- **Effort**: 1 day
- **Dependencies**: Must complete Story 3A first

## **User Story**

> **As a** developer debugging webview communication
> **I want** all message posting to use the centralized utility
> **So that** message posting is consistent and errors are handled uniformly

## **Business Value**

- **Impact**: Standardizes 25+ message posting locations
- **Risk**: LOW - systematic replacement with same functionality
- **ROI**: HIGH - significantly improves debugging and maintenance

## **Acceptance Criteria**

### **✅ MUST HAVE**

- [ ] All `window.vscodeApi.postMessage()` calls replaced with `postToExtension()`
- [ ] Import statements updated to use new utility
- [ ] All existing functionality preserved
- [ ] TypeScript compilation succeeds
- [ ] Consistent logging for all messages

### **🔍 VERIFICATION STEPS**

- [ ] Search codebase shows no direct `window.vscodeApi.postMessage` calls
- [ ] All webview features work (typing, saving, comments, settings)
- [ ] Console shows consistent message logging format
- [ ] No TypeScript errors or warnings

## **Implementation Tasks**

### **Task 1: Locate All postMessage Calls**

```bash
cd /Users/jonnyasmar/dev/markdown-docs
rg "window\.vscodeApi\.postMessage" webview-ui/src/ -n --type ts
```

**Expected locations** (from analysis):

- `webview-ui/src/components/MDXEditorWrapper.tsx` (multiple locations)
- `webview-ui/src/EditorApp.tsx`
- `webview-ui/src/EditorAppWithSettings.tsx`
- `webview-ui/src/App.tsx`

### **Task 2: Update MDXEditorWrapper.tsx**

**File**: `webview-ui/src/components/MDXEditorWrapper.tsx`

**Add import at top**:

```typescript
import { postEdit, postSave, postToExtension, postUserInteraction } from '../utils/extensionMessaging';
```

**Replace each occurrence**:

**Location \~1118**: User interaction setting

```typescript
// FIND:
window.vscodeApi.postMessage({
  command: 'setUserInteracting',
  isInteracting: true,
});

// REPLACE:
postUserInteraction(true);
```

**Location \~1906**: Keydown handler

```typescript
// FIND:
window.vscodeApi.postMessage({
  command: 'setUserInteracting',
  isInteracting: true,
});

// REPLACE:
postUserInteraction(true);
```

**Location \~1921**: Keyup handler

```typescript
// FIND:
window.vscodeApi.postMessage({
  command: 'setUserInteracting',
  isInteracting: false,
});

// REPLACE:
postUserInteraction(false);
```

**Location \~2008**: Direct message posting (already updated in Story 1B, verify consistency)

```typescript
// Should already be updated to use postEdit() or verify:
if (typeof window !== 'undefined' && window.vscodeApi) {
  // REPLACE THIS PATTERN:
  window.vscodeApi.postMessage({
    command: 'edit',
    content: processedMarkdown,
  });

  // WITH:
  postEdit(processedMarkdown);
}
```

### **Task 3: Continue Systematic Replacement**

**For each remaining file, follow this pattern**:

1. **Add import**: `import { postToExtension } from '../utils/extensionMessaging';`
2. **Replace postMessage calls**: Convert to appropriate utility function
3. **Verify TypeScript**: Check for compilation errors

**File**: `webview-ui/src/EditorApp.tsx`

```typescript
// Add import
import { postToExtension } from './utils/extensionMessaging';

// Replace calls like:
// vscode.postMessage({ command: 'ready' });
// WITH:
postToExtension({ command: 'ready' });
```

**File**: `webview-ui/src/EditorAppWithSettings.tsx`

```typescript
// Add import
import { postToExtension } from './utils/extensionMessaging';

// Replace:
// vscode.postMessage({ command: 'getSettings' });
// WITH:
postToExtension({ command: 'getSettings' });
```

### **Task 4: Handle Comment Operations**

**File**: `webview-ui/src/components/MDXEditorWrapper.tsx`

**Comment-related postMessage calls** (around lines 2383, 2403, 2499, etc.):

```typescript
// Pattern for comment operations:
// FIND:
window.vscodeApi.postMessage({
  command: 'addComment',
  range: { start: selectionStart, end: selectionEnd },
  comment: commentText,
  content: updatedMarkdown,
});

// REPLACE:
postToExtension({
  command: 'addComment',
  range: { start: selectionStart, end: selectionEnd },
  comment: commentText,
  content: updatedMarkdown,
});
```

### **Task 5: Handle Settings Operations**

**Multiple locations for settings** (setFontSize, setTextAlign, etc.):

```typescript
// Pattern for settings:
// FIND:
window.vscodeApi.postMessage({
  command: 'setFontSize',
  fontSize: newSize,
});

// REPLACE:
postToExtension({
  command: 'setFontSize',
  fontSize: newSize,
});
```

### **Task 6: Verify Complete Replacement**

```bash
# This should return NO results:
rg "window\.vscodeApi\.postMessage" webview-ui/src/ --type ts

# This should show the new pattern:
rg "postToExtension|postEdit|postSave|postUserInteraction" webview-ui/src/ --type ts -c
```

### **Task 7: Build and Test**

```bash
cd webview-ui
npm run build
echo "Webview build: $?"

cd ..
npm run build
echo "Extension build: $?"

# Test in VS Code Extension Development Host
npm run compile
# Then F5 to test all functionality
```

### **Task 8: Manual Testing Checklist**

- [ ] Type in editor - content updates VS Code document
- [ ] Save file - content persisted correctly
- [ ] Add comment - comment functionality works
- [ ] Change font settings - settings apply correctly
- [ ] External file edits - sync still works
- [ ] Check developer console - consistent message logging

### **Task 9: Commit Changes**

```bash
git add webview-ui/src/
git commit -m "Convert all postMessage calls to centralized utility

- Replaced 25+ direct window.vscodeApi.postMessage calls
- Updated all files to use postToExtension() utility
- Added consistent error handling and logging to all messages
- Improved type safety with specific message interfaces
- Enhanced debugging with standardized message format

Files updated:
- MDXEditorWrapper.tsx: Primary editor messaging
- EditorApp.tsx: Ready and initialization messages
- EditorAppWithSettings.tsx: Settings retrieval
- App.tsx: Application-level messaging

Refs: TDR-3B"
```

## **Definition of Done**

- [ ] No direct postMessage calls remain in webview code
- [ ] All functionality verified working
- [ ] Consistent message logging across all operations
- [ ] TypeScript compilation clean
- [ ] Extension fully functional with new messaging

---

# 🟡 **STORY 4A: Enhance Echo Prevention Logic**

## **Story Details**

- **Story ID**: TDR-4A
- **Epic**: Technical Debt Remediation
- **Priority**: MAJOR
- **Effort**: 0.5 days
- **Dependencies**: Complete Stories 1A-1C first

## **User Story**

> **As a** user editing markdown files with external changes
> **I want** reliable synchronization without duplicate or lost updates
> **So that** my changes are never lost and external edits sync properly

## **Business Value**

- **Impact**: Eliminates potential data loss from sync race conditions
- **Risk**: LOW - enhancement to existing working system
- **ROI**: HIGH - prevents critical data synchronization issues

## **Acceptance Criteria**

### **✅ MUST HAVE**

- [ ] Enhanced content comparison with normalization
- [ ] Comprehensive logging for sync debugging
- [ ] Handle edge cases (line endings, whitespace)
- [ ] Maintain existing sync behavior
- [ ] No regression in external file sync

### **🔍 VERIFICATION STEPS**

- [ ] Edit file externally while editor open - changes sync correctly
- [ ] Make rapid edits in editor - no duplicated content
- [ ] Mixed line endings handled properly
- [ ] Whitespace variations don't cause sync issues

## **Implementation Tasks**

### **Task 1: Locate Echo Prevention Code**

**File**: `src/extension.ts`
**Method**: `updateTextDocument` around lines 449-453

```bash
cd /Users/jonnyasmar/dev/markdown-docs
rg "lastWebviewContent" src/extension.ts -n -A 3 -B 3
```

### **Task 2: Enhance updateTextDocument Method**

**File**: `src/extension.ts`

**FIND the existing method around line 448**:

```typescript
private async updateTextDocument(document: vscode.TextDocument, newContent: string): Promise<void> {
  // Skip update if content hasn't actually changed
  if (this.lastWebviewContent === newContent) {
    logger.debug('Skipping document update - content unchanged');
    return;
  }

  this.updatingFromWebview = true;
  this.lastWebviewContent = newContent;
  // ... rest of method
}
```

**REPLACE WITH enhanced version**:

```typescript
private async updateTextDocument(document: vscode.TextDocument, newContent: string): Promise<void> {
  // Enhanced content comparison with normalization
  const normalizedNew = this.normalizeContent(newContent);
  const normalizedLast = this.normalizeContent(this.lastWebviewContent || '');

  if (normalizedLast === normalizedNew) {
    logger.debug('Skipping document update - content unchanged after normalization');
    logger.debug(`Content length: ${newContent.length}, Normalized length: ${normalizedNew.length}`);
    return;
  }

  logger.debug('Updating document content', {
    originalLength: this.lastWebviewContent?.length || 0,
    newLength: newContent.length,
    normalizedOriginal: normalizedLast.length,
    normalizedNew: normalizedNew.length,
    documentUri: document.uri.toString()
  });

  this.updatingFromWebview = true;
  this.lastWebviewContent = newContent;

  // Clear the last sent to webview so we can send updates back
  this.lastSentToWebview = null;

  try {
    const edit = new vscode.WorkspaceEdit();

    // Replace the entire document content
    const lastLine = document.lineCount - 1;
    const lastChar = document.lineAt(lastLine).text.length;
    edit.replace(document.uri, new vscode.Range(0, 0, lastLine, lastChar), newContent);

    const success = await vscode.workspace.applyEdit(edit);
    if (!success) {
      logger.error('Failed to apply workspace edit');
    } else {
      logger.debug('Document update applied successfully');
    }
  } catch (error) {
    logger.error('Error updating document:', error);
  } finally {
    // Add a small delay before resetting the flag to handle any async propagation
    setTimeout(() => {
      this.updatingFromWebview = false;
      logger.debug('updatingFromWebview flag reset');
    }, 50);
  }
}
```

### **Task 3: Add Content Normalization Method**

**File**: `src/extension.ts`

**Add new private method after updateTextDocument**:

```typescript
/**
 * Normalizes content for comparison by handling common variations
 * that shouldn't be considered as meaningful changes
 */
private normalizeContent(content: string): string {
  if (!content) {
    return '';
  }

  return content
    .trim()                        // Remove leading/trailing whitespace
    .replace(/\r\n/g, '\n')       // Normalize line endings to LF
    .replace(/\r/g, '\n')         // Handle old Mac line endings
    .replace(/[ \t]+$/gm, '')     // Remove trailing spaces/tabs from lines
    .replace(/\n{3,}/g, '\n\n');  // Collapse excessive empty lines to max 2
}
```

### **Task 4: Enhance sendContentToWebview Echo Prevention**

**File**: `src/extension.ts`
**Method**: `sendContentToWebview` around line 498

**FIND existing echo prevention**:

```typescript
// Prevent echo - don't send the same content back that we just received
if (this.lastSentToWebview === content) {
  this.outputChannel.appendLine('BLOCKED: Skipping webview update - content unchanged');
  return;
}
```

**REPLACE WITH enhanced version**:

```typescript
// Enhanced echo prevention with content normalization
const normalizedContent = this.normalizeContent(content);
const normalizedLastSent = this.normalizeContent(this.lastSentToWebview || '');

if (normalizedLastSent === normalizedContent) {
  this.outputChannel.appendLine('BLOCKED: Skipping webview update - content unchanged after normalization');
  this.outputChannel.appendLine(`Content lengths - original: ${content.length}, normalized: ${normalizedContent.length}`);
  return;
}

logger.debug('Sending content to webview', {
  contentLength: content.length,
  normalizedLength: normalizedContent.length,
  lastSentLength: this.lastSentToWebview?.length || 0,
  panelActive: webviewPanel.active
});
```

### **Task 5: Add Additional Debug Logging**

**File**: `src/extension.ts`
**Method**: Document change handler around line 105

**Enhance the onDidChangeTextDocument handler**:

```typescript
// Listen for document changes and update webview with echo prevention
const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
  if (e.document.uri.toString() === document.uri.toString()) {
    const fileUri = e.document.uri.toString();

    logger.debug('Document changed externally', {
      isDirty: document.isDirty,
      isUpdatingFromWebview: this.updatingFromWebview,
      hasUserInteraction: userInteractionRegistry.has(fileUri),
      panelActive: webviewPanel.active,
      changeCount: e.contentChanges.length,
    });

    // Don't sync VS Code changes back to webview if we're currently updating from webview
    // This prevents echo loops between webview and VS Code
    if (this.updatingFromWebview) {
      logger.debug('Skipping external sync - updating from webview');
      return;
    }

    // Check if user is actively interacting (should block to prevent cursor jumping)
    const isUserInteracting = userInteractionRegistry.has(fileUri);

    // Never allow incoming changes if file is dirty (has unsaved changes)
    if (document.isDirty) {
      logger.debug('Skipping external sync - document is dirty');
      return;
    }

    // For active user interaction, respect the active panel to prevent cursor jumping
    // For external edits, always update regardless of focus
    if (webviewPanel.active && isUserInteracting) {
      logger.debug('Skipping external sync - user actively interacting');
      return;
    }

    logger.debug('Processing external document change');
    this.sendContentToWebview(document, webviewPanel);
  }
});
```

### **Task 6: Test Enhanced Echo Prevention**

```bash
npm run compile
# Test in VS Code Extension Development Host (F5)
```

**Manual Testing Scenarios**:

1. **Basic Echo Prevention**:
   - Open markdown file
   - Type content - verify no echo/duplication
2. **External File Changes**:
   - Open file in extension
   - Edit same file in external editor (different line endings)
   - Verify changes sync without conflict
3. **Whitespace Variations**:
   - Add trailing spaces in external editor
   - Verify doesn't trigger unnecessary updates in webview
4. **Line Ending Variations**:
   - Save file with different line endings externally
   - Verify proper normalization and sync

### **Task 7: Commit Enhanced Logic**

```bash
git add src/extension.ts
git commit -m "Enhance echo prevention with content normalization

- Added normalizeContent() method to handle line ending variations
- Enhanced updateTextDocument() with comprehensive logging
- Improved echo prevention in sendContentToWebview()
- Added detailed debug logging for sync operations
- Better handling of whitespace and line ending differences
- Prevents unnecessary updates from formatting variations

Refs: TDR-4A"
```

## **Definition of Done**

- [ ] Enhanced content normalization implemented
- [ ] Comprehensive debug logging added
- [ ] External file sync works with different line endings
- [ ] No regression in existing sync behavior
- [ ] Echo prevention handles edge cases correctly

---

# 🟢 **STORY 5A: Extract useCommentManagement Hook**

## **Story Details**

- **Story ID**: TDR-5A
- **Epic**: Technical Debt Remediation
- **Priority**: MINOR (Organization)
- **Effort**: 1 day
- **Dependencies**: Can be done after critical stories complete

## **User Story**

> **As a** developer working on comment functionality
> **I want** comment management logic extracted into a reusable hook
> **So that** the component is more maintainable and comment logic is centralized

## **Business Value**

- **Impact**: Improves long-term maintainability
- **Risk**: VERY LOW - pure refactoring with no functional changes
- **ROI**: MEDIUM - reduces complexity of monolithic component

## **Acceptance Criteria**

### **✅ MUST HAVE**

- [ ] Create `webview-ui/src/hooks/useCommentManagement.ts`
- [ ] Extract all comment-related state and logic from MDXEditorWrapper
- [ ] Maintain all existing comment functionality
- [ ] Reduce MDXEditorWrapper by \~200-300 lines
- [ ] TypeScript compilation succeeds

### **🔍 VERIFICATION STEPS**

- [ ] Comment functionality works identically to before
- [ ] Adding comments works
- [ ] Editing comments works
- [ ] Deleting comments works
- [ ] Comment sidebar functionality preserved
- [ ] MDXEditorWrapper is significantly shorter

## **Implementation Tasks**

### **Task 1: Create Hooks Directory Structure**

```bash
cd /Users/jonnyasmar/dev/markdown-docs/webview-ui/src
mkdir -p hooks
```

### **Task 2: Analyze Comment Logic in MDXEditorWrapper**

**File**: `webview-ui/src/components/MDXEditorWrapper.tsx`

**Identify comment-related code**:

```bash
cd /Users/jonnyasmar/dev/markdown-docs
rg "comment" webview-ui/src/components/MDXEditorWrapper.tsx -n -i | head -20
rg "Comment" webview-ui/src/components/MDXEditorWrapper.tsx -n | head -20
```

**Comment-related state variables to extract** (approximate lines):

- `showCommentModal` (\~line 1620)
- `showEditModal` (\~line 1621)
- `selectedText` (\~line 1622)
- `commentText` (\~line 1624)
- `commentRange` (\~line 1625)
- `editingComment` (\~line 1626)
- `showCommentSidebar` (\~line 1628)
- `comments` and related state
- `parsedComments` computation
- `commentPositions` Map

### **Task 3: Create useCommentManagement Hook**

**Create**: `webview-ui/src/hooks/useCommentManagement.ts`

```typescript
import { useCallback, useMemo, useRef, useState } from 'react';

import { DirectiveService } from '../../../src/services/directive';
import { postToExtension } from '../utils/extensionMessaging';
import { logger } from '../utils/logger';

export interface Comment {
  id: string;
  content: string;
  timestamp: string;
  author: string;
  anchoredText: string;
}

export interface CommentRange {
  start: number;
  end: number;
}

export interface CommentManagementState {
  // Modal state
  showCommentModal: boolean;
  showEditModal: boolean;

  // Comment data
  selectedText: string;
  commentText: string;
  commentRange: CommentRange | null;
  editingComment: Comment | null;

  // Sidebar state
  showCommentSidebar: boolean;

  // Comments and positions
  comments: Comment[];
  parsedComments: Comment[];
  commentPositions: Map<string, { element: Element; comment: Comment }>;
}

export interface CommentManagementActions {
  // Modal actions
  openCommentModal: (text: string, range: CommentRange) => void;
  openEditModal: (comment: Comment) => void;
  closeCommentModal: () => void;
  closeEditModal: () => void;

  // Comment actions
  handleAddComment: (commentText: string) => void;
  handleEditComment: (commentId: string, newText: string) => void;
  handleDeleteComment: (commentId: string) => void;

  // Sidebar actions
  toggleCommentSidebar: () => void;

  // State setters
  setCommentText: (text: string) => void;
  updateComments: (markdown: string) => void;
}

export interface UseCommentManagementProps {
  markdown: string;
  onMarkdownChange: (newMarkdown: string) => void;
}

export const useCommentManagement = ({
  markdown,
  onMarkdownChange,
}: UseCommentManagementProps): CommentManagementState & CommentManagementActions => {
  // Modal state
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Comment data state
  const [selectedText, setSelectedText] = useState('');
  const [commentText, setCommentText] = useState('');
  const [commentRange, setCommentRange] = useState<CommentRange | null>(null);
  const [editingComment, setEditingComment] = useState<Comment | null>(null);

  // Sidebar state
  const [showCommentSidebar, setShowCommentSidebar] = useState(false);

  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const commentPositions = useRef(new Map<string, { element: Element; comment: Comment }>());

  // Parse comments from markdown
  const parsedComments = useMemo(() => {
    try {
      return DirectiveService.parseCommentDirectives(markdown);
    } catch (error) {
      logger.error('Error parsing comments:', error);
      return [];
    }
  }, [markdown]);

  // Modal actions
  const openCommentModal = useCallback((text: string, range: CommentRange) => {
    setSelectedText(text);
    setCommentRange(range);
    setCommentText('');
    setShowCommentModal(true);
  }, []);

  const openEditModal = useCallback((comment: Comment) => {
    setEditingComment(comment);
    setCommentText(comment.content);
    setShowEditModal(true);
  }, []);

  const closeCommentModal = useCallback(() => {
    setShowCommentModal(false);
    setSelectedText('');
    setCommentRange(null);
    setCommentText('');
  }, []);

  const closeEditModal = useCallback(() => {
    setShowEditModal(false);
    setEditingComment(null);
    setCommentText('');
  }, []);

  // Comment CRUD actions
  const handleAddComment = useCallback(
    (newCommentText: string) => {
      if (!commentRange || !selectedText.trim() || !newCommentText.trim()) return;

      const commentId = `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = new Date().toISOString();

      const directive = `:::comment{#${commentId} text="${newCommentText}" timestamp="${timestamp}"}
${selectedText}
:::`;

      const beforeText = markdown.substring(0, commentRange.start);
      const afterText = markdown.substring(commentRange.end);
      const updatedMarkdown = beforeText + directive + afterText;

      onMarkdownChange(updatedMarkdown);

      // Post to extension
      postToExtension({
        command: 'addComment',
        range: commentRange,
        comment: newCommentText,
        content: updatedMarkdown,
      });

      closeCommentModal();
    },
    [markdown, commentRange, selectedText, onMarkdownChange],
  );

  const handleEditComment = useCallback(
    (commentId: string, newText: string) => {
      if (!newText.trim()) return;

      const updatedMarkdown = DirectiveService.updateDirective(markdown, commentId, newText);
      onMarkdownChange(updatedMarkdown);

      postToExtension({
        command: 'editComment',
        commentId,
        comment: newText,
        content: updatedMarkdown,
      });

      closeEditModal();
    },
    [markdown, onMarkdownChange],
  );

  const handleDeleteComment = useCallback(
    (commentId: string) => {
      const updatedMarkdown = DirectiveService.removeDirective(markdown, commentId);
      onMarkdownChange(updatedMarkdown);

      postToExtension({
        command: 'deleteComment',
        commentId,
        content: updatedMarkdown,
      });
    },
    [markdown, onMarkdownChange],
  );

  // Sidebar actions
  const toggleCommentSidebar = useCallback(() => {
    setShowCommentSidebar(prev => !prev);
  }, []);

  // Update comments when markdown changes
  const updateComments = useCallback((newMarkdown: string) => {
    const newComments = DirectiveService.parseCommentDirectives(newMarkdown);
    setComments(newComments);
  }, []);

  return {
    // State
    showCommentModal,
    showEditModal,
    selectedText,
    commentText,
    commentRange,
    editingComment,
    showCommentSidebar,
    comments,
    parsedComments,
    commentPositions: commentPositions.current,

    // Actions
    openCommentModal,
    openEditModal,
    closeCommentModal,
    closeEditModal,
    handleAddComment,
    handleEditComment,
    handleDeleteComment,
    toggleCommentSidebar,
    setCommentText,
    updateComments,
  };
};
```

### **Task 4: Create Hooks Barrel Export**

**Create**: `webview-ui/src/hooks/index.ts`

```typescript
export { useCommentManagement } from './useCommentManagement';
export type {
  Comment,
  CommentRange,
  CommentManagementState,
  CommentManagementActions,
  UseCommentManagementProps,
} from './useCommentManagement';
```

### **Task 5: Update MDXEditorWrapper to Use Hook**

**File**: `webview-ui/src/components/MDXEditorWrapper.tsx`

**Add import**:

```typescript
import { useCommentManagement } from '../hooks';
```

**Replace comment state declarations** with hook usage:

```typescript
// REMOVE all individual comment state variables:
// const [showCommentModal, setShowCommentModal] = useState(false);
// const [showEditModal, setShowEditModal] = useState(false);
// ... etc

// REPLACE WITH:
const commentManagement = useCommentManagement({
  markdown: markdown || '',
  onMarkdownChange: (newMarkdown: string) => {
    if (editorRef.current) {
      editorRef.current.setMarkdown(newMarkdown);
    }
  },
});
```

**Update all comment-related references**:

- `showCommentModal` → `commentManagement.showCommentModal`
- `setShowCommentModal` → `commentManagement.openCommentModal` / `commentManagement.closeCommentModal`
- `handleAddComment` → `commentManagement.handleAddComment`
- etc.

### **Task 6: Update Component JSX**

**File**: `webview-ui/src/components/MDXEditorWrapper.tsx`

**Update all JSX references**:

```typescript
// Comment Modal
<CommentModal
  isOpen={commentManagement.showCommentModal}
  onClose={commentManagement.closeCommentModal}
  onSubmit={commentManagement.handleAddComment}
  selectedText={commentManagement.selectedText}
  commentText={commentManagement.commentText}
  onCommentTextChange={commentManagement.setCommentText}
/>

// Edit Modal
<CommentModal
  isOpen={commentManagement.showEditModal}
  onClose={commentManagement.closeEditModal}
  onSubmit={(text) => commentManagement.editingComment &&
    commentManagement.handleEditComment(commentManagement.editingComment.id, text)}
  selectedText={commentManagement.editingComment?.anchoredText || ''}
  commentText={commentManagement.commentText}
  onCommentTextChange={commentManagement.setCommentText}
  isEditing={true}
/>

// Comment Sidebar
{commentManagement.showCommentSidebar && (
  <CommentList
    comments={commentManagement.parsedComments}
    onEditComment={commentManagement.openEditModal}
    onDeleteComment={commentManagement.handleDeleteComment}
  />
)}
```

### **Task 7: Test Hook Integration**

```bash
cd webview-ui
npm run build
echo "Webview build with hook: $?"

cd ..
npm run compile
# Test in VS Code Extension Development Host
```

**Manual Testing**:

- [ ] Add new comment - functionality works
- [ ] Edit existing comment - changes apply
- [ ] Delete comment - removes correctly
- [ ] Comment sidebar toggles properly
- [ ] All comment UI interactions preserved

### **Task 8: Commit Hook Extraction**

```bash
git add webview-ui/src/hooks/
git add webview-ui/src/components/MDXEditorWrapper.tsx
git commit -m "Extract comment management logic into reusable hook

- Created useCommentManagement hook with full TypeScript interfaces
- Extracted ~300 lines of comment logic from MDXEditorWrapper
- Centralized all comment state and actions in single location
- Maintained all existing comment functionality
- Improved component organization and maintainability
- Added proper TypeScript interfaces for all comment operations

Refs: TDR-5A"
```

## **Definition of Done**

- [ ] useCommentManagement hook created and functional
- [ ] All comment functionality preserved
- [ ] MDXEditorWrapper reduced by \~200-300 lines
- [ ] TypeScript compilation succeeds
- [ ] Hook is reusable and well-documented

---

# 🟢 **STORY 6A: Create Barrel Exports and Standardize Imports**

## **Story Details**

- **Story ID**: TDR-6A
- **Epic**: Technical Debt Remediation
- **Priority**: MINOR (Organization)
- **Effort**: 0.5 days
- **Dependencies**: Can be done in parallel with other organization stories

## **User Story**

> **As a** developer navigating the codebase
> **I want** consistent import patterns with barrel exports
> **So that** I can quickly understand dependencies and find related code

## **Business Value**

- **Impact**: Improves developer experience and code navigation
- **Risk**: VERY LOW - import path changes only
- **ROI**: MEDIUM - long-term maintainability benefit

## **Acceptance Criteria**

### **✅ MUST HAVE**

- [ ] Create `index.ts` barrel exports for all major directories
- [ ] Convert imports to use barrel exports where beneficial
- [ ] Group imports: External → Services → Components → Utils
- [ ] TypeScript compilation succeeds
- [ ] No functional changes to application behavior

### **🔍 VERIFICATION STEPS**

- [ ] All imports resolve correctly
- [ ] TypeScript autocomplete works for barrel exports
- [ ] Application functionality unchanged
- [ ] Import statements are cleaner and more organized

## **Implementation Tasks**

### **Task 1: Create Barrel Exports**

**Create**: `webview-ui/src/utils/index.ts` (if doesn't exist)

```typescript
// Utility exports
export * from './cursorTracking';
export * from './extensionMessaging';
export * from './logger';
export * from './textNormalization';
```

**Create**: `webview-ui/src/hooks/index.ts` (already created in Story 5A)

```typescript
export { useCommentManagement } from './useCommentManagement';
export type {
  Comment,
  CommentRange,
  CommentManagementState,
  CommentManagementActions,
  UseCommentManagementProps,
} from './useCommentManagement';

// Add other hooks as they're created:
// export { useEditorState } from './useEditorState';
// export { useFloatingButton } from './useFloatingButton';
```

**Create**: `webview-ui/src/components/index.ts`

```typescript
// Main components
export { default as MDXEditorWrapper } from './MDXEditorWrapper';
export { default as ErrorBoundary } from './ErrorBoundary';
export { default as StatusBar } from './StatusBar';
export { default as TableOfContents } from './TableOfContents';

// Comment components
export { default as CommentItem } from './CommentItem';
export { default as CommentList } from './CommentList';
export { default as CommentModal } from './CommentModal';

// Editor plugins
export { default as CustomSearchPlugin } from './CustomSearchPlugin';
export { default as SimplifiedAngleBracketPlugin } from './SimplifiedAngleBracketPlugin';

// Mermaid components
export { default as MermaidEditor } from './MermaidEditor';
```

**Create**: `src/services/index.ts`

```typescript
// Service exports
export { DirectiveService } from './directive';

// Add other services as they exist:
// export { FormattingService } from './formatting';
// export { DocumentParserService } from './documentParser';
```

**Create**: `src/utils/index.ts`

```typescript
// Extension utilities
export { logger } from './logger';

// Add other utilities as they're created:
// export * from './textProcessing';
// export * from './webviewUtils';
```

### **Task 2: Identify Import Standardization Opportunities**

```bash
cd /Users/jonnyasmar/dev/markdown-docs
rg "from '\.\./\.\./\.\." webview-ui/src/ --type ts -n
rg "from '\.\." webview-ui/src/ --type ts -n | head -10
```

### **Task 3: Update Key Component Imports**

**File**: `webview-ui/src/components/MDXEditorWrapper.tsx`

**Current imports** (example):

```typescript
import { DirectiveService } from '../../../src/services/directive';
import { postToExtension } from '../utils/extensionMessaging';
import { logger } from '../utils/logger';
```

**Standardized imports**:

```typescript
// External imports (already good)
import { MDXEditor /* other MDX imports */ } from '@mdxeditor/editor';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Internal services
import { DirectiveService } from '../../../services';
// Internal hooks
import { useCommentManagement } from '../hooks';
// Internal utilities
import { logger, postToExtension } from '../utils';
```

### **Task 4: Update Other Component Files**

**File**: `webview-ui/src/EditorApp.tsx`

**Standardize imports**:

```typescript
// External imports
import React, { useEffect } from 'react';

// Internal components
import { ErrorBoundary, MDXEditorWrapper } from './components';
// Internal utilities
import { logger } from './utils';
```

**File**: `webview-ui/src/EditorAppWithSettings.tsx`

**Standardize imports**:

```typescript
// External imports
import React, { useEffect } from 'react';

// Internal components
import { MDXEditorWrapper } from './components';
// Internal utilities
import { logger, postToExtension } from './utils';
```

### **Task 5: Update Component Internal Imports**

**File**: `webview-ui/src/components/CommentModal.tsx`

**If using relative imports**:

```typescript
// Current:
// import { logger } from '../utils/logger';
// Standardized:
import { logger } from '../utils';
```

**File**: `webview-ui/src/components/CommentList.tsx`

**Apply same pattern for consistency**.

### **Task 6: Document Import Standards**

**Create**: `webview-ui/src/README.md` (if doesn't exist)

````markdown
# Webview UI - Import Standards

## Import Order

1. **External libraries** (React, third-party packages)
2. **Internal services** (from `../services` or barrel exports)
3. **Internal components** (from `./components` or barrel exports)
4. **Internal utilities** (from `./utils` or barrel exports)

## Examples

```typescript
// External imports
import { MDXEditor } from '@mdxeditor/editor';
import React, { useEffect, useState } from 'react';

// Internal services
import { DirectiveService } from '../../../services';
// Internal hooks
import { useCommentManagement } from '../hooks';
// Internal utilities
import { logger, postToExtension } from '../utils';
// Internal components
import { CommentList, CommentModal } from './components';
```
````

## Barrel Exports

Use barrel exports when:

- Importing multiple items from same directory
- Simplifying complex relative paths
- Creating public API for directories

Avoid when:

- Only importing single item
- Path is already simple (e.g., `./fileName`)

````

### **Task 7: Verify Import Changes**
```bash
cd webview-ui
npm run build
echo "Build with standardized imports: $?"

cd ..
npm run compile
echo "Extension compile: $?"

# Verify TypeScript compilation
cd webview-ui
npx tsc --noEmit
echo "TypeScript check: $?"
````

### **Task 8: Test Application**

```bash
npm run compile
# Test in VS Code Extension Development Host (F5)
```

**Quick functionality test**:

- [ ] Extension loads without errors
- [ ] Editor functionality works
- [ ] Import autocomplete works in IDE
- [ ] No TypeScript errors

### **Task 9: Commit Import Standardization**

```bash
git add webview-ui/src/
git add src/
git commit -m "Standardize imports with barrel exports

- Created barrel exports (index.ts) for utils, hooks, components, services
- Standardized import order: External → Services → Components → Utils
- Simplified complex relative imports using barrel exports
- Added import standards documentation
- Improved code navigation and IDE autocomplete experience
- No functional changes, pure organizational improvement

Refs: TDR-6A"
```

## **Definition of Done**

- [ ] Barrel exports created for all major directories
- [ ] Import statements follow consistent pattern
- [ ] Import groups clearly separated
- [ ] TypeScript compilation clean
- [ ] Application functionality unchanged
- [ ] Developer experience improved with better autocomplete

---

# 🎯 **SUMMARY & EXECUTION PLAN**

## **Story Completion Checklist**

### **Phase 1: Critical (Week 1)**

- [ ] **Story 2A**: Remove Legacy MarkdownEditorProvider _(0.5 days)_
- [ ] **Story 1A**: Remove SyncManager File and Imports _(1 day)_
- [ ] **Story 1B**: Replace SyncManager Usage with Direct Calls _(1 day)_
- [ ] **Story 1C**: Clean Extension Message Handling _(0.5 days)_

### **Phase 2: Major (Week 2)**

- [ ] **Story 3A**: Create Centralized Message Utility _(0.5 days)_
- [ ] **Story 3B**: Convert All postMessage Calls _(1 day)_
- [ ] **Story 4A**: Enhance Echo Prevention Logic _(0.5 days)_

### **Phase 3: Organization (Week 3+)**

- [ ] **Story 5A**: Extract useCommentManagement Hook _(1 day)_
- [ ] **Story 6A**: Create Barrel Exports and Standardize Imports _(0.5 days)_

## **Success Metrics**

### **Code Reduction**

- **Lines Removed**: 470+ lines of redundant/obsolete code
- **SyncManager**: 340 lines removed
- **MarkdownEditorProvider**: 131 lines removed
- **Component Extraction**: 200-300 lines moved to hooks

### **Performance Improvements**

- **Bundle Size**: 15% reduction expected
- **Memory Leaks**: Zero growing listeners after 10 open/close cycles
- **Typing Latency**: <50ms maintained, no progressive degradation

### **Developer Experience**

- **Message Flow**: Single, predictable message path
- **Import Patterns**: Consistent across all components
- **Component Size**: MDXEditorWrapper reduced to <300 lines
- **Debugging**: Centralized logging and error handling

---

**🏃 Bob's Recommendation**: Start with **Story 2A** (Legacy Provider removal) as it's the safest warm-up, then proceed through the SyncManager stories (1A→1B→1C) in sequence. This approach minimizes risk while delivering immediate value.

Each story is now **ready for implementation** with specific line numbers, exact code changes, and comprehensive testing instructions. No ambiguity for AI developers! 🎯
