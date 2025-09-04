# Project Refactoring Plan - File Organization & Code Structure Improvements

## Executive Summary

This document outlines a comprehensive refactoring plan to improve the Markdown Docs VSCode extension's code organization and maintainability. The primary focus is on restructuring oversized files and establishing clear separation of concerns without making any functional changes.

## Current State Analysis

### Critical Issues Identified

1. **Oversized Components**
   - `webview-ui/src/components/MDXEditorWrapper.tsx`: **2,595 lines** - Contains multiple responsibilities
   - `src/extension.ts`: **450 lines** - Mixed concerns and utilities

2. **Poor Separation of Concerns**
   - Business logic mixed with UI components
   - Utility functions embedded in large files
   - Custom hooks not extracted
   - Service layer inconsistently organized

3. **Inconsistent Organization**
   - Some utilities properly separated, others embedded
   - Missing dedicated folders for hooks, constants, and providers
   - Service layer partially implemented but underutilized

## Refactoring Strategy

This refactoring follows the **Single Responsibility Principle** and **Feature-Based Organization** patterns from the coding standards, ensuring each file has one clear purpose and related functionality is co-located.

---

## PHASE 1: Extension Layer Refactoring (`/src`)

### 1.1 Extract Utilities from extension.ts

**Target File:** `src/extension.ts` (450 lines)

**Extract to new files:**

#### `src/utils/textProcessing.ts`
```typescript
// Extract these functions:
- isInCodeBlock(text: string, position: number): boolean
- isInInlineCode(text: string, position: number): boolean  
- preprocessAngleBrackets(markdown: string): string
- postprocessAngleBrackets(markdown: string): string
```

#### `src/utils/webviewUtils.ts`
```typescript
// Extract webview-related utilities:
- getWebviewContent() method logic
- URI handling functions
- Nonce generation
- Resource path resolution
```

#### `src/providers/MarkdownTextEditorProvider.ts`
```typescript
// Extract the entire class:
- MarkdownTextEditorProvider class
- All its methods and properties
- Keep only the constructor and core interface methods in main class
```

#### `src/handlers/webviewMessageHandler.ts`
```typescript
// Extract message handling logic:
- setupWebviewMessageHandling method logic
- Message processing functions
- Command routing logic
```

### 1.2 Create Configuration Module

#### `src/config/editorConfig.ts`
```typescript
// Extract configuration-related functions:
- getEditorConfig() method
- Configuration validation
- Default settings
```

### 1.3 Reorganize Services

#### Move services to proper feature folders:
```
src/services/
├── markdown/
│   ├── directiveService.ts (existing: src/services/directive.ts)
│   ├── markdownProcessor.ts (new)
│   └── textAnalysis.ts (new)
├── editor/
│   ├── editorProvider.ts (new)
│   └── documentSync.ts (new)
└── webview/
    ├── messageRouter.ts (new)
    └── contentManager.ts (new)
```

---

## PHASE 2: Webview Layer Refactoring (`/webview-ui/src`)

### 2.1 Extract Hooks from MDXEditorWrapper.tsx

**Target File:** `webview-ui/src/components/MDXEditorWrapper.tsx` (2,595 lines)

**Create new hooks directory:** `webview-ui/src/hooks/`

#### `webview-ui/src/hooks/useCommentManagement.ts`
```typescript
// Extract comment-related state and logic:
- All comment state (comments, editingComment, focusedCommentId, etc.)
- handleCommentClick, handleDeleteComment, handleEditComment
- Comment parsing and positioning logic
- parsedComments computation
```

#### `webview-ui/src/hooks/useEditorState.ts`
```typescript
// Extract core editor state:
- markdown state
- currentViewMode, isBookView, isTyping
- selectedText, selectedFont
- Editor configuration state
```

#### `webview-ui/src/hooks/useFloatingButton.ts`
```typescript
// Extract floating button logic:
- floatingButtonPosition, showFloatingButton
- Button positioning calculations
- Show/hide logic based on text selection
```

#### `webview-ui/src/hooks/useSidebar.ts`
```typescript
// Extract sidebar-related state:
- showCommentSidebar, sidebarWidth
- Sidebar toggle logic
- Width adjustment handlers
```

#### `webview-ui/src/hooks/useModalManagement.ts`
```typescript
// Extract modal-related state:
- showCommentModal, showEditModal
- Modal open/close handlers
- Modal state coordination
```

#### `webview-ui/src/hooks/useViewModeTracking.ts`
```typescript
// Extract view mode logic (this may already exist):
- View mode change handling
- Mode-specific behavior
- Transition logic
```

### 2.2 Extract Utility Functions

#### `webview-ui/src/utils/editorUtils.ts`
```typescript
// Extract editor utility functions:
- Font handling utilities (fontFamilyMap, handleFontChange)
- Editor focus management
- Content processing helpers
```

#### `webview-ui/src/utils/commentUtils.ts`
```typescript
// Extract comment utilities:
- Comment positioning calculations
- Comment sorting logic
- Comment validation functions
```

#### `webview-ui/src/utils/markdownProcessing.ts`
```typescript
// Extract markdown processing:
- Image path conversion utilities
- Content preprocessing/postprocessing
- Markdown validation helpers
```

### 2.3 Extract Constants and Configuration

#### `webview-ui/src/constants/editorConfig.ts`
```typescript
// Extract constants:
- availableFonts array
- fontFamilyMap object
- Default editor settings
- Plugin configurations
```

#### `webview-ui/src/constants/toolbarConfig.ts`
```typescript
// Extract toolbar configuration:
- ToolbarGroups configuration
- Plugin setup constants
- UI element definitions
```

### 2.4 Create Component Compositions

#### `webview-ui/src/components/editor/EditorCore.tsx`
```typescript
// Extract core MDXEditor setup:
- Basic MDXEditor component setup
- Plugin initialization
- Core event handlers
```

#### `webview-ui/src/components/editor/EditorToolbar.tsx`
```typescript
// Extract toolbar components:
- ToolbarWithCommentButton
- Custom toolbar elements
- Toolbar event handlers
```

#### `webview-ui/src/components/editor/EditorSidebar.tsx`
```typescript
// Extract sidebar logic:
- Comment sidebar rendering
- Sidebar resize handling
- Sidebar content management
```

#### `webview-ui/src/components/editor/FloatingCommentButton.tsx`
```typescript
// Extract floating button:
- Floating button component
- Positioning logic
- Click handlers
```

### 2.5 Reorganize Component Structure

**New structure:**
```
webview-ui/src/components/
├── editor/
│   ├── EditorCore.tsx (new)
│   ├── EditorToolbar.tsx (new)
│   ├── EditorSidebar.tsx (new)
│   ├── FloatingCommentButton.tsx (new)
│   └── MDXEditorWrapper.tsx (refactored - composition root)
├── comments/
│   ├── CommentItem.tsx (existing)
│   ├── CommentList.tsx (existing) 
│   ├── CommentModal.tsx (existing)
│   └── CommentModal.css (existing)
├── mermaid/
│   ├── MermaidEditor.tsx (existing)
│   └── MermaidEditor.css (existing)
├── plugins/
│   └── SimplifiedAngleBracketPlugin.tsx (existing)
└── shared/
    ├── ErrorBoundary.tsx (existing)
    └── focus-styles.css (existing)
```

---

## PHASE 3: Establish Consistent Patterns

### 3.1 Create Index Files for Clean Imports

#### `webview-ui/src/hooks/index.ts`
```typescript
export { useCommentManagement } from './useCommentManagement';
export { useEditorState } from './useEditorState';
export { useFloatingButton } from './useFloatingButton';
export { useSidebar } from './useSidebar';
export { useModalManagement } from './useModalManagement';
export { useViewModeTracking } from './useViewModeTracking';
```

#### `webview-ui/src/utils/index.ts`
```typescript
export * from './editorUtils';
export * from './commentUtils';
export * from './markdownProcessing';
export * from './textNormalization'; // existing
export * from './syncManager'; // existing
export * from './codeBlockComments'; // existing
export * from './logger'; // existing
```

#### `webview-ui/src/constants/index.ts`
```typescript
export * from './editorConfig';
export * from './toolbarConfig';
```

### 3.2 Standardize Service Layer

#### Complete the service layer pattern:
```
src/services/
├── index.ts (barrel export)
├── markdown/
│   ├── index.ts
│   ├── directiveService.ts
│   ├── markdownProcessor.ts
│   └── textAnalysis.ts
├── editor/
│   ├── index.ts
│   ├── editorProvider.ts
│   └── documentSync.ts
└── webview/
    ├── index.ts
    ├── messageRouter.ts
    └── contentManager.ts
```

---

## DETAILED REFACTORING CHECKLIST

### Pre-Refactoring Steps

- [ ] **Create feature branch** for refactoring work
- [ ] **Run full test suite** to establish baseline
- [ ] **Document current import dependencies** for each target file
- [ ] **Create backup** of current working state
- [ ] **Verify build configuration** supports new directory structure

### Phase 1: Extension Layer (`/src`)

#### Extract utilities from extension.ts
- [ ] Create `src/utils/textProcessing.ts`
- [ ] Move `isInCodeBlock` function with tests
- [ ] Move `isInInlineCode` function with tests  
- [ ] Move `preprocessAngleBrackets` function with tests
- [ ] Move `postprocessAngleBrackets` function with tests
- [ ] Update imports in `extension.ts`

#### Extract webview utilities
- [ ] Create `src/utils/webviewUtils.ts`
- [ ] Move webview content generation logic
- [ ] Move URI handling functions
- [ ] Move resource path resolution
- [ ] Update imports in `extension.ts`

#### Extract editor provider
- [ ] Create `src/providers/MarkdownTextEditorProvider.ts`
- [ ] Move entire `MarkdownTextEditorProvider` class
- [ ] Ensure proper constructor injection
- [ ] Update imports in `extension.ts`
- [ ] Test provider registration

#### Extract message handler
- [ ] Create `src/handlers/webviewMessageHandler.ts`
- [ ] Move message handling logic from provider
- [ ] Create proper message routing system
- [ ] Update provider to use new handler
- [ ] Test message communication

#### Extract configuration module
- [ ] Create `src/config/editorConfig.ts`
- [ ] Move `getEditorConfig` method
- [ ] Add configuration validation
- [ ] Update all config usage points

#### Reorganize services directory
- [ ] Create `src/services/markdown/` directory
- [ ] Move `directive.ts` to `src/services/markdown/directiveService.ts`
- [ ] Create `src/services/editor/` directory  
- [ ] Create `src/services/webview/` directory
- [ ] Add index files for barrel exports
- [ ] Update all service imports

### Phase 2: Webview Layer (`/webview-ui/src`)

#### Create hooks directory structure
- [ ] Create `webview-ui/src/hooks/` directory
- [ ] Create hook index file for exports

#### Extract comment management hook
- [ ] Create `useCommentManagement.ts`
- [ ] Move all comment-related state variables
- [ ] Move `handleCommentClick`, `handleDeleteComment`, `handleEditComment`
- [ ] Move comment parsing and positioning logic
- [ ] Move `parsedComments` computation
- [ ] Test comment functionality

#### Extract editor state hook
- [ ] Create `useEditorState.ts`
- [ ] Move `markdown`, `currentViewMode`, `isBookView`, `isTyping` state
- [ ] Move `selectedText`, `selectedFont` state
- [ ] Move editor configuration state
- [ ] Test state management

#### Extract floating button hook
- [ ] Create `useFloatingButton.ts`
- [ ] Move `floatingButtonPosition`, `showFloatingButton` state
- [ ] Move button positioning calculations
- [ ] Move show/hide logic based on text selection
- [ ] Test floating button behavior

#### Extract sidebar hook
- [ ] Create `useSidebar.ts`
- [ ] Move `showCommentSidebar`, `sidebarWidth` state
- [ ] Move sidebar toggle logic
- [ ] Move width adjustment handlers
- [ ] Test sidebar functionality

#### Extract modal management hook
- [ ] Create `useModalManagement.ts`
- [ ] Move `showCommentModal`, `showEditModal` state
- [ ] Move modal open/close handlers
- [ ] Move modal state coordination logic
- [ ] Test modal behavior

#### Extract utility functions
- [ ] Create `webview-ui/src/utils/editorUtils.ts`
- [ ] Move font handling utilities (`fontFamilyMap`, `handleFontChange`)
- [ ] Move editor focus management functions
- [ ] Move content processing helpers

#### Extract comment utilities
- [ ] Create `webview-ui/src/utils/commentUtils.ts`
- [ ] Move comment positioning calculations
- [ ] Move comment sorting logic (`sortedCommentItems`)
- [ ] Move comment validation functions

#### Extract markdown processing utilities
- [ ] Create `webview-ui/src/utils/markdownProcessing.ts`
- [ ] Move image path conversion utilities
- [ ] Move content preprocessing/postprocessing
- [ ] Move markdown validation helpers

#### Extract constants
- [ ] Create `webview-ui/src/constants/editorConfig.ts`
- [ ] Move `availableFonts` array
- [ ] Move `fontFamilyMap` object
- [ ] Move default editor settings

#### Extract toolbar configuration
- [ ] Create `webview-ui/src/constants/toolbarConfig.ts`
- [ ] Move `ToolbarGroups` configuration
- [ ] Move plugin setup constants
- [ ] Move UI element definitions

#### Create component compositions
- [ ] Create `webview-ui/src/components/editor/EditorCore.tsx`
- [ ] Extract core MDXEditor setup
- [ ] Move plugin initialization logic
- [ ] Move core event handlers

#### Create editor toolbar component
- [ ] Create `webview-ui/src/components/editor/EditorToolbar.tsx`
- [ ] Extract `ToolbarWithCommentButton`
- [ ] Move custom toolbar elements
- [ ] Move toolbar event handlers

#### Create editor sidebar component
- [ ] Create `webview-ui/src/components/editor/EditorSidebar.tsx`
- [ ] Extract comment sidebar rendering
- [ ] Move sidebar resize handling
- [ ] Move sidebar content management

#### Create floating comment button component
- [ ] Create `webview-ui/src/components/editor/FloatingCommentButton.tsx`
- [ ] Extract floating button component
- [ ] Move positioning logic
- [ ] Move click handlers

#### Reorganize component directories
- [ ] Create `webview-ui/src/components/editor/` directory
- [ ] Create `webview-ui/src/components/comments/` directory
- [ ] Create `webview-ui/src/components/mermaid/` directory
- [ ] Create `webview-ui/src/components/plugins/` directory
- [ ] Create `webview-ui/src/components/shared/` directory
- [ ] Move existing components to appropriate directories

#### Refactor MDXEditorWrapper as composition root
- [ ] Reduce `MDXEditorWrapper.tsx` to composition logic only
- [ ] Import and compose all extracted hooks
- [ ] Import and compose all extracted components
- [ ] Ensure proper prop passing and state management
- [ ] Target: Reduce from 2,595 lines to ~200-300 lines

### Phase 3: Establish Patterns

#### Create index files
- [ ] Create `webview-ui/src/hooks/index.ts`
- [ ] Create `webview-ui/src/utils/index.ts` (extending existing)
- [ ] Create `webview-ui/src/constants/index.ts`
- [ ] Create `src/services/index.ts`
- [ ] Create index files for service subdirectories

#### Standardize imports
- [ ] Update all files to use barrel imports
- [ ] Remove direct file imports where index exists
- [ ] Ensure consistent import ordering
- [ ] Group imports by: external, internal services, internal components, internal utils

#### Add documentation
- [ ] Add JSDoc comments to all new public functions
- [ ] Document hook usage patterns
- [ ] Document service layer patterns
- [ ] Update README with new structure

### Post-Refactoring Verification

#### Functionality Testing
- [ ] **Run full test suite** - all tests pass
- [ ] **Manual testing** - editor loads correctly
- [ ] **Comment functionality** - create, edit, delete comments
- [ ] **Font selection** - font changes work
- [ ] **View modes** - source, rich text, diff views work
- [ ] **Sidebar** - comment sidebar functions correctly
- [ ] **Modal dialogs** - comment modals work
- [ ] **Floating button** - appears and functions correctly
- [ ] **Sync functionality** - document sync works
- [ ] **Mermaid diagrams** - mermaid editor works
- [ ] **Plugin functionality** - all editor plugins work

#### Build Verification
- [ ] **Extension builds** without errors or warnings
- [ ] **Webview builds** without errors or warnings  
- [ ] **Bundle size** - verify no significant increase
- [ ] **TypeScript compilation** - no type errors
- [ ] **Linting** - all files pass ESLint
- [ ] **Package installation** - extension installs correctly

#### Code Quality Checks
- [ ] **File sizes** - no file over 500 lines (target: 200-300)
- [ ] **Import statements** - clean and organized
- [ ] **Function complexity** - no functions over 50 lines
- [ ] **Single responsibility** - each file has one clear purpose
- [ ] **No code duplication** - shared logic properly extracted
- [ ] **Consistent patterns** - naming and structure follow standards

#### Performance Verification
- [ ] **Extension startup time** - no performance regression
- [ ] **Editor loading** - no slower than before
- [ ] **Memory usage** - no significant increase
- [ ] **Comment operations** - no performance degradation

---

## Success Metrics

### Quantitative Goals
- **MDXEditorWrapper.tsx**: Reduce from 2,595 lines to 200-300 lines (90% reduction)
- **extension.ts**: Reduce from 450 lines to 200-250 lines (50% reduction)
- **Maximum file size**: No file over 500 lines
- **Function complexity**: No function over 50 lines
- **Test coverage**: Maintain current coverage levels
- **Bundle size**: No increase over 5%

### Qualitative Goals
- **Clear separation of concerns**: Each file has single responsibility
- **Improved maintainability**: Easier to find and modify specific functionality
- **Better testability**: Smaller, focused units easier to test
- **Enhanced reusability**: Extracted utilities and hooks can be reused
- **Consistent patterns**: All similar functionality follows same organization
- **Better developer experience**: Faster navigation and understanding

## Risk Mitigation

### High-Risk Areas
1. **State management** - Ensure hooks maintain proper state relationships
2. **Event handlers** - Verify all callbacks still work after extraction  
3. **React lifecycle** - Ensure useEffect dependencies are correct
4. **Type safety** - Maintain TypeScript type safety throughout
5. **Plugin integration** - MDX editor plugins must continue to work

### Rollback Plan
- Maintain feature branch throughout refactoring
- Create checkpoints after each phase
- Keep original files as `.backup` until testing complete
- Document all changes for easy reversal if needed

## Future Improvements

After completing this refactoring, consider these additional improvements:

1. **Add unit tests** for extracted hooks and utilities
2. **Performance optimization** of comment handling
3. **Type safety improvements** with stricter TypeScript config
4. **Component library** - extract reusable UI components
5. **State management** - Consider Redux/Zustand for complex state
6. **Error boundaries** - Add error boundaries around major components
7. **Accessibility improvements** - Audit and improve WCAG compliance
8. **Documentation** - Add comprehensive component documentation

---

## Notes for Development Team

- **Zero functional changes** - This is purely organizational refactoring
- **Maintain backward compatibility** - All existing APIs should continue to work
- **Test extensively** - Each phase should be thoroughly tested before proceeding
- **Code review** - Each extracted component should be reviewed for quality
- **Documentation** - Update coding standards with new organizational patterns
- **Team alignment** - Ensure all developers understand new structure before merge

This refactoring represents a significant improvement in code organization that will make the project much more maintainable and easier to work with for the development team.