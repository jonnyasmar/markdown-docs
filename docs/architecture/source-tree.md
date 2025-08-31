# Source Tree Documentation

## Directory Structure Overview

```
markdown-docs/
├── src/                      # Extension source code
├── webview-ui/              # React-based webview application
├── dist/                    # Compiled extension output
├── out/                     # TypeScript compilation output
├── media/                   # Static assets
├── node_modules/            # Extension dependencies
└── Configuration files      # Build, lint, and project configs
```

## Detailed Structure

### Root Directory (`/`)

Configuration and project files:

* `package.json` - Extension manifest and dependencies
* `tsconfig.json` - TypeScript configuration for extension
* `rspack.config.js` - RSpack bundler configuration
* `webpack.config.js` - Webpack bundler configuration (fallback)
* `.eslintrc.json` - ESLint configuration
* `.gitignore` - Git ignore patterns
* `LICENSE` - Project license
* `README.md` - Project documentation

### Extension Source (`/src`)

#### `/src/common/`

Shared types and interfaces:

* `types.ts` - Core type definitions for the extension

#### `/src/editors/`

Custom editor implementations:

* `markdownEditor.ts` - Main markdown editor provider

#### `/src/services/`

Business logic and core functionality:

* `anchor.ts` - Anchor tag parsing and management
* `comment.ts` - Comment system implementation
* `directive.ts` - Directive processing
* `documentParser.ts` - Document parsing utilities
* `formatting.ts` - Text formatting operations
* `frontmatter.ts` - YAML frontmatter handling

#### `/src/utils/`

Helper utilities:

* `logger.ts` - Logging utilities

#### `/src/views/`

View providers:

* `commentView.ts` - Comment panel view provider

#### `/src/test/`

Test files:

* `anchor.test.ts` - Anchor functionality tests
* `formatting.test.ts` - Formatting tests
* `frontmatter.test.ts` - Frontmatter parsing tests
* `manual-test.ts` - Manual testing utilities
* `anchor-manual-test.ts` - Manual anchor testing

#### `/src/`

Entry point:

* `extension.ts` - Main extension activation and lifecycle

### Webview UI (`/webview-ui`)

#### `/webview-ui/src/`

React application root:

* `main.tsx` - Application entry point
* `App.tsx` - Main application component
* `EditorApp.tsx` - Editor-specific application logic
* `App.css` - Global application styles
* `types.ts` - TypeScript type definitions

#### `/webview-ui/src/components/`

React components:

* `CommentItem.tsx/.css` - Individual comment display
* `CommentList.tsx/.css` - Comment list container
* `CommentModal.tsx/.css` - Comment creation/editing modal
* `ErrorBoundary.tsx` - Error handling wrapper
* `MDXEditorWrapper.tsx/.css` - MDX editor integration
* `MermaidEditor.tsx/.css` - Mermaid diagram editor
* `SimplifiedAngleBracketPlugin.tsx` - Custom MDX plugin
* `focus-styles.css` - Focus state styling

#### `/webview-ui/src/utils/`

Utility functions:

* `codeBlockComments.ts` - Code block comment handling
* `logger.ts` - Webview logging utilities
* `textNormalization.ts` - Text processing utilities

#### `/webview-ui/`

Configuration files:

* `package.json` - Webview dependencies
* `tsconfig.json` - TypeScript configuration
* `tsconfig.node.json` - Node-specific TS config
* `rspack.config.js` - Webview bundler configuration
* `webpack.config.js` - Alternative bundler config
* `index.html` - Webview HTML template

### Build Output Directories

#### `/dist/`

Bundled extension output:

* `extension.js` - Compiled and bundled extension code
* `extension.js.map` - Source map for debugging
* Webview assets (when built)

#### `/out/`

TypeScript compilation output (mirrors src/ structure):

* Compiled JavaScript files
* Source maps for debugging

### Static Assets (`/media`)

* `icon.png` - Extension icon
* `screenshot.png` - Marketplace screenshot
* `promo.html` - Promotional materials

## File Naming Conventions

### TypeScript/JavaScript Files

* **Components**: PascalCase (`CommentModal.tsx`)
* **Utilities**: camelCase (`textNormalization.ts`)
* **Tests**: `*.test.ts` pattern
* **Services**: camelCase (`documentParser.ts`)

### Style Files

* **Component styles**: Match component name (`CommentModal.css`)
* **Global styles**: Descriptive names (`focus-styles.css`)

### Configuration Files

* **Root configs**: Standard names (`.eslintrc.json`, `tsconfig.json`)
* **Build configs**: Tool-specific (`rspack.config.js`, `webpack.config.js`)

## Module Dependencies

### Extension Layer Dependencies

```
extension.ts
├── editors/markdownEditor.ts
│   ├── services/documentParser.ts
│   ├── services/comment.ts
│   ├── services/anchor.ts
│   └── services/frontmatter.ts
├── views/commentView.ts
└── utils/logger.ts
```

### Webview Layer Dependencies

```
main.tsx
├── App.tsx / EditorApp.tsx
│   ├── components/MDXEditorWrapper.tsx
│   │   └── @mdxeditor/editor
│   ├── components/CommentList.tsx
│   │   └── components/CommentItem.tsx
│   ├── components/CommentModal.tsx
│   └── components/MermaidEditor.tsx
│       └── mermaid
└── utils/
    ├── logger.ts
    ├── textNormalization.ts
    └── codeBlockComments.ts
```

## Build Artifacts

### Development Build

* Source maps included
* No minification
* Fast refresh enabled

### Production Build

* Minified code
* Hidden source maps
* Optimized bundle size
* Tree-shaken imports

## Important Files

### Entry Points

1. **Extension**: `src/extension.ts`
2. **Webview**: `webview-ui/src/main.tsx`

### Configuration Files

1. **Extension Manifest**: `package.json`
2. **TypeScript Config**: `tsconfig.json`, `webview-ui/tsconfig.json`
3. **Bundler Config**: `rspack.config.js`, `webpack.config.js`

### Key Services

1. **Document Parser**: `src/services/documentParser.ts`
2. **Comment System**: `src/services/comment.ts`
3. **MDX Editor**: `webview-ui/src/components/MDXEditorWrapper.tsx`

## Development Workflow Files

### Git Ignored

* `node_modules/` - Dependencies
* `dist/` - Build output
* `out/` - Compilation output
* `.vscode/` - IDE settings
* `*.vsix` - Extension packages
* `.DS_Store` - OS files

### Generated Files

* `package-lock.json` - Dependency lock file
* `*.js.map` - Source maps
* `*.tsbuildinfo` - TypeScript build info

## Testing Structure

* Unit tests in `src/test/`
* Manual test utilities provided
* Test naming convention: `*.test.ts`
* Test output in `out/test/`

## Documentation Files

* `README.md` - User documentation
* `LICENSE` - MIT license
* `CHANGELOG.md` - Version history (if present)
* This file (`source-tree.md`) - Architecture documentation