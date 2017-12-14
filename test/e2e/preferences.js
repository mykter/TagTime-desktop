require("should");
const winston = require("winston");
const fs = require("fs");

const helper = require("./helper");

describe("Preferences", function() {
  this.timeout(10000);
  this.retries(2);

  let app, tmpLogFileName, tmpConfig, tmpConfigFile;

  before(function() {
    winston.level = "warning";
  });

  beforeEach(async function() {
    ({ app, tmpConfig, tmpConfigFile, tmpLogFileName } = helper.launchApp("prefs", "/dev/null"));
    winston.debug("Launching app with " + app.path + " " + app.args);
    await app.start();
    await app.client.waitUntilWindowLoaded();
  });

  afterEach(function() {
    // app.stop doesn't work without a renderer window around, so need this fallback
    // the kill might fail because there is no chromedriver e.g. a test ran app.stop()
    helper.kill_spectron();
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

  it("should discard changes on cancel", async function() {
    app.client.waitUntilWindowLoaded();
    await app.client.element("[name=tagWidth]").setValue(42);
    await app.client.click("#cancel");
    // Trying to wait for the app to close doesn't seem to work (app.isRunning() always returns true),
    // so just wait a bit instead... :-/
    await helper.until(() => true, 500);
    let newConfig = JSON.parse(fs.readFileSync(tmpConfigFile));
    newConfig.should.deepEqual(tmpConfig);
  });

  it("should save changes", async function() {
    let origModified = fs.statSync(tmpConfigFile).mtime;
    app.client.waitUntilWindowLoaded();
    await app.client.element("[name=tagWidth]").setValue(42);
    await app.client.click("#save");

    await helper.until(() => fs.statSync(tmpConfigFile).mtime !== origModified, 100);
    let newConfig = JSON.parse(fs.readFileSync(tmpConfigFile));
    tmpConfig.tagWidth = 42;
    newConfig.should.deepEqual(tmpConfig);
  });
});
