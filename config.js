'use strict';

const winston = require('winston');
winston.level = 'debug';
if (process.env.NODE_ENV === 'test') {
  /* don't pollute test console output with anything except errors,
     which shouldn't be triggerable via module APIs.
     Send logs to a temporary file instad.
     Requires tests to set NODE_ENV.
     Requires all modules to import config - dubious, but they probably will
  */
  var tmp = require('tmp');
  var logfile = tmp.tmpNameSync();
  winston.info("Test mode log config - only errors to console, all to " + logfile);
  winston.configure({
    transports : [
      new (winston.transports.File)({filename : logfile, json : false}),
      new (winston.transports.Console)({level : 'error'})
    ]
  });
}

const path = require('path');

/**
 * The birth of timepie/tagtime!
 * Treat as const
 * The first ping in all sequences is on the epoch.
 */
exports.epoch = 1184083200;

/** @type {seconds} */
exports.period = 45*60;

/** The seed for the ping sequence */
exports.seed = 666;

// var someObj = JSON.parse(fs.readFileSync(path, {encoding: "utf8"}))
// fs.writeFileSync(path, JSON.stringify(someObj)});
