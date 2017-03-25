'use strict';

const {app, Menu, Tray} = require('electron');
const url = require('url');
const winston = require('winston');

const config = require('./config');
const prompts = require('./prompts');
const Pings = require('./pings');
const pingfile = require('./pingfile');

// Keep a global reference, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let tray;

/**
 * Ensures only one instance of the app is running at a time.
 * On launch of second instance, it quits and the first instance
 * notifies the user.
 * @return {bool} true if this is the only instance, false otherwise
 */
var singleInstance = function() {
  const secondInstance = app.makeSingleInstance((argv, cwd) => {
    // Runs in the existing app when another instance is launched
    const notify = require('electron-main-notification');
    notify(app.getName() + " is already running", {
      body :
          "You can't run multiple copies of TagTime, please quit first if you want to restart."
    });
  });
  if (secondInstance) {
    winston.warn("An instance of " + app.getName() +
                 " is already running, quitting...");
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
  tray = new Tray('resources/tagtime.png');
  tray.setToolTip(app.getName());
  tray.setContextMenu(Menu.buildFromTemplate([
    {label : 'Preferences', click : function() { return; }},
    {label : 'Edit Pings', click : function() { return; }},
    {label : 'Quit', click : app.quit},
  ]));
}

/**
 * Handle invocations in --test mode
 * @param {string} option The requested test mode
 */
var mainTest = function(option) {
  switch(option) {
    case "prompt":
      app.on('ready', prompts.openPrompt);
      break;
    default:
      throw("Didn't recognise test option" + option);
  }
};

/**
 * Application init
 */
var main = function() {
  var program = require('commander');
  program
    .version(process.env.npm_package_version)
    .option('--test [option]', "Development test mode")
    .option('-v --verbose', "Debug logging")
    .parse(process.argv);

  if (program.verbose) {
    winston.level = 'debug';
  } else {
    winston.level = 'warn';
  }
  global.logger = winston; // expose the logger to renderer windows

  // Prevent second instance from running
  if (!singleInstance()) {
    return;
  }

  winston.debug(app.getName() + " v" + app.getVersion() + " starting up");

  global.pingFile = new pingfile(config.user.get('pingFilePath'));
  global.pings = new Pings(config.period(), config.user.get('seed'));

  if(program.test) {
    mainTest(program.test);
  } else {
    // The tray doesn't count as a window, so don't quit when the other windows
    // are closed
    app.on('window-all-closed', () => {});

    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    app.on('ready', createTray);
    app.on('ready', prompts.schedulePings);
    app.on('ready', prompts.editorIfMissed);
  }
};

main();
