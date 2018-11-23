/**
 * @module A continuous sequence of ping times
 * Uses the global config to determine seed and period
 * Times are all javascript milliseconds
 */

import * as moment from "moment";
import { RandomGenerator } from "./randomgenerator"

type UnixTime = number;
export class PingTimes {
  /**
   * The birth of tagtime.
   * The earliest possible ping in any sequence is on the epoch.
   */
  public static epoch: UnixTime = 1184097393 * 1000;

  public period: number;
  public seed: number;
  private startOfPings: UnixTime;

  /**
   * The list of pings since the earliest asked for.
   *
   * With a 45 minute period there have been roughly 100k pings since the tagtime
   * epoch. So we could store a list of all of them, but it's easy enough to only
   * store from the earliest we've been asked for (at the cost of having to
   * recompute them all if asked for an earlier one)
   */
  private pings: UnixTime[] = [];

  private engine: RandomGenerator = new RandomGenerator();

  /**
   * @param {integer} period The mean period in milliseconds
   * @param {integer} seed The seed for the random number generator
   * @param {time} startOfPings The time after which pings in this sequence begin. A local epoch.
   */
  constructor(period: number, seed: number, startOfPings: UnixTime) {
    this.period = period;
    this.seed = seed;
    if (startOfPings) {
      this.startOfPings = moment(startOfPings).valueOf();
    } else {
      this.startOfPings = PingTimes.epoch;
    }
  }

  /**
   * Re-initialise module state. Only public for tests.
   */
  public reset() {
    this.reseed();
    this.pings = [];
  }

  /**
   * @param {time} time - point in time after epoch
   * @return {pingtime} The ping that preceded time or null if this ping would be before startOfPings
   * Only public for tests.
   */
  public prev(time: UnixTime): UnixTime | null {
    const idx = this.prevPingIndex(time);
    const pingTime = this.pings[idx];
    if (pingTime < this.startOfPings) {
      return null;
    } else {
      return pingTime;
    }
  }

  /**
   * @param {time} time - reference point in time
   * @returns {pingtime} the ping that follows time
   */
  public next(time: UnixTime): UnixTime {
    time = Math.max(time, this.startOfPings); // skip to startOfPings

    let idx = this.prevPingIndex(time) + 1;
    // if time was a ping, then next(prev(ping)) === ping, which isn't what we
    // want
    if (this.pings[idx] === time) {
      idx += 1;
    }
    return this.pings[idx];
  }

  /**
   * Re-initialise rand with the root seed
   */
  private reseed() {
    this.engine.setSeed(this.seed);
  }

  /**
   * random number generator using the engine's seed
   * @returns {real} in [0,1]
   */
  private rand(): number {
    if (!this.engine) {
      this.reseed();
    }
    return this.engine.ran0();
  }

  /**
   * (side effect: updates the seed)
   * @param {pingtime} ping Previous ping
   * @returns {pingtime} The next ping time
   */
  private nextPing(ping: UnixTime): UnixTime {
    // Add a random number drawn from an exponential distribution with mean
    // period
    const gap = -1 * this.period * Math.log(this.rand());
    // Round gaps of <1s up to 1s, and only add a whole number of seconds
    return ping + Math.max(1000, 1000 * Math.round(gap / 1000));
  }

  /**
   * @param {time} time
   * @returns {int} the index into this.pings of the ping preceding time
   * Side effect: the next ping is present at the next index in this.pings
   */
  private prevPingIndex(time: UnixTime): number {
    if (!this.pings || this.pings.length === 0 || time < this.pings[0]) {
      // we don't have a record of a ping this early
      this.reset();
      let prev = PingTimes.epoch;
      let nxt = prev;
      while (nxt < time) {
        prev = nxt;
        nxt = this.nextPing(prev);
      }
      this.pings = [prev, nxt];
    }

    // grow this.pings as needed until we have a ping after time
    while (this.pings[this.pings.length - 1] <= time) {
      this.pings.push(this.nextPing(this.pings[this.pings.length - 1]));
    }

    const timeOrLater = (e: UnixTime): boolean => {
      return e >= time;
    };

    // the index of the ping before the first ping later than time
    return this.pings.findIndex(timeOrLater) - 1;
  }
}
