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
        chunkFileNames: 'index.js',
        assetFileNames: '[name].[ext]',
        inlineDynamicImports: true, // This should bundle everything into one file
      }
    },
    minify: 'terser',
    chunkSizeWarningLimit: 10000,
  },
  base: './',
  define: {
    'import.meta.env': 'window.__VITE_ENV__'
  }
});