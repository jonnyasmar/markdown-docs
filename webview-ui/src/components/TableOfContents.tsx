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
}

const TableOfContents: React.FC<TableOfContentsProps> = ({ content, onHeadingClick }) => {
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

  if (tocItems.length === 0) {
    return (
      <div className="toc-container">
        <div className="toc-header">Table of Contents</div>
        <div className="toc-empty">No headings found</div>
      </div>
    );
  }

  return (
    <div className="toc-container">
      <div className="toc-header">Table of Contents</div>
      <nav className="toc-nav">
        {tocItems.map((item, index) => (
          <button
            key={`${item.id}-${index}`}
            className={`toc-item toc-level-${item.level}`}
            onClick={() => onHeadingClick(item.id)}
            title={`Navigate to ${item.text}`}
          >
            {item.text}
          </button>
        ))}
      </nav>
    </div>
  );
};

export default TableOfContents;
