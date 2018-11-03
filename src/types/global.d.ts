// We extend the global object with various properties - tell typescript about them here

import * as winston from "winston";

import { Config } from "../main-process/config";
import { PingFile } from "../main-process/pingfile";
import { PingTimes } from "../pingtimes";

declare global {
  namespace NodeJS {
    interface Global {
      config: Config;
      coverage: undefined | any[];
      pingFile: PingFile;
      pings: PingTimes;
      logger: typeof winston;
    }
  }
  export var __coverage__: any;
}
