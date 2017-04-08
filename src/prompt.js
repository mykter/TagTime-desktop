/* Display time of ping */
const querystring = require('querystring');
const moment = require('moment');
const time = querystring.parse(window.location.search.slice(1)).time;
document.getElementById("time").innerHTML =
    moment(time, 'x').format('HH:mm:ss');

/* Typeahead */

const Bloodhound = window.Bloodhound;
var allTags = new Bloodhound({
  datumTokenizer : Bloodhound.tokenizers.obj.whitespace('tag'),
  queryTokenizer : Bloodhound.tokenizers.whitespace,
  // Bloodhound doesn't work with a plain array of strings - needs key:value
  // pairs
  // https://github.com/twitter/typeahead.js/blob/master/doc/migration/0.10.0.md
  local : [ "firsttag", "t:atool", "t:btool", "tags", "tastytags" ].map(
      (e) => { return {tag : e}; }),
});

// document.getElementById doesn't work here - presumably tagsinput is extending
// jQuery so #tags redirects to the new input element?
const $ = window.$;
$("#tags").tagsinput({
  confirmKeys : [ 13, 32, 44 ], // space, comma, and enter trigger tag entry
  trimValue : true,
  cancelConfirmKeysOnEmpty : true,
  typeaheadjs : {
    name : 'allTags',
    displayKey : 'tag',
    valueKey : 'tag',
    source : allTags.ttAdapter()
  }
});

/* tagsinput has an annoying behaviour - if the user doesn't trigger a new tag
 * by pressing one of the confirmKeys, any remaining text is just ignored.
 * Make sure we turn it into a tag when the field loses focus */
var tagsElt = $('#tags').tagsinput('input')
tagsElt[0].onblur =
    _ => {
      if (tagsElt.val().trim() !== '') {
        $('#tags').tagsinput('add', tagsElt.val().trim());
      }
    }

/* Button events */
const {ipcRenderer} = require('electron');
document.getElementById('save').addEventListener('click', _ => {
  ipcRenderer.send('save-ping', {
    time : time,
    tags : $('#tags').tagsinput('items'),
    comment : document.getElementById('comment').innerHTML
  });
});

/* bootstrap-tagsinput doesn't respect the autofocus attribute */
$("#tags").tagsinput('focus');
