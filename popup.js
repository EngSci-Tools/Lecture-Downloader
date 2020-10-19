let getVideo = document.getElementById('getVideo');
let refresh = document.getElementById('refresh');
let directDownload = document.getElementById('directDownload');
let emailInput = document.getElementById('emailInput');
let nameBox = document.getElementById('nameBox');
let courseNameInput = document.getElementById('courseNameInput');
let lectureNumberInput = document.getElementById('lectureNumberInput');
let nameInput = document.getElementById('nameInput');
let messageText = document.getElementById('messageText');
let timeSince = document.getElementById('timeSince');
let titleText = document.getElementById('titleText');
let resText = document.getElementById('resText');
let progress = document.getElementById('progress')

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
  progress.style.display = "none";
  directDownload.style.display = "none";
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
  progress.style.display = "none";
  directDownload.style.display = "block";
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
    progress.style.display = "none";
    directDownload.style.display = "block";
    timeSince.innerHTML = `Time since refresh: ${getTimeSinceDetection()}`
    titleText.innerHTML = "Lecture Not Processed Yet"
    messageText.innerHTML = "This lecture needs to be processed before it can be downloaded. Please give this lecture a name to be saved under. If you want to be notified when the processing is done, add your email. Since the video needs to be downloaded to the server, this can take up to 10 minutes although it is usually closer to 2.";
  });
}

getVideo.onclick = async () => {
  if (current_video && current_video.exists) {
    // Then we dont need a name or email
    const res = await sendRequest(current_video.video)
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
    const res = await sendRequest(current_video.video,
      emailInput.value,
      courseNameInput.value,
      lectureNumberInput.value,
      nameInput.value
    )
    resText.innerHTML = res;
    resText.style.display = "block";
  }
}

directDownload.onclick = () => {
  chrome.downloads.download({
    url: `https://mymedia.library.utoronto.ca/api/download/${current_video.video}.mp4`,
    filename: "lecture.mp4"
  })
}

refresh.onclick = () => {
  chrome.runtime.sendMessage('refresh_lecture');
}

async function sendRequest(videoId, email, courseCode, lectureNumber, lectureName) {
  const res = await (await fetch(`http://${baseUrl}/getVideo/${videoId}`, {
    method: "POST",
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email, lectureName, lectureNumber, courseCode
    })
  })).json()
  console.log("Backend returned: ", res);
  if ("time_till_complete" in res && res["time_till_complete"] > 0) {
    // Then we want to display the time until complete and progress
    progress.innerHTML = `Progress: ${Math.round(res["progress"]*100)}% - Time Until Finished: ${res["time_till_complete"]}`
    progress.style.display = "block";
  }
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