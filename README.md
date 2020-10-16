# UofT Lecture Downloader for Google Chrome
University of Toronto online lectures are hidden behind a proprietary site that only allows UofT students to access them. In itself, this is perfectly fine since the students are the ones paying for them. The only problem is, students also cannot view these lectures offline and have to use UofT's clunky video player. To solve this issue and keep UofT's lectures restricted to UofT's students, I created a chrome extension that allows you to download lectures only if you are actively viewing already.

## Usage:
The extension is not yet published on the extension store and it may stay that way since this extension's purpose is to circumvent a university's security measures. We will see how google likes that.
### Frontend - 
The frontend is a chrome extension that checks for web requests made to UofT's video servers. If a request is found, it logs the video id and sends it to the backend to download the video.

**Note: This extension is not published which means it has not been verified as secure by Google. In general, do not execute arbitrary code that you cannot understand. I happen to not be stealing your data or mining bitcoin with your computer, but be careful.**

To download, clone this repository with `git clone https://github.com/Veldrovive/Lecture-Downloader` or download the zip file. To install, navigate to the extensions page (chrome://extensions/), toggle developer mode in the top right corner, click on `Load Unpacked` in the top left corner, and select the unpacked directory that contains this repository. Toggle `UofT Video Downloader` to on and navigate to a page that has a UofT lecture on it.

Click on the UofT icon in the extension bar to open the downloading popup. If the lecture has a title, it has already been processed and can be immediately downloaded. If the popup has a title of `Lecture Not Processed Yet` then you must enter the course code, lecture number, and lecture title then press `Process Video` to send it to the backend. There, the stream will be downloaded and processed into an mp4 that you can view on your computer. This process can take a couple of minutes. After it is finished, the popup will have a `Download` button that will directly download the video.
### Backend - 
The backend uses a python script to pull video fragments from UofT's servers, concatenate them with FFmpeg, and store them in an amazon s3 bucket so that they can be downloaded without waiting once they have been processed once. Users do not have to run the backend themselves since it is always running on my webserver.

If you do wish to run the backend locally, you need to update the configuration files appropriately. You must overwrite the `config.cfg.example` with your email and AWS certs and rename it `config.cfg`. 
The extension backend can be run locally by installing FFmpeg and running the `concat.py` file in python 3.7. The server will start on port 5000. If you want to dockerize the script, run `docker build --tag uoft_lectures .` and then `docker run -d -p 5000:5000 --name uoft_lectures uoft_lectures` to start it in daemon mode.
