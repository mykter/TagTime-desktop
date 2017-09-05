/**
 * build: Build an istanbul coverage instrumented version of the app
 * cover:e2e: Run the e2e tests on it, outputting istanbul raw coverage data to COVERAGE_DIR
 */
/* eslint-disable no-console */

const gulp = require("gulp");
const mocha = require("gulp-mocha");
const sourcemaps = require("gulp-sourcemaps");
const babel = require("gulp-babel");

const path = require("path");
const del = require("del");
const child_process = require("child_process");
const mkdirp = require("mkdirp");
const fs = require("fs");

const BASE_DIR = path.resolve(".");
const BUILD_DIR = path.join(BASE_DIR, "app");
const COVERAGE_ROOT_DIR = path.join(BASE_DIR, "coverage");
const COVERAGE_DIR = path.join(COVERAGE_ROOT_DIR, "e2e-collection");
const REPORT_DIR = path.join(COVERAGE_ROOT_DIR, "raw", "e2e-report");
const NYC_DIR = path.join(COVERAGE_ROOT_DIR, "raw");
const paths = {
  sources: "./src/**/*.js",
  tests: "./test/**/*.js",
  static: ["./src/css/*.css", "./src/*.html"]
};

gulp.task("compile", function() {
  return gulp
    .src(["src/**/*.js"], { base: "./" })
    .pipe(sourcemaps.init())
    .pipe(babel())
    .pipe(sourcemaps.write())
    .pipe(gulp.dest(BUILD_DIR));
});

gulp.task("compile:tests", function() {
  return gulp.src(["test/**/*.js"], { base: "./" }).pipe(babel()).pipe(gulp.dest(BUILD_DIR));
});

// Get any non-js components of the app
gulp.task("copy", function() {
  return gulp.src(paths.static, { base: "." }).pipe(gulp.dest(BUILD_DIR));
});

gulp.task("clean:build", function() {
  return del([BUILD_DIR]);
});
gulp.task("clean:coverage", function() {
  return del([COVERAGE_DIR]);
});
gulp.task("clean:report", function() {
  return del([REPORT_DIR]);
});

// Note we aren't running clean:build before this, because it was a pain in combo with watch.
gulp.task("build", ["compile", "copy"]);
gulp.task("build:tests", ["compile:tests", "build"]);

gulp.task("cover:e2e", ["build:tests", "clean:coverage"], function() {
  // The e2e tests will pick this up and launch our instrumented app
  process.env.TAGTIME_E2E_COVERAGE_DIR = COVERAGE_DIR;
  process.env.NODE_ENV = "coverage";
  mkdirp.sync(COVERAGE_ROOT_DIR);
  mkdirp.sync(COVERAGE_DIR);
  return gulp.src(["app/test/e2e/*.js"]).pipe(mocha());
});

gulp.task("report:e2e", ["cover:e2e", "clean:report"], function() {
  mkdirp.sync(REPORT_DIR);
  // tried reporting with writeReports, and it didn't seem to support specifying where the coverage
  // root dir was - it seems to be designed to be used in the inline / unit test case, not the
  // browser case
  var text_report = child_process.execSync(
    "./node_modules/.bin/istanbul report json text-summary " +
      `--root='${COVERAGE_DIR}' --dir='${REPORT_DIR}'`
  );
  process.stdout.write(text_report);
  fs.renameSync(path.join(REPORT_DIR, "coverage-final.json"), path.join(NYC_DIR, "e2e.json"));

  // Remove the coverage dir else istanbul will fail when trying to build the overall combined
  // report. Don't use a clean:cover dependency because it will already have run once so gulp won't
  // run it again.
  return del([REPORT_DIR, COVERAGE_DIR]);
});

gulp.task("watch", () => {
  gulp.watch(paths.sources, function(event) {
    console.log("File " + event.path + " was " + event.type + ", rebuilding...");
    gulp.start("build");
  });
  gulp.watch(paths.tests, function(event) {
    console.log("File " + event.path + " was " + event.type + ", rebuilding...");
    gulp.start("build:tests");
  });
  gulp.watch(paths.static, function(event) {
    // gulp.watch <v4 is broken but not documented as such. https://github.com/gulpjs/gulp/issues/651
    // expect to see this watch picking up changes under ./app !
    console.log("File " + event.path + " was " + event.type + ", copying...");
    gulp.start("copy");
  });
});

gulp.task("default", ["watch", "build:tests"]);
