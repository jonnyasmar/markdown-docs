import { MermaidEditor } from '@/components/MermaidEditor';
import { Toolbar } from '@/components/Toolbar';
import { commentInsertionPlugin } from '@/components/plugins/commentInsertionPlugin';
import { customSearchPlugin } from '@/components/plugins/customSearchPlugin';
import { commentsPlugin } from '@/components/plugins/directives';
import { frontmatterPlugin } from '@/components/plugins/frontmatter';
import { DirectiveService } from '@/services/directive';
import { CommentWithAnchor, FontFamily, WebviewMessage } from '@/types';
import { createCommentDirectiveDescriptor, genericDirectiveDescriptor } from '@/utils/createCommentDirectiveDescriptor';
import {
  postBookViewMarginSetting,
  postBookViewSetting,
  postBookViewWidthSetting,
  postDirtyState,
  postFontSetting,
  postFontSizeSetting,
  postImageUri,
  postTextAlignSetting,
} from '@/utils/extensionMessaging';
import { logger } from '@/utils/logger';
import {
  AdmonitionDirectiveDescriptor,
  CodeMirrorEditor,
  MDXEditorMethods,
  RealmPlugin,
  codeBlockPlugin,
  codeMirrorPlugin,
  diffSourcePlugin,
  headingsPlugin,
  imagePlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
} from '@mdxeditor/editor';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface UsePluginsProps {
  defaultFont: FontFamily;
  bookView: boolean;
  bookViewMargin: string;
  bookViewWidth: string;
  currentViewMode: 'rich-text' | 'source' | 'diff';
  focusedCommentId: string | null;
  fontSize: number;
  handleViewModeChange: (mode: 'rich-text' | 'source' | 'diff') => void;
  isDarkTheme: boolean;
  pendingComment: {
    comment: string;
    commentId: string;
    selectedText: string;
    strategy: 'inline' | 'container';
  } | null;
  textAlign: string;
  setPendingComment: (
    comment: {
      comment: string;
      commentId: string;
      selectedText: string;
      strategy: 'inline' | 'container';
    } | null,
  ) => void;
  setIsTyping: (isTyping: boolean) => void;
  editorRef: React.RefObject<MDXEditorMethods | null>;
  onMarkdownChange: (markdown: string) => void;
  setParsedComments: (comments: CommentWithAnchor[]) => void;
  setFocusedCommentId: (id: string | null) => void;
  selectedFont: FontFamily;
  setSelectedFont: (font: FontFamily) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CodeMirrorEditorWithSave: React.FC<any> = props => {
  return <CodeMirrorEditor {...props} />;
};

const fontFamilyMap = {
  Default:
    'var(--vscode-editor-font-family, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif)',
  Arial: 'Arial, sans-serif',
  'Times New Roman': '"Times New Roman", Times, serif',
  Roboto: 'Roboto, Arial, sans-serif',
  Georgia: 'Georgia, serif',
  Calibri: 'Calibri, Arial, sans-serif',
  Garamond: 'Garamond, serif',
  'Book Antiqua': '"Book Antiqua", serif',
  'Courier New': '"Courier New", "Monaco", "Menlo", monospace',
  'Open Sans': '"Open Sans", Arial, sans-serif',
  Lato: '"Lato", Arial, sans-serif',
  Montserrat: '"Montserrat", Arial, sans-serif',
  'Source Sans Pro': '"Source Sans Pro", Arial, sans-serif',
};

export const usePlugins = ({
  defaultFont,
  bookView,
  bookViewMargin,
  bookViewWidth,
  currentViewMode,
  focusedCommentId,
  fontSize,
  handleViewModeChange,
  isDarkTheme,
  pendingComment,
  textAlign,
  setPendingComment,
  setIsTyping,
  editorRef,
  onMarkdownChange,
  setParsedComments,
  setFocusedCommentId,
  selectedFont,
  setSelectedFont,
}: UsePluginsProps) => {
  const currentFontSizeRef = useRef(fontSize);

  // Local state for book view inputs to prevent cursor jumping (numbers only, default to 'in' units)
  const [localBookViewWidth, setLocalBookViewWidth] = useState<string>((bookViewWidth || '5.5in').replace('in', ''));
  const [localBookViewMargin, setLocalBookViewMargin] = useState<string>((bookViewMargin || '0.5in').replace('in', ''));

  useEffect(() => {
    const editorContent = document.querySelector('.mdx-content[contenteditable="true"]') as HTMLElement;
    if (!editorContent) {
      return;
    }

    // Apply font size (affects base font size, headings will scale proportionally)
    editorContent.style.fontSize = `${fontSize}px`;

    // Ensure paragraphs inherit the font size properly
    const paragraphs = editorContent.querySelectorAll('p');
    paragraphs.forEach(p => {
      (p as HTMLElement).style.fontSize = 'inherit';
    });

    // Apply text alignment
    editorContent.style.textAlign = textAlign;

    // Apply Book View styles
    if (bookView) {
      editorContent.style.maxWidth = bookViewWidth || '5.5in';
      editorContent.style.paddingLeft = bookViewMargin || '0.5in';
      editorContent.style.paddingRight = bookViewMargin || '0.5in';
      editorContent.style.margin = '0 auto';
    } else {
      editorContent.style.maxWidth = '';
      editorContent.style.paddingLeft = '';
      editorContent.style.paddingRight = '';
      editorContent.style.margin = '';
    }
  }, [fontSize, textAlign, bookView, bookViewWidth, bookViewMargin]);

  // Handle font changes and save to VS Code settings
  const handleFontChange = useCallback(
    (fontName: FontFamily) => {
      setSelectedFont(fontName);
      postFontSetting(fontName);
    },
    [setSelectedFont],
  );

  // Handle font size changes
  const handleFontSizeChange = useCallback((delta: number) => {
    const newSize = Math.max(8, Math.min(48, currentFontSizeRef.current + delta));
    currentFontSizeRef.current = newSize;
    // Save to VS Code settings
    postFontSizeSetting(newSize);
  }, []);

  // Handle text alignment changes
  const handleTextAlignChange = useCallback((align: string) => {
    // Save to VS Code settings
    postTextAlignSetting(align);
  }, []);

  // Handle Book View toggle
  const handleBookViewToggle = useCallback(() => {
    const newBookView = !bookView;
    // Save to VS Code settings
    postBookViewSetting(newBookView);
  }, [bookView]);

  // Debounced handlers for book view inputs to prevent cursor jumping
  const handleBookViewWidthChange = useCallback(
    (value: string) => {
      console.log('handleBookViewWidthChange called with:', value);
      console.log('Current localBookViewWidth:', localBookViewWidth);

      // Update local state immediately for responsive UI
      setLocalBookViewWidth(value);
      postBookViewWidthSetting(`${value}in`);
    },
    [localBookViewWidth],
  );

  const handleBookViewMarginChange = useCallback(
    (value: string) => {
      console.log('handleBookViewMarginChange called with:', value);
      console.log('Current localBookViewMargin:', localBookViewMargin);

      // Update local state immediately for responsive UI
      setLocalBookViewMargin(value);
      postBookViewMarginSetting(`${value}in`);
    },
    [localBookViewMargin],
  );

  // Update selected font when defaultFont prop changes
  useEffect(() => {
    setSelectedFont(defaultFont);
  }, [defaultFont, setSelectedFont]);

  // Sync local book view state with props when they change externally
  useEffect(() => {
    setLocalBookViewWidth((bookViewWidth || '5.5in').replace('in', ''));
  }, [bookViewWidth]);

  useEffect(() => {
    setLocalBookViewMargin((bookViewMargin || '0.5in').replace('in', ''));
  }, [bookViewMargin]);

  const availableFonts = Object.keys(fontFamilyMap);

  // Callback for when comment insertion is complete
  const handleCommentInserted = useCallback(() => {
    setPendingComment(null);

    // Force immediate comment parsing by temporarily clearing isTyping
    setIsTyping(false);

    // Wait for MDX Editor to update its internal state, then get the markdown
    setTimeout(() => {
      if (editorRef?.current) {
        const updatedMarkdown = editorRef.current.getMarkdown();
        onMarkdownChange(updatedMarkdown);

        // Force comment parsing immediately to show new comment in sidebar
        try {
          const comments = DirectiveService.parseCommentDirectives(updatedMarkdown);
          const commentsWithAnchor: CommentWithAnchor[] = comments.map(comment => ({
            ...comment,
            anchoredText: comment.anchoredText ?? 'Selected text',
            startPosition: 0,
            endPosition: 0,
          }));
          setParsedComments(commentsWithAnchor);
        } catch (error) {
          logger.error('Error in forced comment parsing:', error);
        }

        // Notify extension about changes
        postDirtyState(true);
      } else {
        logger.error('No editor ref available in handleCommentInserted');
      }
    }, 200);
  }, [editorRef, onMarkdownChange, setIsTyping, setParsedComments, setPendingComment]);

  const diffSourcePluginFactory = useCallback(
    () =>
      diffSourcePlugin({
        diffMarkdown: '',
        codeMirrorExtensions: [],
      }),
    [],
  );

  const imagePluginFactory = useCallback(
    () =>
      imagePlugin({
        imageUploadHandler: async (image: File) => {
          return new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = e => {
              const data = e.target?.result;
              if (data) {
                postImageUri(data);
                const handleUri = (event: MessageEvent<WebviewMessage>) => {
                  if (event.data.command === 'imageUri') {
                    window.removeEventListener('message', handleUri);
                    resolve(event.data.uri ?? '');
                  }
                };

                window.addEventListener('message', handleUri);
              }
            };
            reader.readAsDataURL(image);
          });
        },
        imageAutocompleteSuggestions: ['media/', './media/', '../media/'],
      }),
    [],
  );

  const commentInsertionPluginFactory = useCallback(
    () =>
      commentInsertionPlugin({
        pendingComment,
        onInsertComment: _commentData => {
          handleCommentInserted();
        },
      }),
    [handleCommentInserted, pendingComment],
  );

  /* const directivesPluginFactory = useCallback(
    () =>
      directivesPlugin({
        directiveDescriptors: [
          AdmonitionDirectiveDescriptor,
          //createCommentDirectiveDescriptor(focusedCommentId, setFocusedCommentId),
          //genericDirectiveDescriptor,
        ],
        // Disable escaping of unknown text directives
        escapeUnknownTextDirectives: false,
      }),
    [],
  ); */

  const toolbarPluginFactory = useCallback(
    () =>
      toolbarPlugin({
        toolbarContents: () => (
          <Toolbar
            selectedFont={selectedFont}
            handleFontChange={handleFontChange}
            availableFonts={availableFonts}
            bookView={bookView}
            bookViewWidth={bookViewWidth}
            bookViewMargin={bookViewMargin}
            currentViewMode={currentViewMode}
            onViewModeChange={handleViewModeChange}
            fontSize={fontSize}
            handleFontSizeChange={handleFontSizeChange}
            textAlign={textAlign}
            handleTextAlignChange={handleTextAlignChange}
            handleBookViewToggle={handleBookViewToggle}
            localBookViewWidth={localBookViewWidth}
            localBookViewMargin={localBookViewMargin}
            handleBookViewWidthChange={handleBookViewWidthChange}
            handleBookViewMarginChange={handleBookViewMarginChange}
          />
        ),
      }),
    [
      availableFonts,
      bookView,
      bookViewMargin,
      bookViewWidth,
      currentViewMode,
      fontSize,
      handleBookViewMarginChange,
      handleBookViewToggle,
      handleBookViewWidthChange,
      handleFontChange,
      handleFontSizeChange,
      handleTextAlignChange,
      handleViewModeChange,
      localBookViewMargin,
      localBookViewWidth,
      selectedFont,
      textAlign,
    ],
  );

  const codeBlockPluginFactory = useCallback(
    () =>
      codeBlockPlugin({
        defaultCodeBlockLanguage: 'js',
        codeBlockEditorDescriptors: [
          // Mermaid diagram editor - highest priority
          {
            priority: 10,
            match: (language, _code) => language === 'mermaid',
            Editor: props => <MermaidEditor {...props} isDarkTheme={isDarkTheme} />,
          },
          // Specific mappings for common aliases
          {
            priority: 5,
            match: (language, _code) => language === 'javascript',
            Editor: props => <CodeMirrorEditorWithSave {...props} language="js" />,
          },
          {
            priority: 5,
            match: (language, _code) => language === 'python',
            Editor: props => <CodeMirrorEditorWithSave {...props} language="py" />,
          },
          {
            priority: 5,
            match: (language, _code) => language === 'typescript',
            Editor: props => <CodeMirrorEditorWithSave {...props} language="ts" />,
          },
          {
            priority: 5,
            match: (language, _code) => language === 'markdown',
            Editor: props => <CodeMirrorEditorWithSave {...props} language="md" />,
          },
          {
            priority: 5,
            match: (language, _code) => language === 'yml',
            Editor: props => <CodeMirrorEditorWithSave {...props} language="yaml" />,
          },
          {
            priority: 5,
            match: (language, _code) => language === 'text',
            Editor: props => <CodeMirrorEditorWithSave {...props} language="txt" />,
          },
          {
            priority: 5,
            match: (language, _code) => language === 'shell',
            Editor: props => <CodeMirrorEditorWithSave {...props} language="sh" />,
          },
          // Top 10 additional language mappings
          {
            priority: 5,
            match: (language, _code) => language === 'rust',
            Editor: props => <CodeMirrorEditorWithSave {...props} language="rust" />,
          },
          {
            priority: 5,
            match: (language, _code) => language === 'go',
            Editor: props => <CodeMirrorEditorWithSave {...props} language="go" />,
          },
          {
            priority: 5,
            match: (language, _code) => language === 'cpp' || language === 'c++',
            Editor: props => <CodeMirrorEditorWithSave {...props} language="cpp" />,
          },
          {
            priority: 5,
            match: (language, _code) => language === 'c',
            Editor: props => <CodeMirrorEditorWithSave {...props} language="c" />,
          },
          {
            priority: 5,
            match: (language, _code) => language === 'java',
            Editor: props => <CodeMirrorEditorWithSave {...props} language="java" />,
          },
          {
            priority: 5,
            match: (language, _code) => language === 'kotlin',
            Editor: props => <CodeMirrorEditorWithSave {...props} language="kotlin" />,
          },
          {
            priority: 5,
            match: (language, _code) => language === 'swift',
            Editor: props => <CodeMirrorEditorWithSave {...props} language="swift" />,
          },
          {
            priority: 5,
            match: (language, _code) => language === 'php',
            Editor: props => <CodeMirrorEditorWithSave {...props} language="php" />,
          },
          {
            priority: 5,
            match: (language, _code) => language === 'ruby',
            Editor: props => <CodeMirrorEditorWithSave {...props} language="ruby" />,
          },
          {
            priority: 5,
            match: (language, _code) => language === 'dart',
            Editor: props => <CodeMirrorEditorWithSave {...props} language="dart" />,
          },
          // Fallback editor for any other unknown languages
          {
            priority: -10,
            match: _ => true,
            Editor: CodeMirrorEditor,
          },
        ],
      }),
    [isDarkTheme],
  );

  const codeMirrorPluginFactory = useCallback(
    () =>
      codeMirrorPlugin({
        codeBlockLanguages: {
          js: 'JavaScript',
          css: 'CSS',
          txt: 'Text',
          md: 'Markdown',
          ts: 'TypeScript',
          html: 'HTML',
          json: 'JSON',
          yaml: 'YAML',
          ini: 'INI',
          toml: 'TOML',
          xml: 'XML',
          csv: 'CSV',
          sql: 'SQL',
          py: 'Python',
          bash: 'Bash',
          sh: 'Shell',
          mermaid: 'Mermaid',
          // Top 10 additional languages
          rust: 'Rust',
          go: 'Go',
          cpp: 'C++',
          c: 'C',
          java: 'Java',
          kotlin: 'Kotlin',
          swift: 'Swift',
          php: 'PHP',
          ruby: 'Ruby',
          dart: 'Dart',
        },
        // Add better syntax theme configuration
      }),
    [],
  );

  //const frontmatterPluginFactory = () => frontmatterPlugin();

  return useMemo<RealmPlugin[]>(() => {
    return [
      headingsPlugin(),
      quotePlugin(),
      listsPlugin(),
      linkPlugin(),
      linkDialogPlugin(),
      tablePlugin(),
      thematicBreakPlugin(),
      markdownShortcutPlugin(),
      customSearchPlugin({}),
      frontmatterPlugin(),
      diffSourcePluginFactory(),
      imagePluginFactory(),
      commentInsertionPluginFactory(),
      commentsPlugin({
        focusedCommentId,
        setFocusedCommentId,
        // Support admonitions and comments, with a generic fallback for unknown directives
        directiveDescriptors: [
          AdmonitionDirectiveDescriptor,
          createCommentDirectiveDescriptor(focusedCommentId, setFocusedCommentId),
          genericDirectiveDescriptor,
        ],
      }),
      //directivesPluginFactory(),
      toolbarPluginFactory(),
      codeBlockPluginFactory(),
      codeMirrorPluginFactory(),
    ];
  }, [
    codeBlockPluginFactory,
    codeMirrorPluginFactory,
    commentInsertionPluginFactory,
    diffSourcePluginFactory,
    focusedCommentId,
    imagePluginFactory,
    setFocusedCommentId,
    toolbarPluginFactory,
  ]);
};
