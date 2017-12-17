require("should");
import * as tmp from "tmp";
import * as _ from "lodash";
import * as fs from "fs";
const winston = require("winston"); // type errors with winston.level= if using "import"

import * as helper from "./helper";
import { PingFile } from "../../src/main-process/pingfile";
import { Ping } from "../../src/ping";

describe("Prompts", function() {
  this.timeout(10000);
  this.retries(2); // had an occasion where appveyor test transiently failed.

  let app: any, tmpLogFileName: string;
  let tmpPingFileName: string;
  let tmpConfig: helper.ConfigDict;
  let prevPing: Ping;
  let prevPingEncoded: string;

  const tagsSelector = "#tags-input";
  const saveSelector = "#save";
  const repeatSelector = "#repeat";
  const commentSelector = "#comment";

  before(function() {
    winston.level = "warning";
    prevPing = new Ping(1234567890000, new Set(["previous", "tags"]), "");
    prevPingEncoded = PingFile.encode(prevPing);
  });

  beforeEach(function() {
    tmpPingFileName = tmp.tmpNameSync();
    fs.writeFileSync(tmpPingFileName, prevPingEncoded);
    // As the pingfile changes for each test, need to recreate the app each test
    ({ app, tmpLogFileName, tmpConfig } = helper.launchApp("prompt", tmpPingFileName));
    winston.debug("Launching app with " + app.path + " " + app.args);
    return app.start();
  });

  afterEach(async function() {
    // spectron struggles if the window has closed already, e.g.
    // https://github.com/electron/spectron/issues/101
    // So we have the app quit when all the windows close in test mode.
    // Even this isn't enough - chromedriver will hang around waiting for its dead child,
    // so we manually kill it (and any other running chromedriver instances ¯\_(ツ)_/¯)

    await helper.kill_spectron();
    winston.debug("Application logs follow:");
    winston.debug(fs.readFileSync(tmpLogFileName, { encoding: "utf8" }));
  });

  it("should open a window", function() {
    app.client
      .waitUntilWindowLoaded()
      .getWindowCount()
      .should.eventually.equal(1);
    // stop() will work, because the window is still open.
    // It's needed, because we just kill spectron rather than TagTime
    return app.stop();
  });

  let untilSaved = function() {
    // As the app is gone, verify the pingfile separately.
    // Note that writeSync doesn't do synchronous file i/o, so there's no
    // guarantee the pingfile exists yet! See
    // http://www.daveeddy.com/2013/03/26/synchronous-file-io-in-nodejs/

    // fs.watchFile looks like a solution, but what if the app has finished writing before the
    // watcher starts? So manually check to see if the file has more data in it than it started with
    return helper.until(() => fs.statSync(tmpPingFileName).size > prevPingEncoded.length + 10, 100);
  };

  let saveInput = async function(
    tags: string,
    comment: string = "",
    button: null | string = saveSelector
  ) {
    app.client.waitForExist(tagsSelector);

    await app.client.element(tagsSelector).setValue(tags);
    if (comment) {
      await app.client.element(commentSelector).setValue(comment);
    }
    if (button) {
      await app.client.click(button);
    }
  };

  let lastPingShouldEqual = function(tags: Set<string>, comment?: string) {
    const pings = new PingFile(tmpPingFileName).pings;
    pings.length.should.equal(2);
    winston.debug(
      "asserting Set(" + Array.from(pings[1]!.tags) + ") should equal Set(" + tags + ")"
    );
    _.isEqual(pings[1]!.tags, new Set(tags)).should.equal(true);
    if (comment) {
      pings[1]!.comment.should.endWith(comment);
    }
  };

  it("should save a ping with tags separated by spaces and commas", async function() {
    await saveInput("tag1 tag2, tag3");
    await untilSaved();
    lastPingShouldEqual(new Set(["tag1", "tag2", "tag3"]));
  });

  it('should repeat pings when a " is entered', async function() {
    await saveInput('"');
    await untilSaved();
    lastPingShouldEqual(prevPing.tags);
  });

  it("should repeat pings when the repeat button is pressed", async function() {
    await saveInput("", "", repeatSelector);
    await untilSaved();
    lastPingShouldEqual(prevPing.tags);
  });

  it("should save a comment", async function() {
    await saveInput("tag", "Test comment", saveSelector);
    await untilSaved();
    lastPingShouldEqual(new Set(["tag"]), "Test comment");
  });

  let saveOnEnter = async function(fieldSelector: string) {
    await saveInput("tag,", "", null); // The comma forces tag termination as otherwise the first enter just finishes the tag
    app.client.addValue(fieldSelector, "Enter");
    await untilSaved();
    lastPingShouldEqual(new Set(["tag"]));
  };

  it("should save on enter key in comment field", async function() {
    await saveOnEnter(commentSelector);
  });

  it("should save on enter key in tags field", async function() {
    await saveOnEnter(tagsSelector);
  });

  let quitOnEscape = async function(fieldSelector: string) {
    await saveInput("notused", "never seen", null);
    app.client.addValue(fieldSelector, "Escape");
    await untilSaved();
    lastPingShouldEqual(tmpConfig["cancelTags"]);
  };

  it("should close and save afk tags on escape in the tags input box", async function() {
    await quitOnEscape(tagsSelector);
  });

  it("should close and save afk tags on escape elsewhere - e.g. the comment box", async function() {
    await quitOnEscape(commentSelector);
  });

  it("should save afk tags on close", async function() {
    app.client.close();
    await untilSaved();
    lastPingShouldEqual(tmpConfig["cancelTags"]);
  });
});
