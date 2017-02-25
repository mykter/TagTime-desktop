/**
 * Run before anything else to do initial log config.
 * Contains global constants.
 * Contains persisted non-constant data under 'user'.
 */
'use strict';

// Global constants
//==================================

/**
 * The birth of tagtime
 * Treat as const
 * The first ping in all sequences is on the epoch.
 */
exports.epoch = 1184083200;


// User config
//==================================

const Configstore = require('configstore');
const pkg = require('../package.json');

exports.defaultUserConf = {
  /** @type {seconds} */
  period : 45 * 60,
  /**
   * The seed for the ping sequence.
   * Random initial value based on date/time of first run.
   */
  seed : require('random-js')().integer(0, 2**32 - 1),
  loglevel : 'warn',
  promptWidth: 600,
  promptHeight: 250
};

/** The per-user config object
 * We are not storing it under the configstore path, to make it
 * easier for users to find the config file.
 */
exports.user = new Configstore(pkg.name, exports.defaultUserConf, {globalConfigPath: true});

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
