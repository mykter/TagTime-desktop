/**
 * Helper module for tests
 */

const path = require('path');
exports.appPath = path.resolve(__dirname, '../');

var exe_suffix = "";
if(process.platform === 'win32') {
  exe_suffix = '.cmd';
}
exports.electronPath = path.resolve(__dirname, '..', 'node_modules', '.bin' , 'electron' + exe_suffix);

process.env.NODE_ENV = 'test'; // suppress logging
