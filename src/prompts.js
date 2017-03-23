const winston = require('winston');
const {BrowserWindow} = require('electron');

const config = require('./config');
const pingfile = require('./pingfile');
const helper = require('./helper');

'use strict';

// Global reference to prevent garbage collection
let promptWindow;

/**
 * Open a ping prompt window
 */
exports.openPrompt = function () {
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

  promptWindow.loadURL(helper.getFileUrl('windows/prompt.html'));
  // don't show until rendering complete
  promptWindow.once('ready-to-show', () => {
    promptWindow.show();

    promptWindow.flashFrame(true); // TODO this only works the first time?
    setTimeout(() => { if(promptWindow) {promptWindow.flashFrame(false);} }, 2500);

    promptWindow.on('closed', () => { promptWindow = null; });
  });
};

var _scheduleTimer;

/**
 * Schedules the creation of prompt windows at ping times in the future.
 * Won't launch a new prompt window if one is already open.
 * Doesn't handle missed past pings.
 * If a ping is due this second, it won't be scheduled.
 */
exports.schedulePings = function() {
  var now = Date.now();
  var next = global.pings.next(now);

  _scheduleTimer = setTimeout(() => {
    if (promptWindow) {
      winston.info(
          "Skipping prompt because current prompt hasn't been answered");
    } else {
      exports.openPrompt();
    }
    exports.schedulePings();
  }, next - now);
};

/**
 * Cancel future pings set up by schedulePings
 */
exports.cancelSchedule = function() {
  cancelTimeout(_scheduleTimer);
};

/**
 * Show an editor if the time is after the next ping in the pingfile
 */
exports.editorIfMissed = function() {
  pingFile = new pingfile(config.user.get('pingFilePath'));
  if(pingFile.pings.length === 0) {
    return;
  }

  if (Date.now() >= global.pings.next(pingFile.pings[0].time)) {
    if (promptWindow) {
      winston.info(
          "Skipping editor because prompt hasn't been answered");
    } else {
      // open an editor
    }
  }
};
