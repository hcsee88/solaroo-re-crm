const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = function (options) {
  return {
    ...options,
    // Pin the webpack entry to the real source file. nest-cli.json's
    // entryFile + sourceRoot are tuned for tsc-watch (dev), and webpack
    // would otherwise compose them into a non-existent path.
    entry: path.resolve(__dirname, 'src/main.ts'),
    // Force the bundle to dist/main.js so the production Dockerfile
    // (CMD ["node", "dist/main"]) stays stable.
    output: {
      ...(options.output ?? {}),
      filename: 'main.js',
      path: path.resolve(__dirname, 'dist'),
    },
    externals: [
      nodeExternals({
        // Allow @solaroo/* workspace packages to be bundled (not treated as external)
        allowlist: [/^@solaroo\//],
        modulesDir: path.resolve(__dirname, '../../node_modules'),
      }),
      nodeExternals({
        allowlist: [/^@solaroo\//],
        modulesDir: path.resolve(__dirname, 'node_modules'),
      }),
    ],
  };
};
