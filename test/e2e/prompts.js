require("should");
const tmp = require("tmp");
const _ = require("lodash");
const fs = require("fs");
const winston = require("winston");

const helper = require("./helper");

const { PingFile } = require("../../src/main-process/pingfile");
const { Ping } = require("../../src/ping");

describe("Prompts", function() {
  this.timeout(10000);
  this.retries(0); // had an occasion where appveyor test transiently failed.

  let app, tmpLogFileName;
  let tmpPingFileName;
  let tmpConfig;
  let prevPing;
  let prevPingEncoded;

  const tagsSelector = "#tags-input";
  const saveSelector = "#save";
  const repeatSelector = "#repeat";
  const commentSelector = "#comment";

  before(function() {
    winston.level = "warning";
    prevPing = new Ping(1234567890000, ["previous", "tags"], "");
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

  afterEach(function() {
    // spectron struggles if the window has closed already
    // https://github.com/electron/spectron/issues/101
    // So we have the app quit when all the windows close in test mode, rather
    // than trying to stop it here.

    winston.debug("Application logs follow:");
    winston.debug(fs.readFileSync(tmpLogFileName, { encoding: "utf8" }));
  });

  it("should open a window", function() {
    app.client
      .waitUntilWindowLoaded()
      .getWindowCount()
      .should.eventually.equal(1);
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

  let saveInput = async function(tags, comment = null, button = saveSelector) {
    app.client.waitForExist(tagsSelector);

    await app.client.element(tagsSelector).setValue(tags);
    if (comment) {
      await app.client.element(commentSelector).setValue(comment);
    }
    if (button) {
      await app.client.click(button);
    }
  };

  let lastPingShouldEqual = function(tags, comment = null) {
    const pings = new PingFile(tmpPingFileName).pings;
    pings.length.should.equal(2);
    winston.debug(
      "asserting Set(" + Array.from(pings[1].tags) + ") should equal Set(" + tags + ")"
    );
    _.isEqual(pings[1].tags, new Set(tags)).should.equal(true);
    if (comment) {
      pings[1].comment.should.endWith(comment);
    }
  };

  it("should save a ping with tags separated by spaces and commas", async function() {
    await saveInput("tag1 tag2, tag3");
    await untilSaved();
    lastPingShouldEqual(["tag1", "tag2", "tag3"]);
  });

  it('should repeat pings when a " is entered', async function() {
    await saveInput('"');
    await untilSaved();
    lastPingShouldEqual(prevPing.tags);
  });

  it("should repeat pings when the repeat button is pressed", async function() {
    await saveInput("", null, repeatSelector);
    await untilSaved();
    lastPingShouldEqual(prevPing.tags);
  });

  it("should save a comment", async function() {
    await saveInput("tag", "Test comment", saveSelector);
    await untilSaved();
    lastPingShouldEqual(["tag"], "Test comment");
  });

  let saveOnEnter = async function(fieldSelector) {
    await saveInput("tag,", null, null); // The comma forces tag termination as otherwise the first enter just finishes the tag
    app.client.addValue(fieldSelector, "Enter");
    await untilSaved();
    lastPingShouldEqual(["tag"]);
  };

  it("should save on enter key in comment field", async function() {
    await saveOnEnter(commentSelector);
  });

  it("should save on enter key in tags field", async function() {
    await saveOnEnter(tagsSelector);
  });

  let quitOnEscape = async function(fieldSelector) {
    await saveInput("notused", "never seen", false);
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
