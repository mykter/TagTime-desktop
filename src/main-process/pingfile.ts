import { dialog } from "electron";
import * as fs from "fs";
import * as moment from "moment";
import * as winston from "winston";

import { Ping } from "../ping";
import { PingTimes } from "../pingtimes";

/**
 * Parse a tagtime log into pings and append pings to it
 * PingFile doesn't hold the file opened.
 */
export class PingFile {
  /**
   * @returns The ping formatted for the log file (no trailing newline).
   * @param ping The ping to encode. Must have a time.
   * @param annotate If true, prepend ping.comment with time in ISO
   * @param width The width to right pad tags to with spaces
   * @throws if a ping is provided without a valid time property format
   */
  public static encode(ping: Ping, annotate = true, width = 0): string {
    if (isNaN(ping.time) || ping.time < PingTimes.epoch) {
      throw new Error(
        "Invalid ping time in ping to be encoded: " +
          ping.time +
          " must be integer after the epoch"
      );
    }

    let tags = "";
    if (ping.tags) {
      // cope with no tags
      if (typeof ping.tags === "string") {
        throw new Error("Tags of ping to be encoded is a string");
      }
      tags = Array.from(ping.tags).join(" ");
      // pad right with spaces
      tags = tags + " ".repeat(Math.max(0, width - tags.length));
    }

    let comment = "";
    if (annotate) {
      // ISO 8601, with local timezone
      // TODO support other formats? What does original tagtime do?
      const time = moment(ping.time, "x");
      comment = time.format() + " " + time.format("ddd") + " ";
    }
    if (ping.comment) {
      comment += ping.comment;
    }
    comment = comment.trim();
    if (comment !== "") {
      // don't output empty comments
      comment = "[" + comment + "]";
    }

    // trims to deal with empty tags or comment
    const unixtime = Math.round(ping.time / 1000);
    return (
      unixtime +
      " " +
      (tags.length > 0 ? tags + " " : "") +
      comment
    ).trim();
  }

  /**
   * Not information preserving - tags are deduplicated, spacing lost
   * @param entry The log entry to parse
   * @returns A ping or null if the entry couldn't be parsed
   */
  public static parse(entry: string): Ping | null {
    const m = entry.match(/^(\d+)\s*(\s[^[]+)?(\[.*\])?\s*$/);
    if (!m) {
      // TODO what is the comment syntax for ping files?
      winston.warn("Could not parse entry: '" + entry + "'");
      return null;
    }

    // Time must be an integer after the epoch
    let time = parseInt(m[1], 10);
    if (isNaN(time) || time * 1000 < PingTimes.epoch) {
      winston.warn("Invalid time while parsing entry: '" + m[1] + "'");
      return null;
    }
    time = time * 1000; // upscale to js time

    let tags;
    if (m[2]) {
      tags = new Set(m[2].trim().split(/\s+/));
    } else {
      tags = new Set();
    }

    let comment = "";
    if (m[3]) {
      comment = m[3].slice(1, -1); // ditch the []
    }

    return new Ping(time, tags, comment);
  }

  /**
   * Because we're using an unstructured text file, we occasionally want to retrieve the 'pure' comment.
   * Bring on a new storage format.
   * @param comment A potentially time-annotated comment
   * @returns The same comment but with its time prefix removed, if it had one
   */
  public static unannotateComment(comment: string): string {
    const prefix = /^(\S+) \w\w\w( (.+))?$/; // see encode - comments look like "ISO ddd comment"
    const match = comment.match(prefix);
    if (match) {
      // check the first group is a valid datetime
      const m = moment(match[1], moment.defaultFormat);
      if (m.isValid()) {
        // looks like a timestamp annotation
        if (match[3]) {
          return match[3];
        } else {
          // There is no comment, just a timestamp
          return "";
        }
      }
    }
    // One of the tests failed, don't prune the comment
    return comment;
  }

  /**
   * Whether this instance replaces invalid entries with nulls, or ignores them
   * Only public for tests
   */
  public keep_invalid: boolean;
  private path: string;
  private width: number;

  private _pings: Array<Ping | null> | undefined;
  private _allTags: { [index: string]: number } | undefined;

  /**
   * Create a PingFile. Note the file isn't opened until pings is read
   * or push is called.
   * @param path The file to use
   * @param keep_invalid Whether to ignore invalid lines or return them
   *                      as nulls. Defaults to false (discard).
   * @param create If true, create the file if it doesn't exist.
   * @param width The width to pad encoded tags to
   */
  constructor(path: string, keep_invalid = false, create = false, width = 0) {
    this.path = path;
    this.keep_invalid = keep_invalid;
    this.width = width;

    // Create the ping file if it doesn't exist
    if (create && !fs.existsSync(this.path)) {
      winston.debug("Creating pingfile at ", this.path);
      try {
        const fd = fs.openSync(this.path, "a");
        fs.closeSync(fd);
      } catch (err) {
        winston.warn("Couldn't create ping file at location " + this.path);
        dialog.showErrorBox(
          "TagTime - can't create ping file",
          "Can't create the ping file '" +
            this.path +
            "'. Please change the path in settings."
        );
      }
    }
  }

  /**
   * @returns the log file as a list of pings
   * Behaviour depends on instance's keep_invalid property.
   * @throws fs exceptions if the file can't be read from
   */
  get pings(): Array<Ping | null> {
    if (!this._pings) {
      let ps: Array<Ping | null>;
      try {
        ps = fs
          .readFileSync(this.path, "utf8")
          .toString()
          .trim() // trailing new line would give us a spurious null
          .split("\n")
          .map(PingFile.parse)
          .filter((e, _i, _a) => {
            return this.keep_invalid || e !== null;
          });
      } catch (err) {
        if (err.code === "ENOENT") {
          // File couldn't be opened
          winston.error(
            "Couldn't open ping file '" + this.path + "', got error " + err
          );
          const msg =
            "Can't open the ping file '" +
            this.path +
            "'. Please check the path in settings.";
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
      this._pings = ps;
    }
    return this._pings;
  }

  /**
   * @returns {Set of tags} all unique tags in the pingfile
   */
  get allTags() {
    return new Set(Object.keys(this.allTagsFrequencies));
  }

  /**
   * @returns {Array of tags} all unique tags in the pingfile, ordered by frequency of occurency
   */
  get allTagsOrdered() {
    const tags = Object.keys(this.allTagsFrequencies);
    tags.sort((a, b) => this._allTags![b] - this._allTags![a]);
    return tags;
  }

  /**
   * @returns An object mapping all unique tags to the count of times they appear
   */
  get allTagsFrequencies() {
    if (!this._allTags) {
      this._allTags = {};
      this.pings.map(ping => {
        if (ping) {
          ping.tags.forEach(tag => {
            if (tag in this._allTags!) {
              this._allTags![tag] += 1;
            } else {
              this._allTags![tag] = 1;
            }
          });
        }
      });
    }
    return this._allTags;
  }

  /**
   * Saves a ping to the log file (and to the local cache)
   * @param annotate - see PingFile.encode
   * @throws fs exceptions if the file can't be written to
   */
  public push(ping: Ping, annotate = true) {
    let nl = "";
    if (fs.existsSync(this.path)) {
      // The ping should be on a new line, so check whether the final byte
      // already is \n
      const buffer = new Buffer(1);
      const fd = fs.openSync(this.path, "r");
      if (fs.readSync(fd, buffer, 0, 1, fs.fstatSync(fd).size - 1) === 1) {
        // test bytes read to cope with empty file
        if (buffer[0] !== 10) {
          // 10 is ASCII \n
          nl = "\n";
        }
      }
      fs.closeSync(fd);
    }

    fs.appendFileSync(
      this.path,
      nl + PingFile.encode(ping, annotate, this.width) + "\n",
      "utf8"
    );
    if (this._pings) {
      this._pings.push(ping);
    }

    if (this._allTags) {
      // only update the cache if it exists already
      ping.tags.forEach(t => {
        if (t in this._allTags!) {
          this._allTags![t] += 1;
        } else {
          this._allTags![t] = 1;
        }
      });
    }
  }
}
