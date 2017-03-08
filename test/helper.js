/**
 * Helper module for tests
 */

const path = require('path');
exports.appPath = path.resolve(__dirname, '../');
exports.electronPath = path.resolve(__dirname, '../node_modules/.bin/electron');

process.env.NODE_ENV = 'test'; // suppress logging
