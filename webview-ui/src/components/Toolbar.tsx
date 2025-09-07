import { DiffViewWrapper } from '@/components/DiffViewWrapper';
import { ToolbarGroups } from '@/components/ToolbarGroups';
import { CustomSearchInput } from '@/components/plugins/customSearchPlugin';
import { FontFamily } from '@/types';
import { memo, useCallback, useEffect, useRef, useState } from 'react';

export const Toolbar = memo(
  ({
    selectedFont,
    handleFontChange,
    availableFonts,
    currentViewMode,
    fontSize,
    handleFontSizeChange,
    textAlign,
    handleTextAlignChange,
    bookView,
    handleBookViewToggle,
    localBookViewWidth,
    localBookViewMargin,
    handleBookViewWidthChange,
    handleBookViewMarginChange,
  }: {
    selectedFont: string;
    handleFontChange: (font: FontFamily) => void;
    availableFonts: string[];
    bookView: boolean;
    bookViewWidth: string;
    bookViewMargin: string;
    currentViewMode: 'rich-text' | 'source' | 'diff';
    onViewModeChange: (mode: 'rich-text' | 'source' | 'diff') => void;
    fontSize: number;
    handleFontSizeChange: (delta: number) => void;
    textAlign: string;
    handleTextAlignChange: (align: string) => void;
    handleBookViewToggle: () => void;
    localBookViewWidth: string;
    localBookViewMargin: string;
    handleBookViewWidthChange: (width: string) => void;
    handleBookViewMarginChange: (margin: string) => void;
  }) => {
    const [isOverflowOpen, setIsOverflowOpen] = useState(false);
    const [hiddenGroups, setHiddenGroups] = useState<string[]>([]);
    const overflowTriggerRef = useRef<HTMLButtonElement>(null);
    const toolbarRef = useRef<HTMLDivElement>(null);

    const handleOverflowToggle = () => {
      setIsOverflowOpen(!isOverflowOpen);
    };

    const updateResponsiveState = useCallback(() => {
      if (!toolbarRef.current) {
        return;
      }

      const width = toolbarRef.current.offsetWidth;
      const newHidden: string[] = [];

      // Use the same thresholds from CSS variables - updated for new groups
      if (width < 1160 + 25 + 100) {
        newHidden.push('diff-view');
      }
      if (width < 1120 + 25 + 100) {
        newHidden.push('book-view');
      }
      if (width < 1085 + 25) {
        newHidden.push('lists');
      }
      if (width < 980 + 25) {
        newHidden.push('text-align');
      }
      if (width < 870 + 25) {
        newHidden.push('blocks');
      }
      if (width < 740) {
        newHidden.push('admonition');
      }
      if (width < 660) {
        newHidden.push('formatting');
      }
      if (width < 560) {
        newHidden.push('font-size');
      }
      if (width < 475) {
        newHidden.push('font-style');
      }
      if (width < 320) {
        newHidden.push('display-font');
      }
      // Removed undo-redo group - VS Code handles undo/redo

      setHiddenGroups(newHidden);
    }, []);

    // Handle click outside to close overflow menu
    useEffect(() => {
      if (!isOverflowOpen) {
        return;
      }

      const handleClickOutside = (event: MouseEvent) => {
        if (
          overflowTriggerRef.current &&
          !overflowTriggerRef.current.contains(event.target as Node) &&
          !(event.target as Element).closest('.overflow-menu')
        ) {
          setIsOverflowOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOverflowOpen]);

    // Set up ResizeObserver to watch toolbar width changes
    useEffect(() => {
      if (!toolbarRef.current) {
        return;
      }

      const resizeObserver = new ResizeObserver(() => {
        updateResponsiveState();
      });

      resizeObserver.observe(toolbarRef.current);

      // Initial measurement
      updateResponsiveState();

      return () => resizeObserver.disconnect();
    }, [updateResponsiveState]);

    return (
      <div ref={toolbarRef} className="responsive-toolbar">
        {/* Main toolbar content - conditional based on view mode */}
        <div className={`toolbar-main ${currentViewMode !== 'rich-text' ? 'source-toolbar' : ''}`}>
          <DiffViewWrapper shouldShow={!hiddenGroups.includes('diff-view')} currentViewMode={currentViewMode}>
            <ToolbarGroups
              selectedFont={selectedFont}
              handleFontChange={handleFontChange}
              availableFonts={availableFonts}
              isOverflow={false}
              hiddenGroups={hiddenGroups}
              currentViewMode={currentViewMode}
              fontSize={fontSize}
              handleFontSizeChange={handleFontSizeChange}
              textAlign={textAlign}
              handleTextAlignChange={handleTextAlignChange}
              bookView={bookView}
              handleBookViewToggle={handleBookViewToggle}
              localBookViewWidth={localBookViewWidth}
              localBookViewMargin={localBookViewMargin}
              handleBookViewWidthChange={handleBookViewWidthChange}
              handleBookViewMarginChange={handleBookViewMarginChange}
            />
          </DiffViewWrapper>

          {/* Search - only in rich-text mode */}
          {currentViewMode !== 'source' && (
            <div className="toolbar-search">
              <CustomSearchInput />
            </div>
          )}
        </div>

        {/* Overflow menu trigger - only in rich-text mode */}
        {currentViewMode !== 'source' && (
          <div className="toolbar-overflow">
            <button
              ref={overflowTriggerRef}
              className={`overflow-trigger ${hiddenGroups.length > 0 ? 'visible' : ''}`}
              title="More options"
              onClick={handleOverflowToggle}
            >
              ⋮
            </button>

            <div className={`overflow-menu ${isOverflowOpen ? 'visible' : ''}`}>
              <div className="overflow-menu-content">
                <DiffViewWrapper shouldShow={hiddenGroups.includes('diff-view')} currentViewMode={currentViewMode}>
                  <ToolbarGroups
                    selectedFont={selectedFont}
                    handleFontChange={handleFontChange}
                    availableFonts={availableFonts}
                    isOverflow={true}
                    hiddenGroups={hiddenGroups}
                    currentViewMode={currentViewMode}
                    fontSize={fontSize}
                    handleFontSizeChange={handleFontSizeChange}
                    textAlign={textAlign}
                    handleTextAlignChange={handleTextAlignChange}
                    bookView={bookView}
                    handleBookViewToggle={handleBookViewToggle}
                    localBookViewWidth={localBookViewWidth}
                    localBookViewMargin={localBookViewMargin}
                    handleBookViewWidthChange={handleBookViewWidthChange}
                    handleBookViewMarginChange={handleBookViewMarginChange}
                  />
                </DiffViewWrapper>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  },
);
