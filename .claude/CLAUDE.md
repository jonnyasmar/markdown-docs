# Markdown Docs Project Rules

## Project Context
VSCode extension for rendering markdown documentation with enhanced UI components and interactive features.

## Development Rules

### Testing

**CRITICAL RULE**: Never run `npm run compile`, `npm run build`, or similar commands during development. 

When you complete a task and are ready for testing, the ONLY command you should run is:

```
npx vsce package && code --uninstall-extension jonnyasmar.markdown-docs && code --install-extension markdown-docs-$(jq -r .version package.json).vsix --force
```

**Key Points:**
- No intermediate compilation commands
- Only package and install when task is complete
- All testing beyond that will be manual and you will await feedback from the user

### Committing

You will not make any git commits unless explicitly instructed to do so.