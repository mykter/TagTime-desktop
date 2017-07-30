'use strict';
require('should');
const tmp = require('tmp');
const _ = require('lodash');
const fs = require('fs');
const winston = require('winston');

const helper = require('./helper');

const pingFile = require('../../src/pingfile');

describe('Prompts', function() {
  winston.level = 'warning';
  this.timeout(10000);
  this.retries(3); // had an occasion where appveyor test transiently failed.

  var Application = require('spectron').Application;
  var app;
  var tmpPingFileName;

  beforeEach(function() {
    tmpPingFileName = tmp.tmpNameSync();
    var tmpLogFileName = tmp.tmpNameSync();
    winston.debug("Logging to " + tmpLogFileName);
    // As the pingfile changes for each test, need to recreate the app each test
    app = new Application({
      path : helper.electronPath,
      args : [
        helper.appPath, "--test", "prompt", "--pingfile", tmpPingFileName, "--logfile",
        tmpLogFileName, "--verbose", "--configdir", helper.createConfig()
      ]
    });

    return app.start();
  });

  afterEach(function() {
    // spectron struggles if the window has closed already
    // https://github.com/electron/spectron/issues/101
    // So we have the app quit when all the windows close in test mode, rather
    // than trying to stop it here.
  });

  it('should open a window', function() {
    app.client.waitUntilWindowLoaded().getWindowCount().should.eventually.equal(1);

    return app.stop();
  });

  it('should save a ping with tags separated by spaces and commas, closing the window when done',
     async function() {
       // There are two input elements in the div
       const inputSelector = '.bootstrap-tagsinput input.tt-input';
       await app.client.waitUntil(function() { return app.client.hasFocus(inputSelector); });
       await app.client.element(inputSelector).setValue('tag1 tag2, tag3');
       await app.client.click('#save');

       // As the app is gone, verify the pingfile separately.
       // Note that writeSync doesn't do synchronous file i/o, so there's no
       // guarantee the pingfile exists yet! See
       // http://www.daveeddy.com/2013/03/26/synchronous-file-io-in-nodejs/

       // So it's race central. fs.watchFile looks like a solution, but what if the app has finished
       // writing before the watcher starts? So manually check to see if the file has any data in
       // it.
       await new Promise(function(resolve, _reject) {
         var check = function() {
           if (fs.statSync(tmpPingFileName).size > 0) {
             resolve();
           } else {
             setTimeout(check, 200);
           }
         };
         setTimeout(check, 200);
       });
       const pings = new pingFile(tmpPingFileName).pings;
       pings.length.should.equal(1);
       _.isEqual(pings[0].tags, new Set([ 'tag1', 'tag2', 'tag3' ])).should.equal(true);
     });
});
