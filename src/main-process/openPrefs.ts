import { BrowserWindow, ipcMain } from "electron";
import * as winston from "winston";

import * as helper from "./helper";
import { Config } from "./config";

let prefsWindow: Electron.BrowserWindow | null;
exports.openPreferences = function() {
  winston.debug("Showing preferences");
  if (prefsWindow) {
    winston.warn("Tried to open preferences window but it seems it already exists. Aborting.");
    return;
  }

  prefsWindow = new BrowserWindow({
    frame: true,
    minWidth: 205,
    minHeight: 185,
    width: 450,
    height: 600,
    // icon : path, // defaults to executable
    title: "TagTime Preferences",
    show: false,
    acceptFirstMouse: true, // ensure you can click direct onto the tag entry
    // on some platforms?
    autoHideMenuBar: true, // not an issue on ubuntu, could be a pain on win
    webPreferences: { defaultEncoding: "utf8", nodeIntegration: true }
  });

  prefsWindow.loadURL(helper.getFileUrl("../preferences.html"));
  prefsWindow.once("ready-to-show", () => {
    // prefsWindow could conceivable be closed in this gap?
    if (prefsWindow) {
      prefsWindow.show();
    }
  });

  prefsWindow.webContents.on("did-finish-load", () => {
    // prefsWindow could conceivable be closed in this gap?
    if (prefsWindow) {
      prefsWindow.webContents.send("config", {
        info: Config.fieldInfo,
        conf: global.config.userDict
      });
    }
  });

  ipcMain.on("save-config", (_evt: any, message: any) => {
    winston.debug("Saving config");
    for (let key in message) {
      winston.debug("   " + key + ": " + JSON.stringify(message[key]));
      global.config.user.set(key, message[key]);
    }
  });

  prefsWindow.on("closed", () => {
    prefsWindow = null;
  });
};
