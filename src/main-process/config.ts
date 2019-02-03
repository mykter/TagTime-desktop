import AutoLaunch = require("auto-launch");
import { app } from "electron";
import ElectronStore = require("electron-store");
import * as fs from "fs";
import { platform } from "os";
import * as path from "path";
import * as winston from "winston";

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
export const appRoot = path.join(__dirname, "..", "..", "..");
export const imagesPath = path.resolve(appRoot, "resources");
export const logoPath = path.resolve(imagesPath, "icon.png");
export let trayIconPath: string;
if (platform() === "darwin") {
  trayIconPath = path.resolve(imagesPath, "mac.png");
} else if (platform() === "win32") {
  trayIconPath = path.resolve(imagesPath, "tagtime.ico");
} else {
  trayIconPath = logoPath;
}
const devConfigDir = path.resolve(appRoot, "devconfig");

/**
 * Config for the main process - dependent on access to the user's config file
 * Contains persisted non-constant data under 'user'.
 */
export class Config {
  /**
   * For each config field its: type, description, and whether it is user configurable
   */
  public static fieldInfo: ConfigPref[] = [
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
      "Time from which this ping sequence starts (only needed if using a ping file with pings in it from classic TagTime, or with a different seed or period, choose 07/10/2007, 07:56 PM for compliance with classic TagTime)",
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
        "Seed for your sequence of pings (random whole number) choose 11193462 for classic TagTime compliance",
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
      label:
        "Open the tag editor on startup if pings have been missed since last run",
      configurable: true,
      default: false
    }
  ];

  /**
   * Returns an object mapping field names to their (static) default values.
   */
  public static defaultDict(): ConfigDict {
    const conf = {} as ConfigDict;
    for (const field of Config.fieldInfo) {
      conf[field.name] = field.default;
    }
    return conf;
  }

  /**
   * The user config. Access with .get, .set, .has
   */
  public user: ElectronStore;

  private _firstRun: boolean | null;
  private _isDev: boolean | undefined;

  /**
   * The directory where the default ping file, config file, and logs are.
   */
  private configPath: string;

  /**
   * @param dir Specify a non-default config location. Should only be used for testing.
   * @param forceProd If true, isDev will be false. Otherwise attempts to automatically detect development mode.
   */
  constructor(dir?: string, forceProd?: boolean) {
    if (forceProd) {
      // Don't try and detect development mode
      this._isDev = false;
    }

    if (dir) {
      this.configPath = dir;
    } else {
      if (this.isDev) {
        this.configPath = devConfigDir;
      } else {
        this.configPath = app.getPath("userData");
      }
    }

    const initialConfig = Config.defaultDict();
    // These two default config values are set here rather than in fieldInfo because the "app"
    // object isn't available in the test context
    initialConfig.seed = require("random-js")().integer(0, Math.pow(2, 32) - 1);
    initialConfig.pingFilePath = path.join(this.configPath, pingFileName);

    const options: { defaults: {}; cwd?: string } = { defaults: initialConfig };
    if (dir) {
      options.cwd = dir;
    } else if (this.isDev) {
      options.cwd = this.configPath;
    }
    this.user = new ElectronStore(options);
    winston.debug("Config file path: " + this.user.path);

    this._firstRun = this.user.get("firstRun");
    if (this._firstRun) {
      this.user.set("firstRun", false);
    }
  }

  /**
   * Is the application running in a development environment (vs a release environment)?
   */
  get isDev(): boolean {
    if (this._isDev === undefined) {
      this._isDev = fs.existsSync(path.resolve(appRoot, ".git"));
      if (this._isDev) {
        winston.debug("Development mode");
      }
    }
    return this._isDev;
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

  public setupAutoLaunch() {
    const autoLauncher = new AutoLaunch({ name: app.getName() });
    if (this.user.get("runOnStartup")) {
      if (this.isDev) {
        winston.info("Ignoring runOnStartup as in development mode.");
      } else {
        winston.info("Setting app to run on startup");
        autoLauncher.enable().catch(reason => {
          winston.warn("Couldn't enable launch on system startup: " + reason);
        });
      }
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
    return "YYYY-MM-DDTHH:MM";
  }

  /**
   * Returns the user config but in pure dictionary form, for sending over IPC
   */
  get userDict(): ConfigDict {
    const conf = {} as ConfigDict;
    for (const field of Config.fieldInfo) {
      conf[field.name] = this.user.get(field.name);
    }
    return conf;
  }
}
