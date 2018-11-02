import openAboutWindow from "about-window";
import * as commander from "commander";
import { app, Menu, nativeImage, Tray } from "electron";
import * as fs from "fs";
import * as moment from "moment";
import { platform } from "os";
import * as path from "path";
import winston = require("winston"); // type errors with winston.level= if using "import"

import { PingTimes } from "../pingtimes";
import {
  appRoot,
  Config,
  ConfigName,
  imagesPath,
  logoPath,
  trayIconPath
} from "./config";
import { saveCoverage } from "./coverageSupport";
import { openEditor } from "./edit";
import { openPreferences } from "./openPrefs";
import { PingFile } from "./pingfile";
import * as prompts from "./prompts";

// Keep a global reference, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let tray;

/**
 * Ensures only one instance of the app is running at a time.
 * On launch of second instance, it quits and the first instance
 * notifies the user.
 * @param {bool} alwaysQuit Notify any existing instance then quit regardless
 * @return true if this is the only instance, false otherwise
 */
function singleInstance(alwaysQuit: boolean) {
  app.on("second-instance", (event, commandLine, workingDirectory) => {
    // Runs in the existing app when another instance is launched
    winston.debug("A second instance was started");
    const notify = require("electron-main-notification");
    if (commandLine.includes("--quit")) {
      notify(app.getName() + " quitting.", {
        body: "Quitting as another instance was run with --quit"
      });
      app.quit();
    } else {
      notify(app.getName() + " is already running", {
        body:
          "You can't run multiple copies of TagTime, please quit first if you want to restart."
      });
    }
  });

  const instanceLock = app.requestSingleInstanceLock();

  if (alwaysQuit) {
    // Quit regardless.
    winston.debug(
      "Quitting per --quit; if a second instance existed it has been notified."
    );
    app.quit();
    return false;
  } else if (!instanceLock) {
    winston.warn(
      "An instance of " + app.getName() + " is already running, quitting..."
    );
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
  openAboutWindow({ icon_path: logoPath, package_json_dir: appRoot });
}

/**
 * Create a system tray icon with context menu
 */
function createTray() {
  winston.debug("Creating tray");
  tray = new Tray(trayIconPath);
  if (platform() === "darwin") {
    const trayPressedIcon = nativeImage.createFromPath(
      path.resolve(imagesPath, "macHighlight.png")
    );
    tray.setPressedImage(trayPressedIcon);
  }
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
      throw new Error("Didn't recognise test option " + option);
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
  const version = JSON.parse(fs.readFileSync(`${appRoot}/package.json`, "utf8"))
    .version;

  commander
    .version(version)
    .option(
      "--nostdout",
      "Suppress logging on stdout (still goes to debug.log)"
    )
    .option("-v, --verbose", "Debug logging")
    .option("--test <option>", "Development test mode")
    .option(
      "--configdir <path>",
      "Path which contains config file (test use only)"
    )
    .option(
      "--quit",
      "Tell another running instance to quit (useful for killing zombie " +
        "--test instances that don't have a tray icon)"
    )
    .option(
      "--prod",
      "Usually, the presence of a .git folder in the application root directory will \
cause TagTime to use a local config directory. --prod suppresses this behaviour."
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
  global.config.user.set(
    "pingFileStart",
    moment().format(global.config.pingFileStartFormat)
  );
}

/**
 * Configure winston and expose to renderer windows via global.logger
 */
function setupLogging(verbose: boolean, noStdout: boolean) {
  if (verbose) {
    winston.level = "debug";
  } else {
    winston.level = "warn";
  }

  if (noStdout) {
    winston.remove(winston.transports.Console);
  }

  global.logger = winston;
}

/**
 * Finish configuring winston. Uses global.config.
 */
function finalizeLogging() {
  winston.add(winston.transports.File, {
    filename: global.config.logFile,
    handleExceptions: true
  });
  winston.handleExceptions();
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

  const program = parseCommandLine();

  setupLogging(program.verbose, program.nostdout);

  global.config = new Config(program.configdir, program.prod);

  // Prevent second instance from running (unless in dev mode)
  if (!global.config.isDev && !singleInstance(program.quit)) {
    saveCoverage();
    return;
  }

  winston.debug(app.getName() + " v" + app.getVersion() + " starting up");
  finalizeLogging();

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
  app.on("window-all-closed", () => {
    /* do nothing */
  });

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
