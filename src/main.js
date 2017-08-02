'use strict';

const {app, Menu, Tray} = require('electron');
const winston = require('winston');
const path = require('path');
const fs = require('fs');

const Config = require('./config');
const prompts = require('./prompts');
const PingTimes = require('./pingtimes');
const PingFile = require('./pingfile');
const edit = require('./edit');

// Keep a global reference, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let tray;

/**
 * Ensures only one instance of the app is running at a time.
 * On launch of second instance, it quits and the first instance
 * notifies the user.
 * @return {bool} true if this is the only instance, false otherwise
 */
var singleInstance = function(cmdline) {
  const secondInstance = app.makeSingleInstance((argv, _cwd) => {
    // Runs in the existing app when another instance is launched
    const notify = require('electron-main-notification');
    if (argv.includes('--quit')) {
      notify(app.getName() + " quitting.",
             {body : "Quitting as another instance was run with --quit"});
      app.quit();
    } else {
      notify(app.getName() + " is already running", {
        body : "You can't run multiple copies of TagTime, please quit first if you want to restart."
      });
    }
  });
  if (cmdline.quit) {
    // Quit regardless.
    // Can't offer any useful info to the user - secondInstance might return
    // false even if there was a second instance, because it has now quit.
    app.quit();
    return false;
  } else if (secondInstance) {
    winston.warn("An instance of " + app.getName() + " is already running, quitting...");
    app.quit();
    return false;
  }
  return true;
};

/**
 * Create a system tray icon with context menu
 */
function createTray() {
  winston.debug("Creating tray");
  tray = new Tray(path.resolve(__dirname, '..', 'resources', 'tagtime.png'));
  tray.setToolTip(app.getName());
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label : 'Preferences',
      click : function() {
        winston.debug("prefs not implemented");
        return;
      }
    },
    {label : 'Edit Pings', click : edit.openEditor},
    {label : 'Quit', click : app.quit},
  ]));
}

/**
 * Handle invocations in --test mode
 * @param {string} option The requested test mode
 */
var mainTest = function(option) {
  switch (option) {
  case "prompt":
    app.on('ready', () => {prompts.openPrompt(Date.now())});
    break;
  case "quit":
    break;
  default:
    throw("Didn't recognise test option " + option);
  }
};

/**
 * Process argv into an object
 */
var parseCommandLine = function() {
  // Could split --test out into its own .command('test')
  var program = require('commander');

  // commander assumes that the first two values in argv are 'node' and 'blah.js' and then followed
  // by the args. This is not the case when running from a packaged Electron app. Here you have
  // first value 'appname' and then args. https://github.com/tj/commander.js/issues/512
  var argvWorkaround;
  if (process.argv[0].includes('electron')) {
    argvWorkaround = process.argv;
  } else {
    argvWorkaround = [ process.argv[0], '', ...process.argv.slice(1) ];
  }
  program.version(process.env.npm_package_version)
      .option('--test <option>', "Development test mode")
      .option('--pingfile <path>', "Override the pingfile path specified in the user config")
      .option('--logfile <path>', "Send logging output to this file instead of stdout")
      .option('--configdir <path>', "Path which contains config file (test use only)")
      .option('-v, --verbose', "Debug logging")
      .option('--quit', "Tell another running instance to quit (useful for killing zombie " +
                            "--test instances that don't have a tray icon)")
      .parse(argvWorkaround);
  return program;
};

/**
 * @returns {PingFile} the pingfile at pathArg or from the config if not specified
 */
var getPingFile = function(pathArg) {
  var pingFilePath;
  if (pathArg) {
    pingFilePath = pathArg;
  } else {
    pingFilePath = global.config.user.get('pingFilePath');
  }
  return new PingFile(pingFilePath, false, global.config.firstRun, true,
                      global.config.user.get("tagWidth"));
};

/**
 * Initial setup
 */
var firstRunTasks = function() {
  winston.info("First run, setting up app to launch on startup");
  global.config.setupAutoLaunch();

  // Don't assume that pings prior to first install use the same seed, or came from the same
  // algorithm.
  winston.info(
      "First run: any pings in the configured pingfile before now will be passed over when " +
      "checking for missed pings etc. The ping period is assumed to be the same (" +
      global.config.user.get('period') + " minutes).");
  global.config.user.pingFileStart = Date.now();
};

/**
 * Configure winston and expose to renderer windows via global.logger
 */
var setupLogging = function(verbose, logfile) {
  if (verbose) {
    winston.level = 'debug';
  } else {
    winston.level = 'warn';
  }
  if (logfile) {
    winston.add(winston.transports.File, {filename : logfile});
    winston.remove(winston.transports.Console);
  }
  global.logger = winston;
};

/**
 * Save istanbul coverage information on program exit
 */
var save_coverage = function() {
  if (!process.env.TAGTIME_E2E_COVERAGE_DIR) {
    return;
  }

  if (typeof __coverage__ !== "undefined") {
    global.coverage.push(__coverage__); // eslint-disable-line no-undef
    winston.warn("main coverage");
  }
  if (global.coverage.length === 0) {
    winston.error("TAGTIME_E2E_COVERAGE_DIR is set but no coverage information available.");
  } else {
    // Find a unique file name
    var i = -1;
    var coverageBase;
    do {
      i += 1;
      coverageBase = `coverage${i}.json`;
    } while (fs.existsSync(path.join(process.env.TAGTIME_E2E_COVERAGE_DIR, coverageBase)))

    global.coverage.forEach((e, i) => {
      var name;
      if (i === 0) {
        // The first file we write is the unique name
        name = coverageBase;
      } else {
        // subsequent ones are prefixed, to allow identifying which run a
        // file came from
        name = "var" + i + "-" + coverageBase;
      }
      fs.writeFileSync(path.join(process.env.TAGTIME_E2E_COVERAGE_DIR, name), JSON.stringify(e));
    });
  }
};

/**
 * Application init
 */
var main = function() {
  // Coverage variables from the main and renderer processes accumulate here
  global.coverage = []

      var program = parseCommandLine();

  setupLogging(program.verbose, program.logfile);

  // Prevent second instance from running
  if (!singleInstance(program)) {
    save_coverage();
    return;
  }

  winston.debug(app.getName() + " v" + app.getVersion() + " starting up");
  global.config = new Config(program.configdir);

  if (global.config.firstRun) {
    firstRunTasks();
  }

  // Export the ping file and ping stream wrappers
  global.pingFile = getPingFile(program.pingfile);
  global.pings = new PingTimes(global.config.period, global.config.user.get('seed'),
                               global.config.user.get('pingFileStart'));

  // Save coverage on exit
  app.on('quit', function() { save_coverage(); });

  if (program.test) {
    mainTest(program.test);
  } else {
    app.on('ready', function() { winston.debug(app.getName() + " ready"); });

    /* The tray doesn't count as a window, so don't quit when the other windows
     are closed.
     In e2e test mode we will quit when there are no open windows - as a
     consequence we can't test any asynchronous events in the main process after
     all the windows have closed. */
    app.on('window-all-closed', () => {});

    app.on('ready', createTray);
    app.on('ready', prompts.schedulePings);
    app.on('ready', prompts.editorIfMissed);
  }
};

main();
