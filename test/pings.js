var should = require('should');
var _ = require('lodash');
var stats = require("stats-lite");

const pings = require('../pings');
var config = require('../config');

describe('Pings', function() {
  var time = 1300000000;

  describe('next()', function() {
    it('should return a ping after the requested time',
       function() { pings.next(time).should.be.greaterThan(time); });
  });

  describe('prev()', function() {
    it('should return a ping before the requested time',
       function() { pings.prev(time).should.be.lessThan(time); });
  });

  describe('next() & prev()', function() {
    it('should be idempotent', function() {
      ping = pings.next(time);
      debugger;
      pings.prev(pings.next(ping)).should.equal(ping);
    });
  });

  it('should return consistent answers when requesting an earlier time',
     function() {
       a = pings.next(time);
       b = pings.prev(a);
       c = pings.prev(b - 100000);
       pings.next(time).should.equal(a);
     });

  it('should give different results for different seeds', function() {
    config.seed = 1;
    pings.reset();
    a = pings.next(time);

    config.seed = 2;
    pings.reset();
    pings.next(time).should.not.equal(a);
  });

  it('should give the same results for the same seeds', function() {
    config.seed = 3;
    pings.reset();
    a = pings.next(time);

    config.seed = 4;
    pings.reset();
    pings.next(time);

    config.seed = 3;
    pings.reset();
    pings.next(time).should.equal(a);
  });

  it('should have ping gaps with the mean and mode close to the period', function() {
		// https://en.wikipedia.org/wiki/Poisson_distribution#Mean

		// a smaller period should require a smaller sample for the same error margin?
		config.period = 5*60; 
		pings.reset();

		// generate a bunch of pings, and record the gap between them
		var gaps = [];
		var prev = pings.epoch + 10000; // speed things up a little
		var next;
		for (var x = 1; x<=5000; x++) {
			next = pings.next(prev);
			gaps.push(next - prev);
			prev = next;
		}

		// i_have_no_idea_what_im_doing_dog.gif
    debugger;

    Math.round(_.mean(gaps)).should.be.approximately(config.period, 0.05 * config.period);

		mode = stats.mode(gaps);
		if (typeof mode != "number") { mode = mode[0]; } // pick an arbitrary one
    (config.period - mode).should.be.approximately(config.period-1, 0.1 * config.period); 
  });
});

