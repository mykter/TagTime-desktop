"use strict";
const { app } = require("electron");
const AutoLaunch = require("auto-launch");
const winston = require("winston");
const path = require("path");
const Configstore = require("electron-store");

/**
 * Config for the main process - dependent on access to the user's config file
 * Contains persisted non-constant data under 'user'.
 */
module.exports = class Config {
  /**
   * @param {"text"} dir Specify a non-default config location. Should only be used for testing.
   */
  constructor(dir = null) {
    let initialConfig = Config.defaultConfig();
    // These two default config values are set here rather than in fieldInfo because the "app"
    // object isn't available in the test context
    initialConfig.seed = require("random-js")().integer(0, Math.pow(2, 32) - 1);
    initialConfig.pingFilePath = path.join(app.getPath("userData"), "tagtime.log");

    var options = { defaults: initialConfig };
    if (dir) {
      options["cwd"] = dir;
    }
    this._user = new Configstore(options);
    winston.debug("Config file path: " + this.user.path);

    this._firstRun = this.user.get("firstRun");
    if (this._firstRun) {
      this.user.set("firstRun", false);
    }
  }

  /**
   * @returns {dict} The user config. Access with .get, .set, .has
   */
  get user() {
    return this._user;
  }

  /**
   * @returns {dict} The user config but in pure dictionary form, for sending over IPC
   */
  get userDict() {
    let o = {};
    for (let field of Config.fieldInfo) {
      o[field.name] = this.user.get(field.name);
    }
    return o;
  }

  /**
   * @returns {bool} Whether this is the first run of the application or not.
   */
  get firstRun() {
    return this._firstRun;
  }

  setupAutoLaunch() {
    var autoLauncher = new AutoLaunch({ name: app.getName() });
    if (this.user.get("runOnStartup")) {
      winston.info("Setting app to run on startup");
      autoLauncher.enable().catch(reason => {
        winston.warning("Couldn't enable launch on system startup: " + reason);
      });
    }
  }

  /**
   * Period is stored in minutes in the config file.
   * Use this helper to get it in a useful form.
   * @returns {time} period in milliseconds
   */
  get period() {
    return this.user.get("period") * 60 * 1000;
  }

  get pingFileStartFormat() {
    return "YYYY:MM:DDTHH:MM";
  }

  /**
   * Returns an object mapping field names to their (static) default values, per fieldInfo
   */
  static defaultConfig() {
    let conf = {};
    for (let field of Config.fieldInfo) {
      conf[field.name] = field.default;
    }
    return conf;
  }

  /**
   * @returns {dict} For each config field its: type, description, and whether it is user configurable
   */
  static get fieldInfo() {
    return [
      {
        name: "firstRun",
        type: "checkbox",
        label: "Whether this is the applications first run or not",
        configurable: false,
        default: true
      },
      {
        name: "alwaysOnTop",
        type: "checkbox",
        label: "Prompt is always on top?",
        configurable: true,
        default: true
      },
      {
        name: "runOnStartup",
        type: "checkbox",
        label: "Run on startup?",
        configurable: true,
        default: true
      },
      {
        name: "tagWidth",
        type: "number",
        label: "Width to pad tags to in the ping file",
        configurable: true,
        default: 80
      },
      {
        name: "pingFilePath",
        type: "file",
        label: "Ping file (where all your pings are recorded)",
        configurable: true,
        default: null // set at runtime
      },
      {
        name: "pingFileStart",
        type: "datetime-local",
        label:
          "Time from which this ping sequence starts (only needed if using a ping file with pings in it from classic TagTime, or with a different seed or period)",
        configurable: true,
        default: null
      },
      {
        name: "period",
        type: "number",
        label: "Mean period between pings (minutes)",
        configurable: true,
        default: 45
      },
      {
        name: "seed",
        type: "number",
        label:
          "Seed for your sequence of pings (random whole number; not backwards compatible with classic TagTime)",
        configurable: true,
        default: null // set at runtime
      }
    ];
  }
};
