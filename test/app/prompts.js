'use strict';
require('should');
const sinon = require('sinon');

require('./helper');

const prompts = require('../../src/prompts');

describe('Prompts', function() {
  describe('should trigger a prompt at the right time', function() {
    // We don't test this end-to-end. Spectron just isn't well
    // suited to it. Instead we have unit tests to check the right
    // looking calls are made at the right time.

    var start, sandbox;

    /**
     * Create the spectron instance
     */
    beforeEach(function() {
      sandbox = sinon.sandbox.create();
      sandbox.useFakeTimers(start);
    });

    /**
     * Clean up the spectron instance
     */
    afterEach(function() {
      sandbox.restore();
    });


    /**
     * Control when pings occur
     */
    before(function() {
      // pings ~= [<now throw(), now+1000, now+3000, now+4000, throw()]
      start = Date.now();

      global.pings = {};
      global.pings.next = sinon.stub().callsFake(function(time) {
        if (time < start) {
          throw("ping.next called with a time before start (" + start + "): " + time);
        } else if (time < start + 1000) {
          return start + 1000;
        } else if (time < start + 3000) {
          return start + 3000;
        } else if (time < start + 4000) {
          return start + 4000;
        } else {
          throw("ping.next called with a time after start+4000:" + time);
        }
      });
    });

    it('should not prompt before the first ping', function() {
      var promptsMock = sandbox.mock(prompts);
      var expectation = promptsMock.expects('openPrompt');
      expectation.never();

      prompts.schedulePings();
      sandbox.clock.tick(999);

      promptsMock.verify();
    });

    it('should prompt on the first ping', function() {
      var promptsMock = sandbox.mock(prompts);
      var expectation = promptsMock.expects('openPrompt');
      expectation.once();

      prompts.schedulePings();
      sandbox.clock.tick(1000);

      promptsMock.verify();
    });

    it('should prompt on each ping in the series', function() {
      var openPromptsStub = sandbox.stub(prompts, 'openPrompt');

      prompts.schedulePings();
      sandbox.clock.tick(1000);
      openPromptsStub.callCount.should.equal(1);
      sandbox.clock.tick(1000);
      openPromptsStub.callCount.should.equal(1);
      sandbox.clock.tick(1500);
      openPromptsStub.callCount.should.equal(2);
    });
  });
});
