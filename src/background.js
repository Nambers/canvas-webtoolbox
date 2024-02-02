'use strict';

// var getCredit = require("./modules/schools.js");
// Can't find original post, but this is close
// http://stackoverflow.com/questions/6965107/ (continues on next line)
// converting-between-strings-and-arraybuffers
function arrayBufferToBinaryString(buffer) {
  var binary = '';
  var bytes = new Uint8Array(buffer);
  var length = bytes.byteLength;
  var i = -1;
  while (++i < length) {
    binary += String.fromCharCode(bytes[i]);
  }
  return binary;
}

const enableModules = {
  get: (cb) => {
    chrome.storage.local.get([`enableModules`], (result) => {
      cb(result[`enableModules`]);
    });
  },
};

function getCreditWrapper(info, callback, fallback) {
  enableModules.get((result) => {
    if (result && result.school_name) {
      require(`./modules/schools/${result.school_name}.js`).getCredit(
        info,
        callback,
        fallback
      );
    }
  });
}

function fetch_with_cookie(url, method, req_headers = {}) {
  return new Promise((resolve, reject) => {
    chrome.cookies.getAll({ domain: url.split('/')[2] }, (cookies) => {
      var cookie = cookies.map((c) => `${c.name}=${c.value}`).join(';');
      req_headers['Cookie'] = cookie;
      fetch(url, {
        method: method,
        headers: req_headers,
      })
        .then((resp) => {
          resolve(resp);
        })
        .catch((e) => {
          reject(e);
        });
    });
  });
}

async function getGrade(info, callback, fallback) {
  chrome.tabs.create(
    {
      url: info.link + '/grades',
      active: false,
    },
    (tab) => {
      // since we need to run the script after the page is loaded to get the grade, we need to use debugger
      chrome.debugger.attach({ tabId: tab.id }, '1.3', () => {
        chrome.debugger.sendCommand(
          { tabId: tab.id },
          'Page.enable',
          {},
          () => {
            chrome.debugger.onEvent.addListener(
              async (source, method, params) => {
                if (
                  method === 'Page.loadEventFired' &&
                  source.tabId === tab.id
                ) {
                  await new Promise((r) => setTimeout(r, 1000));
                  chrome.debugger.sendCommand(
                    source,
                    'Runtime.evaluate',
                    {
                      expression: `document.querySelector("div.student_assignment.final_grade")?.outerHTML`,
                    },
                    (resp) => {
                      if (!resp) {
                        console.error(
                          `Course ${info.class_name} cannot be loaded`
                        );
                        chrome.tabs.remove(source.tabId);
                        fallback();
                        return;
                      }
                      console.log(resp);
                      var final_grade = resp.result.value;
                      console.log(final_grade);
                      var grade_percent_parser = RegExp(
                        /<span class="grade">([0-9.]+)(%*)([ \/]*)([0-9.]*)<\/span>/
                      ).exec(final_grade);
                      console.log(grade_percent_parser);
                      var grade_percent = 0;
                      if (grade_percent_parser) {
                        if (grade_percent_parser[3] == ' / ') {
                          grade_percent =
                            (parseFloat(grade_percent_parser[1]) /
                              parseFloat(grade_percent_parser[4])) *
                            100;
                        } else {
                          grade_percent = parseFloat(grade_percent_parser[1]);
                        }
                      } else {
                        console.error(
                          `Course ${info.class_name} does not have a grade ${final_grade}. Please check manually.`
                        );
                      }
                      console.log(grade_percent);
                      var grade_letter_parser = RegExp(
                        /<span class="letter_grade" id="final_letter_grade_text">([ABCDESU+-]+)<\/span>/
                      ).exec(final_grade);
                      var grade_letter = undefined;
                      if (grade_letter_parser) {
                        grade_letter = grade_letter_parser[1];
                      }
                      if (!grade_letter) {
                        console.warn(
                          `Course ${info.class_name} does not have a letter grade. We will try to convert the percent grade to letter grade.`
                        );
                        // manual transfer
                        // A 93-100
                        // A- 90-93
                        // B+ 87-90
                        // B 83-87
                        // B- 80-83
                        // C+ 77-80
                        // C 73-77
                        // C- 70-73
                        // D+ 67-70
                        // D 60-67
                        // E <60
                        // transfer from percent to letter
                        if (grade_percent >= 93) {
                          grade_letter = 'A';
                        } else if (grade_percent >= 90) {
                          grade_letter = 'A-';
                        } else if (grade_percent >= 87) {
                          grade_letter = 'B+';
                        } else if (grade_percent >= 83) {
                          grade_letter = 'B';
                        } else if (grade_percent >= 80) {
                          grade_letter = 'B-';
                        } else if (grade_percent >= 77) {
                          grade_letter = 'C+';
                        } else if (grade_percent >= 73) {
                          grade_letter = 'C';
                        } else if (grade_percent >= 70) {
                          grade_letter = 'C-';
                        } else if (grade_percent >= 67) {
                          grade_letter = 'D+';
                        } else if (grade_percent >= 60) {
                          grade_letter = 'D';
                        } else {
                          grade_letter = 'E';
                        }
                      }
                      chrome.tabs.remove(source.tabId);
                      callback({
                        letter: grade_letter,
                        percent: grade_percent,
                      });
                    }
                  );
                }
              }
            );
          }
        );
      });
    }
  );
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.type) {
    case 'DL':
      fetch(request.url)
        .then((resp) => resp.blob())
        .then((blob) => blob.arrayBuffer())
        .then((buffer) =>
          sendResponse({ a: arrayBufferToBinaryString(buffer) })
        )
        .catch((error) => {
          // Handle any errors that occur during the fetch or conversion
          console.error(
            'Error fetching or converting blob:',
            error,
            '\nreq',
            request
          );
          sendResponse({ error: 'Failed to fetch or convert blob' });
        });
      break;

    case 'GET_URL':
      // get redirected url of href
      fetch(request.url).then((resp) => {
        if (resp.status == 200) {
          var redirected_url = resp.url.split('?')[0];
          if (redirected_url.includes('files')) {
            resp
              .text()
              .then((t) => {
                var res = RegExp(
                  /<div id="content" class="ic-Layout-contentMain" role="main">(\s)+<h2>(.*)<\/h2>/
                ).exec(t);
                // get group 2
                var filename = res[2];
                var download_url = redirected_url + '/download?download_frd=1';
                sendResponse({
                  url: download_url,
                  filename: filename,
                  original_url: request.url,
                });
              })
              .catch((e) => {
                // Handle any errors that occur during the fetch or conversion
                sendResponse({ error: e });
              });
          } else {
            sendResponse({ skip: true });
          }
        } else {
          sendResponse({
            error: 'Failed to fetch url, status: ' + resp.status,
          });
        }
      });
      break;
    case 'GET_CREDIT':
      getCreditWrapper(
        request,
        (credit) =>
          getGrade(
            request,
            (grade) =>
              sendResponse({
                credit: credit,
                class_name: request.class_name,
                grade: grade,
              }),
            () =>
              sendResponse({
                error: `Grade of course ${request.class_name} not found. Please check manually.`,
              })
          ),
        (j) => {
          if (j && j.lab) {
            getGrade(
              request,
              (grade) =>
                sendResponse({
                  lab_percent: j.lab,
                  class_name: request.class_name,
                  grade: grade,
                }),
              () =>
                sendResponse({
                  error: `Grade of course ${request.class_name} not found. Please check manually.`,
                })
            );
          }else{
            sendResponse({
              error: `Credit of course ${request.class_name} not found. Please check manually.`,
            });
          }
        }
      );
      break;
    case 'GET_W_COOKIES_HTML':
      fetch_with_cookie(request.url, 'GET')
        .then((resp) => resp.text())
        .then((t) => sendResponse(t))
        .catch((error) => {
          console.error(
            'Error fetching or converting blob:',
            error,
            '\nreq',
            request
          );
          sendResponse({ error: 'Failed to fetch or convert blob' });
        });
      break;
    case 'GET_W_COOKIES_JSON':
      fetch_with_cookie(request.url, 'GET')
        .then((resp) => resp.json())
        .then((t) => sendResponse(t))
        .catch((error) => {
          console.error(
            'Error fetching or converting blob:',
            error,
            '\nreq',
            request
          );
          sendResponse({ error: 'Failed to fetch or convert blob' });
        });
      break;
    default:
      sendResponse({ error: 'unknown request' });
  }
  return true;
});
