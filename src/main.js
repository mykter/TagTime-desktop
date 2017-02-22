'use strict';

const {BrowserWindow, app, Menu, Tray} = require('electron');
const path = require('path');
const url = require('url');
const winston = require('winston');

const pings = require('./pings');
const config = require('./config');

// Ensure only one instance running at a time
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
  app.quit()
}

winston.debug(app.getName() + " v" + app.getVersion()  +" starting up");

// Keep a global reference of the tray object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let tray, promptWindow;

/** @returns {unixtime} Current time */
var now = function() { return Math.round(Date.now() / 1000); };

//var a = pings.next(now());

/**
 * Returns a file:// url to path (which must be relative to the script location)
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
  tray = new Tray('resources/tray.png');
  tray.setToolTip(app.getName());
  tray.setContextMenu(Menu.buildFromTemplate([
    {label : 'Prompt - debug', click : function() { openPrompt(); }},
    {label : 'Preferences', click : function() { openPreferences(); }},
    {label : 'Edit Pings', click : function() { editPings(); }},
    {label : 'Quit', click : app.quit},
  ]));
}

function openPrompt() {
  winston.debug("Showing prompt");
  if(promptWindow) {
    winston.warn("Tried to open a prompt window but the old one wasn't cleaned up. Aborting.");
    return;
  }

  promptWindow = new BrowserWindow({
    frame : true,
    backgroundColor : "#202020",
    width : config.user.get('promptWidth'),
    height : config.user.get('promptHeight'),
    resizable :
        false, // user hostile? aim to ensure it resizes itself if needed
    maximizable : false,
    fullscreenable : false,
    // icon : path, // defaults to executable
    title : "TagTime",
    show : false,            // let it render first
    acceptFirstMouse : true, // ensure you can click direct onto the tag entry
                             // on some platforms?
    autoHideMenuBar :  true, // not an issue on ubuntu, could be a pain on win
    webPreferences: {defaultEncoding: 'utf8'},
  });

  promptWindow.loadURL(getFileUrl('windows/prompt.html'));
  // don't show until rendering complete
  promptWindow.once('ready-to-show', () => {
    promptWindow.show();

    promptWindow.flashFrame(true); // TODO this only works the first time?
    setTimeout(() => { if(promptWindow) {promptWindow.flashFrame(false);} }, 2500);

    promptWindow.on('closed', () => { promptWindow = null; });
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createTray);

// The tray doesn't count as a window, so don't quit when the other windows are
// closed
app.on('window-all-closed', () => {} );

var pingfilePath = path.join(app.getPath('userData'),'tagtime.log');
const PingFile = require('./pingfile');
var pingfile = new PingFile(pingfilePath);
