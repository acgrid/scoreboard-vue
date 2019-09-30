'use strict'

const webpack = require('webpack')
const path = require('path')
const nodeExternals = require('webpack-node-externals')

const NODE_ENV = process.env.NODE_ENV || 'development'
const isProd = NODE_ENV === 'production'

const base = {
  mode: NODE_ENV,
  target: 'node',
  cache: true,
  node: {
    console: false,
    global: false,
    process: false,
    Buffer: false,
    __filename: true,
    __dirname: true
  },

  entry: ['./server/main.js'],

  output: {
    path: path.join(__dirname, '..', 'dist-server'),
    filename: isProd ? 'bundle.js' : 'bundle-dev.js'
  },

  externals: [
    nodeExternals({
      whitelist: ['webpack/hot/poll?100']
    })
  ],

  // devtool: "sourcemap",

  module: {
    noParse: /es6-promise\.js$/, // avoid webpack shimming process
    rules: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: [/node_modules/, /vendor/]
      },
      {
        test: /\.json$/,
        loader: 'json-loader'
      },
      {
        test: /\.vue$/,
        loader: 'vue-loader',
        options: {
          compilerOptions: {
            preserveWhitespace: false
          }
        }
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.json']
  },
  performance: {
    maxEntrypointSize: 1048576,
    hints: isProd ? 'warning' : false
  },
  plugins: [
  ]
}

if (!isProd) {
  base.entry.unshift('webpack/hot/poll?100')
  base.plugins.push(new webpack.HotModuleReplacementPlugin())
}

module.exports = base
