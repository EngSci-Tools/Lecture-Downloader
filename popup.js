let getVideo = document.getElementById('getVideo');
let refresh = document.getElementById('refresh');
let emailInput = document.getElementById('emailInput');
let nameBox = document.getElementById('nameBox');
let courseNameInput = document.getElementById('courseNameInput');
let lectureNumberInput = document.getElementById('lectureNumberInput');
let nameInput = document.getElementById('nameInput');
let messageText = document.getElementById('messageText');
let timeSince = document.getElementById('timeSince');
let titleText = document.getElementById('titleText');
let resText = document.getElementById('resText');

const baseUrl = "lectures.aidandev.ca"

const states = ["NoVideo", "CanDownload", "CanRequest"]

let current_video = null;

function pullBackgroundData() {
  chrome.storage.sync.get(['uoft_eng_downloader_current_video'], function(result) {
    const data = result.uoft_eng_downloader_current_video;
    if (data) {
      const {exists} = data;
      current_video = data;
      if (exists) {
        // Then we just need to download
        setupDownload();
      } else {
        // Then we need to proccess
        setupProcess();
      }
    }
  })
}

function setupDefault() {
  getVideo.style.display = "none";
  refresh.style.display = "none";
  emailInput.style.display = "none";
  nameBox.style.display = "none";
  timeSince.style.display = "none";
  messageText.innerHTML = "Please play a UofT lecture. When a playback is detected, it will appear here.";
  titleText.innerHTML = "No Lecture Found"
}

function getLectureName() {
  let name = "";
  if (current_video.courseCode && current_video.courseCode.length > 0) {
    name += current_video.courseCode;
  }
  if (current_video.lectureNumber && current_video.lectureNumber.length > 0) {
    name += `: Lecture ${current_video.lectureNumber}`;
  }
  if (current_video.lectureName && current_video.lectureName.length > 0) {
    name += ` - ${current_video.lectureName}`;
  }
  if (name.length === 0) {
    name = "No Name";
  }
  return name;
}

function timeDelta(date) {

  var seconds = Math.floor((new Date() - date) / 1000);

  var interval = seconds / 31536000;

  if (interval > 1) {
    return Math.floor(interval) + " years";
  }
  interval = seconds / 2592000;
  if (interval > 1) {
    return Math.floor(interval) + " months";
  }
  interval = seconds / 86400;
  if (interval > 1) {
    return Math.floor(interval) + " days";
  }
  interval = seconds / 3600;
  if (interval > 1) {
    return Math.floor(interval) + " hours";
  }
  interval = seconds / 60;
  if (interval > 1) {
    return Math.floor(interval) + " minutes";
  }
  return Math.floor(seconds) + " seconds";
}

function getTimeSinceDetection() {
  if (!current_video) {
    return "No Video"
  }
  const detectionTime = new Date(current_video.detection_time);
  return timeDelta(detectionTime);
}

function setupDownload() {
  getVideo.innerHTML = "Download Video";
  getVideo.style.display = "block";
  refresh.style.display = "none";
  emailInput.style.display = "none";
  nameBox.style.display = "none";
  timeSince.style.display = "none";
  timeSince.innerHTML = `Time since refresh: ${getTimeSinceDetection()}`
  const name = getLectureName();
  titleText.innerHTML = name;
  messageText.innerHTML = `This lecture is ready for download!`;
}

function setupProcess() {
  getVideo.innerHTML = "Process Video";
  chrome.storage.sync.get(['uoft_eng_downloader_email'], function(result) {
    const email = result.uoft_eng_downloader_email;
    if (email) {
      emailInput.value = email;
    }
    getVideo.style.display = "block";
    refresh.style.display = "block";
    emailInput.style.display = "block";
    nameBox.style.display = "flex";
    timeSince.style.display = "block";
    timeSince.innerHTML = `Time since refresh: ${getTimeSinceDetection()}`
    titleText.innerHTML = "Lecture Not Processed Yet"
    messageText.innerHTML = "This lecture needs to be processed before it can be downloaded. Please give this lecture a name to be saved under. If you want to be notified when the processing is done, add your email. Since the video needs to be downloaded to the server, this can take up to 10 minutes although it is usually closer to 2.";
  });
}

getVideo.onclick = async () => {
  if (current_video && current_video.exists) {
    // Then we dont need a name or email
    const res = await sendRequest(current_video.video, current_video.request)
    resText.innerHTML = res;
    resText.style.display = "block";
  } else {
    // Then we need an email and name
    const email =emailInput.value;
    const courseCode = courseNameInput.value;
    const lectureNumber = lectureNumberInput.value;
    const lectureName = nameInput.value;
    if (!(courseCode && lectureNumber && lectureName)) {
      resText.innerHTML = "Please input a Course Code, Lecture Number, and Lecture Name";
      resText.style.display = "block";
      return;
    }
    const res = await sendRequest(current_video.video, current_video.request,
      emailInput.value,
      courseNameInput.value,
      lectureNumberInput.value,
      nameInput.value
    )
    resText.innerHTML = res;
    resText.style.display = "block";
  }
}

refresh.onclick = () => {
  chrome.runtime.sendMessage('refresh_lecture');
}

async function sendRequest(videoId, requestId, email, courseCode, lectureNumber, lectureName) {
  const res = await (await fetch(`http://${baseUrl}/getVideo/${videoId}/${requestId}`, {
    method: "POST",
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email, lectureName, lectureNumber, courseCode
    })
  })).json()
  console.log("Backend returned: ", res);
  if ("link" in res && res["link"]) {
    console.log("Downloading: ", res["link"])
    const rawFilename = `${current_video.courseCode}_lec_${current_video.lectureNumber}_${current_video.lectureName}`
    const fileName = rawFilename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    chrome.downloads.download({
      url: res["link"],
      filename: fileName+".mp4",
    });
  }
  if ("message" in res && res["message"]) {
    return res["message"]
  }
  return
}

chrome.storage.onChanged.addListener(function(changes) {
  if ('uoft_eng_downloader_current_video' in changes) {
    console.log("Refreshing background changes.");
    pullBackgroundData();
  }
});

window.setInterval(() => {
  timeSince.innerHTML = `Time since refresh: ${getTimeSinceDetection()}`
}, 1000)

setupDefault();
pullBackgroundData();

// let startLogging = document.getElementById('startLogging');
// let getVideo = document.getElementById('getVideo');
// let emailInput = document.getElementById('emailInput');
// let messageText = document.getElementById('messageText');
// let resText = document.getElementById('resText');

// let logging = false;
// let urlTest = /(https:\/\/stream.library.utoronto.ca:1935\/MyMedia\/play\/mp4:1\/)(.+)(.mp4\/media_w)(.+)(_)(.+)(.ts)/g
// let currentVideo = null;

// function setMessageToCurrentVideo() {
//   let message = "";
//   if (!currentVideo && !logging) {
//     message = "Not Logging.";
//     getVideo.style.display = "none";
//     emailInput.style.display = "none";
//   } else if (!currentVideo && logging) {
//     message = "Searching For Video...";
//     getVideo.style.display = "none";
//     emailInput.style.display = "none";
//   } else {
//     // message = `Video Found - id: ${currentVideo.video}, request: ${currentVideo.request}`;
//     message = "Video Found. The video can take a while to download and process, so we ask for your email so that we can send you a link to the email once it has finished."
//     if (getVideo.style.display !== "block") {
//       chrome.storage.sync.get(['uoft_eng_downloader_email'], function(result) {
//         const email = result.uoft_eng_downloader_email;
//         if (email) {
//           emailInput.value = email;
//         }
//         getVideo.style.display = "block";
//         emailInput.style.display = "block";
//       });
//     }
//   }
//   messageText.innerHTML = message;
// }

// function updateLoggingButton() {
//   if (logging) {
//     startLogging.innerHTML = "Stop Logging";
//   } else {
//     startLogging.innerHTML = "Start Logging";
//   }
// }

// function onRequest(details) {
//   urlTest.lastIndex = 0;
//   const url = details.url;
//   if(urlTest.test(url)) {
//     urlTest.lastIndex = 0;
//     const matches = urlTest.exec(url);
//     const videoId = matches[2], requestId = matches[4];
//     currentVideo = {video: videoId, request: requestId};
//     setMessageToCurrentVideo();
//   }
// }

// function toggleLogging() {
//   if (logging) {
//     console.log("Stopping logging");
//     chrome.webRequest.onBeforeRequest.removeListener(onRequest);
//   } else {
//     console.log("Starting logging");
//     currentVideo = null;
//     chrome.webRequest.onBeforeRequest.addListener(
//       onRequest,
//       {urls: ["<all_urls>"]}
//     )
//   }
//   logging = !logging;
//   setMessageToCurrentVideo()
//   updateLoggingButton();
// }

// startLogging.onclick = () => {
//   toggleLogging()
// }

// getVideo.onclick = async () => {
//   chrome.storage.sync.set({uoft_eng_downloader_email: emailInput.value});
//   const res = await (await fetch(`http://localhost:5000/getVideo/${currentVideo.video}/${currentVideo.request}`, {
//     method: "POST",
//     headers: {
//       'Content-Type': 'application/json'
//     },
//     body: JSON.stringify({
//       "email": emailInput.value
//     })
//   })).json()
//   console.log("Backend returned: ", res);
//   if ("message" in res) {
//     resText.style.display = "block";
//     resText.innerHTML = res["message"];
//   }
//   if ("link" in res) {
//     console.log("Downloading: ", res["link"])
//     chrome.downloads.download({
//       url: res["link"],
//       filename: "lecture.mp4",
//     });
//   }
// }

// console.log("Starting")
// toggleLogging()