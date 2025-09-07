import { FontFamily } from '@/types';
import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  ConditionalContents,
  CreateLink,
  InsertAdmonition,
  InsertCodeBlock,
  InsertFrontmatter,
  InsertTable,
  InsertThematicBreak,
  ListsToggle,
  Select,
  Separator,
} from '@mdxeditor/editor';
import { AArrowDown, AArrowUp, AlignCenter, AlignJustify, AlignLeft, AlignRight, BookOpen, Undo } from 'lucide-react';
import { memo } from 'react';

export const ToolbarGroups = memo(
  ({
    selectedFont,
    handleFontChange,
    availableFonts,
    isOverflow = false,
    hiddenGroups = [],
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
    isOverflow?: boolean;
    hiddenGroups?: string[];
    currentViewMode?: 'rich-text' | 'source' | 'diff';
    fontSize?: number;
    handleFontSizeChange?: (delta: number) => void;
    textAlign?: string;
    handleTextAlignChange?: (align: string) => void;
    bookView?: boolean;
    localBookViewWidth?: string;
    localBookViewMargin?: string;
    handleBookViewToggle: () => void;
    handleBookViewWidthChange: (width: string) => void;
    handleBookViewMarginChange: (margin: string) => void;
  }) => {
    const groupClass = isOverflow ? 'overflow-group' : 'toolbar-group';

    const shouldShowGroup = (groupName: string) => {
      return currentViewMode !== 'source' && isOverflow
        ? hiddenGroups.includes(groupName)
        : !hiddenGroups.includes(groupName);
    };

    return (
      <>
        {/* Block Type (text style) - before font selection */}
        {shouldShowGroup('display-font') && (
          <>
            <div
              className={`${groupClass} ${isOverflow ? 'overflow-group verflow-display-font' : 'display-font-group'}`}
            >
              <BlockTypeSelect />
              {!isOverflow && <Separator />}
            </div>
          </>
        )}

        {/* Font Selection - now properly positioned */}
        {shouldShowGroup('font-style') && (
          <>
            <div className={`${groupClass} ${isOverflow ? 'overflow-group overflow-font-style' : 'font-style-group'}`}>
              <Select
                value={selectedFont}
                onChange={val => handleFontChange(val as FontFamily)}
                triggerTitle="Select Font"
                placeholder="Font"
                items={availableFonts.map((font: string) => ({
                  value: font,
                  label: font,
                  className: `font-option-${font.toLowerCase().replace(/\s+/g, '-')}`,
                }))}
              />
              {!isOverflow && <Separator />}
            </div>
          </>
        )}

        {/* Font Size Controls */}
        {shouldShowGroup('font-size') && handleFontSizeChange && (
          <>
            <div className={`${groupClass} ${isOverflow ? 'overflow-group overflow-font-size' : 'font-size-group'}`}>
              <button
                className="custom-button _toolbarToggleItem_1e2ox_208"
                title="Decrease Font Size"
                onClick={() => handleFontSizeChange(-1)}
              >
                <AArrowDown size={16} />
              </button>
              <button
                className="custom-button _toolbarToggleItem_1e2ox_208"
                title="Increase Font Size"
                onClick={() => handleFontSizeChange(1)}
              >
                <AArrowUp size={16} />
              </button>
              <button
                className="custom-button _toolbarToggleItem_1e2ox_208"
                title="Reset Font Size"
                onClick={() => handleFontSizeChange?.(14 - (fontSize ?? 14))}
              >
                <Undo size={16} />
              </button>
              {!isOverflow && <Separator />}
            </div>
          </>
        )}

        {shouldShowGroup('formatting') && (
          <>
            <div className={`${groupClass} ${isOverflow ? 'overflow-group overflow-formatting' : 'formatting-group'}`}>
              <BoldItalicUnderlineToggles />
              {!isOverflow && <Separator />}
            </div>
          </>
        )}

        {shouldShowGroup('admonition') && (
          <>
            <div
              className={`${groupClass} ${isOverflow ? 'overflow-admonition overflow-admonition' : 'admonition-group'}`}
            >
              <InsertAdmonition />
              {!isOverflow && <Separator />}
            </div>
          </>
        )}

        {shouldShowGroup('blocks') && (
          <>
            <div className={`${groupClass} ${isOverflow ? 'overflow-group overflow-blocks' : 'blocks-group'}`}>
              <ConditionalContents
                options={[
                  {
                    when: editor => editor?.editorType === 'codeblock',
                    contents: () => null,
                  },
                  {
                    fallback: () => <InsertCodeBlock />,
                  },
                ]}
              />
              <CreateLink />
              <InsertFrontmatter />
              <InsertTable />
              <InsertThematicBreak />
              {!isOverflow && <Separator />}
            </div>
          </>
        )}

        {/* Text Justification Controls */}
        {shouldShowGroup('text-align') && handleTextAlignChange && (
          <>
            <div className={`${groupClass} ${isOverflow ? 'overflow-group overflow-text-align' : 'text-align-group'}`}>
              <button
                className={`custom-button _toolbarToggleItem_1e2ox_208 ${textAlign === 'left' ? 'active' : ''}`}
                title="Align Left"
                onClick={() => handleTextAlignChange('left')}
              >
                <AlignLeft size={16} />
              </button>
              <button
                className={`custom-button _toolbarToggleItem_1e2ox_208 ${textAlign === 'center' ? 'active' : ''}`}
                title="Align Center"
                onClick={() => handleTextAlignChange('center')}
              >
                <AlignCenter size={16} />
              </button>
              <button
                className={`custom-button _toolbarToggleItem_1e2ox_208 ${textAlign === 'right' ? 'active' : ''}`}
                title="Align Right"
                onClick={() => handleTextAlignChange('right')}
              >
                <AlignRight size={16} />
              </button>
              <button
                className={`custom-button _toolbarToggleItem_1e2ox_208 ${textAlign === 'justify' ? 'active' : ''}`}
                title="Justify"
                onClick={() => handleTextAlignChange('justify')}
              >
                <AlignJustify size={16} />
              </button>
              {!isOverflow && <Separator />}
            </div>
          </>
        )}

        {shouldShowGroup('lists') && (
          <>
            <div className={`${groupClass} ${isOverflow ? 'overflow-group overflow-lists' : 'lists-group'}`}>
              <ListsToggle />
              {!isOverflow && <Separator />}
            </div>
          </>
        )}

        {/* Book View Toggle */}
        {shouldShowGroup('book-view') && handleBookViewToggle && (
          <>
            <div className={`${groupClass} ${isOverflow ? 'overflow-group overflow-book-view' : 'book-view-group'}`}>
              <button
                className={`custom-button _toolbarToggleItem_1e2ox_208 ${bookView ? 'active' : ''}`}
                title="Toggle book view mode"
                onClick={handleBookViewToggle}
              >
                <BookOpen size={16} />
              </button>
              <input
                type="number"
                placeholder="5.5"
                title="Book view content width in inches (e.g., 5.5)"
                value={localBookViewWidth}
                onChange={e => handleBookViewWidthChange(e.target.value)}
                step="0.1"
                min="1"
                style={{
                  width: '50px',
                  padding: '3px 2px',
                  margin: '0 2px',
                  fontSize: '17px',
                  border: '1px solid var(--vscode-input-border)',
                  background: 'var(--vscode-input-background)',
                  color: 'var(--vscode-input-foreground)',
                  borderRadius: '2px',
                }}
              />
              <input
                type="number"
                placeholder="0.5"
                title="Book view horizontal margins in inches (e.g., 0.5)"
                value={localBookViewMargin}
                onChange={e => handleBookViewMarginChange(e.target.value)}
                step="0.1"
                min="0"
                style={{
                  width: '50px',
                  padding: '3px 2px',
                  margin: '0 2px',
                  fontSize: '17px',
                  border: '1px solid var(--vscode-input-border)',
                  background: 'var(--vscode-input-background)',
                  color: 'var(--vscode-input-foreground)',
                  borderRadius: '2px',
                }}
              />
              {!isOverflow && <Separator />}
            </div>
          </>
        )}
      </>
    );
  },
);
