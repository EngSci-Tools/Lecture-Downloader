function insertAfter(referenceNode, newNode) {
  referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
}

function isNextDownloadButton(node) {
  // Used to make sure we don't put multiple download buttons on screen.
  const next = node.nextSibling;
  return next ? next.id === "downloadButton" : false;
}

function download(id) {
  // The 'lecture_download' message tells the background script which id to download.
  chrome.runtime.sendMessage({type: "lecture_download", id});
}

function loadDownloadButtons() {
  var iframes = document.getElementsByTagName('iframe');
  for (const iframe of iframes) {
    // We only want to place download buttons under iframes that link to an embeded lecture
    const r = /(https:\/\/play.library.utoronto.ca\/embed\/)(.+)(\?.+)?/
    const arr = iframe.src.match(r)
    if (arr) {
      const id = arr[2]; // This matches the lecture id as seen in the database
      const button = document.createElement('button');
      const width = iframe.width;
      button.innerHTML = "Download";
      button.id = "downloadButton";
      button.style.width = width+"px";
      button.style.background = 'rgb(207 232 255)';
      button.style.color = "rgb(49, 130, 206)";
      button.style.borderRadius = "0.25rem";
      button.style.height = "2rem";
      button.style.border = "none";
      button.onclick = () => {
        download(id);
      }
      const parent = iframe.parentNode;
      // We edit the parent so the button lies under the iframe. I hope this doesn't have wider effects.
      parent.style.display = "flex";
      parent.style['flex-direction'] = "column";
      if (!isNextDownloadButton(iframe)) {
        insertAfter(iframe, button);
      }
    }
  }

  // We look for thumbnails because they directly contain links to the lecture id
  thumbnails = document.getElementsByClassName('vjs-poster');
  for (const thumbnail of thumbnails) {
    const r = /(url\("https:\/\/mymedia.library.utoronto.ca\/api\/download\/thumbnails\/)(.+)(\..+)/
    const arr = thumbnail.style["background-image"].match(r);
    if (arr) {
      const id = arr[2]; // This matches the lecture id as seen in the database
      const button = document.createElement('button');
      button.classList = 'css-41msu2'; // We use a class that is already on these pages to style
      button.id = "downloadButton";
      button.style.marginRight = '0';
      button.style.background = 'rgb(207 232 255)';
      button.innerHTML = "Download"
      button.onclick = () => {
        download(id);
      }
      // The parent of the thumbnail is the actual video so we insert after the parent.
      if (!isNextDownloadButton(thumbnail.parentNode)) {
        insertAfter(thumbnail.parentNode, button);
      }
    }
  }

  // Links might also point to lectures so we place download buttons on those as well.
  links = document.getElementsByTagName('a');
  for (const link of links) {
    const r = /(https:\/\/play.library.utoronto.ca\/)(play\/)?(.+)(\?.+)?/
    const arr = link.href.match(r);
    if(arr) {
      const id = arr[3];
      const button = document.createElement('button');
      button.innerHTML = "Download";
      button.id = "downloadButton";
      button.style.background = 'rgb(207 232 255)';
      button.style.color = "rgb(49, 130, 206)";
      button.style.borderRadius = "0.25rem";
      button.style.height = "2rem";
      button.style.border = "none";
      button.onclick = () => {
        download(id);
      }
      if (!isNextDownloadButton(link)) {
        insertAfter(link, button);
      }
    }
  }
}

window.addEventListener('load', function () {
  // Videos sometimes takes up to a second to load
  setTimeout(loadDownloadButtons(), 0); // Event loop quirk. Don't question it. I don't.
  setTimeout(loadDownloadButtons, 100);
  setTimeout(loadDownloadButtons, 1000);
})