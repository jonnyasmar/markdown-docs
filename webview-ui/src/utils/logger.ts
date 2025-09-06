// Centralized logging utility for Markdown Docs extension
// All console output is prefixed for easy filtering

const PREFIX = '[Markdown Docs]';

interface Logger {
  log: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
}

export const logger: Logger = {
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
    // Always log debug in webview (can be filtered in dev tools)
    // eslint-disable-next-line no-console
    console.debug(`${PREFIX} DEBUG: ${message}`, ...args);
  },

  info: (message: string, ...args: unknown[]) => {
    console.info(`${PREFIX} INFO: ${message}`, ...args);
  },
};
