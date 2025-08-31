# Technology Stack

## Core Technologies

### Extension Development

* **Platform**: Visual Studio Code Extension API v1.74.0+
* **Language**: TypeScript 4.9.4
* **Runtime**: Node.js (VSCode's built-in)
* **Module Bundler**: RSpack 1.5.1 (primary) / Webpack 5.75.0 (fallback)

### Webview UI

* **Framework**: React 19.1.1
* **Language**: TypeScript 5.9.2
* **Bundler**: RSpack 1.5.1
* **Styling**: CSS Modules with component-specific stylesheets

## Dependencies

### Extension Dependencies

```json
{
  "uuid": "^11.1.0",      // Unique identifier generation
  "yaml": "^2.8.1"        // YAML parsing for frontmatter
}
```

### Webview Dependencies

```json
{
  "@mdxeditor/editor": "^3.19.0",  // Rich markdown editor component
  "marked": "^12.0.2",              // Markdown parsing and rendering
  "mermaid": "^11.10.1",            // Diagram and flowchart rendering
  "react": "^19.1.1",               // UI framework
  "react-dom": "^19.1.1"            // React DOM rendering
}
```

## Development Tools

### Build Tools

* **RSpack**: Modern Rust-based bundler for fast builds
  * Configuration: `rspack.config.js`
  * Development server with HMR
  * Production optimizations
* **Webpack**: Fallback bundler option
  * Configuration: `webpack.config.js`
  * Tree shaking and code splitting

### TypeScript Configuration

* **Extension**:
  * Target: ES2020
  * Module: CommonJS
  * Strict mode enabled
* **Webview**:
  * Target: ESNext
  * Module: ESNext
  * JSX: react-jsx
  * Strict mode disabled

### Quality Assurance

* **Linting**: ESLint with TypeScript plugin
* **Testing**: VSCode Test Framework
* **Type Checking**: TypeScript compiler

## Architecture Components

### VSCode Extension Layer

* **Custom Editor Provider**: Handles `.md` files
* **Webview Provider**: Manages React-based UI
* **Command Palette Integration**: Custom commands
* **Context Menu Integration**: File explorer actions

### Webview Architecture

* **MDX Editor**: Rich markdown editing experience
* **Comment System**: Inline commenting functionality
* **Mermaid Integration**: Diagram support
* **Error Boundaries**: Graceful error handling

### Communication Layer

* **Message Passing**: PostMessage API for extension-webview communication
* **State Management**: Local state with React hooks
* **Data Persistence**: VSCode workspace storage

## Browser Compatibility

* **Polyfills**:
  * `buffer`: Node.js buffer API
  * `crypto-browserify`: Cryptographic functions
  * `stream-browserify`: Node.js streams
  * `process`: Process global
  * `path-browserify`: Path utilities
  * `os-browserify`: OS utilities
  * `util`: Node.js utilities

## Build Pipeline

### Development Build

```bash
npm run compile         # Full build with RSpack
npm run watch          # Watch mode for development
npm run compile:webview # Build webview only
```

### Production Build

```bash
npm run package        # Production build with optimizations
vsce package          # Create .vsix extension package
```

### Alternative Builds

```bash
npm run build:webpack  # Use Webpack instead of RSpack
npm run build:rspack   # Explicitly use RSpack
```

## Performance Optimizations

* **Code Splitting**: Lazy loading of heavy components
* **Tree Shaking**: Remove unused code
* **Minification**: Production builds are minified
* **Source Maps**: Hidden source maps in production
* **Bundle Analysis**: Monitor bundle sizes

## Security Measures

* **Content Security Policy**: Strict CSP for webviews
* **Nonce-based Scripts**: Prevent script injection
* **Input Sanitization**: Markdown content sanitization
* **Trusted Types**: Where supported

## Development Environment

### Required Tools

* Node.js 16.x or higher
* npm or yarn
* Visual Studio Code
* Git

### Recommended Extensions

* ESLint
* TypeScript and JavaScript Language Features
* Prettier (optional)

## Deployment

### Publishing

* **Marketplace**: Visual Studio Code Marketplace
* **Publisher**: jonnyasmar
* **Package Format**: .vsix
* **Version Management**: Semantic versioning

### Distribution Channels

* VS Code Marketplace (primary)
* GitHub Releases (alternative)
* Manual installation via .vsix

## Monitoring & Analytics

* **Error Tracking**: Console logging with levels
* **Performance Metrics**: Build time monitoring
* **Bundle Size Tracking**: Dist folder analysis

## Future Considerations

* **Potential Migrations**:
  * Consider Vite for faster development builds
  * Evaluate Bun as alternative runtime
  * Explore Tauri for standalone app version
* **Scalability**:
  * WebWorker for heavy markdown processing
  * Virtual scrolling for large documents
  * Incremental parsing strategies

## Technology Decision Rationale

### Why RSpack?

* Rust-based for superior performance
* Drop-in Webpack replacement
* Faster build times (3-5x improvement)
* Active development and community

### Why React 19?

* Latest stable version
* Improved performance
* Better TypeScript support
* Concurrent features

### Why MDXEditor?

* Comprehensive markdown editing features
* Extensible plugin architecture
* Active maintenance
* Good TypeScript support

### Why Mermaid?

* Industry standard for diagrams
* Extensive diagram types
* Good documentation
* Active community