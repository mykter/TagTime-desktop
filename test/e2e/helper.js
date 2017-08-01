const path = require('path');
if (process.env.TAGTIME_TARGET_APP_PATH) {
  exports.appPath = process.env.TAGTIME_TARGET_APP_PATH;
} else {
  exports.appPath = path.resolve(__dirname, '..', '..');
}

var electronPath;
if (process.platform === 'win32') {
  electronPath =
      path.resolve(__dirname, '..', '..', 'node_modules', 'electron', 'dist', 'electron.exe');
} else {
  electronPath = path.resolve(__dirname, '..', '..', 'node_modules', '.bin', 'electron');
}
exports.electronPath = electronPath;

const Config = require('../../src/config');
const tmp = require('tmp');
const fs = require('fs');
const pkg = require('../../package.json');
const _ = require('lodash');
/**
 * Creates a new config file in a temporary directory based on the default config
 * @param options {dict} Any options to change from Config.defaultUserConfig
 * @returns {string} directory containing the config file
 */
exports.createConfig = function(options) {
  var configDir = tmp.dirSync();
  var conf = _.clone(Config.defaultUserConf);
  for (var key in options) {
    conf[key] = options[key];
  }
  fs.writeFileSync(path.join(configDir.name, pkg.name + ".json"), JSON.stringify(conf));
  return configDir.name;
}
