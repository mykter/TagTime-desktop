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
  confirmKeys : [ 13, 32, 44 ], // space, comma, and enter trigger tag entry
  trimValue : true,
  cancelConfirmKeysOnEmpty : true, // this should allow the form to be submitted on Enter if there
                                   // isn't a pending tag, but it doesn't seem to work - issue #29
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

/* Button events */

document.getElementById('save').addEventListener('click', _ => {
  ipcRenderer.send('save-ping', {
    time : time,
    tags : window.$('#tags').tagsinput('items'),
    comment : document.getElementById('comment').textContent
  });
});

document.getElementById('repeat').addEventListener('click', _ => {
  window.$("#tags").tagsinput('removeAll');
  for (var tag of prevTags) {
    window.$("#tags").tagsinput('add', tag);
  }
});
