Code Style
==========
Code is formatted using clang-format. e.g. in vimrc:
  map <C-K> :py3f /usr/share/vim/addons/syntax/clang-format.py<cr>

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

Code coverage is collected and reported via coveralls. End to end tests don't
have coverage data.

Debugging
=========
To get the Chrome DevTools debugging interface add a 'debugger;' statement in
your test of choice, then:
$ npm run debugtest
 or
$ npm run debugtestmain
