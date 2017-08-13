const {BrowserWindow} = require('electron');
const winston = require('winston');

const helper = require('./helper');

let prefsWindow;
exports.openPreferences = function() {
  winston.debug("Showing preferences");
  if (prefsWindow) {
    winston.warn("Tried to open preferences window but it seems it already exists. Aborting.");
    return;
  }

  prefsWindow = new BrowserWindow({
    frame : true,
    minWidth : 205,
    minHeight : 185,
    // icon : path, // defaults to executable
    title : "TagTime Preferences",
    show : false,
    acceptFirstMouse : true, // ensure you can click direct onto the tag entry
                             // on some platforms?
    autoHideMenuBar : true,  // not an issue on ubuntu, could be a pain on win
    webPreferences : {defaultEncoding : 'utf8', nodeIntegration : true},
  });

  prefsWindow.loadURL(helper.getFileUrl('../preferences.html'));
  prefsWindow.once('ready-to-show', () => { prefsWindow.show(); });
  prefsWindow.on('closed', () => { prefsWindow = null; });
};
