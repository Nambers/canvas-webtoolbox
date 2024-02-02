'use strict';

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
