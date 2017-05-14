const {shell} = require('electron');
const winston = require('winston');

const config = require('./config');

exports.openEditor = function() {
  var path = config.user.get('pingFilePath');
  winston.debug("Opening editor for " + path);
  shell.openItem(path);
}
