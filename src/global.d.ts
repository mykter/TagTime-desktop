// We extend the global object with various properties - tell typescript about them here

import { Config } from "./main-process/config";

declare global {
  namespace NodeJS {
    interface Global {
      config: Config;
    }
  }
}
