import React from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import EditorApp from './EditorApp';

// Determine which app to render based on the container element
const editorRoot = document.getElementById('editor-root');
const commentRoot = document.getElementById('root');

if (editorRoot) {
  // Render the editor app
  const root = createRoot(editorRoot);
  root.render(<EditorApp />);
} else if (commentRoot) {
  // Render the comment sidebar app
  const root = createRoot(commentRoot);
  root.render(<App />);
}
