import { app } from "electron";
import AutoLaunch = require("auto-launch");
import ElectronStore = require("electron-store");
import * as winston from "winston";
import * as path from "path";

export enum ConfigName {
  runOnStartup = "runOnStartup",
  firstRun = "firstRun",
  alwaysOnTop = "alwaysOnTop",
  tagWidth = "tagWidth",
  pingFilePath = "pingFilePath",
  pingFileStart = "pingFileStart",
  period = "period",
  seed = "seed",
  cancelTags = "cancelTags",
  editorOnStartup = "editorOnStartup"
}
export interface ConfigDict {
  [index: string]: any;
  firstRun: boolean;
  alwaysOnTop: boolean;
  tagWidth: number;
  pingFilePath: string;
  pingFileStart: number;
  period: number;
  seed: number;
  cancelTags: Set<string>;
  editorOnStartup: boolean;
}

export interface ConfigPref {
  name: ConfigName;
  type: string;
  label: string;
  configurable: boolean;
  default: any;
}

export const logFileName = "debug.log";
export const pingFileName = "tagtime.log";

/**
 * Config for the main process - dependent on access to the user's config file
 * Contains persisted non-constant data under 'user'.
 */
export class Config {
  /**
   * The user config. Access with .get, .set, .has
   */
  user: ElectronStore;
  private _firstRun: Boolean | null;
  /**
   * The directory where the default ping file, config file, and logs are.
   */
  configPath: string;

  /**
   * @param {"text"} dir Specify a non-default config location. Should only be used for testing.
   */
  constructor(dir?: string) {
    if (dir) {
      this.configPath = dir;
    } else {
      this.configPath = app.getPath("userData");
    }

    let initialConfig = Config.defaultDict();
    // These two default config values are set here rather than in fieldInfo because the "app"
    // object isn't available in the test context
    initialConfig.seed = require("random-js")().integer(0, Math.pow(2, 32) - 1);
    initialConfig.pingFilePath = path.join(this.configPath, pingFileName);

    var options: { defaults: {}; cwd?: string } = { defaults: initialConfig };
    if (dir) {
      options.cwd = dir;
    }
    this.user = new ElectronStore(options);
    winston.debug("Config file path: " + this.user.path);

    this._firstRun = this.user.get("firstRun");
    if (this._firstRun) {
      this.user.set("firstRun", false);
    }
  }

  get logFile(): string {
    return path.join(this.configPath, logFileName);
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
        winston.warn("Couldn't enable launch on system startup: " + reason);
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
   * Returns the user config but in pure dictionary form, for sending over IPC
   */
  get userDict(): ConfigDict {
    let conf = {} as ConfigDict;
    for (let field of Config.fieldInfo) {
      conf[field.name] = this.user.get(field.name);
    }
    return conf;
  }

  /**
   * Returns an object mapping field names to their (static) default values.
   */
  static defaultDict(): ConfigDict {
    let conf = {} as ConfigDict;
    for (let field of Config.fieldInfo) {
      conf[field.name] = field.default;
    }
    return conf;
  }

  /**
   * For each config field its: type, description, and whether it is user configurable
   */
  static fieldInfo: ConfigPref[] = [
    {
      name: ConfigName.firstRun,
      type: "checkbox",
      label: "Whether this is the applications first run or not",
      configurable: false,
      default: true
    },
    {
      name: ConfigName.alwaysOnTop,
      type: "checkbox",
      label: "Prompt is always on top?",
      configurable: true,
      default: true
    },
    {
      name: ConfigName.runOnStartup,
      type: "checkbox",
      label: "Run on startup?",
      configurable: true,
      default: true
    },
    {
      name: ConfigName.tagWidth,
      type: "number",
      label: "Width to pad tags to in the ping file",
      configurable: true,
      default: 80
    },
    {
      name: ConfigName.pingFilePath,
      type: "file",
      label: "Ping file (where all your pings are recorded)",
      configurable: true,
      default: null // assigned at runtime to avoid calling electron apis when imported by tests
    },
    {
      name: ConfigName.pingFileStart,
      type: "datetime-local",
      label:
        "Time from which this ping sequence starts (only needed if using a ping file with pings in it from classic TagTime, or with a different seed or period)",
      configurable: true,
      default: null
    },
    {
      name: ConfigName.period,
      type: "number",
      label: "Mean period between pings (minutes)",
      configurable: true,
      default: 45
    },
    {
      name: ConfigName.seed,
      type: "number",
      label:
        "Seed for your sequence of pings (random whole number; not backwards compatible with classic TagTime)",
      configurable: true,
      default: null // set at runtime
    },
    {
      name: ConfigName.cancelTags,
      type: "tags",
      label: "The tags to use when not supplied by the user for any reason",
      configurable: true,
      default: ["afk", "RETRO"]
    },
    {
      name: ConfigName.editorOnStartup,
      type: "checkbox",
      label: "Open the tag editor on startup if pings have been missed since last run",
      configurable: true,
      default: false
    }
  ];
}
