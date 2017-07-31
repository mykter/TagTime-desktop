const should = require('should');
const _ = require('lodash');
const tmp = require('tmp');
const fs = require('fs');

require('./helper');
const PingFile = require('../../src/pingfile');
const Ping = require('../../src/ping');

describe('PingFile', function() {
  describe('parse()', function() {
    it('should parse time-only entries', function() {
      var ping = new Ping(1487459622000, null, null);
      // use _.isEqual as it copes with Sets, whereas should.eql doesn't
      ['1487459622', '1487459622 ', '1487459622  '].forEach(function(entry) {
        _.isEqual(PingFile.parse(entry), ping).should.be.true();
      });
    });

    it('should reject times before the epoch',
       function() { should(PingFile.parse('1000000')).be.null(); });

    it('should reject entries without a timestamp',
       function() { should(PingFile.parse('1487459622x tag')).be.null(); });

    it('should reject entries with a broken comment',
       function() { should(PingFile.parse('1487459622 [half')).be.null(); });

    it('should parse a single tag', function() {
      var entries = [
        '1487459622 atag', '1487459622  atag', '1487459622\tatag', '1487459622 \tatag \t ',
        '1487459622      atag            '
      ];
      entries.forEach(function(entry) {
        PingFile.parse(entry).tags.size.should.equal(1);
        PingFile.parse(entry).tags.has('atag').should.be.true();
      });
    });

    it('should parse multiple tags (incl special chars)', function() {
      var tags = new Set([ 'one:', 't\'w\'o', 'th-ree', 'four,', 'fi;ve' ]);
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
      ["1487459622 tag [", "1487459622 tag[", "1487459622 [", "1487459622\t["].forEach(function(
          prefix) {
        [' hello\'"\t\t', '', '1'].forEach(function(comment) {
          PingFile.parse(prefix + comment + "]").comment.should.equal(comment);
        });
      });
    });
  });

  describe('encode()', function() {
    it('should throw on malformed pings', function() {
      [{}, {time : 1, tags : null, comment : null},
       {time : '1487459622000a', tags : null, comment : null},
       {time : 'a', tags : null, comment : null},
       {time : 1487459622000, tags : 'atag', comment : null}]
          .forEach(function(ping) { should(function() { PingFile.encode(ping); }).throw(); });
    });

    it('should encode a time only ping', function() {
      PingFile.encode({time : 1487459622000, tags : new Set(), comment : null}, false)
          .trim() // don't care
          .should.equal("1487459622");
    });

    it('should annotate pings', function() {
      // we don't know what timezone this is running in, so ignore that
      PingFile.encode({time : 1487459622000, tags : new Set(), comment : null})
          .should.match(/1487459622 \[2017-02-18T23:13:42\+\d\d:\d\d \w{3}\]/);
      PingFile.encode({time : 1487459622000, tags : new Set([ 1, 2, 'three' ]), comment : null})
          .should.match(/1487459622 1 2 three \[2017-02-18T23:13:42\+\d\d:\d\d \w{3}\]/);
      PingFile.encode({time : 1487459622000, tags : new Set(), comment : "hi"})
          .should.match(/1487459622 \[2017-02-18T23:13:42\+\d\d:\d\d \w{3} hi]/);
    });

    it('should encode tags', function() {
      PingFile.encode({time : 1487459622000, tags : new Set([ 1 ]), comment : null}, false)
          .should.equal("1487459622 1");
      PingFile
          .encode({time : 1487459622000, tags : new Set([ 1, 2, 'three' ]), comment : null}, false)
          .should.equal("1487459622 1 2 three");
      PingFile.encode({time : 1487459622000, tags : new Set([ 3, 2, 1 ]), comment : null}, false)
          .should.equal("1487459622 3 2 1");
      PingFile.encode({time : 1487459622000, tags : [ 1, 2 ], comment : null}, false)
          .should.equal("1487459622 1 2");
    });

    it('should pad tags to the specified width', function() {
      // include a comment otherwise the padding will be removed
      PingFile.encode({time : 1487459622000, tags : new Set([ 1 ]), comment : "hi"}, false, 40)
          .should.equal("1487459622 1" +
                        " ".repeat(39) + " [hi]");
    });
  });

  describe('get pings', function() {
    var f;
    var pf;
    beforeEach(function() {
      f = tmp.fileSync();
      pf = new PingFile(f.name, true);
    });
    afterEach(function() { f.removeCallback(); });

    var get = function(contents) {
      fs.writeSync(f.fd, contents);
      return pf.pings;
    };

    it('should parse an empty file', function() { get('').should.deepEqual([ null ]); });

    it('should parse a single entry', function() {
      var res = get('1487459622 1 2 three [2017-02-18T23:13:42+00:00 hi]');
      should(res[0].time).equal(1487459622000);
      should(res[0].comment).equal('2017-02-18T23:13:42+00:00 hi');
      _.isEqual(res[0].tags, new Set([ '1', '2', 'three' ])).should.be.true();
    });

    it('should parse a multiline file with invalid entries', function() {
      var res = get('header\n' +
                    '\n' +
                    '1487459622 1 2 three [2017-02-18T23:13:42+00:00 hi]\n' +
                    '123invalid tags\n' +
                    '1487459623 1 2 three [2017-02-18T23:13:42+00:00 hi]\n');
      should(res[0]).equal(null);
      should(res[1]).equal(null);
      should(res[2].time).equal(1487459622000);
      should(res[2].comment).equal('2017-02-18T23:13:42+00:00 hi');
      _.isEqual(res[2].tags, new Set([ '1', '2', 'three' ])).should.be.true();
      should(res[3]).equal(null);
      should(res[4].time).equal(1487459623000);
    });

    it('should ignore invalid entries when configured to do so', function() {
      pf.keep_invalid = false;
      var res = get('header\n' +
                    '\n' +
                    '1487459622 1 2 three [2017-02-18T23:13:42+00:00 hi]\n' +
                    '123invalid tags\n' +
                    '1487459623 1 2 three [2017-02-18T23:13:42+00:00 hi]\n');
      should(res[0].time).equal(1487459622000);
      should(res[0].comment).equal('2017-02-18T23:13:42+00:00 hi');
      _.isEqual(res[0].tags, new Set([ '1', '2', 'three' ])).should.be.true();
      should(res[1].time).equal(1487459623000);
    });
  });

  describe('push', function() {
    var pf;
    var f;
    var p = {time : 1487459622000, tags : new Set([ "one", "two" ]), comment : "c"};
    var pStr = "1487459622 one two [c]";
    var pAnnoStr = /1487459622 one two \[2017-02-18T23:13:42\+\d\d:\d\d \w{3} c]/;
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
      should(fs.readFileSync(f.name, 'utf8').trim()).equal(pStr);
      fs.unlinkSync(f.name);
    });

    it('should annotate pings', function() {
      pf.push(p);
      should(fs.readFileSync(f.name, 'utf8').trim()).match(pAnnoStr);
    });

    it('should append to existing files that don\'t end in \\n', function() {
      fs.writeSync(f.fd, "some stuff!");
      pf.push(p, false);
      should(fs.readFileSync(f.name, 'utf8').trim()).equal('some stuff!\n' + pStr);
    });

    it('should append to existing files that do end in \\n', function() {
      fs.writeSync(f.fd, "some stuff!\n");
      pf.push(p, false);
      should(fs.readFileSync(f.name, 'utf8').trim()).equal('some stuff!\n' + pStr);
    });
  });

  var testPush = function(caching) {
    var p = {time : 1487459622000, tags : new Set([ "one", "two" ]), comment : "c"};
    var f = tmp.fileSync();
    var pf = new PingFile(f.name, false, false, caching);
    pf.push(p, false);
    pf.push(p, false);
    pf.pings.should.have.length(2);
    pf.pings.forEach(function(ping) {
      should(ping.time).equal(p.time);
      _.isEqual(ping.tags, p.tags).should.be.true();
      should(ping.comment).equal(p.comment);
    });
    f.removeCallback();
  };
  it('get should return the pings pushed, without caching', function() { testPush(false); });
  it('get should return the pings pushed, with caching', function() { testPush(true); });

  describe('allTags', function() {
    var pf;
    var f;
    beforeEach(function() { f = tmp.fileSync(); });
    afterEach(function() { f.removeCallback(); });

    it('should return an empty set if there are no pings', function() {
      pf = new PingFile(f.name);
      _.isEqual(pf.allTags, new Set()).should.be.true();
    });

    var testAllTags = function(caching) {
      var pf = new PingFile(f.name, false, false, caching);
      pf.push({time : 1487459622000, tags : new Set([ "one" ]), comment : null});
      pf.push({time : 1487459623000, tags : new Set([ "one", "two" ]), comment : null});
      pf.push({time : 1487459624000, tags : new Set([ "three" ]), comment : null});
      return _.isEqual(pf.allTags, new Set([ "one", "two", "three" ])).should.be.true();
    };
    it('should return the set of recorded pings with caching',
       function() { return testAllTags(true); });
    it('should return the set of recorded pings without caching',
       function() { return testAllTags(false); });
  });
});
