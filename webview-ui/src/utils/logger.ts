// Centralized logging utility for Markdown Docs extension
// All console output is prefixed for easy filtering

const PREFIX = '[Markdown Docs]';

export const logger = {
  log: (message: string, ...args: any[]) => {
    console.log(`${PREFIX} ${message}`, ...args);
  },
  
  error: (message: string, ...args: any[]) => {
    console.error(`${PREFIX} ERROR: ${message}`, ...args);
  },
  
  warn: (message: string, ...args: any[]) => {
    console.warn(`${PREFIX} WARN: ${message}`, ...args);
  },
  
  debug: (message: string, ...args: any[]) => {
    // Only log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`${PREFIX} DEBUG: ${message}`, ...args);
    }
  },
  
  info: (message: string, ...args: any[]) => {
    console.info(`${PREFIX} INFO: ${message}`, ...args);
  }
};