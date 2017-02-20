const should = require('should');
const _ = require('lodash');
const tmp = require('tmp');
const fs = require('fs');

process.env.NODE_ENV = 'test'; // suppress logging

describe('PingFile', function() {
  var PingFile = require('../src/pingfile');

  describe('parse()', function() {
    it('should parse time-only entries', function() {
      ping = {time : 1487459622, tags : new Set(), comment : null};
      // use _.isEqual as it copes with Sets, whereas should.eql doesn't
      ['1487459622', '1487459622 ', '1487459622  '].forEach(function(entry) {
        _.isEqual(PingFile.parse(entry), ping).should.be.true();
      });
    });

    it('should reject times before the epoch', function() {
      // use _.isEqual as it copes with Sets, whereas should.eql doesn't
      should(PingFile.parse('1000000')).be.null();
    });

    it('should reject entries without a timestamp',
       function() { should(PingFile.parse('1487459622x tag')).be.null(); });

    it('should reject entries with a broken comment',
       function() { should(PingFile.parse('1487459622 [half')).be.null(); });

    it('should parse a single tag', function() {
      ping = {time : 1487459622, tags : new Set([ 'atag' ]), comment : null};
      var entries = [
        '1487459622 atag', '1487459622  atag', '1487459622\tatag',
        '1487459622 \tatag \t ', '1487459622      atag            '
      ];
      entries.forEach(function(entry) {
        PingFile.parse(entry).tags.size.should.equal(1);
        PingFile.parse(entry).tags.has('atag').should.be.true();
      });
    });

    it('should parse multiple tags (incl special chars)', function() {
      var tags = new Set([ 'one:', 't\'w\'o', 'th-ree', 'four,', 'fi;ve' ]);
      ping = {time : 1487459622, tags : tags, comment : null};
      var entries = [
        // vanilla
        '1487459622 one: t\'w\'o th-ree four, fi;ve',
        // re-ordered + spaces
        '1487459622 \t \tt\'w\'o\tth-ree\tone:  four, fi;ve        ',
      ];
      entries.forEach(function(entry) {
        PingFile.parse(entry).tags.size.should.equal(5);
        _.isEqual(PingFile.parse(entry).tags, tags).should.be.true();
      });
    });

    it('should parse comments (with or without tags)', function() {
      ["1487459622 tag [", "1487459622 tag[", "1487459622 [", "1487459622\t["]
          .forEach(function(prefix) {
            [' hello\'"\t\t', '', '1'].forEach(function(comment) {
              should(PingFile.parse(prefix + comment + "]")).containEql({
                comment : comment
              });
            });
          });
    });
  });

  describe('encode()', function() {
    it('should throw on malformed pings', function() {
      [{}, {time : 1, tags : null, comment : null},
       {time : '1487459622a', tags : null, comment : null},
       {time : 'a', tags : null, comment : null},
       {time : 1487459622, tags : 'atag', comment : null}]
          .forEach(function(ping) {
            should(function() { PingFile.encode(ping); }).throw();
          });
    });

    it('should encode a time only ping', function() {
      PingFile
          .encode({time : 1487459622, tags : new Set(), comment : null}, false)
          .trim() // don't care
          .should.equal("1487459622");
    });

    it('should annotate pings', function() {
      // we don't know what timezone this is running in, so ignore that
      PingFile.encode({time : 1487459622, tags : new Set(), comment : null})
          .should.match(/1487459622 \[2017-02-18T23:13:42\+\d\d:\d\d\]/);
      PingFile
          .encode({
            time : 1487459622,
            tags : new Set([ 1, 2, 'three' ]),
            comment : null
          })
          .should.match(
              /1487459622 1 2 three \[2017-02-18T23:13:42\+\d\d:\d\d\]/);
      PingFile.encode({time : 1487459622, tags : new Set(), comment : "hi"})
          .should.match(/1487459622 \[2017-02-18T23:13:42\+\d\d:\d\d\ hi]/);
    });

    it('should encode tags', function() {
      PingFile
          .encode({time : 1487459622, tags : new Set([ 1 ]), comment : null},
                  false)
          .should.equal("1487459622 1");
      PingFile
          .encode({
            time : 1487459622,
            tags : new Set([ 1, 2, 'three' ]),
            comment : null
          },
                  false)
          .should.equal("1487459622 1 2 three");
      PingFile
          .encode(
              {time : 1487459622, tags : new Set([ 3, 2, 1 ]), comment : null},
              false)
          .should.equal("1487459622 3 2 1");
      PingFile
          .encode({time : 1487459622, tags : [ 1, 2 ], comment : null}, false)
          .should.equal("1487459622 1 2");
    });
  });

  describe('get pings', function() {
    var f;
    var pf;
    beforeEach(function() {
      f = tmp.fileSync();
      pf = new PingFile(f.name);
    });
    afterEach(function() { f.removeCallback(); });

    var get = function(contents) {
      fs.writeSync(f.fd, contents);
      return pf.pings;
    };

    it('should parse an empty file',
       function() { get('').should.deepEqual([ null ]); });

    it('should parse a single entry', function() {
      res = get('1487459622 1 2 three [2017-02-18T23:13:42+00:00 hi]');
      should(res[0].time).equal(1487459622);
      should(res[0].comment).equal('2017-02-18T23:13:42+00:00 hi');
      _.isEqual(res[0].tags, new Set([ '1', '2', 'three' ])).should.be.true();
    });

    it('should parse a multiline file with invalid entries', function() {
      res = get('header\n' +
                '\n' +
                '1487459622 1 2 three [2017-02-18T23:13:42+00:00 hi]\n' +
                '123invalid tags\n' +
                '1487459623 1 2 three [2017-02-18T23:13:42+00:00 hi]\n');
      should(res[0]).equal(null);
      should(res[1]).equal(null);
      should(res[2].time).equal(1487459622);
      should(res[2].comment).equal('2017-02-18T23:13:42+00:00 hi');
      _.isEqual(res[2].tags, new Set([ '1', '2', 'three' ])).should.be.true();
      should(res[3]).equal(null);
      should(res[4].time).equal(1487459623);
    });
  });

  describe('push', function() {
    var pf;
    var f;
    var p = {
      time : 1487459622,
      tags : new Set([ "one", "two" ]),
      comment : "c"
    };
    var p_str = "1487459622 one two [c]";
    var p_anno_str = /1487459622 one two \[2017-02-18T23:13:42\+\d\d:\d\d\ c]/;
    beforeEach(function() {
      f = tmp.fileSync();
      pf = new PingFile(f.name);
    });
    afterEach(function() { f.removeCallback(); });

    it('should throw on an invalid ping',
       function() { should(function() { pf.push({}); }).throw(); });

    it('should create a non-existent file', function() {
      f.removeCallback();
      pf.push(p, false);
      should(fs.readFileSync(f.name, 'utf8').trim()).equal(p_str);
      fs.unlinkSync(f.name);
    });

    it('should annotate pings', function() {
      pf.push(p);
      should(fs.readFileSync(f.name, 'utf8').trim()).match(p_anno_str);
    });

    it('should append to existing files that don\'t end in \\n', function() {
      fs.writeSync(f.fd, "some stuff!");
      pf.push(p, false);
      should(fs.readFileSync(f.name, 'utf8').trim())
          .equal('some stuff!\n' + p_str);
    });

    it('should append to existing files that do end in \\n', function() {
      fs.writeSync(f.fd, "some stuff!\n");
      pf.push(p, false);
      should(fs.readFileSync(f.name, 'utf8').trim())
          .equal('some stuff!\n' + p_str);
    });
  });

  it('get should return the pings pushed', function() {
    var f = tmp.fileSync();
    var pf = new PingFile(f.name);
    var p = {
      time : 1487459622,
      tags : new Set([ "one", "two" ]),
      comment : "c"
    };
    pf.push(p, false);
    pf.push(p, false);
    pf.pings.should.have.length(2);
    pf.pings.forEach(function(ping) {
      should(ping.time).equal(p.time);
      _.isEqual(ping.tags, p.tags).should.be.true();
      should(ping.comment).equal(p.comment);
    });

    f.removeCallback();
  });
});
