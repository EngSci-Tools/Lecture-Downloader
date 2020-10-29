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
  const options = {
    method: "POST",
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(meta)
  };
  fetch(`http://lectures.aidandev.ca/setMeta/${id}`, options);
}

chrome.runtime.onMessage.addListener(request => {
  if(request.type === "lecture_download") {
    console.log("Requesting download")
    // The content script will send a 'lecture_download' message when the user presses a 'Download' button
    chrome.storage.sync.get(['ufot_auth_session_id'], async res => {
      // This id is grabbed from a graphsql call and is used to query the UofT media database to get the name of the lecture
      const id = res["ufot_auth_session_id"];
      let name = "lecture.mp4"
      if (id) {
        const options = {
          method: "POST",
          headers: {
            'Content-Type': 'application/json',
            'AUTH_SESSION_ID': id
          },
          body: JSON.stringify(getGraphqlBody(request.id))
        }
        const rawRes = await fetch("https://play.library.utoronto.ca/api/graphql", options);
        const res = await rawRes.json();
        try {
          updateMeta(request.id, res.data ? res.data.getOneMedia : {});
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
        }
      } else {
        try {
          updateMeta(request.id, {});
        } catch(err) {
          console.log("Failed to send meta:", err);
        }
      }
      const url = `https://play.library.utoronto.ca/api/download/${request.id}.mp4`;
      chrome.downloads.download({
        url: url,
        filename: name,
      });
    })
  }
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