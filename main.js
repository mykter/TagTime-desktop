const {app, BrowserWindow, Tray, Menu} = require('electron');
const path = require('path');
const url = require('url');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let tray;

function createTray() {
  tray = new Tray('resources/tray.png');
  tray.setToolTip('TagTime');
  tray.setContextMenu(Menu.buildFromTemplate([
    {label : 'Preferences', click : function() { open_window('preferences') }},
    {label : 'Edit Pings', click : function() { open_window('prompt') }},
    {label : 'Quit', click : app.quit},
  ]));
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createTray)
