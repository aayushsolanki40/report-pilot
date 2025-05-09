const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

module.exports = {
    mode: 'none', // This will be controlled by the --mode flag
    entry: './src/extension.ts',
    output: {
        path: path.resolve(__dirname, 'out'),
        filename: 'extension.js',
        libraryTarget: 'commonjs2'
    },
    resolve: {
        extensions: ['.ts', '.js'],
        fallback: {
            "path": false,
            "fs": false,
            "child_process": false,
            "events": false
        }
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/
            }
        ]
    },
    externals: {
        vscode: 'commonjs vscode' // Do not bundle the vscode module
    },
    plugins: [
        new CleanWebpackPlugin()
    ],
    devtool: 'source-map',
    infrastructureLogging: {
        level: "log", // enables logging required for problem matchers
    },
    target: 'node', // VS Code extensions run in a Node.js-context
    node: {
        __dirname: false, // leave the __dirname behavior intact
        __filename: false // leave the __filename behavior intact
    }
};