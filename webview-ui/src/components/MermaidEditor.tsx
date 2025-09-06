import { logger } from '@/utils/logger';
import { CodeMirrorEditor } from '@mdxeditor/editor';
import mermaid from 'mermaid';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface MermaidEditorProps {
  code: string;
  language: string;
  setCode?: (code: string) => void;
  focusEmitter?: unknown;
  parentEditor?: unknown;
  isDarkTheme?: boolean;
  meta?: string;
  nodeKey?: string;
}

type ViewMode = 'preview' | 'edit' | 'split';

export const MermaidEditor: React.FC<MermaidEditorProps> = ({
  code,
  setCode: _setCode,
  focusEmitter: _focusEmitter,
  parentEditor: _parentEditor,
  isDarkTheme = false,
  meta: _meta,
  nodeKey: _nodeKey,
  ..._props
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [svgContent, setSvgContent] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [renderKey, setRenderKey] = useState(0);
  const [splitPaneWidth, setSplitPaneWidth] = useState(50); // Percentage for left pane
  const [isResizing, setIsResizing] = useState(false);
  const mermaidRef = useRef<HTMLDivElement>(null);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  // SVG sanitization function to prevent XSS
  const sanitizeSVG = useCallback((svg: string): string => {
    if (!svg || typeof svg !== 'string') {
      return '';
    }

    return (
      svg
        // Remove script tags and their content
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        // Remove event handlers (onclick, onload, etc.)
        .replace(/on\w+=["'][^"']*["']/gi, '')
        // Remove javascript: protocols
        .replace(/javascript:/gi, '')
        // Remove data: protocols except for safe image formats
        .replace(/data:(?!image\/(png|jpg|jpeg|gif|svg|webp))[^;]*;/gi, '')
        // Remove suspicious attributes
        .replace(/\s*(href|src)=["'][^"']*javascript:[^"']*["']/gi, '')
    );
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

      // Generate new diagram ID for each render to avoid cache issues
      const newDiagramId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Render with fresh ID
      const { svg } = await mermaid.render(newDiagramId, code);

      // Sanitize SVG content before setting it
      let sanitizedSVG = sanitizeSVG(svg);

      // Debug: Log the SVG content to see what's being generated
      console.log('Generated SVG sample:', svg.substring(0, 500));

      // Inject theme-specific CSS directly into the SVG to override hardcoded colors
      const themeCSS = isDarkTheme
        ? `
        <style>
          .node rect, .node polygon, .node circle, .node path { 
            fill: #2d3748 !important; 
            stroke: #4a5568 !important; 
          }
          .nodeLabel, .nodeLabel p { 
            color: #ffffff !important; 
          }
          .label-container { 
            fill: #2d3748 !important; 
            stroke: #4a5568 !important; 
          }
          .edgeLabel { 
            background-color: #2d3748 !important; 
            color: #ffffff !important; 
          }
        </style>
      `
        : `
        <style>
          .node rect, .node polygon, .node circle, .node path { 
            fill: #e3f2fd !important; 
            stroke: #1976d2 !important; 
          }
          .nodeLabel, .nodeLabel p { 
            color: #000000 !important; 
          }
          .label-container { 
            fill: #e3f2fd !important; 
            stroke: #1976d2 !important; 
          }
          .edgeLabel { 
            background-color: #ffffff !important; 
            color: #000000 !important; 
          }
        </style>
      `;

      // Inject CSS into SVG
      if (sanitizedSVG.includes('<svg')) {
        sanitizedSVG = sanitizedSVG.replace(/<svg([^>]*)>/, `<svg$1>${themeCSS}`);
      }

      setSvgContent(sanitizedSVG);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const errorMessage = err.message || 'Failed to render mermaid diagram';
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      setError(errorMessage);
      setSvgContent('');

      // Log error for debugging but don't expose sensitive information
      logger.error('Mermaid rendering failed:', errorMessage);
    }
  }, [code, sanitizeSVG, isDarkTheme]);

  // Initialize mermaid with proper theme configuration
  useEffect(() => {
    console.log('Mermaid: Initializing with isDarkTheme =', isDarkTheme);

    // Completely destroy and recreate mermaid instance
    try {
      // @ts-ignore - Force clear all internal state
      // Mermaid library internal API lacks proper TypeScript definitions
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      if ((mermaid as any).mermaidAPI) {
        // eslint-disable-next-line max-len
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
        (mermaid as any).mermaidAPI.reset();
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      if ((mermaid as any).reset) {
        // eslint-disable-next-line max-len
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
        (mermaid as any).reset();
      }
      // Clear diagram registry completely
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      if ((mermaid as any).getDiagramRegistry) {
        // eslint-disable-next-line max-len
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
        const registry = (mermaid as any).getDiagramRegistry();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        registry.clear();
      }
      // @ts-ignore - Clear any cached configurations
      delete mermaid.defaultConfig;
    } catch (e) {
      console.log('Mermaid aggressive reset warning:', e);
    }

    // Use proper mermaid theming with darkMode setting
    mermaid.initialize({
      startOnLoad: false,
      theme: isDarkTheme ? 'dark' : 'default',
      securityLevel: 'loose',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      //themeVariables: themeConfig,
      // Force fresh configuration - no caching
      deterministicIds: false,
      deterministicIDSeed: Date.now().toString(),
    });

    // Clear SVG and force complete re-render
    setSvgContent('');
    setError('');
    setRenderKey(prev => prev + 100); // Large increment to ensure fresh render

    // Force immediate re-render with aggressive timing
    if (code.trim()) {
      setTimeout(() => {
        void renderMermaid();
      }, 200); // Longer timeout for complete reset
    }
  }, [code, isDarkTheme, renderMermaid]);

  // Debounced rendering for performance optimization
  // Memory leak fix: Store timeout ref for proper cleanup
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const debouncedRenderMermaid = useMemo(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        void renderMermaid();
      }, 300); // 300ms debounce
    };
  }, [renderMermaid]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
      }
    };
  }, []);

  // Re-render when code changes and when in preview or split mode
  useEffect(() => {
    if (viewMode === 'preview' || viewMode === 'split') {
      debouncedRenderMermaid();
    }
  }, [code, viewMode, debouncedRenderMermaid]);

  // Handle split pane resizing
  useEffect(() => {
    if (viewMode !== 'split') {
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !splitContainerRef.current) {
        return;
      }

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

  const switchToMode = useCallback(
    (mode: ViewMode) => {
      setViewMode(mode);

      if (mode === 'preview' || mode === 'split') {
        // Force a re-render by updating the render key
        setRenderKey(prev => prev + 1);
        // Use a small timeout to ensure state has updated
        setTimeout(() => {
          void renderMermaid();
        }, 100);
      }
    },
    [renderMermaid],
  );

  // Render diagram preview component
  const renderDiagramPreview = () => (
    <div className="mermaid-preview" ref={mermaidRef} key={`preview-${renderKey}`}>
      {error ? (
        <div className="mermaid-error">
          <strong>Mermaid Error:</strong>
          <pre>{error}</pre>
          <button
            onClick={() => {
              void switchToMode('edit');
            }}
            className="mermaid-edit-btn"
          >
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
        <div className="mermaid-placeholder">{code.trim() ? 'Rendering diagram...' : 'Empty mermaid diagram'}</div>
      )}
    </div>
  );

  // Render code editor component
  const renderCodeEditor = () => (
    <div className="mermaid-code-editor">
      <CodeMirrorEditor
        code={code}
        language="mermaid"
        meta={_meta ?? ''}
        nodeKey={_nodeKey ?? ''}
        // CodeMirror editor focusEmitter prop lacks proper TypeScript definitions
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
        focusEmitter={_focusEmitter as any}
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
              onClick={() => {
                void switchToMode('edit');
              }}
              title="Edit mermaid code"
            >
              ✏️ Edit
            </button>
            <button
              className="mermaid-toggle-btn"
              onClick={() => {
                void switchToMode('split');
              }}
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
              onClick={() => {
                void switchToMode('preview');
              }}
              title="View rendered diagram"
            >
              📊 Preview
            </button>
            <button
              className="mermaid-toggle-btn"
              onClick={() => {
                void switchToMode('split');
              }}
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
            onClick={() => {
              void switchToMode('preview');
            }}
            title="Preview only"
          >
            📊 Preview
          </button>
          <button
            className="mermaid-toggle-btn"
            onClick={() => {
              void switchToMode('edit');
            }}
            title="Edit only"
          >
            ✏️ Edit
          </button>
        </div>
      </div>
      <div className="mermaid-split-container" ref={splitContainerRef}>
        <div className="mermaid-split-left" style={{ width: `${splitPaneWidth}%` }}>
          <div className="mermaid-split-header">Code</div>
          {renderCodeEditor()}
          {error && (
            <div className="mermaid-error-inline">
              <strong>Error:</strong> {error}
            </div>
          )}
        </div>
        <div className="mermaid-split-resizer" onMouseDown={() => setIsResizing(true)} />
        <div className="mermaid-split-right" style={{ width: `${100 - splitPaneWidth}%` }}>
          <div className="mermaid-split-header">Preview</div>
          {renderDiagramPreview()}
        </div>
      </div>
    </div>
  );
};
