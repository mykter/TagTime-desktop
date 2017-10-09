import * as winston from "winston";
import * as fs from "fs";
import * as path from "path";

/**
 * Save istanbul coverage information (on program exit)
 */
export function saveCoverage() {
  if (!process.env.TAGTIME_E2E_COVERAGE_DIR) {
    return;
  }

  if (typeof __coverage__ !== "undefined") {
    global.coverage.push(__coverage__); // eslint-disable-line no-undef
    winston.warn("main coverage");
  }
  if (global.coverage.length === 0) {
    winston.error("TAGTIME_E2E_COVERAGE_DIR is set but no coverage information available.");
  } else {
    // Find a unique file name
    let i = -1;
    let coverageBase: string;
    do {
      i += 1;
      coverageBase = `coverage${i}.json`;
    } while (fs.existsSync(path.join(process.env.TAGTIME_E2E_COVERAGE_DIR, coverageBase)));

    global.coverage.forEach((e, i) => {
      let name;
      if (i === 0) {
        // The first file we write is the unique name
        name = coverageBase;
      } else {
        // subsequent ones are prefixed, to allow identifying which run a
        // file came from
        name = "var" + i + "-" + coverageBase;
      }
      fs.writeFileSync(path.join(process.env.TAGTIME_E2E_COVERAGE_DIR, name), JSON.stringify(e));
    });
  }
}
