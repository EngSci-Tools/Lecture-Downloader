const debug = false
function log(...message) {
  if (debug) {
    console.log(...message)
  }
}
const address = debug ? 'http://localhost' : 'http://lectures.engscitools.ca'

let socket = io.connect(address);
function reconnect() {
  socket = io.connect(address)
}

socket.on('connect', function() {
  log('Socket type:', socket.io.engine.transport.name);
})

const downloading = [] // Whenever a finished event is throw, if the id is in downloading, it will be downloaded
async function download(id, link, name) {
  const index = downloading.indexOf(id)
  if (index > -1) {
    const meta = await getMeta(id)
    this.updateMeta(id, meta)
    chrome.downloads.download({
      url: link,
      filename: name,
    })
    downloading.splice(index, 1)
  }
} 
function addDownload(id) {
  if (downloading.indexOf(id)) {
    downloading.push(id)
  }
}

socket.on('test', () => {
  log("Test Complete")
  log('Socket type:', socket.io.engine.transport.name);
})
socket.on('finished', async meta => {
  const { ready, link, id, message, error } = meta
  log('Finished', ready, id, link)
  if (ready) {
    const meta = await getMeta(id)
    const name = meta.name || "lecture.mp4"
    download(id, link, name)
    sendContentMessage("finished", { id })
  }
})
socket.on('progress', meta => {
  const { duration, time, progress, id } = meta
  log('Progress', progress)
  sendContentMessage("updated_progress", { progress, id })
})
socket.emit('test', {'asdf': 1})

function sendContentMessage(action, meta) {
  chrome.tabs.query({}, tabs => {
    for (const tab of tabs) {
      try {
        if (watching_tabs.indexOf(tab.id) > -1) {
          chrome.tabs.sendMessage(tab.id, {action, ...meta}, function(response) { return true; });
        }
      } catch (err) {
        // Where did the tab go!?
        console.log("Tab error:", err)
      }
    }
  })
}

function getGraphqlBody(id) {
  // I pulled this query directly from calls that uoft websites make to the database
  return {
    "variables":{
      "filename": id
    },
    "query": "query ($filename: String!) {\n  getOneMedia(filename: $filename) {\n    id\n    status\n    filename\n    extension\n    title\n    description\n    thumbnailURL\n    duration\n    uploaded(format: \"dd MMM yyy\")\n    downloadable\n    uoftOnly\n    discoverable\n    systemMessage\n    user {\n      firstName\n      lastName\n      __typename\n    }\n    tracks {\n      id\n      type\n      code\n      description\n      __typename\n    }\n    keywords {\n      id\n      label\n      __typename\n    }\n    __typename\n  }\n}\n"
  }
}

function updateMeta(id, meta) {
  if (!socket.connected) {
    reconnect()
  }
  socket.emit('addMeta', JSON.stringify(meta))
}

async function startWatch(id) {
  const meta = await getMeta(id)
  if (!socket.connected) {
    reconnect()
  }
  socket.emit('download', { ...meta, id })
}

function startDownload(id) {
  addDownload(id)
  startWatch(id)
}

async function getMeta(video_id) {
  return new Promise(async resolve => {
    chrome.storage.sync.get(['ufot_auth_session_id'], async res => {
      // This id is grabbed from a graphsql call and is used to query the UofT media database to get the name of the lecture
      const id = res["ufot_auth_session_id"];
      let name = "lecture.mp4"
      let meta = { id: video_id, name, downloadable: false, duration: -1, title: "lecture.mp4", user: { firstName: "", lastName: "" }, uploaded: "", description: "" }
      if (id) {
        const options = {
          method: "POST",
          headers: {
            'Content-Type': 'application/json',
            'AUTH_SESSION_ID': id
          },
          body: JSON.stringify(getGraphqlBody(video_id))
        }
        const rawRes = await fetch("https://play.library.utoronto.ca/api/graphql", options);
        const res = await rawRes.json();
        try {
          meta = {...meta, ...res.data.getOneMedia}
        } catch(err) {
          console.log("Failed to send meta:", err);
        }
        if (res.data && res.data.getOneMedia.title !== "undefined") { // That's right. Sometimes the title is literally the string undefined. Good job people.
          const title = res.data.getOneMedia.title;
          const extension = res.data.getOneMedia.extension;
          if (title.indexOf(extension) !== title.length - extension.length) {
            name = `${title}.${extension}`;
          } else {
            name = title;
          }
          preExt = name.slice(0, -1*extension.length);
          name = `${preExt.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${extension}`;
          name = name.replace(/(_)(?=_*\1)|(_)(?=\.)/g, '');
          meta.name = name
        }
      } else {
        try {
          // updateMeta(request.id, {});
        } catch(err) {
          console.log("Failed to send meta:", err);
        }
      }
      resolve(meta)
    })
  })
}

function downloadBBColab(link, name) {
  chrome.downloads.download({
    url: link,
    filename: name,
  })
}

const watching_tabs = []
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => sendResponse('pong'));
chrome.runtime.onConnect.addListener(port => {
  port.onMessage.addListener(request => {
    if(request.type === "lecture_watch") {
      // The content script will send a 'lecture_download' message when the user presses a 'Download' button
      watching_tabs.push(port.sender.tab.id)
      startWatch(request.id)
    }
    if(request.type === "lecture_download") {
      // The content script will send a 'lecture_download' message when the user presses a 'Download' button
      startDownload(request.id)
    }
    if(request.type === "bb_colab_download") {
      // Then we can just download from their unsecured endpoint
      downloadBBColab(request.link, request.name)
    }
  })
});

function grabAuth(details) {
  // When a request is made to the graphql database, we grab the auth id and use it to authenticate future requests to the api
  if ("requestHeaders" in details) {
    for (const header of details["requestHeaders"]) {
      if (header["name"] === "AUTH_SESSION_ID") {
        chrome.storage.sync.set({ufot_auth_session_id: header['value']});
      }
    }
  }
}

chrome.webRequest.onSendHeaders.addListener(
  // When headers are being sent, we intercept the graphql database auth
  grabAuth,
  {urls: ["https://play.library.utoronto.ca/api/graphql"]},
  ['requestHeaders']
)