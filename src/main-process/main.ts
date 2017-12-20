import { app, Menu, Tray } from "electron";
const winston = require("winston"); // type errors with winston.level= if using "import"
import * as path from "path";
const openAboutWindow = require("about-window").default;
import * as moment from "moment";
import * as commander from "commander";
import * as fs from "fs";

import * as prompts from "./prompts";
import { Config, ConfigName } from "./config";
import { PingFile } from "./pingfile";
import { openPreferences } from "./openPrefs";
import { openEditor } from "./edit";
import { saveCoverage } from "./coverageSupport";
import { PingTimes } from "../pingtimes";

// Keep a global reference, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let tray;
const appRoot = path.join(__dirname, "..", "..", "..");
const icon_path = path.resolve(appRoot, "resources", "tagtime.png");

/**
 * Ensures only one instance of the app is running at a time.
 * On launch of second instance, it quits and the first instance
 * notifies the user.
 * @param {bool} alwaysQuit Notify any existing instance then quit regardless
 * @return true if this is the only instance, false otherwise
 */
function singleInstance(alwaysQuit: boolean) {
  const secondInstance = app.makeSingleInstance((argv, _cwd) => {
    // Runs in the existing app when another instance is launched
    winston.debug("A second instance was started");
    const notify = require("electron-main-notification");
    if (argv.includes("--quit")) {
      notify(app.getName() + " quitting.", {
        body: "Quitting as another instance was run with --quit"
      });
      app.quit();
    } else {
      notify(app.getName() + " is already running", {
        body: "You can't run multiple copies of TagTime, please quit first if you want to restart."
      });
    }
  });
  if (alwaysQuit) {
    // Quit regardless.
    // Can't offer any useful info to the user - secondInstance might return
    // false even if there was a second instance, because it has now quit.
    winston.debug("Quitting per --quit; if a second instance existed it has been notified.");
    app.quit();
    return false;
  } else if (secondInstance) {
    winston.warn("An instance of " + app.getName() + " is already running, quitting...");
    app.quit();
    return false;
  }
  return true;
}

/**
 * Download and install developer extensions
 */
async function installDevExtensions() {
  const installer = require("electron-devtools-installer");
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ["REACT_DEVELOPER_TOOLS"];

  return Promise.all(
    extensions.map(name => installer.default(installer[name], forceDownload))
  ).catch(winston.error);
}

/**
 * Launch an about window
 */
function about() {
  openAboutWindow({ icon_path: icon_path, package_json_dir: appRoot });
}

/**
 * Create a system tray icon with context menu
 */
function createTray() {
  winston.debug("Creating tray");
  tray = new Tray(icon_path);
  tray.setToolTip(app.getName());
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Preferences",
        click: () => {
          openPreferences();
        }
      },
      { label: "Edit Pings", click: openEditor },
      { label: "About", click: about },
      { label: "Quit", click: app.quit }
    ])
  );
}

/**
 * Handle invocations in --test mode
 * @param {string} option The requested test mode
 */
function mainTest(option: string) {
  switch (option) {
    case "prompt":
      prompts.openPrompt(Date.now(), true);
      break;
    case "prefs":
      openPreferences(true);
      break;
    case "quit":
      break;
    default:
      throw "Didn't recognise test option " + option;
  }
}

/**
 * Process argv into an object
 */
function parseCommandLine() {
  // Could split --test out into its own .command('test')
  // commander assumes that the first two values in argv are 'node' and 'blah.js' and then followed
  // by the args. This is not the case when running from a packaged Electron app. Here you have
  // first value 'appname' and then args. https://github.com/tj/commander.js/issues/512
  let argvWorkaround;
  if (process.argv[0].includes("electron")) {
    argvWorkaround = process.argv;
  } else {
    argvWorkaround = [process.argv[0], "", ...process.argv.slice(1)];
  }

  // process.env.npm_package_version only guaranteed available when run from an npm script
  let version = JSON.parse(fs.readFileSync(`${appRoot}/package.json`, "utf8")).version;

  commander
    .version(version)
    .option("--test <option>", "Development test mode")
    .option("--logfile <path>", "Send logging output to this file instead of stdout")
    .option("--configdir <path>", "Path which contains config file (test use only)")
    .option("-v, --verbose", "Debug logging")
    .option(
      "--quit",
      "Tell another running instance to quit (useful for killing zombie " +
        "--test instances that don't have a tray icon)"
    )
    .parse(argvWorkaround);
  return commander;
}

/**
 * Initial setup
 */
function firstRunTasks() {
  winston.info("First run");
  global.config.setupAutoLaunch();

  // Don't assume that pings prior to first install use the same seed, or came from the same
  // algorithm.
  winston.info(
    "First run: any pings in the configured pingfile before now will be passed over when " +
      "checking for missed pings etc. The ping period is assumed to be the same (" +
      global.config.user.get("period") +
      " minutes)."
  );
  global.config.user.set("pingFileStart", moment().format(global.config.pingFileStartFormat));
}

/**
 * Configure winston and expose to renderer windows via global.logger
 */
function setupLogging(verbose: boolean, logfile: string) {
  if (verbose) {
    winston.level = "debug";
  } else {
    winston.level = "warn";
  }

  if (logfile) {
    winston.add(winston.transports.File, { filename: logfile });
    winston.remove(winston.transports.Console);
  }
  global.logger = winston;
}

/**
 * Add any missing pings to the file, and show an editor if we added any
 */
export function catchUp() {
  if (prompts.catchUp(Date.now())) {
    if (global.config.user.get(ConfigName.editorOnStartup)) {
      openEditor();
    }
  }
}

/**
 * Application init
 */
function main() {
  // Coverage variables from the main and renderer processes accumulate here
  global.coverage = [];

  let program = parseCommandLine();

  setupLogging(program.verbose, program.logfile);

  // Prevent second instance from running
  if (!singleInstance(program.quit)) {
    saveCoverage();
    return;
  }

  winston.debug(app.getName() + " v" + app.getVersion() + " starting up");
  global.config = new Config(program.configdir);

  let createPingFile = false;
  if (global.config.firstRun) {
    firstRunTasks();
    createPingFile = true;
  }

  // Export the ping file and ping stream wrappers
  global.pingFile = new PingFile(
    global.config.user.get("pingFilePath"),
    false,
    createPingFile,
    true,
    global.config.user.get("tagWidth")
  );
  global.pings = new PingTimes(
    global.config.period,
    global.config.user.get("seed"),
    global.config.user.get("pingFileStart")
  );

  // Save coverage on exit
  app.on("quit", function() {
    saveCoverage();
  });

  /* The tray doesn't count as a window, so don't quit when the other windows
  are closed.
  In e2e test mode we will need to ensure we explicitly quit after closing a window. */
  app.on("window-all-closed", () => {});

  app.on("ready", async function() {
    winston.debug(app.getName() + " ready");
    await installDevExtensions();
    if (program.test) {
      mainTest(program.test);
    } else {
      createTray();
      catchUp();
      prompts.schedulePings(prompts.openPrompt);
    }
  });
}

// Only actually do anything if we weren't require'd but ran
if (require.main === module) {
  main();
}
