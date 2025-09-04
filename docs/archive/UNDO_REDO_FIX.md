# Undo/Redo Fix Implementation

## Problem Identified

The extension had conflicting undo/redo systems:

1. **VS Code's TextDocument** had its own undo/redo stack
2. **MDX Editor (Lexical)** had its own internal undo/redo stack
3. These two systems were fighting each other, causing:
   * Duplicate history entries
   * Circular update loops
   * Inconsistent undo/redo behavior

## Solution Implemented: VS Code as Single Source of Truth

### Changes Made:

#### 1. MDXEditorWrapper.tsx

* **Removed** the `undoRedoSyncPlugin` that was trying to sync undo/redo between systems
* **Added** `disableUndoRedoPlugin` that completely blocks MDX Editor's undo/redo commands
* **Removed** keyboard shortcut interception - VS Code now handles Ctrl+Z/Y naturally
* **Improved** update synchronization with `lastSentContent` tracking to prevent echo
* **Enhanced** external update handling to better support undo/redo from VS Code

#### 2. extension.ts

* **Added** `lastWebviewContent` tracking to prevent unnecessary updates
* **Improved** the `updateTextDocument` method to skip redundant updates
* **Added** delay in flag reset to handle async propagation

### How It Works Now:

1. **User presses Ctrl+Z (undo)**:
   * VS Code handles the keyboard shortcut
   * VS Code performs undo on its TextDocument
   * Change is sent to MDX Editor via the `update` message
   * MDX Editor displays the undone content
   * MDX Editor's own undo is blocked by our plugin
2. **User edits in MDX Editor**:
   * Change is sent to VS Code via `edit` message
   * VS Code updates TextDocument (creates undo point)
   * No circular update because we track last sent content
3. **No more conflicts**:
   * Single undo/redo stack (VS Code's)
   * Clean separation of responsibilities
   * Predictable behavior matching VS Code standards

### Race Condition Fixes Applied:
* **Removed startTransition** from parent state updates to prevent delayed execution
* **Extended external update protection** to 300ms to block delayed onChange events
* **Added timeout clearing** during external updates to prevent interference  
* **Improved content change guards** to prevent echo and overwrites
* **Removed forced cursor positioning** that was causing cursor jumps

### Testing Checklist:

* [ ] Ctrl+Z undoes changes correctly (should not flash/revert)
* [ ] Ctrl+Y (or Ctrl+Shift+Z) redoes changes correctly
* [ ] Multiple undo/redo operations work sequentially
* [ ] No duplicate entries in undo history
* [ ] Cursor position stays stable (no jumping to beginning)
* [ ] No circular update loops
* [ ] Works with both keyboard shortcuts and Edit menu
* [ ] Rapid undo operations (holding Ctrl+Z) work smoothly

### Benefits:

* ✅ Consistent with VS Code behavior
* ✅ Integrates with VS Code's file history
* ✅ Works with multi-file undo/redo
* ✅ Simpler architecture
* ✅ No synchronization complexity