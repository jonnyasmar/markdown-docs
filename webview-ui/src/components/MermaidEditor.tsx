import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import mermaid from 'mermaid';
import { CodeMirrorEditor } from '@mdxeditor/editor';
import { logger } from '../utils/logger';

interface MermaidEditorProps {
  code: string;
  language: string;
  setCode: (code: string) => void;
  focusEmitter: any;
  parentEditor: any;
}

type ViewMode = 'preview' | 'edit' | 'split';

export const MermaidEditor: React.FC<MermaidEditorProps> = ({ 
  code, 
  setCode, 
  focusEmitter,
  parentEditor,
  ...props 
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [svgContent, setSvgContent] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [renderKey, setRenderKey] = useState(0);
  const [splitPaneWidth, setSplitPaneWidth] = useState(50); // Percentage for left pane
  const [isResizing, setIsResizing] = useState(false);
  const mermaidRef = useRef<HTMLDivElement>(null);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const diagramId = useRef(`mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

  // Initialize mermaid
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'loose',
      fontFamily: 'inherit',
    });
  }, []);

  // SVG sanitization function to prevent XSS
  const sanitizeSVG = useCallback((svg: string): string => {
    if (!svg || typeof svg !== 'string') return '';
    
    return svg
      // Remove script tags and their content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Remove event handlers (onclick, onload, etc.)
      .replace(/on\w+=["'][^"']*["']/gi, '')
      // Remove javascript: protocols
      .replace(/javascript:/gi, '')
      // Remove data: protocols except for safe image formats
      .replace(/data:(?!image\/(png|jpg|jpeg|gif|svg|webp))[^;]*;/gi, '')
      // Remove suspicious attributes
      .replace(/\s*(href|src)=["'][^"']*javascript:[^"']*["']/gi, '');
  }, []);

  // Optimized mermaid rendering with security and performance improvements
  const renderMermaid = useCallback(async () => {
    if (!code.trim()) {
      setSvgContent('');
      setError('');
      return;
    }

    try {
      setError('');
      setSvgContent(''); // Clear previous content
      
      // Reuse the same diagram ID to prevent memory leaks
      const { svg } = await mermaid.render(diagramId.current, code);
      
      // Sanitize SVG content before setting it
      const sanitizedSVG = sanitizeSVG(svg);
      setSvgContent(sanitizedSVG);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to render mermaid diagram';
      setError(errorMessage);
      setSvgContent('');
      
      // Log error for debugging but don't expose sensitive information
      logger.error('Mermaid rendering failed:', errorMessage);
    }
  }, [code, sanitizeSVG]);

  // Debounced rendering for performance optimization
  const debouncedRenderMermaid = useMemo(() => {
    let timeoutId: NodeJS.Timeout;
    return () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(renderMermaid, 300); // 300ms debounce
    };
  }, [renderMermaid]);

  // Re-render when code changes and when in preview or split mode
  useEffect(() => {
    if (viewMode === 'preview' || viewMode === 'split') {
      debouncedRenderMermaid();
    }
  }, [code, viewMode, debouncedRenderMermaid]);

  // Let the split container grow naturally with its content
  // No height manipulation needed - CSS flexbox handles this

  // Handle split pane resizing
  useEffect(() => {
    if (viewMode !== 'split') return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !splitContainerRef.current) return;

      const rect = splitContainerRef.current.getBoundingClientRect();
      const newWidth = Math.max(20, Math.min(80, ((e.clientX - rect.left) / rect.width) * 100));
      setSplitPaneWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, viewMode]);

  const switchToMode = useCallback(async (mode: ViewMode) => {
    setViewMode(mode);
    
    if (mode === 'preview' || mode === 'split') {
      // Force a re-render by updating the render key
      setRenderKey(prev => prev + 1);
      // Use a small timeout to ensure state has updated
      setTimeout(() => {
        renderMermaid();
      }, 100);
    }
  }, [renderMermaid]);

  // Render diagram preview component
  const renderDiagramPreview = () => (
    <div className="mermaid-preview" ref={mermaidRef} key={`preview-${renderKey}`}>
      {error ? (
        <div className="mermaid-error">
          <strong>Mermaid Error:</strong>
          <pre>{error}</pre>
          <button onClick={() => switchToMode('edit')} className="mermaid-edit-btn">
            Edit Code
          </button>
        </div>
      ) : svgContent ? (
        <div 
          className="mermaid-diagram"
          key={`diagram-${renderKey}`}
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      ) : (
        <div className="mermaid-placeholder">
          {code.trim() ? 'Rendering diagram...' : 'Empty mermaid diagram'}
        </div>
      )}
    </div>
  );

  // Render code editor component
  const renderCodeEditor = () => (
    <div className="mermaid-code-editor">
      <CodeMirrorEditor
        code={code}
        language="mermaid"
        setCode={setCode}
        focusEmitter={focusEmitter}
        parentEditor={parentEditor}
        {...props}
      />
    </div>
  );

  // Preview mode - show only diagram
  if (viewMode === 'preview') {
    return (
      <div className="mermaid-editor-container">
        <div className="mermaid-editor-header">
          <span className="mermaid-label">Mermaid Diagram</span>
          <div className="mermaid-actions">
            <button
              className="mermaid-toggle-btn"
              onClick={() => switchToMode('edit')}
              title="Edit mermaid code"
            >
              ✏️ Edit
            </button>
            <button
              className="mermaid-toggle-btn"
              onClick={() => switchToMode('split')}
              title="Split view - code and diagram"
            >
              📱 Split
            </button>
          </div>
        </div>
        {renderDiagramPreview()}
      </div>
    );
  }

  // Edit mode - show only code editor
  if (viewMode === 'edit') {
    return (
      <div className="mermaid-editor-container">
        <div className="mermaid-editor-header">
          <span className="mermaid-label">Edit Mermaid Code</span>
          <div className="mermaid-actions">
            <button
              className="mermaid-toggle-btn"
              onClick={() => switchToMode('preview')}
              title="View rendered diagram"
            >
              📊 Preview
            </button>
            <button
              className="mermaid-toggle-btn"
              onClick={() => switchToMode('split')}
              title="Split view - code and diagram"
            >
              📱 Split
            </button>
          </div>
        </div>
        {renderCodeEditor()}
        {error && (
          <div className="mermaid-error-inline">
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>
    );
  }

  // Split mode - show both code editor and diagram side by side
  return (
    <div className="mermaid-editor-container">
      <div className="mermaid-editor-header">
        <span className="mermaid-label">Mermaid Split View</span>
        <div className="mermaid-actions">
          <button
            className="mermaid-toggle-btn"
            onClick={() => switchToMode('preview')}
            title="Preview only"
          >
            📊 Preview
          </button>
          <button
            className="mermaid-toggle-btn"
            onClick={() => switchToMode('edit')}
            title="Edit only"
          >
            ✏️ Edit
          </button>
        </div>
      </div>
      <div className="mermaid-split-container" ref={splitContainerRef}>
        <div 
          className="mermaid-split-left"
          style={{ width: `${splitPaneWidth}%` }}
        >
          <div className="mermaid-split-header">Code</div>
          {renderCodeEditor()}
          {error && (
            <div className="mermaid-error-inline">
              <strong>Error:</strong> {error}
            </div>
          )}
        </div>
        <div 
          className="mermaid-split-resizer"
          onMouseDown={() => setIsResizing(true)}
        />
        <div 
          className="mermaid-split-right"
          style={{ width: `${100 - splitPaneWidth}%` }}
        >
          <div className="mermaid-split-header">Preview</div>
          {renderDiagramPreview()}
        </div>
      </div>
    </div>
  );
};