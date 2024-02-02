'use strict';

const { merge } = require('webpack-merge');

const common = require('./webpack.common.js');
const PATHS = require('./paths');
const CircularDependencyPlugin = require('circular-dependency-plugin');

// Merge webpack configuration files
const config = (env, argv) =>
  merge(common, {
    entry: {
      background: PATHS.src + '/background.js',
      cumulative_gpa: PATHS.src + '/cumulative_gpa.js',
      modules_downloader: PATHS.src + '/modules_downloader.js',
      files_downloader: PATHS.src + '/files_downloader.js',
      popup: PATHS.src + '/popup.js',
    },
    // module: {
    //   rules: [
    //     {
    //       test: /\.js$/i,
    //       exclude: /node_modules/,
    //       include: PATHS.src + "/modules",
    //       use: ['babel-loader'],
    //     },
    //   ],
    // },
    plugins: [
      new CircularDependencyPlugin({
        // exclude detection of files based on a RegExp
        exclude: /node_modules/,
        // include specific files based on a RegExp
        include: /src/,
        // add errors to webpack instead of warnings
        failOnError: true,
        // allow import cycles that include an asyncronous import,
        // e.g. via import(/* webpackMode: "weak" */ './file.js')
        allowAsyncCycles: false,
        // set the current working directory for displaying module paths
        cwd: process.cwd(),
        // `onEnd` is called before the cycle detection ends
        onEnd({ compilation }) {
          console.log('end detecting webpack modules cycles');
        },
      }),
    ],
    devtool: argv.mode === 'production' ? false : 'source-map',
  });

module.exports = config;
