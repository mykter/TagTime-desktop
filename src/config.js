/**
 * Run before anything else to do initial log config.
 * Contains global constants.
 * Contains persisted non-constant data under 'user'.
 */
'use strict';
const {app} = require('electron');
const path = require('path');
const fs = require('fs');

// Global constants
//==================================

/**
 * The birth of tagtime
 * Treat as const
 * The first ping in all sequences is on the epoch.
 */
exports.epoch = 1184083200 * 1000;


// User config
//==================================

const Configstore = require('configstore');
const pkg = require('../package.json');

exports.defaultUserConf = {
  /** @type {minutes} */
  period : 45,
  /**
   * The seed for the ping sequence.
   * Random initial value based on date/time of first run.
   */
  seed : require('random-js')().integer(0, 2**32 - 1),
  loglevel : 'warn',
  pingFilePath : path.join(app.getPath('userData'), 'tagtime.log'),
  promptWidth: 600,
  promptHeight: 250,
  firstRun: true
};

/** The per-user config object
 * We are not storing it under the configstore path, to make it
 * easier for users to find the config file.
 */
exports.user = new Configstore(pkg.name, exports.defaultUserConf, {globalConfigPath: true});

var _firstRun;
/**
 * @returns {bool} Whether this is the first time the application has been opened
 */
exports.firstRun = function() {
  if (_firstRun === undefined) {
    if (_firstRun = exports.user.get('firstRun')) {
      exports.user.set('firstRun', false);
    }
  }
  return _firstRun;
};

/**
 * Period is stored in minutes in the config file.
 * Use this helper to get it in a useful form.
 * @returns {time} period in milliseconds
 */
exports.period = function() {
  return exports.user.get('period') * 60 * 1000;
};

// Log config
// ==============================

const winston = require('winston');
winston.level = exports.user.get('loglevel');
if (process.env.NODE_ENV === 'test') {
  /* don't pollute test console output with anything except errors,
     which shouldn't be triggerable via module APIs.
     Send logs to a temporary file instad.
     Requires tests to set NODE_ENV.
     Requires all modules to import config - dubious, but they probably will
  */
  var tmp = require('tmp');
  var logfile = tmp.tmpNameSync();
  winston.info("Test mode log config - only errors to console, all to " + logfile);
  winston.configure({
    transports : [
      new (winston.transports.File)({filename : logfile, json : false}),
      new (winston.transports.Console)({level : 'error'})
    ]
  });
}
