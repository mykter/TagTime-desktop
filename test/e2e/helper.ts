import * as fkill from "fkill";
import * as fs from "fs";
import * as _ from "lodash";
import * as path from "path";
import * as psTree from "ps-tree";
import spectron = require("spectron");
import * as tmp from "tmp";
import * as winston from "winston";

import { Config, ConfigDict, logFileName } from "../../src/main-process/config";
export { ConfigDict } from "../../src/main-process/config"; // reexport for convenience

export const appPath = path.resolve(__dirname, "..", "..", "..");

const nodeModulesPath = path.resolve(appPath, "node_modules");
let tmpElectronPath;
if (process.platform === "win32") {
  tmpElectronPath = path.resolve(
    nodeModulesPath,
    "electron",
    "dist",
    "electron.exe"
  );
} else {
  tmpElectronPath = path.resolve(nodeModulesPath, ".bin", "electron");
}
export const electronPath = tmpElectronPath;

/**
 * Creates a new config file in a temporary directory based on the default config
 * @param options {dict} Any options to change from their defaults
 * @returns {string} directory containing the config file
 */
function createConfig(options: Partial<ConfigDict>) {
  const conf: ConfigDict = _.clone(Config.defaultDict());
  for (const key in options) {
    if (options.hasOwnProperty(key)) {
      conf[key] = options[key];
    }
  }
  const configDir: string = tmp.dirSync().name;
  const configFile: string = path.join(configDir, "config.json");
  fs.writeFileSync(configFile, JSON.stringify(conf));
  return { configDir, configFile, config: conf };
}

/**
 * Launch the applicaiton under spectron
 * @param testParam {string} The parameter to pass to --test
 * @param pingFilePath {string} The ping file to put in this instances config file
 */
export function launchApp(testParam: string, pingFilePath?: string) {
  const Application = spectron.Application;
  const { configDir, configFile, config } = createConfig({
    pingFilePath,
    runOnStartup: false,
    firstRun: false
  });

  const logFile = path.join(configDir, logFileName);
  fs.writeFileSync(logFile, ""); // touch the log to ensure it exists - makes reading simpler

  const app = new Application({
    path: electronPath,
    args: [
      appPath,
      "--test",
      testParam,
      "--nostdout",
      "--verbose",
      "--configdir",
      configDir
    ]
  });
  return {
    app,
    tmpLogFileName: logFile,
    tmpConfigDir: configDir,
    tmpConfigFile: configFile,
    tmpConfig: config
  };
}

/**
 * Returns a promise that resolves once test() is truthy
 * Tests the value of test() every interval ms
 */
export function until(test: () => boolean, interval: number) {
  return new Promise(function(resolve, _reject) {
    const check = function() {
      if (test()) {
        resolve();
      } else {
        setTimeout(check, interval);
      }
    };
    setTimeout(check, interval);
  });
}

/**
 * Kill a process and all of its children
 * The tree-kill module doesn't work for me in this context
 *  - the ps process never returns, it gets stuck as a defunct
 *  process.
 * @param {number} parentPid The root of the process tree to kill
 */
export function tree_kill(parentPid: number) {
  psTree(parentPid, function(err, children) {
    children.forEach(function(child) {
      try {
        process.kill(child.PID, "SIGKILL");
      } catch (e) {
        // ignore it
      }
    });
    try {
      process.kill(parentPid, "SIGKILL");
    } catch (e) {
      // ignore it
    }
  });
}

export function kill_spectron() {
  // app.stop doesn't work without a renderer window around, so need this fallback
  // the kill might fail because there is no chromedriver e.g. a test ran app.stop()
  return fkill(["chromedriver", "chromedriver.exe"], {
    force: true,
    tree: true
  }).then(
    () => {
      /* do nothing */
    },
    () => {
      /* do nothing */
    }
  );
}
