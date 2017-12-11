import * as React from "react";
import * as ReactDOM from "react-dom";
import * as TagsInput from "react-tagsinput";
import * as Autosuggest from "react-autosuggest";
import * as moment from "moment";
import { HotKeys } from "react-hotkeys";
import { ipcRenderer, remote } from "electron";

interface TagsProps {
  onChange: (tags: string[]) => void;
  tags: string[];
  allTags: string[];
  inputValue: string;
  onChangeInput: (input: string) => void;
}
const Tags = (props: TagsProps) => {
  const autocompleteRenderInput = (renderInputProps: TagsInput.RenderInputProps) => {
    const handleOnChange = (e: any, { newValue, method }: Autosuggest.ChangeEvent) => {
      if (method === "enter") {
        e.preventDefault();
      } else {
        renderInputProps.onChange(e);
      }
    };

    const inputValue = renderInputProps.value && renderInputProps.value.trim().toLowerCase();
    const inputLength = inputValue.length;

    let suggestions = props.allTags.filter(tag => {
      return tag.toLowerCase().slice(0, inputLength) === inputValue;
    });

    // If we just pass inputProps=renderInputProps directly, that includes addTag which isn't a DOM property
    let { addTag, ...inputProps } = renderInputProps;

    const storeInputReference = (autosuggest: any) => {
      // Type should be autosuggest:Autosuggest, but the typings are missing ".input"
      if (autosuggest !== null) {
        renderInputProps.ref(autosuggest.input);
      }
    };

    return (
      <Autosuggest
        ref={storeInputReference}
        suggestions={suggestions}
        shouldRenderSuggestions={value => Boolean(value) && value.trim().length > 0}
        getSuggestionValue={suggestion => suggestion}
        renderSuggestion={suggestion => <span>{suggestion}</span>}
        inputProps={{ onChange: handleOnChange, ...inputProps }}
        highlightFirstSuggestion={true}
        onSuggestionSelected={(e, { suggestion }) => {
          renderInputProps.addTag(suggestion);
        }}
        onSuggestionsClearRequested={() => {}}
        onSuggestionsFetchRequested={() => {}}
      />
    );
  };

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
      renderInput={autocompleteRenderInput}
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
  allTags: string[];
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
    this.cancel = this.cancel.bind(this);
  }

  cancel() {
    if (this.state.input === "") {
      // If the user isn't in the middle of entering a tag, set the tags to the cancelTags, and save + quit once that's done
      this.setState((prevState, props) => ({ tags: props.cancelTags }), this.save);
    } else {
      this.setState({ input: "" });
    }
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

  // Replace the current tags with the previous tags
  // If specified, callback is called after the state has been updated
  repeat(callback?: () => void) {
    this.setState((prevState, props) => ({ tags: props.prevTags }), callback);
  }

  render() {
    return (
      <HotKeys keyMap={{ cancel: "esc" }} handlers={{ cancel: this.cancel }}>
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
                  allTags={this.props.allTags}
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
      </HotKeys>
    );
  }
}

ipcRenderer.on(
  "data",
  (
    _event: Electron.Event,
    message: { time: number; allTags: string[]; prevTags: string[]; cancelTags: string[] }
  ) => {
    ReactDOM.render(<Prompt {...message} />, document.getElementById("root"));
  }
);
