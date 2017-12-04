import * as React from "react";
import * as ReactDOM from "react-dom";
import * as TagsInput from "react-tagsinput";
import * as moment from "moment";
import { ipcRenderer, remote } from "electron";

interface TagsProps {
  onChange: (tags: string[]) => void;
  tags: string[];
  inputValue: string;
  onChangeInput: (input: string) => void;
}
const Tags = (props: TagsProps) => {
  const inputProps = { id: "tags-input", placeholder: "tag", autoFocus: true };
  return (
    <TagsInput
      addKeys={[9, 13, 32, 188]} // tab enter space comma
      validationRegex={/\S+/} // no spaces in tags as it could conflict with addKeys
      value={props.tags}
      onChange={props.onChange}
      inputProps={inputProps}
      addOnBlur={true}
      onlyUnique={true}
      addOnPaste={true}
      preventSubmit={false} // enter submits form
      inputValue={props.inputValue}
      onChangeInput={props.onChangeInput}
    />
  );
};

interface PromptState {
  tags: string[];
  comment: string;
  input: string;
}
interface PromptProps {
  prevTags: string[];
  cancelTags: string[];
  time: number;
}
class Prompt extends React.Component<PromptProps, PromptState> {
  constructor(props: PromptProps) {
    super(props);
    this.state = { tags: [], comment: "", input: "" };

    this.handleChangeInput = this.handleChangeInput.bind(this);
    this.handleChangeComment = this.handleChangeComment.bind(this);
    this.save = this.save.bind(this);
    this.repeat = this.repeat.bind(this);
  }

  // Send the ping to the main process and close window.
  // Also send coverage info back to the main process if available
  save(event?: React.FormEvent<HTMLFormElement>) {
    if (event) {
      // Don't allow the normal submit behaviour that will reload the page
      event.preventDefault();
    }

    let coverage = null;
    if (typeof __coverage__ !== "undefined") {
      coverage = __coverage__; // eslint-disable-line no-undef
    }
    ipcRenderer.send("save-ping", {
      ping: {
        time: this.props.time,
        tags: this.state.tags,
        comment: this.state.comment
      },
      coverage: coverage
    });
    remote.getCurrentWindow().close();
  }

  handleChangeInput(input: string) {
    if (this.state.tags.length === 0 && input === '"') {
      // on single ", repeat previous tags
      this.repeat();
    } else {
      this.setState({ input });
    }
  }

  handleChangeComment(event: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ comment: event.target.value });
  }

  //TODO
  /*
  document.addEventListener("keyup", e => {
    if (e.key === "Escape") {
      setTags(cancelTags);
      save();
    }
  });
  */

  // Replace the current tags with the previous tags
  // If specified, callback is called after the state has been updated
  repeat(callback?: () => void) {
    this.setState((prevState, props) => ({ tags: props.prevTags }), callback);
  }

  render() {
    return (
      <div className="window">
        <div className="window-content">
          <form id="theform" onSubmit={e => this.save(e)}>
            <div className="form-group">
              <label>
                What are you doing <i>right now</i>?{" "}
              </label>
              <div id="time" className="pull-right">
                {moment(this.props.time, "x").format("HH:mm:ss")}
              </div>
              <br />
              <Tags
                tags={this.state.tags}
                onChange={(tags: string[]) => {
                  this.setState({ tags });
                }}
                onChangeInput={this.handleChangeInput}
                inputValue={this.state.input}
              />
            </div>
            <div className="form-group">
              <input
                id="comment"
                className="form-control"
                placeholder="Comment?"
                value={this.state.comment}
                onChange={this.handleChangeComment}
              />
            </div>
            <p>
              <i>Previous: {this.props.prevTags.join(", ")}</i>
            </p>
          </form>
        </div>

        <footer className="toolbar toolbar-footer">
          <div className="toolbar-actions">
            <button
              id="repeat"
              className="btn btn-large btn-positive pull-left"
              onClick={() => this.repeat(this.save)}
            >
              Repeat
            </button>

            <button
              id="save"
              type="submit"
              form="theform"
              className="btn btn-large btn-primary pull-right"
            >
              Save
            </button>
          </div>
        </footer>
      </div>
    );
  }
}

ipcRenderer.on(
  "data",
  (
    _event: Electron.Event,
    message: { time: number; pings: string[]; prevTags: string[]; cancelTags: string[] }
  ) => {
    ReactDOM.render(
      <Prompt time={message.time} prevTags={message.prevTags} cancelTags={message.cancelTags} />,
      document.getElementById("root")
    );
  }
);
