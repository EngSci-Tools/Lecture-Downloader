# UofT Lecture Downloader for Google Chrome
University of Toronto online lectures are hidden behind a proprietary site that only allows UofT students to access them. In itself, this is perfectly fine since the students are the ones paying for them. The only problem is, students also cannot view these lectures offline and have to use UofT's clunky video player. To solve this issue and keep UofT's lectures restricted to UofT's students, I created a chrome extension that allows you to download lectures only if you are actively viewing already.

## Usage:
The extension is not yet published on the extension store and it may stay that way since this extension's purpose is to circumvent a university's security measures. We will see how google likes that.
### Frontend - 
The frontend is a chrome extension that checks for web requests made to UofT's video servers. If a request is found, it logs the video id and sends it to the backend to download the video.

**Note: This extension is not published which means it has not been verified as secure by Google. In general, do not execute arbitrary code that you cannot understand. I happen to not be stealing your data or mining bitcoin with your computer, but be careful.**

To download, clone this repository with `git clone https://github.com/Veldrovive/Lecture-Downloader` or download the [zip file](https://github.com/Veldrovive/Lecture-Downloader/archive/main.zip). To install, navigate to the extensions page (chrome://extensions/), toggle developer mode in the top right corner, click on `Load Unpacked` in the top left corner, and select the unpacked directory that contains this repository. Toggle `UofT Video Downloader` to on and navigate to a page that has a UofT lecture on it. A dowload button should appear next to the lecture.

This will work with lectures that are displayed as videos on a page or that are linked to in text. It also bypasses restrictions with published lectures so unpublished lectures can also be downloaded.
