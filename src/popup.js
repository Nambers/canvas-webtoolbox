'use strict';

const checkbox_download_helper = document.querySelector(
  'input#download_helper'
);

const enableModules = {
  get: (cb) => {
    chrome.storage.local.get(['enableModules'], (result) => {
      cb(result['enableModules']);
    });
  },
  set: (value, cb = undefined) => {
    chrome.storage.local.set(
      {
        ['enableModules']: value,
      },
      () => {
        if (cb) cb();
      }
    );
  },
  remove: () => chrome.storage.local.remove(['enableModules']),
};
enableModules.get((result) => {
  if (result == null || result.download_helper == null) {
    enableModules.set({
      download_helper: false,
    });
    checkbox_download_helper.checked = false;
  } else {
    checkbox_download_helper.checked = result.download_helper;
  }
});
checkbox_download_helper.addEventListener('change', (event) => {
  enableModules.set({
    gpa_calculator: checkbox_gpa_calculator.checked,
    download_helper: checkbox_download_helper.checked,
    school_name: select_school_name.value,
  });
});
