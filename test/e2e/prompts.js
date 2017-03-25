'use strict';
const should = require('should');
const sinon = require('sinon');

const helper = require('./helper');

describe('Prompts', function() {
  describe('should render correctly', function() {
    this.timeout(10000);

    var Application = require('spectron').Application;

    beforeEach(function() {
      this.app = new Application({
        path : helper.electronPath,
        args : [ helper.appPath, "--test", "prompt" ]
      });
      return this.app.start();
    });

    afterEach(function() {
      if (this.app && this.app.isRunning()) {
        return this.app.stop();
      }
    });

    it('should open a window', function() {
      return this.app.client.getWindowCount().then(function(count) {
        count.should.equal(1);
      });
    });

  });
});