import * as fs from "fs";
import * as _ from "lodash";
import * as should from "should";
import * as tmp from "tmp";

import { PingFile } from "../../src/main-process/pingfile";
import { Ping } from "../../src/ping";
import "./helper";

describe("PingFile", function() {
  describe("parse()", function() {
    it("should parse time-only entries", function() {
      const ping = new Ping(1487459622000, new Set(), "");
      // use _.isEqual as it copes with Sets, whereas should.eql doesn't
      ["1487459622", "1487459622 ", "1487459622  "].forEach(function(entry) {
        _.isEqual(PingFile.parse(entry), ping).should.be.true();
      });
    });

    it("should reject times before the epoch", function() {
      should(PingFile.parse("1000000")).be.null();
    });

    it("should reject entries without a timestamp", function() {
      should(PingFile.parse("1487459622x tag")).be.null();
    });

    it("should reject entries with a broken comment", function() {
      should(PingFile.parse("1487459622 [half")).be.null();
    });

    it("should parse a single tag", function() {
      const entries = [
        "1487459622 atag",
        "1487459622  atag",
        "1487459622\tatag",
        "1487459622 \tatag \t ",
        "1487459622      atag            "
      ];
      entries.forEach(function(entry) {
        const ping = PingFile.parse(entry);
        should.exist(ping);
        ping!.tags.size.should.equal(1);
        ping!.tags.has("atag").should.be.true();
      });
    });

    it("should parse multiple tags (incl special chars)", function() {
      const tags = new Set(["one:", "t'w'o", "th-ree", "four,", "fi;ve"]);
      const entries = [
        // vanilla
        "1487459622 one: t'w'o th-ree four, fi;ve",
        // re-ordered + spaces
        "1487459622 \t \tt'w'o\tth-ree\tone:  four, fi;ve        "
      ];
      entries.forEach(function(entry) {
        const ping = PingFile.parse(entry);
        should.exist(ping);
        ping!.tags.size.should.equal(5);
        _.isEqual(ping!.tags, tags).should.be.true();
      });
    });

    it("should parse comments (with or without tags)", function() {
      [
        "1487459622 tag [",
        "1487459622 tag[",
        "1487459622 [",
        "1487459622\t["
      ].forEach(function(prefix) {
        [" hello'\"\t\t", "", "1"].forEach(function(comment) {
          const parsed = PingFile.parse(prefix + comment + "]");
          should(parsed).not.be.null();
          parsed!.comment.should.equal(comment);
        });
      });
    });
  });

  describe("encode()", function() {
    it("should throw on malformed pings", function() {
      [
        {},
        { time: 1, tags: null, comment: null },
        { time: "1487459622000a", tags: null, comment: null },
        { time: "a", tags: null, comment: null },
        { time: 1487459622000, tags: "atag", comment: null }
      ].forEach(function(ping) {
        should(function() {
          PingFile.encode(ping as any); // ping isn't a Ping, deliberately
        }).throw();
      });
    });

    it("should encode a time only ping", function() {
      PingFile.encode(
        { time: 1487459622000, tags: new Set(), comment: "" },
        false
      )
        .trim() // don't care
        .should.equal("1487459622");
    });

    it("should annotate pings", function() {
      // we don't know what timezone this is running in, so ignore that
      PingFile.encode({
        time: 1487459622000,
        tags: new Set(),
        comment: ""
      }).should.match(/1487459622 \[2017-02-18T23:13:42\+\d\d:\d\d \w{3}\]/);
      PingFile.encode({
        time: 1487459622000,
        tags: new Set(["1", "2", "three"]),
        comment: ""
      }).should.match(
        /1487459622 1 2 three \[2017-02-18T23:13:42\+\d\d:\d\d \w{3}\]/
      );
      PingFile.encode({
        time: 1487459622000,
        tags: new Set(),
        comment: "hi"
      }).should.match(/1487459622 \[2017-02-18T23:13:42\+\d\d:\d\d \w{3} hi]/);
    });

    it("should encode tags", function() {
      PingFile.encode(
        { time: 1487459622000, tags: new Set(["1"]), comment: "" },
        false
      ).should.equal("1487459622 1");
      PingFile.encode(
        {
          time: 1487459622000,
          tags: new Set(["1", "2", "three"]),
          comment: ""
        },
        false
      ).should.equal("1487459622 1 2 three");
      PingFile.encode(
        { time: 1487459622000, tags: new Set(["3", "2", "1"]), comment: "" },
        false
      ).should.equal("1487459622 3 2 1");
    });

    it("should pad tags to the specified width", function() {
      // include a comment otherwise the padding will be removed
      PingFile.encode(
        { time: 1487459622000, tags: new Set(["1"]), comment: "hi" },
        false,
        40
      ).should.equal("1487459622 1" + " ".repeat(39) + " [hi]");
    });
  });

  describe("get pings", function() {
    let f: tmp.SynchrounousResult;
    let pf: PingFile;
    beforeEach(function() {
      f = tmp.fileSync();
      pf = new PingFile(f.name, true);
    });
    afterEach(function() {
      f.removeCallback();
    });

    const get = function(contents: string) {
      fs.writeSync(f.fd, contents);
      return pf.pings;
    };

    it("should parse an empty file", function() {
      get("").should.deepEqual([null]);
    });

    it("should parse a single entry", function() {
      const res = get("1487459622 1 2 three [2017-02-18T23:13:42+00:00 hi]");
      should.exist(res);
      res!.length.should.equal(1);
      should(res[0]!.time).equal(1487459622000);
      should(res[0]!.comment).equal("2017-02-18T23:13:42+00:00 hi");
      _.isEqual(res[0]!.tags, new Set(["1", "2", "three"])).should.be.true();
    });

    it("should parse a multiline file with invalid entries", function() {
      const res = get(
        "header\n" +
          "\n" +
          "1487459622 1 2 three [2017-02-18T23:13:42+00:00 hi]\n" +
          "123invalid tags\n" +
          "1487459623 1 2 three [2017-02-18T23:13:42+00:00 hi]\n"
      );
      should.exist(res);
      res!.length.should.equal(5);
      should(res[0]!).equal(null);
      should(res[1]!).equal(null);
      should(res[2]!.time).equal(1487459622000);
      should(res[2]!.comment).equal("2017-02-18T23:13:42+00:00 hi");
      _.isEqual(res[2]!.tags, new Set(["1", "2", "three"])).should.be.true();
      should(res[3]!).equal(null);
      should(res[4]!.time).equal(1487459623000);
    });

    it("should ignore invalid entries when configured to do so", function() {
      pf.keep_invalid = false;
      const res = get(
        "header\n" +
          "\n" +
          "1487459622 1 2 three [2017-02-18T23:13:42+00:00 hi]\n" +
          "123invalid tags\n" +
          "1487459623 1 2 three [2017-02-18T23:13:42+00:00 hi]\n"
      );
      should(res[0]!.time).equal(1487459622000);
      should(res[0]!.comment).equal("2017-02-18T23:13:42+00:00 hi");
      _.isEqual(res[0]!.tags, new Set(["1", "2", "three"])).should.be.true();
      should(res[1]!.time).equal(1487459623000);
    });
  });

  describe("push", function() {
    let pf: PingFile;
    let f: tmp.SynchrounousResult;
    const p = {
      time: 1487459622000,
      tags: new Set(["one", "two"]),
      comment: "c"
    };
    const pStr = "1487459622 one two [c]";
    const pAnnoStr = /1487459622 one two \[2017-02-18T23:13:42\+\d\d:\d\d \w{3} c]/;
    beforeEach(function() {
      f = tmp.fileSync();
      pf = new PingFile(f.name);
    });
    afterEach(function() {
      f.removeCallback();
    });

    it("should throw on an invalid ping", function() {
      should(function() {
        pf.push({} as Ping);
      }).throw();
    });

    it("should create a non-existent file", function() {
      f.removeCallback();
      pf.push(p, false);
      should(fs.readFileSync(f.name, "utf8").trim()).equal(pStr);
      fs.unlinkSync(f.name);
    });

    it("should annotate pings", function() {
      pf.push(p);
      should(fs.readFileSync(f.name, "utf8").trim()).match(pAnnoStr);
    });

    it("should append to existing files that don't end in \\n", function() {
      fs.writeSync(f.fd, "some stuff!");
      pf.push(p, false);
      should(fs.readFileSync(f.name, "utf8").trim()).equal(
        "some stuff!\n" + pStr
      );
    });

    it("should append to existing files that do end in \\n", function() {
      fs.writeSync(f.fd, "some stuff!\n");
      pf.push(p, false);
      should(fs.readFileSync(f.name, "utf8").trim()).equal(
        "some stuff!\n" + pStr
      );
    });
  });

  const testPush = function(caching: boolean) {
    const p = {
      time: 1487459622000,
      tags: new Set(["one", "two"]),
      comment: "c"
    };
    const f = tmp.fileSync();
    const pf = new PingFile(f.name, false, false, caching);
    pf.push(p, false);
    pf.push(p, false);
    pf.pings.should.have.length(2);
    pf.pings.forEach(function(ping) {
      should.exist(ping);
      should(ping!.time).equal(p.time);
      _.isEqual(ping!.tags, p.tags).should.be.true();
      should(ping!.comment).equal(p.comment);
    });
    f.removeCallback();
  };
  it("get should return the pings pushed, without caching", function() {
    testPush(false);
  });
  it("get should return the pings pushed, with caching", function() {
    testPush(true);
  });

  describe("allTags", function() {
    let pf: PingFile;
    let f: tmp.SynchrounousResult;
    beforeEach(function() {
      f = tmp.fileSync();
    });
    afterEach(function() {
      f.removeCallback();
    });

    it("should return an empty set if there are no pings", function() {
      pf = new PingFile(f.name);
      _.isEqual(pf.allTags, new Set()).should.be.true();
    });

    const testAllTags = function(caching: boolean) {
      pf = new PingFile(f.name, false, false, caching);
      pf.push({ time: 1487459622000, tags: new Set(["one"]), comment: "" });
      pf.push({
        time: 1487459623000,
        tags: new Set(["one", "two"]),
        comment: ""
      });
      pf.push({ time: 1487459624000, tags: new Set(["three"]), comment: "" });
      return _.isEqual(
        pf.allTags,
        new Set(["one", "two", "three"])
      ).should.be.true();
    };
    it("should return the set of recorded pings with caching", function() {
      return testAllTags(true);
    });
    it("should return the set of recorded pings without caching", function() {
      return testAllTags(false);
    });
  });
});
