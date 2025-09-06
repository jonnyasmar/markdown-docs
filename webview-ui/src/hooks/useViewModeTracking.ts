import { logger } from '@/utils/logger';
import { useEffect } from 'react';

export const useViewModeTracking = (onViewModeChange: (mode: 'rich-text' | 'source' | 'diff') => void) => {
  useEffect(() => {
    let lastViewMode: 'rich-text' | 'source' | 'diff' = 'rich-text';

    const checkViewMode = () => {
      const sourceEditor: HTMLElement | null = document.querySelector('.mdxeditor-source-editor');
      const diffEditor: HTMLElement | null = document.querySelector('.mdxeditor-diff-editor');
      const richTextEditor: HTMLElement | null = document.querySelector('.mdxeditor-rich-text-editor');

      let currentMode: 'rich-text' | 'source' | 'diff' = 'rich-text';

      if (sourceEditor && sourceEditor.style.display !== 'none') {
        currentMode = 'source';
      } else if (diffEditor && diffEditor.style.display !== 'none') {
        currentMode = 'diff';
      } else if (richTextEditor && richTextEditor.style.display !== 'none') {
        currentMode = 'rich-text';
      }

      if (currentMode !== lastViewMode) {
        logger.debug('View mode changed from', lastViewMode, 'to', currentMode);
        lastViewMode = currentMode;
        onViewModeChange(currentMode);
      }
    };

    // Check immediately
    checkViewMode();

    // Set up observer for DOM changes
    const observer = new MutationObserver(() => {
      checkViewMode();
    });

    const editorContainer = document.querySelector('.mdxeditor');
    if (editorContainer) {
      observer.observe(editorContainer, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class'],
      });
    }

    return () => {
      observer.disconnect();
    };
  }, [onViewModeChange]);
};
