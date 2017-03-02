/**
 * @module A continuous sequence of ping times
 * Uses the global config to determine seed and period
 * Times are all javascript milliseconds
 */

'use strict';

var _ = require('lodash');
var Random = require('random-js');

var config = require('./config');

/**
 * The random number engine using this sequence's root seed
 */
var engine;
var rand;
/**
 * Re-initialise rand with the root seed
 */
var reseed = function() {
  /* NOTE: because we're using a different PRNG to original tagtime,
   * sequences generated from the same seed won't match up.
   * This doesn't matter - we never validate a logfile against the
   * expected ping sequence. Subsequent pings will continue to follow
   * the same distribution.
   * The only problem might arise if a user was very frequently swapping
   * between implementations?
   *
   * Seed with a 32bit integer
   */
  engine = Random.engines.mt19937().seed(config.user.get('seed'));
  /**
   * random number generator using the engine's seed
   * @returns {real} in [0,1]
   */
  rand = function() { return Random.real(0, 1)(engine); };
};

/**
 * Re-initialise module state, including config settings
 */
exports.reset = function() {
  period = config.period();
  reseed();
  _pings = undefined;
};

/**
 * The period for this sequence (independent of any changes to the config)
 * @type {time}
 */
var period;

/**
 * The list of pings since the earliest asked for.
 *
 * With a 45 minute period there have been roughly 100k pings since the tagtime
 * epoch. So we could store a list of all of them, but it's easy enough to only
 * store from the earliest we've been asked for (at the cost of having to
 * recompute them all if asked for an earlier one)
 */
var _pings;

/**
 * (side effect: updates the seed)
 * @param {pingtime} ping Previous ping
 * @returns {pingtime} The next ping time
 */
var nextPing = function(ping) {
  // Add a random number drawn from an exponential distribution with mean period
  var gap = -1 * period * Math.log(rand());
  // Round gaps of <1s up to 1s, and only add a whole number of seconds
  return ping + Math.max(1000, 1000 * Math.round(gap/1000));
};

/**
 * @param {time} time
 * @returns {int} the index into _pings of the ping preceding time
 * Side effect: the next ping is present at the next index in _pings
 */
var prevPingIndex = function(time) {
  if (!_pings || time < _pings[0]) {
    // we don't have a record of a ping this early
    exports.reset();
    var prev = config.epoch;
    var nxt = prev;
    while (nxt < time) {
      prev = nxt;
      nxt = nextPing(prev);
    }
    _pings = [ prev, nxt ];
  }

  // grow _pings as needed until we have a ping after time
  while (_pings[_pings.length - 1] <= time) {
    _pings.push(nextPing(_pings[_pings.length - 1]));
  }

  /**
   *  @returns {bool} true if e is not before time
   *  @param {time} e
   */
  var timeOrLater = function(e) { return e >= time; };

  // the index of the ping before the first ping later than time
  return _pings.findIndex(timeOrLater) - 1;
};

/**
 * @param {time} time - point in time after epoch
 * @return {pingtime} The ping that preceded time
 */
exports.prev = function(time) { return _pings[prevPingIndex(time)]; };

/**
 * @param {time} time - reference point in time
 * @returns {pingtime} the ping that follows time
 */
exports.next = function(time) {
  var idx = prevPingIndex(time) + 1;
  // if time was a ping, then next(prev(ping)) === ping, which isn't what we want
  if (_pings[idx] === time) {
    idx += 1;
  }
  return _pings[idx];
};
