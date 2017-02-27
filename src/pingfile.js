const fs = require('fs');
const moment = require('moment');
const config = require('./config');
var winston = require('winston');

/**
 * Parse a tagtime log into pings and append pings to it
 * Pings have:
 *  .time {time} javascript time - milliseconds since unix epoch
 *  .tags {Set of tags}
 *  .comment {string} - the contents in [] at the end of an entry
 * PingFile doesn't hold the file opened.
 */
module.exports = class PingFile {
  /**
   * Create a PingFile. Note the file isn't opened until pings is read
   * or push is called.
   * @param {path} path The file to use
   */
  constructor(path) { this.path = path; };

  /**
   * @returns {string} The ping formatted for the log file (no trailing
   * newline).
   * @param {ping} ping The ping to encode. Must have a time.
   * @param {bool=} annotate If true, prepend ping.comment with time in ISO
   * @throws if an ping is provided without a valid time property
   * format
   */
  static encode(ping, annotate = true) {
    if (isNaN(ping.time) || ping.time < config.epoch) {
      throw("Invalid ping time in ping to be encoded: " + ping.time +
                  " must be integer after the epoch");
    }

    var time = Math.round(ping.time / 1000);

    var tags = "";
    if (ping.tags) { // cope with no tags
      if (typeof ping.tags == "string") {
        throw "Tags of ping to be encoded is a string";
      }
      tags = Array.from(ping.tags).join(" ");
    }

    var comment = "";
    if (annotate) {
      // ISO 8601, with local timezone
      // TODO support other formats? What does original tagtime do?
      comment = moment(ping.time).format() + " ";
    }
    if (ping.comment) {
      comment += ping.comment;
    }
    comment = comment.trim();
    if (comment !== "") { // don't output empty comments
      comment = "[" + comment + "]";
    }

    // trims to deal with empty tags or comment
    return ((time + " " + tags).trim() + " " + comment).trim();
  };

  /**
   * Not information preserving - tags are deduplicated, spacing lost
   * @param {string} entry The log entry to parse
   * @returns {ping} A ping or null if the entry couldn't be parsed
   */
  static parse(entry) {
    var m = entry.match(/^(\d+)\s*(\s[^\[]+)?(\[.*\])?\s*$/);
    if (!m) {
      winston.warn("Could not parse entry: '" + entry + "'");
      return null;
    }

    // Time must be an integer after the epoch
    var time = parseInt(m[1]);
    if (isNaN(time) || (time*1000) < config.epoch) {
      winston.warn("Invalid time while parsing entry: '" + m[1] + "'");
      return null;
    }
    time = time * 1000; // upscale to js time

    if (m[2]) {
      var tags = new Set(m[2].trim().split(/\s+/));
    } else {
      var tags = new Set();
    }

    var comment = null;
    if (m[3]) {
      comment = m[3].slice(1, -1); // ditch the []
    }

    return {time : time, tags : tags, comment : comment};
  };

  /**
   * @returns {[ping]} the log file as a list of pings (no caching)
   * Invalid entries appears as nulls in the list
   * @throws fs exceptions if the file can't be read from
   */
  get pings() {
    return fs.readFileSync(this.path, 'utf8')
        .toString()
        .trim()  // trailing new line would give us a spurious null
        .split("\n")
        .map(PingFile.parse);
  };

  /**
   * Saves a ping to the log file
   * @param {ping} ping
   * @param {bool=} annotate - see PingFile.encode
   * @throws fs exceptions if the file can't be written to
   */
  push(ping, annotate = true) {
    var nl = '';
    if (fs.existsSync(this.path)) {
      // The ping should be on a new line, so check whether the final byte
      // already is \n
      var buffer = new Buffer(1);
      var fd = fs.openSync(this.path, 'r');
      if (fs.readSync(fd, buffer, 0, 1, fs.fstatSync(fd).size - 1) == 1) {
        // test bytes read to cope with empty file
        if (buffer[0] !== 10) { // 10 is ASCII \n
          nl = '\n';
        }
      }
      fs.closeSync(fd);
    }

    fs.appendFileSync(this.path, nl + PingFile.encode(ping, annotate) + '\n',
                      'utf8');
  };
};
