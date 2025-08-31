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

* **Structure**: Feature-based organization with layered architecture
  * `common/` - Shared types and interfaces
  * `config/` - Configuration modules and settings
  * `handlers/` - Event and message handlers
  * `providers/` - VSCode providers (editor, tree, etc.)
  * `services/` - Business logic organized by domain
    * `services/markdown/` - Markdown processing services
    * `services/editor/` - Editor-related services
    * `services/webview/` - Webview communication services
  * `utils/` - Pure utility functions
  * `views/` - View providers
* **Entry Point**: `extension.ts` (composition root only)
* **Activation Events**: Defined in `package.json`
* **File Size Limit**: Maximum 500 lines per file
* **Single Responsibility**: Each file serves one clear purpose

#### Webview Layer (`/webview-ui/src`)

* **Structure**: Feature-based React architecture with clear separation
  * `components/` - React components organized by feature
    * `components/editor/` - Core editor components
    * `components/comments/` - Comment-related components
    * `components/mermaid/` - Mermaid diagram components
    * `components/plugins/` - Editor plugin components
    * `components/shared/` - Reusable UI components
  * `hooks/` - Custom React hooks for state management
  * `utils/` - Pure utility functions
  * `constants/` - Application constants and configuration
  * `types.ts` - TypeScript type definitions
* **Entry Points**:
  * `main.tsx` - Application bootstrap
  * `App.tsx` - Main application component
  * `EditorApp.tsx` - Editor-specific functionality
* **Component Size Limit**: Maximum 300 lines per component
* **Hook Extraction**: Complex state logic extracted to custom hooks
* **Utility Separation**: Business logic separated from UI components

#### Organizational Principles

* **Single Responsibility Principle**: Each file, function, and component has one reason to change
* **Feature Cohesion**: Related functionality grouped together
* **Dependency Direction**: Higher-level modules depend on lower-level modules
* **Import Organization**: Barrel exports via index.ts files
* **Co-location**: Styles and tests near their components

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

### File Organization Standards

#### File Size Limits
* **Maximum file size**: 500 lines (extension), 300 lines (components)
* **Target file size**: 200-250 lines for optimal maintainability
* **Function size**: Maximum 50 lines per function
* **Component complexity**: Extract hooks when component exceeds 200 lines

#### Directory Structure Standards
```
src/
├── config/           # Configuration modules
├── handlers/         # Event and message handlers  
├── providers/        # VSCode API providers
├── services/         # Business logic by domain
│   ├── markdown/     # Markdown processing
│   ├── editor/       # Editor services
│   └── webview/      # Webview communication
└── utils/           # Pure utility functions

webview-ui/src/
├── components/       # React components by feature
│   ├── editor/       # Core editor functionality
│   ├── comments/     # Comment management
│   ├── mermaid/      # Diagram components
│   ├── plugins/      # Editor plugins
│   └── shared/       # Reusable components
├── hooks/           # Custom React hooks
├── utils/           # Pure utility functions
└── constants/       # Application constants
```

#### Import Standards
* **Barrel exports**: Use index.ts files for clean imports
* **Import grouping**: External → Services → Components → Utils
* **Relative imports**: Prefer absolute imports via barrel exports
* **Import organization**: Group related imports together

```typescript
// Good: Barrel imports
import { useCommentManagement, useEditorState } from '../hooks';
import { CommentModal, CommentList } from '../components/comments';
import { editorUtils, markdownProcessing } from '../utils';

// Avoid: Direct file imports when barrel exists
import { useCommentManagement } from '../hooks/useCommentManagement';
import { CommentModal } from '../components/comments/CommentModal';
```

#### Component Organization Standards

##### Hook Extraction Rules
Extract custom hooks when components have:
* More than 3 useState calls
* Complex useEffect logic (>10 lines)
* Reusable state management patterns
* Business logic mixed with UI logic

```typescript
// Good: Extracted hook
const useCommentManagement = () => {
  const [comments, setComments] = useState([]);
  const [editingComment, setEditingComment] = useState(null);
  
  const handleDeleteComment = useCallback((id) => {
    // Complex logic here
  }, [comments]);
  
  return { comments, editingComment, handleDeleteComment };
};

// Component uses extracted hook
const CommentSection = () => {
  const { comments, editingComment, handleDeleteComment } = useCommentManagement();
  return <div>{/* UI only */}</div>;
};
```

##### Component Composition Pattern
Large components should be composition roots that orchestrate smaller components:

```typescript
// Good: Composition root pattern
const MDXEditorWrapper = (props) => {
  const editorState = useEditorState(props);
  const commentManagement = useCommentManagement();
  const sidebarState = useSidebar();
  
  return (
    <div className="editor-container">
      <EditorCore {...editorState} />
      <EditorSidebar {...sidebarState} />
      <FloatingCommentButton {...commentManagement} />
      <CommentModal {...commentManagement} />
    </div>
  );
};
```

#### Service Layer Standards

##### Service Organization
* **Domain-based**: Services organized by business domain
* **Interface-based**: All services implement clear interfaces
* **Dependency injection**: Services receive dependencies via constructor
* **Single responsibility**: Each service handles one business domain

```typescript
// Good: Service interface
interface IMarkdownProcessor {
  processContent(content: string): ProcessedContent;
  extractComments(content: string): Comment[];
  validateMarkdown(content: string): ValidationResult;
}

// Implementation
export class MarkdownProcessor implements IMarkdownProcessor {
  constructor(private logger: ILogger) {}
  
  processContent(content: string): ProcessedContent {
    // Implementation
  }
}
```

##### Service Registration Pattern
```typescript
// services/index.ts - Barrel export with clear organization
export * from './markdown';
export * from './editor';
export * from './webview';

// services/markdown/index.ts
export { MarkdownProcessor } from './markdownProcessor';
export { DirectiveService } from './directiveService';
export { TextAnalysisService } from './textAnalysisService';
```

#### Utility Organization Standards

##### Utility Function Rules
* **Pure functions**: No side effects
* **Single purpose**: One clear responsibility
* **Testable**: Easy to unit test
* **Reusable**: Can be used across the application

```typescript
// Good: Pure utility function
export const calculateCommentPosition = (
  content: string, 
  commentId: string
): Position | null => {
  // Pure calculation logic
  return position;
};

// Good: Utility module organization
// utils/commentUtils.ts
export const calculateCommentPosition = ...;
export const sortCommentsByPosition = ...;
export const validateCommentFormat = ...;
```

## Code Review Checklist

### Structure & Organization
* [ ] File size under limit (500 lines extension, 300 lines webview)
* [ ] Single responsibility principle followed
* [ ] Appropriate directory structure used
* [ ] Barrel imports used where available
* [ ] Components properly decomposed

### React Component Standards
* [ ] Complex state extracted to custom hooks
* [ ] Business logic separated from UI logic
* [ ] Component composition over large monolithic components
* [ ] Proper prop types and interfaces defined

### Service Layer
* [ ] Services properly organized by domain
* [ ] Clear interfaces defined
* [ ] Dependency injection used appropriately
* [ ] Single responsibility maintained

### Code Quality
* [ ] TypeScript types properly defined
* [ ] Error handling implemented
* [ ] Tests added/updated
* [ ] Documentation updated
* [ ] Accessibility considered
* [ ] Performance impact assessed
* [ ] Security implications reviewed
* [ ] Follows naming conventions
* [ ] No console.log statements