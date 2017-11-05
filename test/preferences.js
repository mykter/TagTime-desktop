import * as React from "react";
import * as renderer from "react-test-renderer";
const snapshot = require("snap-shot");
const should = require("should");

import { PrefGroup } from "../src/preferences";

const numPref = {
  name: "num",
  type: "number",
  label: "Configurable number field",
  configurable: true
};
const datePref = {
  name: "n",
  type: "datetime-local",
  label: "Configurable datetime field",
  configurable: true
};
const checkPref = {
  name: "n",
  type: "checkbox",
  label: "Configurable checkbox field",
  configurable: true
};
const filePref = {
  name: "myfile",
  type: "file",
  label: "Static file field",
  configurable: true
};
const nonConfigurablePref = {
  name: "nothere",
  type: "input",
  label: "Not configurable",
  configurable: false
};

describe("PrefGroup", function() {
  let runTest = pref => {
    const component = renderer.create(<PrefGroup pref={pref} />);
    let tree = component.toJSON();
    snapshot(tree);
  };
  it("should render a number field that matches the snapshot", function() {
    runTest(numPref);
  });
  it("should render a date field that matches the snapshot", function() {
    runTest(datePref);
  });
  it("should render a checkbox that matches the snapshot", function() {
    runTest(checkPref);
  });
  it("should render a file field that matches the snapshot", function() {
    runTest(filePref);
  });
  it("should not render a pref that isn't configurable", function() {
    const component = renderer.create(<PrefGroup pref={nonConfigurablePref} />);
    should(component.toJSON()).be.null();
  });
});
