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

// From http://stackoverflow.com/questions/14967647/ (continues on next line)
// encode-decode-image-with-base64-breaks-image (2013-04-21)
function binaryStringToArrayBuffer(binary) {
  var length = binary.length;
  var buf = new ArrayBuffer(length);
  var arr = new Uint8Array(buf);
  var i = -1;
  while (++i < length) {
    arr[i] = binary.charCodeAt(i);
  }
  return buf;
}

function resolve_download_urls(cb) {
  Promise.all(
    Array.from(ctx.children).flatMap((mod) => {
      var folder = mod.querySelector('span.name').innerText;
      return Array.from(mod.querySelectorAll('span.item_name')).flatMap(
        async (span) => {
          // remove old
          span
            .querySelectorAll('a.osuwebtool_download_url')
            .forEach((val, k, p) => val.remove());
          var link = span.querySelector('a');
          if (link) {
            if (link.classList.contains('external')) return;
            const href = link.href;
            if (href.startsWith(curr_url)) {
              // under modules
              var response = await chrome.runtime.sendMessage(
                chrome.runtime.id,
                {
                  type: 'GET_URL',
                  url: href,
                }
              );
              // console.log(response);
              if (response.url) {
                var a = document.createElement('a');
                a.href = response.url;
                a.target = '_blank';
                a.download = true;
                a.classList.add('osuwebtool_download_url');
                a.innerText = `Download ${response.filename}`;
                link.parentElement.appendChild(a);
                response.folder = folder;
                return response;
              }
            }
          }
          return;
        }
      );
    })
  )
    .then((responses) => {
      var tmp = responses.filter((r) => r);
      console.log('Finish extracting urls');
      urls = tmp;
      butt.disabled = false;
      urlsCache.set(tmp, () => {});
      cb();
    })
    .catch((e) => {
      console.error(e);
    });
}

const ctx = document.getElementById('context_modules');
const curr_url = window.location.href;

const urlsCache = {
  get: (cb) => {
    chrome.storage.local.get(
      [`file_urls:${window.location.pathname}`],
      (result) => {
        cb(result[`file_urls:${window.location.pathname}`]);
      }
    );
  },
  set: (value, cb) => {
    chrome.storage.local.set(
      {
        [`file_urls:${window.location.pathname}`]: value,
      },
      () => {
        cb();
      }
    );
  },
  remove: () =>
    chrome.storage.local.remove([`file_urls:${window.location.pathname}`]),
};

var urls = [];
var zip = new JSZip();
var butt = document.createElement('button');

function init() {
  if (ctx) {
    butt.innerText = 'Download all!';
    butt.classList.add('btn');
    butt.disabled = true;
    butt.style.backgroundColor = '#5cc46b';
    document
      .getElementById('expand_collapse_all')
      .parentElement.appendChild(butt);
    var refresh_butt = document.createElement('i');
    refresh_butt.style.marginLeft = '10px';
    refresh_butt.style.cursor = 'pointer';
    refresh_butt.title = 'Delete cache of urls';
    refresh_butt.classList.add('icon-refresh');
    refresh_butt.disabled = true;
    document
      .getElementById('expand_collapse_all')
      .parentElement.appendChild(refresh_butt);

    refresh_butt.addEventListener('click', async () => {
      refresh_butt.style.pointerEvents = 'none';
      refresh_butt.style.color = 'gray';
      await urlsCache.remove();
      resolve_download_urls(() => {
        // re-enable
        refresh_butt.style.pointerEvents = null;
        refresh_butt.style.color = null;
      });
    });

    urlsCache.get((retried_urls) => {
      // console.log(retried_urls);
      if (retried_urls && retried_urls.length > 0) {
        console.log('Found retried urls');
        urls = retried_urls;
        butt.disabled = false;
        var items = ctx.getElementsByClassName('item_name');
        for (let i = 0; i < items.length; i++) {
          const span = items[i];
          var links = span.getElementsByTagName('a');
          if (links.length == 1) {
            const link = links[0];
            var re = urls.find((u) => u.original_url == link.href);
            if (re)
              link.parentElement.innerHTML += `<a href="${re.url}" class="osuwebtool_download_url" target="_blank" download="true">Download ${re.filename}</a>`;
          }
        }
      } else {
        // resolve_download_urls(); // no auto resolve
      }
    });

    butt.addEventListener('click', async () => {
      butt.disabled = true;
      var butt_text = butt.innerText;
      var downloading_prefix = 'Downloading...';
      butt.innerText = downloading_prefix + '0%';
      var dl_count = 0;
      await Promise.all(
        urls.map(
          (response) =>
            new Promise((reslv) =>
              chrome.runtime.sendMessage(
                chrome.runtime.id,
                { url: response.url, type: 'DL' },
                (resp) => {
                  zip
                    .folder(response.folder)
                    .file(response.filename, binaryStringToArrayBuffer(resp.a));
                  butt.innerText =
                    downloading_prefix +
                    ((++dl_count / urls.length) * 100).toFixed(2) +
                    '%';
                  reslv();
                }
              )
            )
        )
      );

      zip.generateAsync({ type: 'blob' }).then(function (blob) {
        saveAs(blob, 'archive.zip');
      });
      console.log('Finish downloading all');
      butt.innerText = butt_text;
      butt.disabled = false;
    });
  }
}

enableModules.get((result) => {
  if (result && result.download_helper) {
    init();
  } else {
    console.log('Download helper disabled');
  }
});
