import { ipcRenderer, remote } from "electron";
import * as moment from "moment";
import * as React from "react";
import * as Autosuggest from "react-autosuggest";
import * as ReactDOM from "react-dom";
import { HotKeys } from "react-hotkeys";
import * as TagsInput from "react-tagsinput";

interface TagsProps {
  onChange: (tags: string[]) => void;
  tags: string[];
  allTags: string[];
  inputValue: string;
  onChangeInput: (input: string) => void;
  tagInputRef: (field: HTMLInputElement) => void;
}
const Tags = (props: TagsProps) => {
  const autocompleteRenderInput = (
    renderInputProps: TagsInput.RenderInputProps
  ) => {
    let inputValue = "";
    if (renderInputProps.value) {
      inputValue = renderInputProps.value.trim().toLowerCase();
    }
    const inputLength = inputValue.length;

    const suggestions = props.allTags.filter(
      tag =>
        inputLength > 0 &&
        tag.toLowerCase().slice(0, inputLength) === inputValue
    );

    const handleOnChange = (
      e: any,
      { newValue, method }: Autosuggest.ChangeEvent
    ) => {
      if (method === "enter" && inputLength > 0) {
        // preventDefault to stop the currently entered text being used as a tag
        // but _don't_ preventDefault if there's no options available - otherwise this
        // will stop form submission
        e.preventDefault();
      } else {
        renderInputProps.onChange(e);
      }
    };

    // If we just pass inputProps=renderInputProps directly, that includes addTag which isn't a DOM property,
    // and onChange which we want to override
    const { addTag, onChange, ...prunedRenderInputProps } = renderInputProps;

    const storeInputReference = (autosuggest: any) => {
      // Type should be autosuggest:Autosuggest, but the typings are missing ".input"
      if (autosuggest !== null) {
        renderInputProps.ref(autosuggest.input);
        props.tagInputRef(autosuggest.input);
      }
    };

    return (
      <Autosuggest
        ref={storeInputReference}
        suggestions={suggestions}
        shouldRenderSuggestions={value =>
          Boolean(value) && value.trim().length > 0
        }
        getSuggestionValue={suggestion => suggestion}
        renderSuggestion={suggestion => <span>{suggestion}</span>}
        inputProps={{ onChange: handleOnChange, ...prunedRenderInputProps }}
        highlightFirstSuggestion={true}
        onSuggestionSelected={(e, { suggestion }) => {
          renderInputProps.addTag(suggestion);
        }}
        onSuggestionsClearRequested={() => {
          /* do nothing */
        }}
        onSuggestionsFetchRequested={() => {
          /* do nothing */
        }}
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
  prevComment: string;
  allTags: string[];
  cancelTags: string[];
  time: number;
}
class Prompt extends React.Component<PromptProps, PromptState> {
  private tagInputField: HTMLInputElement | undefined;

  private keyMap = {
    cancel: "esc",
    repeat: "alt+r",
    save: ["alt+s", "ctrl+s"]
  };

  private keyHandlers = {
    cancel: () => {
      this.cancel();
    },
    save: () => {
      // If the shortcut key was pressed whilst the autocomplete selection box was open, the tag isn't
      // saved in our state yet. Blur triggers it to complete.
      // (the input field should be already set by the Tags component)
      if (this.tagInputField) {
        this.tagInputField.blur();
      }
      this.save();
    },
    repeat: () => {
      this.repeat(this.save);
    }
  };

  constructor(props: PromptProps) {
    super(props);
    this.state = { tags: [], comment: "", input: "" };

    this.handleChangeInput = this.handleChangeInput.bind(this);
    this.handleChangeComment = this.handleChangeComment.bind(this);
    this.save = this.save.bind(this);
    this.repeat = this.repeat.bind(this);
    this.cancel = this.cancel.bind(this);
  }

  public render() {
    return (
      <HotKeys keyMap={this.keyMap} handlers={this.keyHandlers}>
        <div className="window">
          <div className="window-content">
            <form id="theform" onSubmit={e => this.save(e)}>
              <div className="form-group">
                <label>
                  What are you doing <i>right now</i>?
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
                  tagInputRef={(e: HTMLInputElement) => {
                    this.tagInputField = e;
                  }}
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
                <i>Previous: {this.previous()}</i>
              </p>
            </form>
          </div>

          <footer className="toolbar toolbar-footer">
            <div className="toolbar-actions">
              <button
                id="repeat"
                title="Use the previous tags (ALT+R)"
                className="btn btn-large btn-positive pull-left"
                onClick={() => this.repeat(this.save)}
              >
                Repeat
              </button>

              <button
                id="save"
                title="Save the ping (CTRL+S / ALT+S)"
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

  private cancel() {
    if (this.state.input === "") {
      // If the user isn't in the middle of entering a tag, set the tags to the cancelTags, and save + quit once that's done
      this.setState(
        (prevState, props) => ({ tags: props.cancelTags }),
        this.save
      );
    } else {
      this.setState({ input: "" });
    }
  }

  // Send the ping to the main process and close window.
  // Also send coverage info back to the main process if available
  private save(event?: React.FormEvent<HTMLFormElement>) {
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
      coverage
    });
    remote.getCurrentWindow().close();
  }

  private handleChangeInput(input: string) {
    if (this.state.tags.length === 0 && input === '"') {
      // on single ", repeat previous tags
      this.repeat();
    } else {
      this.setState({ input });
    }
  }

  private handleChangeComment(event: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ comment: event.target.value });
  }

  // Replace the current tags with the previous tags
  // If specified, callback is called after the state has been updated
  private repeat(callback?: () => void) {
    this.setState(
      (prevState, props) => ({
        tags: props.prevTags,
        comment: props.prevComment
      }),
      callback
    );
  }

  private previous() {
    let comment = "";
    if (this.props.prevComment) {
      comment = ` [${this.props.prevComment}]`;
    }
    return this.props.prevTags.join(", ") + comment;
  }
}

ipcRenderer.on(
  "data",
  (
    _event: Electron.Event,
    message: {
      time: number;
      allTags: string[];
      prevTags: string[];
      prevComment: string;
      cancelTags: string[];
    }
  ) => {
    ReactDOM.render(<Prompt {...message} />, document.getElementById("root"));
  }
);
