/**
 * build: Build an istanbul coverage instrumented version of the app
 * cover:e2e: Run the e2e tests on it, outputting istanbul raw coverage data to COVERAGE_DIR
 */
const path = require('path');
const del = require('del');
const child_process = require('child_process');
var gulp = require('gulp');
var istanbul = require('gulp-istanbul');
// We'll use mocha in this example, but any test framework will work
var mocha = require('gulp-mocha');
var fs = require('fs');

const BASE_DIR = path.resolve(path.join('coverage', 'e2e'));
const COVERAGE_DIR = path.join(BASE_DIR, 'coverage');
const BUILD_DIR = path.join(BASE_DIR, 'app');
const REPORT_DIR = path.join(BASE_DIR, 'report');

// Instrument the source files
gulp.task('instrument', [ 'clean:build' ], function() {
  return gulp.src([ 'src/*.js' ], {base : './'})
      .pipe(istanbul({coverageVariable : '__coverage__'}))
      .pipe(gulp.dest(BUILD_DIR));
});

// Get any non-js components of the app
gulp.task('copy', [ 'clean:build' ], function() {
  return gulp.src([ 'package.json', 'src/css/*.css', 'src/*.html', 'resources/*' ], {base : '.'})
      .pipe(gulp.dest(BUILD_DIR));
});

// some things refer to node_modules, so symlink it in
gulp.task('node_modules', [ 'copy' ], function() { // dependency just to ensure BUILD_DIR exists
  fs.symlinkSync(path.resolve('./node_modules'), path.join(BUILD_DIR, 'node_modules'));
})

gulp.task('clean:build', function() { return del([ BUILD_DIR ]); });
gulp.task('clean:coverage', function() { return del([ COVERAGE_DIR ]); });
gulp.task('clean:report', function() { return del([ REPORT_DIR ]); });

gulp.task('build_instrumented', [ 'node_modules', 'copy', 'instrument' ]);

gulp.task('cover:e2e', [ 'build_instrumented', 'clean:coverage' ], function() {
  // The e2e tests will pick this up and launch our instrumented app
  process.env.TAGTIME_TARGET_APP_PATH = BUILD_DIR;
  process.env.TAGTIME_E2E_COVERAGE_DIR = COVERAGE_DIR;
  fs.mkdirSync(COVERAGE_DIR);
  return gulp.src([ 'test/e2e/*.js' ]).pipe(mocha());
});

gulp.task('report:e2e', [ 'cover:e2e', 'clean:report' ], function() {
  fs.mkdirSync(REPORT_DIR);
  // tried reporting with writeReports, and it didn't seem to support specifying where the coverage
  // root dir was - it seems to be designed to be used in the inline / unit test case, not the
  // browser case
  var text_report =
      child_process.execSync('./node_modules/.bin/istanbul report json text-summary ' +
                             `--root='${COVERAGE_DIR}' --dir='${REPORT_DIR}'`);
  process.stdout.write(text_report);

  // Remove the coverage dir else istanbul will fail when trying to build the overall combined
  // report. Don't use a clean:cover dependency because it will already have run once so gulp won't
  // run it again.
  return del([ COVERAGE_DIR ]);
});
