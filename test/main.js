const should = require('should');
const child_process = require('child_process');
const psTree = require('ps-tree');
const sinon = require('sinon');

const {appPath, electronPath} = require('./helper');

const pings = require('../src/pings');

describe('Application', function() {
  // Spectron doesn't work with apps that don't open a window,
  // so we use child_process instead.
  // See https://github.com/electron/spectron/issues/90

  // There doesn't seem to be tooling to easily test Tray functionality,
  // e.g. see
  // https://discuss.atom.io/t/automated-e2e-testing-of-electron-application-on-windows/21290

  /**
   * Kill a process and all of its children (SIGTERM)
   * The tree-kill module doesn't work for me in this context
   *  - the ps process never returns, it gets stuck as a defunct
   *  process.
   * @param {number} parentPid The root of the process tree to kill
   */
  var tree_kill = function(parentPid) {
    psTree(parentPid, function(err, children) {
      children.forEach(function(child) { process.kill(child.PID, 'SIGKILL'); });
    });
  };


  var app1, app2; // child_process

  if(process.env.DEBIAN_FRONTEND === 'noninteractive') {
    // TODO this test times out on travis
    it('should only allow one instance to run');
  } else {
    it('should only allow one instance to run', function() {
      this.timeout(10000);

      // un-suppress logging, so we can track child progress
      // Requires the app to be logging in debug level
      process.env.NODE_ENV = undefined;
      app1 = child_process.spawn(electronPath, [ appPath ]);
      process.env.NODE_ENV = 'test';

      app1.on('exit', function() { app1 = null; });

      return new Promise(function(fulfill, reject) {
        var app1startup = function(buffer) {
          if (buffer.toString().includes("Creating tray")) {
            process.env.NODE_ENV = undefined;
            app2 = child_process.spawn(electronPath, [ appPath ]);
            process.env.NODE_ENV = 'test';

            app2.on('exit', function(code) {
              app2 = null;
              fulfill(true);
            });

            // don't care which stream the notification will come on
            app2.stdout.on('data', app2startup);
            app2.stderr.on('data', app2startup);
          }
        };

        var app2startup = function(buffer) {
          if (buffer.toString().includes("starting up")) {
            reject("Second instance is starting up");
          }
        };

        // don't care which stream the notification will come on
        app1.stdout.on('data', app1startup);
        app1.stderr.on('data', app1startup);
      });
    });
  }

  afterEach(function() {
    [app1, app2].forEach(function(a) {
      // a.kill doesn't work - it kills the node process, but its descendents
      // live on
      if (a) {
        tree_kill(a.pid);
      }
    });
  });

});
