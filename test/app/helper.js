/**
 * Helper module for tests
 */
'use strict';

const path = require('path');
exports.appPath = path.resolve(__dirname, '..', '..');

var exe_suffix = "";
if(process.platform === 'win32') {
  exe_suffix = '.cmd';
}
exports.electronPath = path.resolve(__dirname, '..', '..', 'node_modules', '.bin',
                                    'electron' + exe_suffix);

// Don't pollute test output with normal logs
// This will get called prior to the standard log config on app startup,
// so just need to ensure that doesn't overwrite this config.
const winston = require('winston');
var tmp = require('tmp');
var logfile = tmp.tmpNameSync();
winston.info("Test mode log config - only errors to console, all to " + logfile);
winston.configure({
  transports : [
    new (winston.transports.File)({filename : logfile, json : false}),
    new (winston.transports.Console)({level : 'error'})
  ]
});
