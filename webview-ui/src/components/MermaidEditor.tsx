import React, { useRef, useEffect, useState } from 'react';
import mermaid from 'mermaid';
import { CodeMirrorEditor } from '@mdxeditor/editor';

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

  // Render mermaid diagram
  const renderMermaid = async () => {
    console.log('renderMermaid called with code:', code.substring(0, 50));
    
    if (!code.trim()) {
      console.log('No code to render, clearing diagram');
      setSvgContent('');
      setError('');
      return;
    }

    try {
      setError('');
      // Clear any existing diagram
      setSvgContent('');
      
      // Generate a new unique ID for each render to avoid conflicts
      const newId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      diagramId.current = newId;
      
      console.log('Rendering mermaid with ID:', newId);
      
      // Validate and render the diagram
      const { svg } = await mermaid.render(newId, code);
      console.log('Mermaid render successful, SVG length:', svg.length);
      setSvgContent(svg);
    } catch (err: any) {
      console.error('Mermaid rendering error:', err);
      setError(err.message || 'Failed to render mermaid diagram');
      setSvgContent('');
    }
  };

  // Re-render when code changes and when in preview or split mode
  useEffect(() => {
    console.log('useEffect triggered - viewMode:', viewMode, 'code length:', code.length);
    if (viewMode === 'preview' || viewMode === 'split') {
      renderMermaid();
    }
  }, [code, viewMode]);

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

  const switchToMode = async (mode: ViewMode) => {
    console.log('switchToMode called - switching to:', mode);
    setViewMode(mode);
    
    if (mode === 'preview' || mode === 'split') {
      console.log('Mode requires diagram rendering');
      // Force a re-render by updating the render key
      setRenderKey(prev => prev + 1);
      // Use a small timeout to ensure state has updated
      setTimeout(() => {
        renderMermaid();
      }, 100);
    }
  };

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