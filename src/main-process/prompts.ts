import * as winston from "winston";
import { app, ipcMain, BrowserWindow } from "electron";
import windowStateKeeper = require("electron-window-state");

import * as helper from "./helper";
import * as edit from "./edit";
import { Ping } from "../ping";

// Global reference to prevent garbage collection
let promptWindow: Electron.BrowserWindow | null;
// A flag to capture if the prompt window was closed without saving tags
let outstandingPing: Boolean = false;

/**
 * Open a ping prompt window
 */
export function openPrompt(time: number, quitOnClose: Boolean = false) {
  winston.debug("Showing prompt");
  if (promptWindow) {
    winston.warn("Tried to open a prompt window but the old one wasn't cleaned up. Aborting.");
    return;
  }

  outstandingPing = true;

  // Save & restore window position and dimensions
  let promptWindowState = windowStateKeeper({
    defaultWidth: 500,
    defaultHeight: 200,
    file: "promptWindowState.json"
  });

  promptWindow = new BrowserWindow({
    frame: true,
    minWidth: 205,
    minHeight: 185,
    width: promptWindowState.width,
    height: promptWindowState.height,
    x: promptWindowState.x,
    y: promptWindowState.y,
    maximizable: false,
    fullscreenable: false,
    // icon : path, // defaults to executable
    title: "TagTime",
    alwaysOnTop: global.config.user.get("alwaysOnTop"),
    show: false, // let it render first
    acceptFirstMouse: true, // ensure you can click direct onto the tag entry
    // on some platforms?
    autoHideMenuBar: true, // not an issue on ubuntu, could be a pain on win
    webPreferences: { defaultEncoding: "utf8", nodeIntegration: true }
  });

  // Have window state keeper register resize listeners
  promptWindowState.manage(promptWindow);

  promptWindow.loadURL(helper.getFileUrl("../prompt.html"));

  // Send data.
  // Everything gets converted to JSON, so Sets and Pings don't survive
  promptWindow.webContents.on("did-finish-load", () => {
    let allTags: string[] = [];
    let prevTags: string[] = [];

    if (global.pingFile.pings.length > 0) {
      allTags = Array.from(global.pingFile.allTags);
      prevTags = Array.from(global.pingFile.pings.slice(-1)[0]!.tags);
    }
    if (promptWindow) {
      promptWindow.webContents.send("data", {
        time: time,
        allTags: allTags,
        prevTags: prevTags,
        cancelTags: global.config.user.get("cancelTags")
      });
    }
  });

  // don't show until rendering complete
  // could do this once received an ack via IPC?
  promptWindow.once("ready-to-show", () => {
    if (promptWindow) {
      promptWindow.show();

      promptWindow.flashFrame(true); // TODO this only works the first time?
      setTimeout(() => {
        if (promptWindow) {
          promptWindow.flashFrame(false);
        }
      }, 2500);

      promptWindow.on("closed", () => {
        if (outstandingPing) {
          winston.debug("Prompt was closed without saving, using cancelTags");
          global.pingFile.push(new Ping(time, new Set(global.config.user.get("cancelTags")), ""));
        }
        promptWindow = null;
        if (quitOnClose) {
          app.quit();
        }
      });
    }
  });
}

let _scheduleTimer: NodeJS.Timer;

/**
 * Schedules onPing to be executed at ping times in the future.
 * (onPing is exected to just be `openPrompt`, but is a parameter to support testing)
 * Won't launch a new prompt window if one is already open.
 * Doesn't handle missed past pings.
 * If a ping is due this second, it won't be scheduled.
 */
export function schedulePings(onPing: (time: number) => void) {
  let now = Date.now();
  let next = global.pings.next(now);

  _scheduleTimer = setTimeout(() => {
    if (promptWindow) {
      winston.info("Skipping prompt because current prompt hasn't been answered");
    } else {
      onPing(next);
    }
    schedulePings(onPing);
  }, next - now);
}

/**
 * Cancel future pings set up by schedulePings
 */
export function cancelSchedule() {
  clearTimeout(_scheduleTimer);
}

/**
 * Add missing pings to the ping file.
 * Only exported to support testing.
 * @returns Whether there were any missing pings that were added.
 */
export function catchUp(till: number): boolean {
  if (global.pingFile.pings.length === 0) {
    return false;
  }
  let missedPings = false;
  if (global.pingFile.pings.length > 0) {
    let lastPing = global.pingFile.pings[global.pingFile.pings.length - 1];
    if (lastPing) {
      let p: Ping;
      while (till >= global.pings.next(lastPing.time)) {
        // Replace every missing ping with the configured tags to use
        missedPings = true;
        p = new Ping(
          global.pings.next(lastPing.time),
          new Set(global.config.user.get("cancelTags")),
          ""
        );
        global.pingFile.push(p);
        lastPing = p;
      }
    }
  }
  return missedPings;
}

/**
 * Show an editor if the time is after the next ping in the pingfile
 */
export function editorIfMissed() {
  if (global.pingFile.pings.length === 0) {
    return;
  }

  if (catchUp(Date.now()))
    if (promptWindow) {
      winston.info("Skipping editor because prompt hasn't been answered");
    } else {
      edit.openEditor();
    }
}

/* Handle events sent from the prompt window
 * Shouldn't be called directly - only exported so it can be tested :/ */
export function savePing(_evt: Electron.Event | null, message: { ping: Ping; coverage?: any }) {
  outstandingPing = false;
  let ping = message.ping;
  winston.debug("Saving ping @ " + ping.time + ": " + ping.tags + " [" + ping.comment + "]");
  global.pingFile.push(ping);

  // The prompt window might pass us coverage information to save
  // If it does, make sure to push it before closing the window, lest app.quit is fired first
  if (message.coverage && "coverage" in global) {
    global.coverage = global.coverage || [];
    global.coverage.push(message.coverage);
  }
}
ipcMain.on("save-ping", savePing);
