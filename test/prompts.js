const should = require('should');
const sinon = require('sinon');
var Application = require('spectron').Application;

const prompts = require('../src/prompts');
const pings = require('../src/pings');
const {appPath, electronPath} = require('./helper');

process.env.NODE_ENV = 'test'; // suppress logging

describe('Prompts', function() {
  // We don't test this end-to-end. Spectron just isn't well
  // suited to it. Instead we check the right looking calls
  // are made at the right time.

  var pingStub, app, start, sandbox;

  /**
   * Create the spectron instance
   */
  beforeEach(function() {
    sandbox = sinon.sandbox.create();
    sandbox.useFakeTimers(start);
    app = new Application({path : electronPath, args : [ appPath ]});
    // don't start it - not all our tests involve spectron
  });

  /**
   * Clean up the spectron instance
   */
  afterEach(function() {
    sandbox.restore();
    if (app && app.isRunning()) {
      return app.stop();
    }
  });


  /**
   * Control when pings occur
   */
  before(function() {
    // pings ~= [<now throw(), now+1000, now+3000, now+4000, throw()]
    start = Date.now();

    pingStub = sinon.stub(pings, "next", function(time) {
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

  /**
   * Clean up the stubs
   */
  after(function() {
    pingStub.restore();
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
