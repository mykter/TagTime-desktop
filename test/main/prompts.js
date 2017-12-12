"use strict";
// Conversion to TypeScript is tricky - lots of incomplete mocks

const should = require("should");
const sinon = require("sinon");
const tmp = require("tmp");

require("./helper");

const prompts = require("../../src/main-process/prompts");
const { Ping } = require("../../src/ping");
const { PingFile } = require("../../src/main-process/pingfile");
const { PingTimes } = require("../../src/pingtimes");

describe("Prompts", function() {
  it("should save a ping correctly", function() {
    global.pingFile = { push: sinon.spy() };
    let ping = new Ping(1234567890, ["tag1", "tag2"], "comment");

    // Note: doesn't test the ipc component, not obvious how to send a message
    // from here to ipcMain. Maybe mock ipcMain? Or just rely on e2e tests.
    prompts.savePing(null, { ping: ping, message: null });

    global.pingFile.push.calledOnce.should.be.true();
    global.pingFile.push.calledWith(ping).should.be.true();
  });

  describe("ping catchup", function() {
    let f;
    let pf;
    const time = PingTimes.epoch + 30000000;
    const cancelTags = ["cancel", "tags"];
    beforeEach(function() {
      f = tmp.fileSync();
      pf = new PingFile(f.name);
      global.pingFile = pf;
      global.pings = new PingTimes(45, 0, null);
      global.config = { user: { get: _item => cancelTags } }; // prompts needs to get the cancelTags config
    });
    afterEach(function() {
      f.removeCallback();
    });

    it("should not add pings if there is nothing to catch up on", function() {
      pf.push(new Ping(time, null, null));
      should(prompts.catchUp(time)).be.false();
      pf.pings.length.should.equal(1);
    });

    it("should not add pings to an empty ping file", function() {
      should(prompts.catchUp(time)).be.false();
      pf.pings.length.should.equal(0);
    });

    it("should add pings if they are missing", function() {
      pf.push(new Ping(time, "", ""));
      should(prompts.catchUp(global.pings.next(time))).be.true();
      pf.pings.length.should.equal(2);
      pf.pings[1].tags.should.deepEqual(new Set(cancelTags));
    });
  });

  describe("should trigger a prompt at the right time", function() {
    // We don't test this end-to-end. Spectron just isn't well
    // suited to it. Instead we have unit tests to check the right
    // looking calls are made at the right time.

    let start, sandbox;

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
          throw "ping.next called with a time before start (" + start + "): " + time;
        } else if (time < start + 1000) {
          return start + 1000;
        } else if (time < start + 3000) {
          return start + 3000;
        } else if (time < start + 4000) {
          return start + 4000;
        } else {
          throw "ping.next called with a time after start+4000:" + time;
        }
      });
    });

    it("should not prompt before the first ping", function() {
      let promptsMock = sandbox.mock(prompts);
      let expectation = promptsMock.expects("openPrompt");
      expectation.never();

      prompts.schedulePings();
      sandbox.clock.tick(999);

      promptsMock.verify();
    });

    it("should prompt on the first ping", function() {
      let onPing = sandbox.stub();

      prompts.schedulePings(onPing);
      sandbox.clock.tick(1000);

      should(onPing.calledOnce).be.true();
    });

    it("should prompt on each ping in the series", function() {
      let openPromptsStub = sandbox.stub();

      prompts.schedulePings(openPromptsStub);
      sandbox.clock.tick(1000);
      openPromptsStub.callCount.should.equal(1);
      sandbox.clock.tick(1000);
      openPromptsStub.callCount.should.equal(1);
      sandbox.clock.tick(1500);
      openPromptsStub.callCount.should.equal(2);
    });
  });
});
