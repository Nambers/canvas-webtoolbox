'use strict';

import JSZip, { folder } from 'jszip';
import { saveAs } from 'file-saver';

console.log('> OSU Web Toolbox active! <');

const enableModules = {
  get: (cb) => {
    chrome.storage.local.get([`enableModules`], (result) => {
      cb(result[`enableModules`]);
    });
  },
};

const course_id = window.location.href.split('/').slice(-2)[0];

function init(){
    chrome.runtime.sendMessage(
        chrome.runtime.id,
        {
            type: "GET_W_COOKIES_JSON",
            url: "https://osu.instructure.com/api/v1/courses/" + course_id + "/folders/root"
        },
        (response) => {
            // TODO
            console.log(response);
        }
    )
}


enableModules.get((result) => {
    if (result && result.download_helper) {
      init();
    } else {
      console.log('Download helper disabled');
    }
  });