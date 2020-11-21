function insertAfter(referenceNode, newNode) {
  referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
}

function isNextDownloadButton(node) {
  // Used to make sure we don't put multiple download buttons on screen.
  const next = node.nextSibling;
  return next ? next.id === "downloadButton" : false;
}

port = chrome.runtime.connect(); 
function getConnection() {
  return new Promise(resolve => {
    function ping() {
      chrome.runtime.sendMessage('ping', response => {
        if(chrome.runtime.lastError) {
          setTimeout(ping, 500);
        } else {
          resolve(true)
        }
      });
    }
    ping()
  })
}

async function download(id) {
  // The 'lecture_download' message tells the background script which id to download.
  await getConnection()
  port.postMessage({type: "lecture_download", id});
}

async function watch(id) {
  // Lecture watch tells the backend to watch for changes in the room with the name [id]
  await getConnection()
  port.postMessage({ type: "lecture_watch", id });
}

async function watchAll() {
  for (const id of Object.keys(buttons)) {
    watch(id)
  }
}

chrome.runtime.onMessage.addListener((meta, _, sendResponse) => {
  const { action, progress, id } = meta
  const elem = buttons[id]
  if (elem) {
    if (action === 'finished') {
      for (const button of elem) {
        button.innerHTML = 'Download'
      }
    } else if (action === 'updated_progress') {
      const percent = Math.round(progress * 100)
      const append = percent > 99 ? 'Uploading' : `${percent}%`
      for (const button of elem) {
        button.innerHTML = `Progress: ${append}`
      }
    }
  }
  sendResponse(true)
})

const buttons = {} // Stores buttons as { [id]: { elem: [elements], downloading: bool } }

function checkAndAddIframe(iframe) {
  const r = /(https:\/\/play.library.utoronto.ca\/embed\/)(.+)(\?.+)?/
    const arr = iframe.src.match(r)
    if (arr) {
      const id = arr[2]; // This matches the lecture id as seen in the database
      const button = document.createElement('button');
      const width = iframe.width;
      button.innerHTML = "Loading...";
      button.id = "downloadButton";
      button.style.width = width+"px";
      button.style.background = 'rgb(207 232 255)';
      button.style.color = "rgb(49, 130, 206)";
      button.style.borderRadius = "0.25rem";
      button.style.height = "2rem";
      button.style.border = "none";
      watch(id)
      button.onclick = () => {
        download(id);
      }
      const parent = iframe.parentNode;
      // We edit the parent so the button lies under the iframe. I hope this doesn't have wider effects.
      parent.style.display = "flex";
      parent.style['flex-direction'] = "column";
      if (!isNextDownloadButton(iframe)) {
        insertAfter(iframe, button);
        if (id in buttons) {
          buttons[id].push(button)
        } else {
          buttons[id] = [button]
        }
      }
    }
}

function checkAndAddThumbnail(thumbnail) {
  const r = /(url\("https:\/\/mymedia.library.utoronto.ca\/api\/download\/thumbnails\/)(.+)(\..+)/
    const arr = thumbnail.style["background-image"].match(r);
    if (arr) {
      const id = arr[2]; // This matches the lecture id as seen in the database
      const button = document.createElement('button');
      button.classList = 'css-41msu2'; // We use a class that is already on these pages to style
      button.id = "downloadButton";
      button.style.marginRight = '0';
      button.style.background = 'rgb(207 232 255)';
      button.innerHTML = "Loading..."
      watch(id)
      button.onclick = () => {
        download(id);
      }
      // The parent of the thumbnail is the actual video so we insert after the parent.
      if (!isNextDownloadButton(thumbnail.parentNode)) {
        insertAfter(thumbnail.parentNode, button);
        if (id in buttons) {
          buttons[id].push(button)
        } else {
          buttons[id] = [button]
        }
      }
    }
}

function checkAndAddLink(link) {
  const r = /(https:\/\/play.library.utoronto.ca\/)(play\/)?(.+)(\?.+)?/
    const arr = link.href.match(r);
    if(arr) {
      const id = arr[3];
      const button = document.createElement('button');
      button.innerHTML = "Loading...";
      button.id = "downloadButton";
      button.style.background = 'rgb(207 232 255)';
      button.style.color = "rgb(49, 130, 206)";
      button.style.borderRadius = "0.25rem";
      button.style.height = "2rem";
      button.style.border = "none";
      watch(id)
      button.onclick = () => {
        download(id);
      }
      if (!isNextDownloadButton(link)) {
        insertAfter(link, button);
        if (id in buttons) {
          buttons[id].push(button)
        } else {
          buttons[id] = [button]
        }
      }
    }
}

function loadDownloadButtons() {
  var iframes = document.getElementsByTagName('iframe');
  for (const iframe of iframes) {
    // We only want to place download buttons under iframes that link to an embeded lecture
    checkAndAddIframe(iframe);
  }

  // We look for thumbnails because they directly contain links to the lecture id
  thumbnails = document.getElementsByClassName('vjs-poster');
  for (const thumbnail of thumbnails) {
    checkAndAddThumbnail(thumbnail);
  }

  // Links might also point to lectures so we place download buttons on those as well.
  links = document.getElementsByTagName('a');
  for (const link of links) {
    checkAndAddLink(link);
  }
}

(new MutationObserver(mutations => {
  for (const mutation of mutations) {
    mutation.addedNodes.forEach(node => {
      if (node.tagName !== undefined) {
        const tag = node.tagName.toLowerCase();
        if (tag === 'iframe') {
          checkAndAddIframe(node);
        }else if (tag === 'div') {
          checkAndAddThumbnail(node);
        } else if (tag == 'a') {
          checkAndAddLink(node);
        }
      }
    });
  }
})).observe(document.body, {
  attributes: true,
  characterData: true,
  childList: true,
  subtree: true,
  attributeOldValue: true,
  characterDataOldValue: true
});

window.addEventListener('load', function () {
  setTimeout(loadDownloadButtons(), 0); // Event loop quirk. Don't question it. I don't.
})