const path = require('path');
exports.appPath = path.resolve(__dirname, '..', '..');

var exe_suffix = "";
if(process.platform === 'win32') {
  exe_suffix = '.cmd';
}
exports.electronPath = path.resolve(__dirname, '..', '..', 'node_modules', 'electron', 'dist',
                                    'electron.exe');