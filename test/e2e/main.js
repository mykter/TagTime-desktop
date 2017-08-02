require('should');
const child_process = require('child_process');
const psTree = require('ps-tree');
const isrunning = require('is-running');
const tmp = require('tmp');

const helper = require('./helper');

describe('Application', function() {
  // Spectron doesn't work with apps that don't open a window so we use
  // child_process instead.
  // See https://github.com/electron/spectron/issues/90

  // There doesn't seem to be tooling to easily test Tray functionality,
  // e.g. see
  // https://discuss.atom.io/t/automated-e2e-testing-of-electron-application-on-windows/21290

  /**
   * Kill a process and all of its children
   * The tree-kill module doesn't work for me in this context
   *  - the ps process never returns, it gets stuck as a defunct
   *  process.
   * @param {number} parentPid The root of the process tree to kill
   */
  var tree_kill = function(parentPid) {
    psTree(parentPid, function(err, children) {
      children.forEach(function(child) {
        try {
          process.kill(child.PID, 'SIGKILL');
        } catch (e) {
          // ignore it
        }
      });
      try {
        process.kill(parentPid, 'SIGKILL');
      } catch (e) {
        // ignore it
      }
    });
  };

  /**
   * @returns {function} which calls callback if pid isn't running,
   *          otherwise schedules itself to run again after a short pause
   */
  var callWhenDead = function(pid, callback) {
    var check = function() {
      if (isrunning(pid)) {
        setTimeout(check, 100);
      } else {
        callback();
      }
    };
    return check;
  };

  /**
   * @returns {app} a new instance of the app with its own fresh config file
   */
  var spawnApp = function() {
    return child_process.spawn(helper.electronPath, [
      helper.appPath, '--verbose', '--configdir',
      helper.createConfig(
          {pingFilePath : tmpFile.name, firstRun : false}) // skip the launch on startup config bit
    ]);
  };

  var tmpFile = tmp.fileSync();
  var app1, app2; // child_process
  var app1pid, app2pid;

  if ([ 'linux', 'osx' ].includes(process.env.TRAVIS_OS_NAME)) {
    // As best I can tell, makeSingleInstance doesn't work on travis Linux (or
    // at least this travis config).
    // Now it's stopped working on osx too, so it's disabled till someone complains.
    it('should only allow one instance to run');
  } else {
    it('should only allow one instance to run', function() {
      this.timeout(10000);

      app1 = spawnApp();
      app1pid = app1.pid;

      return new Promise(function(fulfill, reject) {
        var app1startup = function(buffer) {
          if (buffer.toString().includes("ready")) {
            app2 = spawnApp();
            app2pid = app2.pid;
            app2.on('exit', function(_code) { fulfill(true); });

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

    afterEach(function() {
      // Kill any processes spawned, and all their descendents.
      // app[12].kill doesn't work - it kills the node process, but its
      // descendants live on.
      if (app1pid) {
        tree_kill(app1pid);
      }
      if (app2pid) {
        tree_kill(app2pid);
      }

      // Only move on from this test when all the processes spawned are dead.
      // No longer sure if this is necessary, but keeping in case it is helping
      // with hard-to-debug errors in CI.
      return new Promise(function(resolve, _reject) {
        // resolve() if/when app2pid doesn't exist
        var waitapp2 = function() {
          if (app2pid) {
            setTimeout(callWhenDead(app2pid, resolve), 100);
          } else {
            resolve();
          }
        };

        // Once app1pid is gone, wait for app2pid
        if (app1pid) {
          setTimeout(callWhenDead(app1pid, waitapp2), 100);
        } else {
          waitapp2();
        }
      });
    });
  }
});
