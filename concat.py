import flask
from flask import request
import ffmpeg
import os
import boto3
import botocore
import logging
from typing import Set
import smtplib, ssl
import glob
import requests
import time
import shutil
import configparser
from threading import Thread
import datetime
from flask_cors import CORS
import m3u8

from gevent.pywsgi import WSGIServer

requests.packages.urllib3.disable_warnings() 

# Set up logging
logging.basicConfig(filename='out.log', level=logging.INFO)

# Read config
configParse = configparser.RawConfigParser()
configParse.read('./config.cfg')

# Set up s3 instance
bucket_name = 'uofteng'
s3 = boto3.resource('s3',
    aws_access_key_id=configParse.get('aws', 'access_key_id'),
    aws_secret_access_key=configParse.get('aws', 'secret_access_key')
)
s3_client = boto3.client('s3',
    aws_access_key_id=configParse.get('aws', 'access_key_id'),
    aws_secret_access_key=configParse.get('aws', 'secret_access_key')
)
bucket = s3.Bucket(name=bucket_name)

# Set up email client
port = 465  # For SSL
app_email = configParse.get('email', 'email')
password = configParse.get('email', 'password')
email_context = ssl.create_default_context()

with smtplib.SMTP_SSL("smtp.gmail.com", port, context=email_context) as server:
    server.login(app_email, password)
    server.sendmail(app_email, app_email, "Subject: UofT Downloader started\nUofT Eng Downloader has started")

class RequestsClient():
    def download(self, uri, timeout=None, headers={}, verify_ssl=False):
        o = requests.get(uri, verify=False)
        return o.text, o.url
class Video:
    video_id: str
    request_id: str

    prop_complete: float = -1
    time_till_finished: float = -1

    slices: m3u8.M3U8

    waiting_emails: Set[str]

    download_rest_period: float = 1
    
    downloading: bool = False

    @property
    def storage_path(self) -> str:
        return os.path.abspath(os.path.join(self.base_path, self.video_id))

    def __init__(self, video_id: str, base_path: str = "./tmp"):
        self.video_id = video_id
        self.base_path = base_path
        self.waiting_emails = set()

        os.makedirs(self.storage_path, exist_ok=True)

    def add_waiting_user(self, email: str):
        self.waiting_emails.add(email)

    def exists(self, file_type: str = "mp4"):
        try:
            logging.info(f"Checking for file: {self.video_id}.{file_type}")
            s3.Object(bucket_name, f'{self.video_id}.{file_type}').load()
        except botocore.exceptions.ClientError as e:
            if e.response['Error']['Code'] == "404":
                logging.info("File did not exist")
                return False
            else:
                logging.info("Another error occured")
                return True
        logging.info("Found file")
        self.prop_complete = 1
        self.time_till_finished = 0
        return True

    def get_lecture_meta(self, file_type: str = "mp4"):
        lecture = s3_client.head_object(Bucket=bucket_name, Key=f"{self.video_id}.{file_type}")
        try:
            name = lecture["Metadata"]["lecture-name"]
            course_code = lecture["Metadata"]["course-code"]
            lecture_number = lecture["Metadata"]["lecture-number"]
        except KeyError:
            name = ""
            course_code = ""
            lecture_number = ""
        # lecture = s3.Object(bucket_name, f'{self.video_id}.{file_type}').load()
        # TODO: Extract the file name from this.
        return course_code, lecture_number, name

    def get_download_url(self, file_type: str = "mp4"):
        return f"https://{bucket_name}.s3.amazonaws.com/{self.video_id}.{file_type}"

    def notify_waiting_users(self, file_type: str = "mp4"):
        logging.info(f"Starting to send emails to: {self.waiting_emails}")
        with smtplib.SMTP_SSL("smtp.gmail.com", port, context=email_context) as server:
            server.login(app_email, password)
            for user in self.waiting_emails:
                logging.info(f"Sending email to {user}")
                try:
                    server.sendmail(app_email, user, f"Subject: Your lecture is ready for download\n\nYour video processing has finished. Access it at the following link: {self.get_download_url(file_type)}")
                    logging.info(f"Sent email to {user}")
                except Exception: # I don't know all the Exceptions that could be throw and I'm too lazy to check. If the user did something wrong that's on them.
                    logging.info(f"Failed to send email to: {user}")

    def get_slice_info(self):
        self.slices = m3u8.load(f"https://stream.library.utoronto.ca:1935/MyMedia/play/mp4:1/{self.video_id}.mp4/chunklist.m3u8", http_client=RequestsClient())

    def get_blob_url(self, slice_id: str):
        return f"https://stream.library.utoronto.ca:1935/MyMedia/play/mp4:1/{self.video_id}.mp4/{slice_id}"

    def get_progress(self):
        return {
            "progress": self.prop_complete,
            "time_till_finished": self.time_till_finished
        }

    def download_streams(self):
        self.prop_complete = 0
        self.time_till_finished = len(self.slices.files) * 1.3
        curr_time = datetime.datetime.now()
        start_time = curr_time
        logging.info("Starting stream download")
        for i, path in enumerate(self.slices.files):
            self.prop_complete = i/len(self.slices.files)
            new_time = datetime.datetime.now()
            time_elapsed = new_time - start_time
            if self.prop_complete == 0:
                self.time_till_finished = -1
            else:
                self.time_till_finished = (time_elapsed / self.prop_complete) - time_elapsed
            logging.info(f"Time since last clip grab: {new_time - curr_time}. Percent complete: {round(self.prop_complete*100)}%. Time till complete: {self.time_till_finished}")
            curr_time = new_time
            if not os.path.exists(os.path.join(self.storage_path, f"{i}.ts")):
                logging.info(f"Requesting: {self.get_blob_url(path)}")
                r = requests.get(self.get_blob_url(path), verify=False)
                if r.status_code == 200:
                    with open(os.path.join(self.storage_path, f"{i}.ts"), "wb") as file:
                        file.write(r.content)
            time.sleep(self.download_rest_period)
        self.prop_complete = 1
        self.time_till_finished = 0
        logging.info("Finished stream download")

    def concatenate_streams(self, file_type: str = "mp4"):
        logging.info("Starting stream concat")
        stream_files = glob.glob(os.path.join(self.storage_path, "*.ts"))
        indices = sorted([int(file[len(self.storage_path)+1:-3]) for file in stream_files])
        concat_string = f"concat:{'|'.join([os.path.join(self.storage_path, f'{count}.ts') for count in indices])}"
        out = ffmpeg.input(concat_string).output(os.path.join(self.storage_path, f'final.{file_type}'), c='copy')
        out.run()
        logging.info("Finished stream concat")

    def upload_final(self, course_code: str = "", lecture_number: str = "", lecture_name: str = "", file_type: str = "mp4"):
        if lecture_name is None:
            lecture_name = ""
        logging.info(f"Starting file upload. Lecture Name: {lecture_name}")
        bucket.upload_file(Filename=os.path.join(self.storage_path, f"final.{file_type}"), Key=f"{self.video_id}.mp4", ExtraArgs={'ACL':'public-read', "Metadata": {"course-code": course_code, "lecture-number": lecture_number, "lecture-name": lecture_name}})
        logging.info("Finished file upload")

    def delete_storage(self):
        logging.info("Starting storage deletion")
        shutil.rmtree(self.storage_path, ignore_errors=True)
        logging.info("Finished storage deletion")

    def download_and_concat(self, course_code: str = "", lecture_number: str = "", lecture_name: str = "", file_type: str = "mp4"):
        self.downloading = True
        self.get_slice_info()
        self.download_streams()
        self.concatenate_streams(file_type)
        self.upload_final(course_code, lecture_number, lecture_name, file_type)
        self.notify_waiting_users(file_type)
        self.delete_storage()
        self.downloading = False

    def create_video(self, course_code: str = "", lecture_number: str = "", lecture_name: str = "", file_type: str = "mp4"):
        if self.exists():
            return {
                "link": self.get_download_url(), 
                "message": f"Video already generated. Download should start momentarily. If download does not start automatically, click <a href='{self.get_download_url(file_type)}'>here</a>.",
                "progress": self.prop_complete,
                "time_till_complete": self.time_till_finished.total_seconds()
            }
        if self.downloading:
            return {
                "link": None, 
                "message": "Video is currently being processed. Check back in a few minutes to see if it has finished.",
                "progress": self.prop_complete,
                "time_till_complete": self.time_till_finished.total_seconds()
            }
        self.get_slice_info()
        if len(self.slices.files) == 0:
            return {
            "link": None, 
            "message": "Video not found on server. Please check the video id.",
            "progress": -1,
            "time_till_complete": -1
        }
        thread = Thread(target=self.download_and_concat, kwargs={"course_code": course_code, "lecture_number": lecture_number, "lecture_name": lecture_name, "file_type": file_type})
        thread.start()
        return {
            "link": None, 
            "message": "Video processing started. This process can take upwards of ten minutes depending on how long the video is.",
            "progress": 0,
            "time_till_complete": len(self.slices.files) * 1.3
        }

    def __del__(self):
        self.delete_storage()
        

app = flask.Flask(__name__)
app.config["DEBUG"] = True

def get_request_meta(request, key, default):
    try:
        return request.json[key]
    except KeyError:
        return default

videos = {}
@app.route('/getVideo/<videoId>', defaults={'requestId': None}, methods=["POST"])
@app.route('/getVideo/<videoId>/<requestId>', methods=["POST"])
def get_video(videoId, requestId):
    file_type = get_request_meta(request, 'fileType', 'mp4')
    email = get_request_meta(request, 'email', None)
    lecture_name = get_request_meta(request, 'lectureName', '')
    lecture_number = get_request_meta(request, 'lectureNumber', '')
    course_code = get_request_meta(request, 'courseCode', '')

    logging.info(f"Saving lecture under name: {lecture_name} and sending to email: {email}")

    if videoId in videos:
        video = videos[videoId]
    else:
        video = Video(videoId)
        videos[videoId] = video
    if video.exists(file_type):
        return {
            "link": video.get_download_url(file_type),
            "message": f"Video already generated. Download should start momentarily. If download does not start automatically, click <a href='{video.get_download_url(file_type)}'>here</a>.",
            "progress": 1,
            "time_till_complete": 0
        }
    if email:
        video.add_waiting_user(email)
    res = video.create_video(course_code, lecture_number, lecture_name, file_type)
    return res
    

@app.route('/getData/<videoId>', methods=["GET"])
def get_info(videoId):
    if videoId in videos:
        video = videos[videoId]
    else:
        video = Video(videoId, "None")
    
    exists = video.exists()
    name = None
    code = None
    number = None
    if exists:
        code, number, name = video.get_lecture_meta()
    return {"exists": exists, "courseCode": code, "lectureNumber": number, "lectureName": name}

@app.route('/', methods=["GET"])
def home():
    return "Hello World"

# app.run(host='0.0.0.0')
CORS(app)
http_server = WSGIServer(('0.0.0.0', 5000), app)
http_server.serve_forever()