import * as React from "react";
import * as renderer from "react-test-renderer";
const snapshot = require("snap-shot");
const should = require("should");

import { PrefGroup } from "../src/preferences";

const numPref = {
  configurable: true,
  label: "Configurable number field",
  name: "num",
  type: "number"
};
const datePref = {
  configurable: true,
  label: "Configurable datetime field",
  name: "n",
  type: "datetime-local"
};
const checkPref = {
  configurable: true,
  label: "Configurable checkbox field",
  name: "n",
  type: "checkbox"
};
const filePref = {
  configurable: true,
  label: "Static file field",
  name: "myfile",
  type: "file"
};
const nonConfigurablePref = {
  configurable: false,
  label: "Not configurable",
  name: "nothere",
  type: "input"
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
