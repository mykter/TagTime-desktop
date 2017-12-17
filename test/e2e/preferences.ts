require("should");
const winston = require("winston"); // type errors with winston.level= if using "import"
import * as fs from "fs";

import * as helper from "./helper";

describe("Preferences", function() {
  this.timeout(10000);
  this.retries(2); // had an occasion where appveyor test transiently failed.

  let app: any, tmpLogFileName: string, tmpConfig: helper.ConfigDict, tmpConfigFile: string;

  before(function() {
    winston.level = "warning";
  });

  beforeEach(async function() {
    ({ app, tmpConfig, tmpConfigFile, tmpLogFileName } = helper.launchApp("prefs", "/dev/null"));
    winston.debug("Launching app with " + app.path + " " + app.args);
    await app.start();
    return app.client.waitUntilWindowLoaded();
  });

  afterEach(async function() {
    // app.stop doesn't work without a renderer window around, so need this fallback
    // the kill might fail because there is no chromedriver e.g. a test ran app.stop()
    await helper.kill_spectron();
    winston.debug("Application logs follow:");
    winston.debug(fs.readFileSync(tmpLogFileName, { encoding: "utf8" }));
  });

  it("should open a window", function() {
    app.client.getWindowCount().should.eventually.equal(1);
    // stop() will work, because the window is still open.
    // It's needed, because we just kill spectron rather than TagTime
    return app.stop();
  });

  it("should discard changes on cancel", async function() {
    await app.client.element("[name=tagWidth]").setValue(42);
    await app.client.click("#cancel");
    // Trying to wait for the app to close doesn't seem to work (app.isRunning() always returns true),
    // so just wait a bit instead... :-/
    await helper.until(() => true, 500);
    let newConfig = JSON.parse(fs.readFileSync(tmpConfigFile, "utf8"));
    newConfig.should.deepEqual(tmpConfig);
  });

  it("should save changes", async function() {
    let origModified = fs.statSync(tmpConfigFile).mtime;
    await app.client.element("[name=tagWidth]").setValue(33);
    await app.client.click("#save");

    await helper.until(() => fs.statSync(tmpConfigFile).mtime !== origModified, 100);
    let newConfig = JSON.parse(fs.readFileSync(tmpConfigFile, "utf8"));
    tmpConfig.tagWidth = 33;
    newConfig.should.deepEqual(tmpConfig);
  });
});
