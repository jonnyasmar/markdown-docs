import React from 'react';
import { createRoot } from 'react-dom/client';

import EditorAppWithSettings from './EditorAppWithSettings';

// Determine which app to render based on the container element
const editorRoot = document.getElementById('editor-root');

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const root = createRoot(editorRoot!);
root.render(<EditorAppWithSettings />);
