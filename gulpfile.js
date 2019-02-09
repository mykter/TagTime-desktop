/**
 * build: Build an istanbul coverage instrumented version of the app
 * cover:e2e: Run the e2e tests on it, outputting istanbul raw coverage data to COVERAGE_DIR
 */
/* eslint-disable no-console */

const gulp = require("gulp");
const mocha = require("gulp-mocha");
const ts = require("gulp-typescript");
const sass = require("gulp-sass");
const apply_patch = require("gulp-apply-patch");

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
const PATCHED_MODULES_DIR = path.join(BUILD_DIR, "node_modules");
const PATCHES_DIR = path.join(BASE_DIR, "patches");
const NODE_MODULES = path.join(BASE_DIR, "node_modules");
const paths = {
  sources: {
    paths: ["src/**/*.[tj]s?(x)", "src/types/**/*.d.ts"],
    onchange: compile
  },
  sass: { paths: ["./src/**/*.scss"], onchange: compile_sass },
  tests: {
    paths: ["test/**/*.[jt]s", "src/types/global.d.ts"],
    onchange: compile_tests
  },

  // gulp.watch <v4 is broken but not documented as such. https://github.com/gulpjs/gulp/issues/651
  // expect to see this watch picking up changes under ./app !
  static: { paths: ["./src/*.html"], onchange: copy }
};

// Need separate projects for parallel builds
// According to the docs, must be defined outside of the task they're used in
const tsProjectBuild = ts.createProject("tsconfig.json");
const tsProjectTests = ts.createProject("tsconfig.json");

function patch() {
  // Get all the directories in the patches folder
  let to_patch = fs
    .readdirSync(PATCHES_DIR)
    .filter(f => fs.statSync(path.join(PATCHES_DIR, f)).isDirectory());

  // If there's only a single entry in the patches directory, the {set glob} won't match, so
  // add a dummy entry to work around that
  to_patch.push("nonexistent_dummy_package");

  // Convert the patch directories into a glob that matches the corresponding source packages.
  let globs_to_patch = NODE_MODULES + "/{" + to_patch.join(",") + "}/**/*";

  return gulp
    .src(globs_to_patch, { base: NODE_MODULES }) // copy only the modules that have patches
    .pipe(apply_patch(PATCHES_DIR + "/**/*.patch"))
    .pipe(gulp.dest(PATCHED_MODULES_DIR));
}

function compile() {
  return gulp
    .src(paths.sources.paths, { base: "./", sourcemaps: true })
    .pipe(tsProjectBuild())
    .js // discard the type outputs (.dts)
    .pipe(gulp.dest(BUILD_DIR, { sourcemaps: true }));
}

function compile_tests() {
  return gulp
    .src(paths.tests.paths, { base: "./" })
    .pipe(tsProjectTests())
    .js // discard the type outputs (.dts)
    .pipe(gulp.dest(BUILD_DIR));
}

function compile_sass() {
  return gulp
    .src(paths.sass.paths, { base: "./", sourcemaps: true })
    .pipe(sass().on("error", sass.logError))
    .pipe(gulp.dest(BUILD_DIR, { sourcemaps: true }));
}

// Get any non-js components of the app
function copy() {
  return gulp
    .src(paths.static.paths, { base: "./" })
    .pipe(gulp.dest(BUILD_DIR));
}

function clean_build() {
  return del([BUILD_DIR]);
}
exports.clean_build = clean_build;

function clean_coverage() {
  return del([COVERAGE_DIR]);
}
function clean_report() {
  return del([REPORT_DIR]);
}

exports.clean = gulp.parallel(clean_build, clean_coverage, clean_report);

// Note we aren't running clean_build before this, because it was a pain in combo with watch.
let build = gulp.parallel(compile, compile_sass, copy, patch);
exports.build = build;

let build_tests = gulp.parallel(compile_tests, build);
exports.build_tests = build_tests;

function coverage() {
  // TODO: this previously depended on babel's istanbul plugin? removed when babel broke, but coverage wasn't working then anyway
  // The e2e tests will pick this up and launch our instrumented app
  process.env.TAGTIME_E2E_COVERAGE_DIR = COVERAGE_DIR;
  process.env.NODE_ENV = "coverage";
  mkdirp.sync(COVERAGE_ROOT_DIR);
  mkdirp.sync(COVERAGE_DIR);
  return gulp.src(["app/test/e2e/*.[tj]s"]).pipe(mocha());
}
let cover_e2e = gulp.series(
  gulp.parallel(build_tests, clean_coverage),
  coverage
);

function create_report(cb) {
  mkdirp.sync(REPORT_DIR);
  // tried reporting with writeReports, and it didn't seem to support specifying where the coverage
  // root dir was - it seems to be designed to be used in the inline / unit test case, not the
  // browser case
  let text_report = child_process.execSync(
    "./node_modules/.bin/istanbul report json text-summary " +
      `--root='${COVERAGE_DIR}' --dir='${REPORT_DIR}'`
  );
  process.stdout.write(text_report);
  fs.rename(
    path.join(REPORT_DIR, "coverage-final.json"),
    path.join(NYC_DIR, "e2e.json"),
    cb
  );
}
let report_e2e = gulp.series(
  gulp.parallel(cover_e2e, clean_report),
  create_report,
  // Now remove the coverage dir else istanbul will fail when trying to build the overall combined
  // report.
  gulp.parallel(clean_coverage, clean_report)
);
exports.report_e2e = report_e2e;

function watch() {
  for (let p in paths) {
    gulp.watch(paths[p].paths, paths[p].onchange);
  }
  return Promise.resolve("done");
}

exports.watch = watch;
exports.default = gulp.series(clean_build, gulp.parallel(watch, build_tests));
