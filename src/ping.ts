/*
 * Pings have:
 *  .time {time} javascript time - milliseconds since unix epoch
 *  .tags {Set of tags}
 *  .comment {string} - the contents in [] at the end of an entry
 */
module.exports = class Ping {
  private _tags: Set<string>;
  private _comment: string;

  constructor(public time: number, tags: Set<string>, comment: string) {
    this.time = time;
    this.tags = tags;
    this.comment = comment;
  }

  get tags() {
    return this._tags;
  }
  set tags(value: Set<string> | string) {
    if (value instanceof Set) {
      this._tags = value;
    } else {
      this._tags = new Set(value);
    }
  }

  get comment() {
    return this._comment;
  }
  set comment(value: string | null) {
    if (value) {
      this._comment = value;
    } else {
      this._comment = "";
    }
  }
};
