const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = function (options) {
  return {
    ...options,
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
