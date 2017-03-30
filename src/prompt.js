/* Display time of ping */
const querystring = require('querystring');
const moment = require('moment');
const time = querystring.parse(window.location.search).time;
document.getElementById("time").innerHTML = moment(time).format('hh:mm:ss');

/* Typeahead */

const $ = window.$;
const Bloodhound = window.Bloodhound;

var allTags = new Bloodhound({
  datumTokenizer: Bloodhound.tokenizers.obj.whitespace('tag'),
  queryTokenizer: Bloodhound.tokenizers.whitespace,
  // Bloodhound doesn't work with a plain array of strings - needs key:value pairs
  // https://github.com/twitter/typeahead.js/blob/master/doc/migration/0.10.0.md
  local: [ "firsttag", "t:atool", "t:btool", "tags", "tastytags" ].map(
     (e) => { return {tag : e}; }
  ),
});

$('input:first').tagsinput({
  confirmKeys: [13, 32, 44], // space, comma, and enter trigger tag entry
  trimValue: true,
  cancelConfirmKeysOnEmpty: true,
  typeaheadjs: {
    name: 'allTags',
    displayKey: 'tag',
    valueKey: 'tag',
    source: allTags.ttAdapter()
  }
});

$(".twitter-typeahead").css('display', 'inline');
