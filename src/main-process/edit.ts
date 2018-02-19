import { shell } from "electron";
import * as winston from "winston";

export function openEditor() {
  const path = global.config.user.get("pingFilePath");
  winston.debug("Opening editor for " + path);
  shell.openItem(path);
}
