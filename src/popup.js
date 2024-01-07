'use strict';

const checkbox_gpa_calculator = document.querySelector('input#gpa_calculator');
const checkbox_download_helper = document.querySelector('input#download_helper');
const select_school_name = document.querySelector('select#school_name');

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
  if (
    result == null ||
    result.gpa_calculator == null ||
    result.download_helper == null
  ) {
    enableModules.set({
      gpa_calculator: false,
      gpa_query_name: 'osu',
      download_helper: false,
    });
    checkbox_gpa_calculator.checked = false;
    checkbox_download_helper.checked = false;
    select_school_name.value = 'osu';
  }else{
    checkbox_gpa_calculator.checked = result.gpa_calculator;
    checkbox_download_helper.checked = result.download_helper;
    select_school_name.value = result.school_name;
  }
});
checkbox_download_helper.addEventListener('change', (event) => {
  enableModules.set({
    gpa_calculator: checkbox_gpa_calculator.checked,
    download_helper: checkbox_download_helper.checked,
    school_name: select_school_name.value,
  });
});
checkbox_gpa_calculator.addEventListener('change', (event) => {
  enableModules.set({
    gpa_calculator: checkbox_gpa_calculator.checked,
    download_helper: checkbox_download_helper.checked,
    school_name: select_school_name.value,
  });
});
select_school_name.addEventListener('change', (event) => {
  enableModules.set({
    gpa_calculator: checkbox_gpa_calculator.checked,
    download_helper: checkbox_download_helper.checked,
    school_name: select_school_name.value,
  });
});
