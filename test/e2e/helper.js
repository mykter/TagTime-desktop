const winston = require("winston");
const path = require("path");

exports.appPath = path.resolve(__dirname, "..", "..", "..");

var nodeModulesPath = path.resolve(exports.appPath, "node_modules");
var electronPath;
if (process.platform === "win32") {
  electronPath = path.resolve(nodeModulesPath, "electron", "dist", "electron.exe");
} else {
  electronPath = path.resolve(nodeModulesPath, ".bin", "electron");
}
exports.electronPath = electronPath;

const Config = require("../../src/main-process/config");
const fs = require("fs");
const _ = require("lodash");
/**
 * Creates a new config file in a temporary directory based on the default config
 * @param options {dict} Any options to change from Config.defaultUserConfig
 * @returns {string} directory containing the config file
 */
let createConfig = function(options) {
  var conf = _.clone(Config.defaultConfig());
  for (var key in options) {
    conf[key] = options[key];
  }
  let configDir = tmp.dirSync().name;
  let configFile = path.join(configDir, "config.json");
  fs.writeFileSync(configFile, JSON.stringify(conf));
  return { configDir: configDir, configFile: configFile, config: conf };
};

const tmp = require("tmp");
/**
 * Launch the applicaiton under spectron
 * @param testParam {string} The parameter to pass to --test
 * @param pingFilePath {string} The ping file to put in this instances config file
 */
exports.launchApp = function(testParam, pingFilePath = null) {
  let Application = require("spectron").Application;
  let tmpLogFileName = tmp.tmpNameSync();
  let { configDir, configFile, config } = createConfig({
    pingFilePath: pingFilePath,
    runOnStartup: false,
    firstRun: false
  });
  winston.debug("Logging to " + tmpLogFileName);

  let app = new Application({
    path: exports.electronPath,
    args: [
      exports.appPath,
      "--test",
      testParam,
      "--logfile",
      tmpLogFileName,
      "--verbose",
      "--configdir",
      configDir
    ]
  });
  return {
    app: app,
    tmpLogFileName: tmpLogFileName,
    tmpConfigDir: configDir,
    tmpConfigFile: configFile,
    tmpConfig: config
  };
};

/**
 * Returns a promise that resolves once test() is truthy
 * Tests the value of test() every interval ms
 */
exports.until = function(test, interval) {
  return new Promise(function(resolve, _reject) {
    let check = function() {
      if (test()) {
        resolve();
      } else {
        setTimeout(check, interval);
      }
    };
    setTimeout(check, interval);
  });
};
