import _ = require("lodash");
import should = require("should");
import stats = require("stats-lite");

import { PingTimes } from "../src/pingtimes";

describe("Pingtimes", function() {
  const time = PingTimes.epoch + 50000000; // close to the epoch speeds things up
  const notBefore = time - 10000000;
  let pings: PingTimes;

  beforeEach(function() {
    pings = new PingTimes(45 * 60 * 1000, 1, notBefore);
  });

  describe("next()", function() {
    it("should return a ping after the requested time", function() {
      pings.next(time).should.be.greaterThan(time);
    });

    it("should return a ping after the requested ping", function() {
      pings.next(pings.next(time)).should.be.greaterThan(pings.next(time));
    });

    it("should only generate pings on the second", function() {
      let next = time;
      for (let x = 1; x <= 50; x++) {
        next = pings.next(next);
        should(next % 1000).equal(0);
      }
    });

    it("should only return pings after startOfPings", function() {
      pings.next(PingTimes.epoch).should.be.greaterThan(notBefore);
    });
  });

  describe("prev()", function() {
    it("should return a ping before the requested time", function() {
      pings.prev(time)!.should.be.lessThan(time);
    });

    it("should not return pings before notBefore", function() {
      should(pings.prev(notBefore)).be.null();
    });
  });

  describe("next() & prev()", function() {
    it("should be idempotent", function() {
      const ping = pings.next(time);
      pings.prev(pings.next(ping))!.should.equal(ping);
    });
  });

  it("should return consistent answers when requesting an earlier time", function() {
    const a = pings.next(time);
    const b = pings.prev(a)!;
    pings.prev(b - 100000000);
    pings.next(time).should.equal(a);
  });

  it("should give different results for different seeds", function() {
    pings.seed = 1;
    pings.reset();
    const a = pings.next(time);

    pings.seed = 2;
    pings.reset();
    pings.next(time).should.not.equal(a);
  });

  it("should give the same results for the same seeds", function() {
    pings.seed = 3;
    pings.reset();
    const a = pings.next(time);

    pings.seed = 4;
    pings.reset();
    pings.next(time);

    pings.seed = 3;
    pings.reset();
    pings.next(time).should.equal(a);
  });

  it("should have ping gaps with the mean and mode close to the period", function() {
    // https://en.wikipedia.org/wiki/Poisson_distribution#Mean

    this.timeout(10000); // When coverage instrumented, this is slooow

    // Fix the seed so we don't get spurious failures
    pings.seed = 1;
    // a smaller period should lead to more collisions, so a better mode
    pings.period = 3 * 1000 * 60;
    pings.reset();

    // generate a bunch of pings, and record the gap between them
    const gaps = [];
    let prev = time;
    let next;
    for (let x = 1; x <= 2000; x++) {
      next = pings.next(prev);
      gaps.push(next - prev);
      prev = next;
    }

    // i_have_no_idea_what_im_doing_dog.gif

    Math.round(_.mean(gaps)).should.be.approximately(
      pings.period,
      0.1 * pings.period
    );

    const gapsMode = stats.mode(gaps);

    const modeMatcher = function(mode: number) {
      (pings.period - mode).should.be.approximately(
        pings.period,
        0.2 * pings.period
      );
    };
    if (typeof gapsMode !== "number") {
      // check that at least one matches
      Array.from(gapsMode).should.matchAny(modeMatcher);
    } else {
      modeMatcher(gapsMode);
    }
  });

  describe("backwards compatibility with original TagTime", function() {
    context("with the default seed", function() {
      beforeEach(function(){
        pings = new PingTimes(45 * 60 * 1000, 11193462 , PingTimes.epoch);
      });
      it("first ping should be reproduced", function() {
        const time = PingTimes.epoch+1;
        pings.next(time).should.be.equal(1184098754*1000);
      });
      it("ping in 2018 should be reproduced",function(){
        const time = 1543080000*1000;
        pings.next(time).should.be.equal(1543081241*1000);
      });
    });
    context("with different seed",function(){
      beforeEach(function(){
        pings = new PingTimes(45 * 60 * 1000, 123456, PingTimes.epoch);
      });
      it("first ping should be reproduced", function() {
        const time = PingTimes.epoch+1;
        pings.next(time).should.be.equal(1184097486*1000);
      });
      it("ping in 2018 should be reproduced",function(){
        const time = 1543080000*1000;
        pings.next(time).should.be.equal(1543080933*1000);
      });
    });
  });
});
