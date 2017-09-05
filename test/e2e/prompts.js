require("should");
const tmp = require("tmp");
const _ = require("lodash");
const fs = require("fs");
const winston = require("winston");

const helper = require("./helper");

const pingFile = require("../../src/main-process/pingfile");
const Ping = require("../../src/ping");

describe("Prompts", function() {
  this.timeout(10000);
  this.retries(2); // had an occasion where appveyor test transiently failed.

  let app, tmpLogFileName;
  let tmpPingFileName;
  let prevPing;
  let prevPingEncoded;

  before(function() {
    winston.level = "warning";
    prevPing = new Ping(1234567890000, ["previous", "tags"], "");
    prevPingEncoded = pingFile.encode(prevPing);
  });

  beforeEach(function() {
    tmpPingFileName = tmp.tmpNameSync();
    fs.writeFileSync(tmpPingFileName, prevPingEncoded);
    // As the pingfile changes for each test, need to recreate the app each test
    ({ app, tmpLogFileName } = helper.launchApp("prompt", tmpPingFileName));
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
    app.client.waitUntilWindowLoaded().getWindowCount().should.eventually.equal(1);
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

  let saveInput = async function(tags, comment = null, button = "#save") {
    // There are two input elements in the div
    const tagsSelector = ".bootstrap-tagsinput input.tt-input";
    await app.client.waitUntil(function() {
      return app.client.hasFocus(tagsSelector);
    });
    await app.client.element(tagsSelector).setValue(tags);
    if (comment) {
      await app.client.element("#comment").setValue(comment);
    }
    if (button) {
      await app.client.click(button);
    }
  };

  let lastPingShouldEqual = function(tags, comment = null) {
    const pings = new pingFile(tmpPingFileName).pings;
    pings.length.should.equal(2);
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
    await saveInput("", null, "#repeat");
    await untilSaved();
    lastPingShouldEqual(prevPing.tags);
  });

  it("should save a comment", async function() {
    await saveInput("tag", "Test comment", "#save");
    await untilSaved();
    lastPingShouldEqual(["tag"], "Test comment");
  });

  it("should save on enter key", async function() {
    await saveInput("tag", null, null);
    app.client.addValue("#comment", "Enter");
    await untilSaved();
    lastPingShouldEqual(["tag"]);
  });
});
