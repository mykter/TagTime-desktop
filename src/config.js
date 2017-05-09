/**
 * Config for the main process - dependent on access to the user's config file
 * Contains persisted non-constant data under 'user'.
 */

'use strict';
const {app} = require('electron');
const path = require('path');

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
  seed : require('random-js')().integer(0, Math.pow(2, 32) - 1),
  pingFilePath : path.join(app.getPath('userData'), 'tagtime.log'),
  firstRun : true,
  alwaysOnTop : true,
  runOnStartup : true,
};

/** The per-user config object
 * We are not storing it under the configstore path, to make it
 * easier for users to find the config file.
 */
exports.user = new Configstore(pkg.name, exports.defaultUserConf, {globalConfigPath : true});

var _firstRun;
/**
 * @returns {bool} Whether this is the first time the application has been opened
 */
exports.firstRun = function() {
  if (_firstRun === undefined) {
    _firstRun = exports.user.get('firstRun');
    if (_firstRun) {
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
exports.period = function() { return exports.user.get('period') * 60 * 1000; };
