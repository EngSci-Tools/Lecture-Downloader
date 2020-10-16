// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

const baseUrl = "lectures.aidandev.ca"

'use strict';

chrome.runtime.onInstalled.addListener(function() {
  chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
    chrome.declarativeContent.onPageChanged.addRules([{
      conditions: [new chrome.declarativeContent.PageStateMatcher({
        pageUrl: {},
      })
      ],
          actions: [new chrome.declarativeContent.ShowPageAction()]
    }]);
  });
});

async function updateVideo(videoId, requestId) {
  const res = await (await fetch(`http://${baseUrl}/getData/${videoId}`, {
    method: "GET",
  })).json();
  console.log("Video updating");
  const video = {
    video: videoId, request: requestId,
    lectureNumber: res.lectureNumber,
    courseCode: res.courseCode,
    lectureName: res.lectureName,
    exists: res.exists,
    detection_time: Date.now()
  };
  chrome.storage.sync.set({uoft_eng_downloader_current_video: video});
}

let urlTest = /(https:\/\/stream.library.utoronto.ca:1935\/MyMedia\/play\/mp4:1\/)(.+)(.mp4\/media_w)(.+)(_)(.+)(.ts)/g
async function onRequest(details) {
  console.log(details);
  urlTest.lastIndex = 0;
  const url = details.url;
  if(urlTest.test(url)) {
    urlTest.lastIndex = 0;
    const matches = urlTest.exec(url);
    const videoId = matches[2], requestId = matches[4];
    const currentVideo = {video: videoId, request: requestId};
    console.log("Got a video: ", currentVideo)
    updateVideo(videoId, requestId);
  }
}

chrome.alarms.create("refreshVideo", {
  delayInMinutes: 1,
  periodInMinutes: 1
});

chrome.alarms.onAlarm.addListener(function(alarm) {
  if (alarm.name === "refreshVideo") {
    chrome.storage.sync.get(['uoft_eng_downloader_current_video'], function(result) {
      const data = result.uoft_eng_downloader_current_video;
      if (data) {
        const {video, request} = data;
        console.log("Refreshing: ", video, request);
        updateVideo(video, request);
      }
    })
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request === "refresh_lecture") {
    chrome.storage.sync.get(['uoft_eng_downloader_current_video'], function(result) {
      const data = result.uoft_eng_downloader_current_video;
      if (data) {
        const {video, request} = data;
        console.log("Refreshing: ", video, request);
        updateVideo(video, request);
      }
    })
  }
})

chrome.webRequest.onBeforeRequest.addListener(
  onRequest,
  {urls: ["*://*.utoronto.ca/*"]}
);