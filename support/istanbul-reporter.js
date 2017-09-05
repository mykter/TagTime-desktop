/**
 * A reporter for electron-mocha to work with istanbul for coverage reporting.
 * Requires the target application to already be instrumented through a build step.
 */
const path = require("path");
const fs = require("fs");
const { Reporter, Collector } = require("istanbul");

/**
 * Run the istanbul reporter on all of the matched files.
 */
function report() {
  const collector = new Collector();
  collector.add(cov);

  const NYC_DIR = path.resolve(__dirname, "..", "coverage", "raw");
  // Save the coverage data to a location dependent on the process type
  // because we do a different test run for browser + renderer and don't
  // want to overwrite it.
  const type = process.type === "browser" ? "main" : "renderer";
  const REPORT_DIR = path.resolve(NYC_DIR, type);

  const reporter = new Reporter(null, REPORT_DIR);
  reporter.addAll(["text-summary", "json"]);
  reporter.write(collector, true, () => {});
  fs.renameSync(path.join(REPORT_DIR, "coverage-final.json"), path.join(NYC_DIR, `${type}.json`));
  fs.rmdirSync(REPORT_DIR);
}

const cov = (global.__coverage__ = {});

if (process.type === "browser") {
  process.on("exit", report);
} else {
  window.addEventListener("unload", report);
}
