//@ts-check

'use strict';

const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const webpack = require('webpack');

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

/** @type WebpackConfig */
const webviewConfig = {
  target: 'web',
  mode: 'development',
  
  entry: './src/main.tsx',
  
  output: {
    path: path.resolve(__dirname, '../dist/webview-ui'),
    filename: 'index.js',
    clean: true
  },
  
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.mjs'],
    mainFields: ['browser', 'module', 'main']
  },
  
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
              compilerOptions: {
                noEmitOnError: false,
                skipLibCheck: true
              }
            }
          }
        ]
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader']
      },
      {
        test: /\.mjs$/,
        type: 'javascript/auto',
        resolve: {
          fullySpecified: false
        }
      }
    ]
  },
  
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'index.css'
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('development'),
      'process.env': JSON.stringify({})
    })
  ],
  
  optimization: {
    minimize: false,
    sideEffects: false,
    splitChunks: false
  },
  
  devtool: 'nosources-source-map',
  
  infrastructureLogging: {
    level: "log"
  },
  
  performance: {
    hints: false
  }
};

module.exports = webviewConfig;