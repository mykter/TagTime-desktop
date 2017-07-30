const moment = require('moment');
const {ipcRenderer} = require('electron');

var time;
ipcRenderer.on('time', (event, message) => {
  time = message;
  document.getElementById("time").textContent = moment(time, 'x').format('HH:mm:ss');
});

var prevTags = [];
ipcRenderer.on('prevTags', (event, message) => {
  prevTags = message;
  document.getElementById("prev").textContent = prevTags.join(", ");
});

ipcRenderer.on('pings', (event, message) => {
  // Add the tags to the typeahead source
  allTags.add(message.map((t) => { return {tag : t}; }));
});

/* Typeahead */
const Bloodhound = window.Bloodhound;
var allTags = new Bloodhound({
  datumTokenizer : Bloodhound.tokenizers.obj.whitespace('tag'),
  queryTokenizer : Bloodhound.tokenizers.whitespace,
  // Bloodhound doesn't work with a plain array of strings - needs key:value pairs
  // https://github.com/twitter/typeahead.js/blob/master/doc/migration/0.10.0.md
});

// document.getElementById doesn't work here, but tagsinput allows us to use
// #tags with jQuery to get the new input element
window.$("#tags").tagsinput({
  // enter and space trigger tag entry. not including comma as it isn't deleted when entered,
  // which messes up tag entry
  confirmKeys : [ 13, 32 ],
  trimValue : true,
  cancelConfirmKeysOnEmpty : true, // allow enter to submit form
  typeaheadjs :
      {name : 'allTags', displayKey : 'tag', valueKey : 'tag', source : allTags.ttAdapter()}
});

/* tagsinput has an annoying behaviour - if the user doesn't trigger a new tag
 * by pressing one of the confirmKeys, any remaining text is just ignored.
 * Make sure we turn it into a tag when the field loses focus */
var tagsElt = window.$('#tags').tagsinput('input')
tagsElt[0].onblur = _ => {
  if (tagsElt.val().trim() !== '') {
    window.$('#tags').tagsinput('add', tagsElt.val().trim());
  }
};

/* bootstrap-tagsinput doesn't respect the autofocus attribute */
window.$("#tags").tagsinput('focus');

/**
 * Replace the contents of the input field with the previous tags
 */
var repeat = function() {
  window.$("#tags").tagsinput('removeAll');
  for (var tag of prevTags) {
    window.$("#tags").tagsinput('add', tag);
  }
};

/* A single " is a repeat */
tagsElt[0].oninput = _ => {
  if (tagsElt.val() === '"') {
    repeat();
  }
};

// Send the ping to the main process. It will kill us when its finished.
// TODO  issue #29: the save button is outside the form, so default submit action doesn't save
var save = function() {
  ipcRenderer.send('save-ping', {
    time : time,
    tags : window.$('#tags').tagsinput('items'),
    comment : document.getElementById('comment').textContent
  });
};

/* Button events */
document.getElementById('save').addEventListener('click', _ => { save(); });
document.getElementById('repeat').addEventListener('click', _ => {
  repeat();
  save();
});
