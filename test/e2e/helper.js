const path = require('path');
exports.appPath = path.resolve(__dirname, '..', '..');

var electronPath;
if(process.platform === 'win32') {
  electronPath = path.resolve(__dirname, '..', '..', 'node_modules', 'electron', 'dist', 'electron.exe');
} else {
  electronPath = path.resolve(__dirname, '..', '..', 'node_modules', '.bin', 'electron');
}
exports.electronPath = electronPath;
