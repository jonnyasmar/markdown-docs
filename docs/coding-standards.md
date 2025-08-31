# Coding Standards

## Project Overview

Markdown Docs is a VSCode extension providing a WYSIWYG Markdown editor with inline commenting capabilities, built with TypeScript and React.

## Language & Framework Standards

### TypeScript Standards

* **Version**: TypeScript 4.9.4+ (extension) / 5.9.2+ (webview)
* **Target**: ES2020 (extension) / ESNext (webview)
* **Module System**: CommonJS (extension) / ESNext (webview)
* **Strict Mode**: Enabled for extension, disabled for webview
* **Source Maps**: Always generated for debugging

### Code Organization

#### Extension Layer (`/src`)

* **Structure**: Feature-based organization
  * `common/` - Shared types and interfaces
  * `editors/` - Custom editor implementations
  * `services/` - Business logic and utilities
  * `views/` - View providers
  * `utils/` - Helper functions
* **Entry Point**: `extension.ts`
* **Activation Events**: Defined in `package.json`

#### Webview Layer (`/webview-ui/src`)

* **Structure**: Component-based React architecture
  * `components/` - React components with co-located styles
  * `utils/` - Shared utilities and helpers
  * `types.ts` - TypeScript type definitions
* **Entry Points**:
  * `main.tsx` - Application bootstrap
  * `App.tsx` - Main application component
  * `EditorApp.tsx` - Editor-specific functionality

### Naming Conventions

#### Files

* **TypeScript/React**: PascalCase for components (`CommentModal.tsx`), camelCase for utilities (`textNormalization.ts`)
* **Styles**: Component.css pattern (`CommentModal.css`)
* **Tests**: `*.test.ts` pattern in `/test` directory

#### Code

* **Interfaces**: PascalCase with `I` prefix optional
* **Types**: PascalCase
* **Functions/Methods**: camelCase
* **Constants**: UPPER\_SNAKE\_CASE for true constants
* **Private Members**: Prefix with underscore (`_privateMethod`)

### Code Style

#### TypeScript/JavaScript

```typescript
// Function declarations
export function processDocument(content: string): ProcessedDocument {
  // Implementation
}

// Arrow functions for callbacks
const handler = (event: Event) => {
  // Handle event
};

// Async/await over promises
async function fetchData(): Promise<Data> {
  const result = await api.getData();
  return processResult(result);
}
```

#### React Components

```tsx
// Functional components with TypeScript
interface CommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  comment?: Comment;
}

export const CommentModal: React.FC<CommentModalProps> = ({ 
  isOpen, 
  onClose, 
  comment 
}) => {
  // Component implementation
  return (
    <div className="comment-modal">
      {/* JSX */}
    </div>
  );
};
```

### Testing Standards

* **Framework**: VSCode Test API
* **Location**: `src/test/` directory
* **Naming**: `*.test.ts` files
* **Coverage**: Focus on services and utilities
* **Manual Tests**: Available for complex scenarios

### Documentation Standards

#### Code Comments

* Use JSDoc for public APIs
* Inline comments for complex logic
* TODO comments include assignee and date

```typescript
/**
 * Parses markdown content and extracts anchors
 * @param content - The markdown content to parse
 * @returns Array of anchor definitions
 */
export function parseAnchors(content: string): Anchor[] {
  // Complex regex explanation here
  const pattern = /\{\{([^}]+)\}\}/g;
  // ...
}
```

### Error Handling

```typescript
// Use try-catch for async operations
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  logger.error('Operation failed', error);
  // Graceful fallback
  return defaultValue;
}

// Validate inputs
if (!isValidInput(input)) {
  throw new Error(`Invalid input: ${input}`);
}
```

### Performance Guidelines

* Lazy load heavy dependencies
* Use React.memo for expensive renders
* Debounce user input handlers
* Minimize webview-extension message passing

### Security Standards

* Sanitize all user input
* Use nonce for webview scripts
* Validate message origins
* No eval() or Function() constructors
* Content Security Policy enforcement

### Linting & Formatting

#### ESLint Configuration

* Parser: @typescript-eslint/parser
* Rules:
  * Semicolons: Required (warning)
  * Curly braces: Required (warning)
  * Equality: Use \=\=\= (warning)
  * No literal throws

#### Pre-commit Checks

```bash
npm run lint        # Lint all source files
npm run compile     # TypeScript compilation
npm run test        # Run test suite
```

### Git Workflow

* **Branch Naming**: `feature/description`, `fix/issue-number`
* **Commit Messages**: Conventional commits format
  * `feat:` New features
  * `fix:` Bug fixes
  * `docs:` Documentation changes
  * `refactor:` Code refactoring
  * `test:` Test additions/changes
* **PR Requirements**:
  * All tests passing
  * Lint checks clean
  * Description of changes

### Accessibility Standards

* ARIA labels for interactive elements
* Keyboard navigation support
* High contrast theme compatibility
* Screen reader friendly markup

### Bundle Size Guidelines

* Monitor dist/ output size
* Use RSpack for optimized builds
* Tree-shake unused imports
* Lazy load optional features

## Code Review Checklist

* [ ] TypeScript types properly defined
* [ ] Error handling implemented
* [ ] Tests added/updated
* [ ] Documentation updated
* [ ] Accessibility considered
* [ ] Performance impact assessed
* [ ] Security implications reviewed
* [ ] Follows naming conventions
* [ ] No console.log statements