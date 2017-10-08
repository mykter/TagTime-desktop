import { shell } from "electron";
import * as winston from "winston";

exports.openEditor = function() {
  var path = global.config.user.get("pingFilePath");
  winston.debug("Opening editor for " + path);
  shell.openItem(path);
};
