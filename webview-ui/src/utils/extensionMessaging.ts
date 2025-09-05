/**
 * Centralized utility for posting messages to VS Code extension
 * Consolidates all webview-to-extension communication patterns
 */
import { FontFamily, WebviewMessage } from '../types';
import { logger } from './logger';

/**
 * Posts a message to the VS Code extension with consistent error handling and logging
 * @param message - The message to send to the extension
 */
export const postToExtension = (message: WebviewMessage): void => {
  if (!window.vscodeApi) {
    logger.warn('VS Code API not available - message not sent:', message.command);
    return;
  }

  try {
    logger.debug('Posting to extension:', message.command, message);
    window.vscodeApi.postMessage(message);
  } catch (error) {
    logger.error('Failed to post message to extension:', error, 'Message:', message);
  }
};

// Convenience functions for common message types
export const postContentEdit = (content: string): void => {
  postToExtension({
    command: 'edit',
    content,
  });
};

export const postContentSave = (content: string): void => {
  postToExtension({
    command: 'save',
    content,
  });
};

export const postDirtyState = (isDirty: boolean): void => {
  postToExtension({
    command: 'dirtyStateChanged',
    isDirty,
  });
};

export const postUserInteraction = (isInteracting: boolean): void => {
  postToExtension({
    command: 'setUserInteracting',
    isInteracting,
  });
};

export const postError = (content: string): void => {
  postToExtension({
    command: 'error',
    content,
  });
};

export const postExternalLink = (url: string): void => {
  postToExtension({
    command: 'openExternalLink',
    url,
  });
};

export const postFontSetting = (font: FontFamily): void => {
  postToExtension({
    command: 'setFont',
    font,
  });
};

export const postFontSizeSetting = (fontSize: number): void => {
  postToExtension({
    command: 'setFontSize',
    fontSize,
  });
};

export const postTextAlignSetting = (textAlign: string): void => {
  postToExtension({
    command: 'setTextAlign',
    textAlign,
  });
};

export const postBookViewSetting = (bookView: boolean): void => {
  postToExtension({
    command: 'setBookView',
    bookView,
  });
};

export const postBookViewWidthSetting = (bookViewWidth: string): void => {
  postToExtension({
    command: 'setBookViewWidth',
    bookViewWidth,
  });
};

export const postBookViewMarginSetting = (bookViewMargin: string): void => {
  postToExtension({
    command: 'setBookViewMargin',
    bookViewMargin,
  });
};

export const postReady = (): void => {
  postToExtension({
    command: 'ready',
  });
};

export const postGetFont = (): void => {
  postToExtension({
    command: 'getFont',
  });
};

export const postImageUri = (data: string | ArrayBuffer): void => {
  postToExtension({
    command: 'getImageUri',
    data,
  });
};
