/**
 * A reporter for electron-mocha to work with istanbul for coverage reporting.
 *
 * Adapted from
 *  https://github.com/tropy/tropy/blob/master/test/support/coverage.js
 */
'use strict';

const glob = require('glob');

const {resolve} = require('path');
const {readFileSync : read} = require('fs');
const {Reporter, Instrumenter, Collector, hook} = require('istanbul');
const {keys} = Object;

/**
 * @param {path} root
 * @param {glob} pattern
 * @returns {fn(file):boolean} An istanbul matcher, per the docs:
 *   "a function that is called with the absolute path to the file being
 *   require-d. Should return a truthy value when transformations need to be
 *   applied to the code, a falsy value otherwise"
 *
 * Like istabul's matcherFor, but provides a .files object that enumerates
 * all the files that match
 */
function match(root, pattern) {
  const map = {};
  const fn = function(file) { return map[file]; };

  fn.files = glob.sync(pattern, {root, realpath : true});
  for (let file of fn.files) {
    map[file] = true;
  }

  return fn;
}

/**
 * Run the istanbul reporter on all of the matched files.
 */
function report() {
  for (let file of matched.files) {
    if (!cov[file]) {
      // Files that are not touched by code ran by the test runner is
      // manually instrumented, to illustrate the missing coverage.
      transformer(read(file, 'utf-8'), file);

      // When instrumenting the code, istanbul will give each
      // FunctionDeclaration a value of 1 in coverState.s,
      // presumably to compensate for function hoisting.
      // We need to reset this, as the function was not hoisted,
      // as it was never loaded.
      for (let key of keys(instrumenter.coverState.s)) {
        instrumenter.coverState.s[key] = 0;
      }

      cov[file] = instrumenter.coverState;
    }
  }

  const collector = new Collector();
  collector.add(cov);

  // Save the coverage data to a location dependent on the process type
  // because we do a different test run for browser + renderer and don't
  // want to overwrite it.
  const reporter =
      new Reporter(null, resolve(__dirname, '..', 'coverage', process.type));
  reporter.addAll([ 'text-summary', 'json' ]);
  reporter.write(collector, true, () => {});
}

const instrumenter = new Instrumenter();
const transformer = instrumenter.instrumentSync.bind(instrumenter);
const cov = global.__coverage__ = {};

// Create a matcher for all source files
const matched = match(resolve(__dirname, '..'), 'src/*.js');
hook.hookRequire(matched, transformer, {});

if (process.type === 'browser') {
  process.on('exit', report);
} else {
  window.addEventListener('unload', report);
}
