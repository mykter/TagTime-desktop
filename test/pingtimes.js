'use strict';
const should = require('should');
const _ = require('lodash');
const stats = require("stats-lite");

const PingTimes = require('../src/pingtimes');

describe('Pings', function() {
  const time = PingTimes.epoch + 30000000; // close to the epoch speeds things up
  const notBefore = time - 10000000;
  var pings;

  beforeEach(function() { pings = new PingTimes(45 * 60 * 1000, 1, notBefore); });

  describe('next()', function() {
    it('should return a ping after the requested time',
       function() { pings.next(time).should.be.greaterThan(time); });

    it('should return a ping after the requested ping',
       function() { pings.next(pings.next(time)).should.be.greaterThan(pings.next(time)); });

    it('should only generate pings on the second', function() {
      var next = time;
      for (var x = 1; x <= 50; x++) {
        next = pings.next(next);
        should(next % 1000).equal(0);
      }
    });

    it('should only return pings after startOfPings',
       function() { pings.next(PingTimes.epoch).should.be.greaterThan(notBefore); });
  });

  describe('prev()', function() {
    it('should return a ping before the requested time',
       function() { pings.prev(time).should.be.lessThan(time); });

    it('should not return pings before notBefore',
       function() { should(pings.prev(notBefore)).be.null; });
  });

  describe('next() & prev()', function() {
    it('should be idempotent', function() {
      var ping = pings.next(time);
      pings.prev(pings.next(ping)).should.equal(ping);
    });
  });

  it('should return consistent answers when requesting an earlier time', function() {
    var a = pings.next(time);
    var b = pings.prev(a);
    pings.prev(b - 100000000);
    pings.next(time).should.equal(a);
  });

  it('should give different results for different seeds', function() {
    pings.seed = 1;
    pings.reset();
    var a = pings.next(time);

    pings.seed = 2;
    pings.reset();
    pings.next(time).should.not.equal(a);
  });

  it('should give the same results for the same seeds', function() {
    pings.seed = 3;
    pings.reset();
    var a = pings.next(time);

    pings.seed = 4;
    pings.reset();
    pings.next(time);

    pings.seed = 3;
    pings.reset();
    pings.next(time).should.equal(a);
  });

  it('should have ping gaps with the mean and mode close to the period', function() {
    // https://en.wikipedia.org/wiki/Poisson_distribution#Mean

    this.timeout(10000); // When coverage instrumented, this is slooow

    // Fix the seed so we don't get spurious failures
    pings.seed = 0;
    // a smaller period should lead to more collisions, so a better mode
    pings.period = 3 * 1000 * 60;
    pings.reset();

    // generate a bunch of pings, and record the gap between them
    var gaps = [];
    var prev = time;
    var next;
    for (var x = 1; x <= 2000; x++) {
      next = pings.next(prev);
      gaps.push(next - prev);
      prev = next;
    }

    // i_have_no_idea_what_im_doing_dog.gif

    Math.round(_.mean(gaps)).should.be.approximately(pings.period, 0.1 * pings.period);

    var mode = stats.mode(gaps);

    var mode_matcher = function(mode) {
      (pings.period - mode).should.be.approximately(pings.period, 0.2 * pings.period);
    };
    if (typeof mode !== "number") {
      // check that at least one matches
      Array.from(mode).should.matchAny(mode_matcher);
    } else {
      mode_matcher(mode);
    }
  });
});
