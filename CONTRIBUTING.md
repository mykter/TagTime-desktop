This file describes major design elements, and how to develop the application.

This project was a learning exercise for almost all of the technologies in use - better ideas welcome.

Directory Structure
===================
```
 - src/              Source
  |  ./              Any modules that run in the  renderer context (windows, primarily)
  |+ main-process/   Any modules that run in the browser/main context (tray, entry point, window openers)
  |+ css/
 - test/
  |  ./              Renderer tests
  |+ e2e/            End to end tests
  |+ main/           Main process tests
 + __snapshots__/    Expected results from/for React snapshot tests
 + resources/        Static assets (e.g. images)
 + support/          Support for testing or compilation

-----------          Generated directories not in the repository
 + app/              Build output
 + dist/             Packaged versions
 + coverage/         Output from coverage instrumented test runs
```

Builds
======
Babel is used to transpile the application prior to running or testing, orchestrated by gulp.
Manually build with `npm build`, but the intended use is to just run `gulp` which will automatically
rebuild the app when changes are detected.

Clean with `gulp clean:build`.

(electron-compile was trialled, but the runtime compilation was too slow and it's 'magic' approach
caused problems with electron-mocha and JSX)

Code Style
==========
Code is formatted using `prettier`.

Code is linted with eslint, and this is part of the default test suite.
$ npm run lint

Tests
=====
$ npm test

Unit and integration tests use electron-mocha, and are themselves split into
renderer and main tests. Run with:
$ npm run test:renderer
 and
$ npm run test:main

End to end tests use plain mocha and spectron.
$ npm run test:e2e

Code coverage is collected and reported via coveralls. This includes end to end tests, for which
there is a special istanbul instrumented build made by gulp.

Debugging
=========
To get the Chrome DevTools debugging interface add a 'debugger;' statement in
your test of choice, then:
$ npm run debugtest
 or
$ npm run debugtestmain
