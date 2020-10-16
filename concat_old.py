import flask
from moviepy.editor import VideoFileClip, concatenate_videoclips
from flask import send_from_directory, request
import os
import uuid
import requests
import base64
import re
import boto3
import botocore
from threading import Thread
import shutil
import configparser
import logging
import time
logging.basicConfig(filename='out.log', level=logging.INFO)

base_path = os.getcwd()

import smtplib, ssl
port = 465  # For SSL
configParse = configparser.RawConfigParser()
configParse.read('./email_config.cfg')

app_email = configParse.get('email', 'email')
password = configParse.get('email', 'password')

context = ssl.create_default_context()
with smtplib.SMTP_SSL("smtp.gmail.com", port, context=context) as server:
    server.login(app_email, password)
    server.sendmail(app_email, app_email, "Subject: UofT Downloader started\nUofT Eng Downloader has started")

    bucket_name = 'uofteng'

    s3 = boto3.resource('s3')
    bucket = s3.Bucket(name=bucket_name)
    logging.info(f"Got Bucket: {bucket}")

    app = flask.Flask(__name__)
    app.config["DEBUG"] = True

    def uuid_url64():
        """Returns a unique, 16 byte, URL safe ID by combining UUID and Base64"""
        rv = base64.b64encode(uuid.uuid4().bytes).decode('utf-8')
        return re.sub(r'[\=\+\/]', lambda m: {'+': '-', '/': '_', '=': ''}[m.group(0)], rv)

    def getBlobUrl(videoId, requestId, sliceIndex):
        return f"https://stream.library.utoronto.ca:1935/MyMedia/play/mp4:1/{videoId}.mp4/media_w{requestId}_{sliceIndex}.ts"

    def checkExists(key):
        try:
            logging.info(f"Checking for file: {key}.mp4")
            s3.Object(bucket_name, f'{key}.mp4').load()
        except botocore.exceptions.ClientError as e:
            if e.response['Error']['Code'] == "404":
                logging.info("File did not exist")
                return False
            else:
                logging.info("Another error occured")
                return True
        logging.info("Found file")
        return True

    def getDownloadUrl(key):
        return f"https://{bucket_name}.s3.amazonaws.com/{key}.mp4"

    def get_path_to(file):
        return os.path.abspath(os.path.join(base_path, file))

    waiting_users = {}
    def email_users(key):
        for user in waiting_users[key]:
            logging.info(f"Sending email to {user}")
            try:
                server.sendmail(app_email, user, f"Subject: Your lecture is ready for download\n\nYour video processing has finished. Access it at the following link: {getDownloadUrl(key)}")
            except Exception:
                logging.info(f"Failed to send email to: {user}")
        del waiting_users[key]

    def create_video(videoId, requestId):
        logging.info("Downloader thread started")
        os.makedirs(get_path_to(f"tmp/{videoId}"), exist_ok=True)
        videos = []
        count = 0
        while True:
            if not os.path.exists(get_path_to(f"tmp/{videoId}/{count}.ts")):
                logging.info(f"Getting clip: {count}")
                r = requests.get(getBlobUrl(videoId, requestId, count), verify=False)
                if r.status_code == 404:
                    break
                else:
                    with open(get_path_to(f"tmp/{videoId}/{count}.ts"), "wb") as file:
                        file.write(r.content)
            videos.append(VideoFileClip(get_path_to(f"tmp/{videoId}/{count}.ts")))
            count += 1
            time.sleep(2)
        logging.info("Finished getting clips. Starting Concatenation.")
        final_clip = concatenate_videoclips(videos)
        logging.info("Finished Concatenation. Starting file write.")
        final_clip.write_videofile(get_path_to(f"tmp/{videoId}/final.mp4"))
        logging.info("Finished writing file. Starting upload.")
        bucket.upload_file(Filename=get_path_to(f"tmp/{videoId}/final.mp4"), Key=f"{videoId}.mp4", ExtraArgs={'ACL':'public-read'})
        logging.info("Finished upload. Starting emails.")
        email_users(videoId)
        logging.info("Finished emails. Deleting temp dir.")
        shutil.rmtree(get_path_to(f"tmp/{videoId}"), ignore_errors=True)
        logging.info("Finished deleting temp dir. Everything is done.")

    @app.route('/getVideo/<videoId>/<requestId>', methods=["POST"])
    def get_video(videoId, requestId):
        os.makedirs("tmp", exist_ok=True)
        if checkExists(videoId):
            return {"link": getDownloadUrl(videoId), "message": f"Full video has already been generated. Download should start momentarily. If it does not, click the following <a href='{getDownloadUrl(videoId)}'>link<a/>."}
        email = request.json['email']
        if videoId in waiting_users:
            waiting_users[videoId].add(email)
        else:
            waiting_users[videoId] = set([email])
        logging.info(f"Users waiting for: {videoId} are {waiting_users[videoId]}")
        if os.path.exists(get_path_to(f"tmp/{videoId}")):
            return {"message": "Downloading. A link will be sent to your email once it is finished. This may take up to ten minutes."}
        thread = Thread(target=create_video, kwargs={"videoId": videoId, "requestId": requestId})
        logging.info("Starting downloader thread.")
        thread.start()
        return {"message": "Downloading. A link will be sent to your email once it is finished. This may take up to ten minutes."}

    @app.route('/', methods=["GET"])
    def home():
        return "Hello World"

    app.run(host='0.0.0.0')