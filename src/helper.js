'use strict';

/**
 * @param {string} path A path relative to the script location
 * @returns {string} a file:// url of path
 */
exports.getFileUrl = function(path) {
  return require('url').format({
    protocol : 'file',
    slashes : true,
    pathname : require('path').join(__dirname, path)
  });
}

