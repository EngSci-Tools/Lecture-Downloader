import boto3
import botocore
import configparser
import logging
import os
import socket
import json
import subprocess as sp
import os
from threading import Thread

from ffmpeg import ffmpeg

# Set up logging
logging.basicConfig(filename='out.log', level=logging.WARNING)

# Read config
configParse = configparser.RawConfigParser()
configParse.read('./config.cfg')

# Set up s3 instance
bucket_name = 'uofteng'
my_config = botocore.config.Config(
    region_name = configParse.get('aws', 'default_region')
)
s3 = boto3.resource('s3',
    aws_access_key_id=configParse.get('aws', 'access_key_id'),
    aws_secret_access_key=configParse.get('aws', 'secret_access_key'),
    config=my_config
)
s3_client = boto3.client('s3',
    aws_access_key_id=configParse.get('aws', 'access_key_id'),
    aws_secret_access_key=configParse.get('aws', 'secret_access_key'),
    config=my_config
)
bucket = s3.Bucket(name=bucket_name)

class Video:
    video_id: str
    # emit
    # duration
    # time
    # process_name

    @property
    def storage_path(self) -> str:
        return os.path.abspath(os.path.join(self.base_path, f"{self.video_id}.mp4"))

    @property
    def chunklist(self):
        return f"https://stream.library.utoronto.ca:1935/MyMedia/play/mp4:1/{self.video_id}.mp4/chunklist.m3u8"

    @property
    def exists(self):
        try:
            logging.warning(f"Checking for file: {self.video_id}.mp4")
            s3.Object(bucket_name, f'{self.video_id}.mp4').load()
        except botocore.exceptions.ClientError as e:
            if e.response['Error']['Code'] == "404":
                logging.warning("File did not exist")
                return False
            else:
                logging.warning(f"Another error occured: {e}")
                return True
        logging.warning("Found file")
        return True

    def __init__(self, id, socketio, downloads, base_path: str = "./tmp"):
        self.video_id = id
        self.emit = socketio.emit
        self.base_path = base_path
        self.downloads = downloads
        os.makedirs(self.base_path, exist_ok=True)

    def get_lecture_meta(self):
        # Grab this info from the database...
        name = 'TestName'
        return name

    def get_download_url(self):
        return f"https://{bucket_name}.s3.amazonaws.com/{self.video_id}.mp4"

    def notify_room_finished(self, failed=False):
        if failed:
            res = {
                "ready": False,
                "link": None,
                "id": self.video_id,
                "message": None,
                "error": failed
            }
            logging.warning("Notifying failed:", res)
            self.emit('finished', res, room=self.video_id, json=True)
        else:
            res = {
                "ready": True,
                "link": self.get_download_url(),
                "id": self.video_id,
                "message": "Download Ready",
                "error": None
            }
            logging.warning("Notifying finished:", res)
            self.emit('finished', res, room=self.video_id, json=True)
        if self.video_id in self.downloads:
            del self.downloads[self.video_id]

    def notify_room_progress(self):
        try:
            res = {
                "duration": self.duration,
                "time": self.time,
                "progress": self.time / self.duration,
                "id": self.video_id
            }
            logging.warning(f"Notifying progress: {res}")
            self.emit('progress', res, room=self.video_id, json=True, broadcast=True)
        except AttributeError as err:
            logging.warning(f"Tried to send progress before progress has been made: {err}")
            res = {
                "duration": 0,
                "time": 0,
                "progress": 0,
                "id": self.video_id
            }
            self.emit('progress', res, room=self.video_id, json=True, broadcast=True)

    def upload_final(self):
        logging.warning("Uploading to bucket")
        logging.warning(f"Starting file upload. Lecture Name: {self.video_id}")
        bucket.upload_file(Filename=self.storage_path, Key=f"{self.video_id}.mp4", ExtraArgs={'ACL':'public-read'})
        logging.warning("Finished file upload")
        self.delete_storage()

    def on_progress(self, duration, time, process_name):
        self.duration = duration
        self.time = time
        self.process_name = process_name
        self.notify_room_progress()

    def start_download(self):
        args = ["-user_agent", '"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_5) AppleWebKit/601.7.8 (KHTML, like Gecko) Version/9.1.3 Safari/537.86.7"', "-c", "copy"]
        self.delete_storage()
        ffmpeg(self.chunklist, self.storage_path, args, self.on_progress, ["Test Progress!"])
        if not os.path.exists(self.storage_path):
            self.notify_room_finished('Video did not exist')
        else:
            self.upload_final()
            self.notify_room_finished()

    def download(self):
        t = Thread(target=self.start_download)
        t.start()

    def delete_storage(self):
        logging.warning("Starting storage deletion")
        if os.path.exists(self.storage_path):
            os.remove(self.storage_path)
        logging.warning("Finished storage deletion")
