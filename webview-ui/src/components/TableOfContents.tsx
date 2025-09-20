import React from 'react';

import './TableOfContents.css';

interface TOCItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  content: string;
  onHeadingClick: (headingId: string) => void;
  sidebarWidth: number;
  setShowTOCSidebar: (show: boolean) => void;
}

export const TableOfContents: React.FC<TableOfContentsProps> = ({
  content,
  onHeadingClick,
  sidebarWidth,
  setShowTOCSidebar,
}) => {
  const tocItems = React.useMemo(() => {
    if (!content) {
      return [];
    }

    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const items: TOCItem[] = [];
    const idCounts: Record<string, number> = {};
    let match;

    while ((match = headingRegex.exec(content)) !== null) {
      const level = match[1].length;
      const text = match[2].trim();
      const baseId = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');

      // Handle duplicate IDs by adding suffix
      let id = baseId;
      if (idCounts[baseId]) {
        idCounts[baseId]++;
        id = `${baseId}-${idCounts[baseId]}`;
      } else {
        idCounts[baseId] = 1;
      }

      items.push({ id, text, level });
    }

    return items;
  }, [content]);

  let Body = null;

  if (tocItems.length === 0) {
    Body = (
      <div className="toc-container">
        <div className="toc-empty">No headings found</div>
      </div>
    );
  }

  Body = (
    <div className="toc-container">
      <nav className="toc-nav">
        {tocItems.map((item, index) => {
          const itemTextStrippedmarkdown = item.text.replace(/[#*_`~]/g, '');

          return (
            <button
              key={`${item.id}-${index}`}
              className={`toc-item toc-level-${item.level}`}
              onClick={() => onHeadingClick(item.id)}
              title={`Navigate to ${itemTextStrippedmarkdown}`}
            >
              {itemTextStrippedmarkdown}
            </button>
          );
        })}
      </nav>
    </div>
  );

  return (
    <div className="toc-sidebar" style={{ width: `${sidebarWidth}px` }}>
      <div className="toc-header-wrapper">
        <h3>Table of Contents</h3>
        <button onClick={() => setShowTOCSidebar(false)} className="sidebar-close" title="Hide Table of Contents">
          ✕
        </button>
      </div>
      {Body}
    </div>
  );
};
