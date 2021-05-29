from flask import Flask, render_template
from flask_socketio import SocketIO, join_room, leave_room, send, emit
import logging

from video import Video
from db import DB

# Set up logging
logging.basicConfig(filename='out.log', level=logging.WARNING)

app = Flask(__name__, static_url_path="", static_folder = "./dist", template_folder = "./dist")
# app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app)
socketio.init_app(app, cors_allowed_origins="*")  # async_mode='threading'

database = DB()

@socketio.on('test')
def test(i):
    logging.warning(f'Test: {i}')
    join_room('testers')
    emit('test', 'Got test', room='testers')

downloading = {}

@socketio.on('addMeta')
def add_meta(meta):
    logging.warning(f'Adding meta: {meta}')
    database.insert(meta['id'], meta)


@socketio.on('download')
def download(meta):
    if "id" not in meta:
        res = {
            "ready": False,
            "link": None,
            "id": None,
            "message": None,
            "error": "No id sent"
        }
        emit('finished', res)
    id = meta["id"]
    logging.warning(f'Downloading: {id}')
    to_download = False
    if id in downloading:
        video = downloading[id]
        logging.warning("Already downloading/downloaded")
    else:
        video = Video(id, socketio, downloading)
        downloading[id] = video
        to_download = True
        logging.warning("Starting download/existence check")
    # Check if the specified id has already been downloaded. If so, send a response with the link.
    if (video.exists):
        res = {
            "ready": True,
            "link": video.get_download_url(),
            "id": video.video_id,
            "message": "Download Ready",
            "error": None
        }
        logging.warning(f"Already exists: {res}")
        emit('finished', res, json=True)
    else:
        # Otherwise, we start the download and add this user to the room that recieves updates
        join_room(id)
        if to_download:
            # Then we need to start a download for this video. We pass an emit object to the downloader so that it can push updates
            video.download()
        else:
            # Then we should update all the users with the progress
            video.notify_room_progress()

@app.route('/timeSummary', methods=['GET'])
def time_summary():
    return 'None'

@app.route('/indivTimeSummary', methods=['GET'])
def indiv_time_summary():
    return 'None'

@app.route('/summary/<limit>', methods=['GET'])
def summary(limit):
    return 'None'

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=80, debug = False)