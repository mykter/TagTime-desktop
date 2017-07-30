const {shell} = require('electron');
const winston = require('winston');

exports.openEditor = function() {
  var path = global.config.user.get('pingFilePath');
  winston.debug("Opening editor for " + path);
  shell.openItem(path);
}
