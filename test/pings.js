var should = require('should');
var _ = require('lodash');
var stats = require("stats-lite");
const sinon = require('sinon');

const helper = require('./helper');

const pings = require('../src/pings');
var config = require('../src/config');

describe('Pings', function() {
  var time = config.epoch + 20000000; // close to the epoch speeds things up

  var stub;
  var currentConfig;

  // Stub out the config with a local in-memory copy
  // Ideally we'd want something like
  //   stub.withArgs('seed').returns(1)
  // whilst leaving the rest alone, but sinon doesn't support that:
  // https://github.com/sinonjs/sinon/pull/278
  beforeEach(function() {
    currentConfig = _.clone(config.defaultUserConf);
    stub = sinon.stub(config.user, 'get', function(key) {
      return currentConfig[key];
    });
  });
  afterEach(function() {
    stub.restore();
  });

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
  });

  describe('prev()', function() {
    it('should return a ping before the requested time',
       function() { pings.prev(time).should.be.lessThan(time); });
  });

  describe('next() & prev()', function() {
    it('should be idempotent', function() {
      ping = pings.next(time);
      pings.prev(pings.next(ping)).should.equal(ping);
    });
  });

  it('should return consistent answers when requesting an earlier time',
     function() {
       a = pings.next(time);
       b = pings.prev(a);
       c = pings.prev(b - 100000000);
       pings.next(time).should.equal(a);
     });

  it('should give different results for different seeds', function() {
    currentConfig['seed'] = 1;
    pings.reset();
    a = pings.next(time);

    currentConfig['seed'] = 2;
    pings.reset();
    pings.next(time).should.not.equal(a);
  });

  it('should give the same results for the same seeds', function() {
    currentConfig['seed'] = 3;
    pings.reset();
    a = pings.next(time);

    currentConfig['seed'] = 4;
    pings.reset();
    pings.next(time);

    currentConfig['seed'] = 3;
    pings.reset();
    pings.next(time).should.equal(a);
  });

  it('should have ping gaps with the mean and mode close to the period',
     function() {
       // https://en.wikipedia.org/wiki/Poisson_distribution#Mean

       this.timeout(10000); // When coverage instrumented, this is slooow

       // Fix the seed so we don't get spurious failures
       currentConfig['seed'] = 1;
       // a smaller period should lead to more collisions, so a better mode
       currentConfig['period'] = 3;
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

       console.log(Math.round(_.mean(gaps)));
       Math.round(_.mean(gaps))
           .should.be.approximately(config.period(),
                                    0.1 * config.period());

       mode = stats.mode(gaps);

       mode_matcher = function(mode) {
         (config.period() - mode)
           .should.be.approximately(config.period(),
               0.2 * config.period());
       };
       if (typeof mode !== "number") {
         // check that at least one matches
         Array.from(mode).should.matchAny(mode_matcher);
       } else {
         mode_matcher(mode);
       }
     });
});

