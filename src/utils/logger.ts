// Centralized logging utility for Markdown Docs extension (Node.js/VS Code side)
// All console output is prefixed for easy filtering

const PREFIX = '[Markdown Docs]';

export const logger = {
  log: (message: string, ...args: unknown[]) => {
    console.log(`${PREFIX} ${message}`, ...args);
  },
  
  error: (message: string, ...args: unknown[]) => {
    console.error(`${PREFIX} ERROR: ${message}`, ...args);
  },
  
  warn: (message: string, ...args: unknown[]) => {
    console.warn(`${PREFIX} WARN: ${message}`, ...args);
  },
  
  debug: (message: string, ...args: unknown[]) => {
    // Only log in development
    if (process.env.NODE_ENV === 'development') {
      console.debug(`${PREFIX} DEBUG: ${message}`, ...args);
    }
  },
  
  info: (message: string, ...args: unknown[]) => {
    console.info(`${PREFIX} INFO: ${message}`, ...args);
  },
};