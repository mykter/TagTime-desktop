This file describes major design elements, and how to develop the application.

This project was a learning exercise for almost all of the technologies in use - better ideas welcome!

Directory Structure
===================
```
 - src/              Source
  |  ./              Any modules that run in the  renderer context (windows, primarily)
  |+ main-process/   Any modules that run in the browser/main context (tray, entry point, window openers)
  |+ css/            (actually sass in scss form)
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
Gulp orchestrates builds prior to running or testing.

Manually build with `npm run build`, but the intended use is to just run `gulp` which will automatically rebuild the app when changes are detected.

Clean with `gulp clean:build`, or 'mrproper' clean with `npm run clean`.

(electron-compile was trialled, but the runtime compilation was too slow and its 'magic' approach caused problems with electron-mocha and JSX)

To build binaries including an installer, use `npm run pack`. From linux this will create Linux and macOS binaries, from Windows it will create Windows binaries.

To see what else you can do, try:

    npm run

Code Style
==========
Code is formatted using `prettier`, also see the `.editorconfig` file.

Code is linted with eslint (`$ npm run lint`), and this is part of the default test suite.

Tests
=====
    $ npm test

Unit and integration tests use electron-mocha, and are themselves split into renderer and main tests. Run with:

    $ npm run test:renderer
 and

    $ npm run test:main

End to end tests use plain mocha and spectron.

    $ npm run test:e2e

Code coverage is collected and reported via coveralls. This includes end to end tests, for which there is a special istanbul instrumented build made by gulp.

UI
==
The UI is developed in React. This could be considered overkill for such a simple application, but I wanted to learn React.

Debugging
=========
As it's an electron app, you can open the Chrome DevTools from any window - maximize and press `CTRL+SHIFT+I`. The React plugin is installed.

To get the Chrome DevTools debugging interface at a convenient point, add a `debugger;` statement in your test of choice, then:

    $ npm run debugtest
 or

    $ npm run debugtestmain

Releases
========
npm
