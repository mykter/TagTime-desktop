"use strict";
// Conversion to TypeScript is tricky - lots of incomplete mocks

const sinon = require("sinon");

const main = require("../../src/main-process/main");
const prompts = require("../../src/main-process/prompts");
const edit = require("../../src/main-process/edit");

require("./helper");

describe("Main", function() {
  let sandbox;

  beforeEach(function() {
    sandbox = sinon.createSandbox();
    global.config = { user: { get: null } }; // placeholder to be setup as required in individual tests
  });
  afterEach(function() {
    sandbox.restore();
  });

  // Prompts.catchUp is separately tested, so just make sure it gets called
  it("should catch up on missed pings", function() {
    sandbox.stub(prompts, "catchUp");
    global.config.user.get = _item => false; // don't open an editor
    main.catchUp();
    sinon.assert.calledOnce(prompts.catchUp);
  });

  it("should respect the configuration of whether to open an editor on startup if pings are missing", function() {
    sandbox.stub(edit, "openEditor");
    sandbox.stub(prompts, "catchUp").returns(true);
    global.config.user.get = _item => true; // Configured to open editor on missed pings on startup

    main.catchUp();
    sinon.assert.calledOnce(edit.openEditor);

    global.config.user.get = _item => false; // Configured to open editor on missed pings on startup
    main.catchUp();
    sinon.assert.calledOnce(edit.openEditor); // still only once
  });
});
