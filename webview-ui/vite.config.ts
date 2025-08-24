import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../dist/webview-ui',
    target: 'esnext',
    rollupOptions: {
      output: {
        entryFileNames: 'index.js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
        // Inline all dynamic imports to avoid module loading issues
        inlineDynamicImports: true
      }
    },
    minify: false, // Disable minification for easier debugging
  },
  base: './',
  define: {
    // Replace import.meta.env with a compatible alternative
    'import.meta.env': 'window.__VITE_ENV__'
  }
});