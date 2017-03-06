'use strict';

const {app, Menu, Tray} = require('electron');
const url = require('url');
const winston = require('winston');

const config = require('./config');
const prompts = require('./prompts');

// Keep a global reference, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let tray;
var pingFile;

/**
 * Ensures only one instance of the app is running at a time.
 * On launch of second instance, it quits and the first instance
 * notifies the user.
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
  }
};

/**
 * @param {string} path A path relative to the script location
 * @returns {string} a file:// url of path
 */
function getFileUrl(path) {
  return require('url').format({
    protocol : 'file',
    slashes : true,
    pathname : require('path').join(__dirname, path)
  });
}

/**
 * Create a system tray icon with context menu
 */
function createTray() {
  winston.debug("Creating tray");
  tray = new Tray('resources/tagtime.png');
  tray.setToolTip(app.getName());
  tray.setContextMenu(Menu.buildFromTemplate([
    {label : 'Prompt - debug', click : function() { prompts.openPrompt(); }},
    {label : 'Preferences', click : function() { openPreferences(); }},
    {label : 'Edit Pings', click : function() { editPings(); }},
    {label : 'Quit', click : app.quit},
  ]));
}

/**
 * Application init
 */
var main = function() {
  // Prevent second instance from running
  singleInstance();

  winston.debug(app.getName() + " v" + app.getVersion() + " starting up");

  // The tray doesn't count as a window, so don't quit when the other windows
  // are closed
  app.on('window-all-closed', () => {});

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.on('ready', createTray);
  app.on('ready', prompts.schedulePings);
  app.on('ready', prompts.editorIfMissed);
};

main();
