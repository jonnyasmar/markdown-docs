//@ts-check

'use strict';

const path = require('path');
const { rspack } = require('@rspack/core');

//@ts-check
/** @typedef {import('@rspack/core').Configuration} RspackConfig **/

/** @type RspackConfig */
const webviewConfig = {
  target: 'web', // VS Code webviews run in a web context
  mode: 'none', // this leaves the source code as close as possible to the original (when packaging we set this to 'production')
  
  entry: './src/main.tsx', // the entry point for the webview
  
  output: {
    // the bundle is stored in the parent dist folder
    path: path.resolve(__dirname, '../dist/webview-ui'),
    filename: 'index.js',
    clean: true
  },
  
  resolve: {
    // support reading TypeScript and JavaScript files, plus JSX
    extensions: ['.tsx', '.ts', '.jsx', '.js'],
    fallback: {
      // Provide polyfills for Node.js modules used in browser
      "process": require.resolve("process/browser.js"),
      "buffer": require.resolve("buffer"),
      "util": require.resolve("util/"),
      "path": require.resolve("path-browserify"),
      "stream": require.resolve("stream-browserify"),
      "crypto": require.resolve("crypto-browserify"),
      "fs": false,
      "os": require.resolve("os-browserify/browser")
    }
  },
  
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'builtin:swc-loader',
          options: {
            jsc: {
              parser: {
                syntax: 'typescript',
                tsx: true, // Enable JSX parsing for .tsx files
              },
              transform: {
                react: {
                  runtime: 'automatic', // Use React 17+ automatic runtime
                }
              }
            },
          },
        }
      },
      {
        test: /\.css$/,
        type: 'css/auto' // Use rspack's built-in CSS support
      }
    ],
    parser: {
      javascript: {
        dynamicImportMode: 'eager' // Inline all dynamic imports into the main bundle
      }
    }
  },
  
  experiments: {
    css: true // Enable native CSS support
  },
  
  optimization: {
    splitChunks: false, // Keep everything in one file like Vite was doing
    usedExports: true,
    sideEffects: false,
    concatenateModules: true // Enable module concatenation for better bundling
  },
  
  plugins: [
    new rspack.DefinePlugin({
      // Equivalent to Vite's define
      'import.meta.env': 'window.__VITE_ENV__',
      // Polyfill Node.js globals for browser
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      'global': 'globalThis'
    }),
    new rspack.ProvidePlugin({
      process: 'process/browser.js',
      Buffer: ['buffer', 'Buffer']
    }),
    new rspack.HtmlRspackPlugin({
      template: './index.html'
    })
  ],
  
  devtool: 'nosources-source-map',
  
  infrastructureLogging: {
    level: "log", // enables logging required for problem matchers
  },
};

module.exports = webviewConfig;