'use strict';

const fs = require('fs');
const moment = require('moment');
const winston = require('winston');

const PingTimes = require('./pingtimes');
const Ping = require('./ping');

/**
 * Parse a tagtime log into pings and append pings to it
 * PingFile doesn't hold the file opened.
 */
module.exports = class PingFile {
  /**
   * Create a PingFile. Note the file isn't opened until pings is read
   * or push is called.
   * @param {string} path The file to use
   * @param {bool=} keep_invalid Whether to ignore invalid lines or return them
   *                             as nulls. Defaults to false (discard).
   * @param {bool=} first_run If true, create the file if it doesn't exist.
   * @param {bool=} caching Whether to cache pings (i.e. assume the file will only be modified via
   *                        this instance)
   */
  constructor(path, keep_invalid = false, first_run = false, caching = true) {
    this.path = path;
    this.keep_invalid = keep_invalid;
    this.caching = caching;
    this._pings = null;
    this._allTags = null;

    // On first run, create the ping file if it doesn't exist
    if (first_run) {
      if (!fs.existsSync(this.path)) {
        try {
          var fd = fs.openSync(this.path, 'a');
          fs.closeSync(fd);
        } catch (err) {
          winston.warn("Couldn't create ping file at location " + this.path);
          const {dialog} = require('electron');
          dialog.showErrorBox("TagTime - can't create ping file",
                              "Can't create the ping file '" + this.path +
                                  "'. Please change the path in settings.");
        }
      }
    }
  }

  /**
   * @returns {bool} Whether this instance replaces invalid entries with nulls,
   * or ignores them
   */
  get keep_invalid() { return this._keep_invalid; }
  /**
   * @param {bool} value Whether this instance replaces invalid entries with
   * nulls, or ignores them
   */
  set keep_invalid(value) {
    if (typeof(value) === "boolean") {
      this._keep_invalid = value;
    } else {
      throw("PingFile.keep_invalid must be a boolean");
    }
  }

  /**
   * @returns {string} The ping formatted for the log file (no trailing
   * newline).
   * @param {ping} ping The ping to encode. Must have a time.
   * @param {bool=} annotate If true, prepend ping.comment with time in ISO
   * @throws if an ping is provided without a valid time property
   * format
   */
  static encode(ping, annotate = true) {
    if (isNaN(ping.time) || ping.time < PingTimes.epoch) {
      throw("Invalid ping time in ping to be encoded: " + ping.time +
            " must be integer after the epoch");
    }

    var time = Math.round(ping.time / 1000);

    var tags = "";
    if (ping.tags) { // cope with no tags
      if (typeof ping.tags === "string") {
        throw "Tags of ping to be encoded is a string";
      }
      tags = Array.from(ping.tags).join(" ");
    }

    var comment = "";
    if (annotate) {
      // ISO 8601, with local timezone
      // TODO support other formats? What does original tagtime do?
      comment = moment(ping.time, 'x').format() + " ";
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
  }

  /**
   * Not information preserving - tags are deduplicated, spacing lost
   * @param {string} entry The log entry to parse
   * @returns {ping} A ping or null if the entry couldn't be parsed
   */
  static parse(entry) {
    var m = entry.match(/^(\d+)\s*(\s[^[]+)?(\[.*\])?\s*$/);
    if (!m) {
      // TODO what is the comment syntax for ping files?
      winston.warn("Could not parse entry: '" + entry + "'");
      return null;
    }

    // Time must be an integer after the epoch
    var time = parseInt(m[1]);
    if (isNaN(time) || (time * 1000) < PingTimes.epoch) {
      winston.warn("Invalid time while parsing entry: '" + m[1] + "'");
      return null;
    }
    time = time * 1000; // upscale to js time

    var tags;
    if (m[2]) {
      tags = new Set(m[2].trim().split(/\s+/));
    } else {
      tags = new Set();
    }

    var comment = null;
    if (m[3]) {
      comment = m[3].slice(1, -1); // ditch the []
    }

    return new Ping(time, tags, comment);
  }

  /**
   * @returns {ping[]} the log file as a list of pings (no caching)
   * Behaviour depends on instance's keep_invalid property.
   * @throws fs exceptions if the file can't be read from
   */
  get pings() {
    if (this.caching && this._pings) {
      return this._pings;
    }
    var ps;
    try {
      ps = fs.readFileSync(this.path, 'utf8')
               .toString()
               .trim() // trailing new line would give us a spurious null
               .split("\n")
               .map(PingFile.parse)
               .filter((e, _i, _a) => { return this.keep_invalid || (e !== null); });
    } catch (err) {
      if (err.code === 'ENOENT') {
        // File couldn't be opened
        winston.error("Couldn't open ping file '" + this.path + "', got error " + err);
        var msg = "Can't open the ping file '" + this.path + "'. Please check the path in settings."
        const {dialog} = require('electron');
        if (dialog) {
          dialog.showErrorBox("TagTime - can't open ping file", msg);
        } else {
          winston.error(msg);
        }
        return [];
      } else {
        throw err;
      }
    }
    if (this.caching) {
      this._pings = ps;
    }
    return ps;
  }

  /**
   * @returns {Set of tags} all unique tags in the pingfile
   */
  get allTags() {
    if (this.caching && this._allTags) {
      return this._allTags;
    }

    var tags = new Set();
    this.pings.map((ping) => { ping.tags.forEach((tag) => { tags.add(tag); }); });

    if (this.caching) {
      this._allTags = tags;
    }
    return tags;
  }

  /**
   * Saves a ping to the log file (and to the local cache)
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
      if (fs.readSync(fd, buffer, 0, 1, fs.fstatSync(fd).size - 1) === 1) {
        // test bytes read to cope with empty file
        if (buffer[0] !== 10) { // 10 is ASCII \n
          nl = '\n';
        }
      }
      fs.closeSync(fd);
    }

    fs.appendFileSync(this.path, nl + PingFile.encode(ping, annotate) + '\n', 'utf8');
    if (this.caching) {
      if (this._pings) {
        this._pings.push(ping);
      }

      if (this._allTags) {
        ping.tags.forEach((t) => { this._allTags.add(t); });
      }
    }
  }
}
