'use strict';
const {app} = require('electron');
const AutoLaunch = require('auto-launch');
const winston = require('winston');
const path = require('path');

// User config
//==================================

const Configstore = require('electron-store');

/**
 * Config for the main process - dependent on access to the user's config file
 * Contains persisted non-constant data under 'user'.
 */
module.exports = class Config {
  /**
   * @param {string} dir Specify a non-default config location. Should only be used for testing.
   */
  constructor(dir = null) {
    var options = {defaults : Config.defaultUserConf()};
    if (dir) {
      options['cwd'] = dir;
    }
    this._user = new Configstore(options);
    winston.debug("Config file path: " + this.user.path);

    this._firstRun = this.user.get('firstRun');
    if (this._firstRun) {
      this.user.set('firstRun', false);
    }
  }

  /**
   * @returns {dict} The user config. Access with .get, .set, .has
   */
  get user() { return this._user; }

  /**
   * @returns {bool} Whether this is the first run of the application or not.
   */
  get firstRun() { return this._firstRun; }

  setupAutoLaunch() {
    var autoLauncher = new AutoLaunch({name : app.getName()});
    if (this.user.get('runOnStartup')) {
      autoLauncher.enable().catch(
          (reason) => { winston.warning("Couldn't enable launch on system startup: " + reason); })
    }
  }

  /**
   * Period is stored in minutes in the config file.
   * Use this helper to get it in a useful form.
   * @returns {time} period in milliseconds
   */
  get period() { return this.user.get('period') * 60 * 1000; }

  /**
   * Pretending to be a class variable. Exposed so we can use it in tests.
   * @returns {dict} The default config
   */
  static defaultUserConf() {
    return {
      /** @type {minutes} */
      period : 45,
      /**
       * The seed for the ping sequence.
       * Random initial value based on date/time of first run.
       */
      seed : require('random-js')().integer(0, Math.pow(2, 32) - 1),
      pingFilePath : path.join(app.getPath('userData'), 'tagtime.log'),
      pingFileStart : null,
      firstRun : true,
      alwaysOnTop : true,
      runOnStartup : true,
      tagWidth : 80, // how much space the tags will be padded to
    };
  }
}
