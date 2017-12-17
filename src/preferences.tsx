import * as React from "react";
import * as ReactDOM from "react-dom";
import { ipcRenderer, remote } from "electron";
import { ConfigDict, ConfigPref, ConfigName } from "./main-process/config";

interface PrefGroupProps {
  setValue: (name: string, value: any) => void;
  pref: ConfigPref;
  value: any;
}

enum ValueKey {
  value = "value",
  checked = "checked"
}

export const PrefGroup = (props: PrefGroupProps) => {
  // Return an input element for pref, with value= or checked= as specified in valKey
  const inputElement = (valKey: ValueKey, isFormControl: boolean, readOnly = false) => {
    let inProps: { [index: string]: any; className?: string; value?: any; checked?: boolean } = {};
    inProps[valKey] = props.value;
    if (isFormControl) {
      inProps["className"] = "form-control";
    }

    let type;
    switch (props.pref.type) {
      case "file": {
        type = "input";
        inProps["className"] =
          ("className" in inProps ? inProps["className"] + " " : "") + "file-input";
        break;
      }
      case "tags": {
        type = "input";
        break;
      }
      default: {
        type = props.pref.type;
      }
    }

    return (
      <input
        readOnly={readOnly}
        name={props.pref.name}
        type={type}
        onChange={onChange}
        {...inProps}
      />
    );
  };

  // Open a file select dialog and set the path via the callback
  const openFile = () => {
    const fileNames = remote.dialog.showOpenDialog({
      properties: ["openFile", "showHiddenFiles", "promptToCreate"]
    });

    if (fileNames === undefined) {
      return;
    } else {
      sendValue(fileNames[0]);
    }
  };

  const onChange = (event: React.ChangeEvent<any>) => {
    sendValue(event.target.value, event.target.checked);
  };

  // convert the value to its appropriate type and trigger the setValue callback
  const sendValue = (value: any, checked?: boolean) => {
    switch (props.pref.type) {
      case "checkbox": // on / off
        value = checked;
        break;
      case "number":
        if (value === "") {
          value = null;
        } else {
          value = Number(value);
        }
        break;
      case "datetime-local":
        if (value === "") {
          value = null;
        }
        break;
      case "tags":
        value = value.split(" ,");

      /*
      case "file":
      case "input":
      */
    }
    props.setValue(props.pref.name, value);
  };

  if (!props.pref.configurable) {
    return null;
  }

  let afterLabel, inLabel;
  switch (props.pref.type) {
    case "checkbox":
      inLabel = inputElement(ValueKey.checked, false);
      break;
    case "file":
      afterLabel = (
        <div>
          {inputElement(ValueKey.value, false)}
          <button
            type="button" // don't submit on click
            className="file-btn btn btn-large btn-default pull-right"
            onClick={openFile}
          >
            ...
          </button>
        </div>
      );
      break;
    default:
      afterLabel = inputElement(ValueKey.value, true);
  }

  return (
    <div className="form-group">
      <label>
        {inLabel}
        {props.pref.label}
      </label>
      {afterLabel}
    </div>
  );
};

interface PrefsProps {
  values: ConfigDict;
  prefs: ConfigPref[];
}

export class Prefs extends React.Component<PrefsProps, ConfigDict> {
  constructor(props: PrefsProps) {
    super(props);

    // React doesn't like input elements to be assigned null values
    let values = {} as ConfigDict;
    Object.keys(props.values).map((key, _index) => {
      values[key] = props.values[key] === null ? "" : props.values[key];
    });
    this.state = values;

    document.addEventListener("keyup", e => {
      if (e.key === "Escape") {
        this.cancel();
      }
    });

    // These bindings are necessary to make `this` work in the callback
    this.handleInputChange = this.handleInputChange.bind(this);
    this.cancel = this.cancel.bind(this);
    this.save = this.save.bind(this);
  }

  handleInputChange(name: string, value: any) {
    this.setState({ [name]: value });
  }

  cancel() {
    remote.getCurrentWindow().close();
  }
  save() {
    // Return nulls instead of empty strings
    let values = {} as ConfigDict;
    Object.keys(this.state).map((key, _index) => {
      values[key] = this.state[key] === "" ? null : this.state[key];
    });
    ipcRenderer.send("save-config", values);
    remote.getCurrentWindow().close();
  }

  render() {
    return (
      <div className="window">
        <div className="window-content">
          <form>
            {this.props.prefs.map((pref: ConfigPref, index: number) => (
              <PrefGroup
                pref={pref}
                value={this.state[pref.name]}
                key={"prefGroup-" + index}
                setValue={this.handleInputChange}
              />
            ))}
          </form>
        </div>
        <footer className="toolbar toolbar-footer">
          <div className="toolbar-actions">
            <button
              className="btn btn-large btn-default pull-left"
              id="cancel"
              onClick={this.cancel}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-large btn-primary pull-right"
              id="save"
              onClick={this.save}
            >
              Save
            </button>
          </div>
        </footer>
      </div>
    );
  }
}

ipcRenderer.on("config", (event: Electron.Event, message: any) => {
  ReactDOM.render(
    <Prefs prefs={message.info} values={message.conf} />,
    document.getElementById("root")
  );
});
