import socket
import json
import subprocess as sp
import os
from threading import Thread
import logging

logging.basicConfig(filename='out.log', format='%(asctime)s %(levelname)-8s %(message)s', datefmt='%Y-%m-%d %H:%M:%S', level=logging.WARNING)
    

# Set up ffmpeg interactions. From https://gist.github.com/AmirSbss/173ba6dc3157fd711d50e2e516bddc7b
def probe(vid_file_path: str):
    ''' Give a json from ffprobe cocmmand line
    @vid_file_path : The absolute (full) path of the video file, string.
    '''
    if type(vid_file_path) != str:
        raise Exception('Give ffprobe a full file path of the video')
        return

    command = ["ffprobe",
            "-loglevel",  "quiet",
            "-print_format", "json",
             "-show_format",
             "-show_streams",
             vid_file_path
             ]

    pipe = sp.Popen(command, stdout=sp.PIPE, stderr=sp.STDOUT)
    out, err = pipe.communicate()
    return json.loads(out.decode('utf-8'))

def ffmpeg(input_file: str, outputfile: str, options: list=[], progress: None or callable=None, progress_args: list=[]):
    logging.warning(f"ffmpeg got command to turn {input_file} into {outputfile}")
    duration = 0
    width = 0
    height = 0
    file_data = probe(input_file)
    data_received = 0
    if 'format' in file_data:
        if 'duration' in file_data['format']:
            duration = float(file_data['format']['duration'])
        if 'width' in file_data['format']:
            width = int(file_data['format']['width'])
            height = int(file_data['format']['height'])
    if 'streams' in file_data:
        for s in file_data['streams']:
            if 'duration' in s:
                duration = float(s['duration'])
            if 'width' in s:
                width = int(s['width'])
                height = int(s['height'])
    last_data = {}
    if progress:
        last_time_progress = 0.0
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("", 0))
            s.listen()
            port = s.getsockname()[1]
            options += ['-progress', 'http://127.0.0.1:{}'.format(port)]
            cmd = '''ffmpeg -i {} {} {} > /dev/null 2>&1 &'''.format(input_file, ' '.join(options), outputfile)
            os.system(cmd)
            conn, addr = s.accept()
            with conn:
                while True:
                    data = conn.recv(1024)
                    data_received += 1
                    if data_received > 1:
                        data = data.decode('utf-8')
                        data = data.replace('\r', '').split('\n')[1:]
                        for i in data:
                            if "=" in i:
                                key, value = i.split("=")
                                last_data[key] = value
                            if progress and "out_time_ms" in last_data:
                                time = int(last_data["out_time_ms"]) / 1000000.0
                                if time - last_time_progress > 1.0 or last_data.get("progress") == "end":
                                    pargs = [duration, time] + progress_args
                                    Thread(target=progress, args=pargs).start()
                                    last_time_progress = time
                    if not data:
                        break
                if last_data.get("progress") != "end":
                    return False
    else:
        cmd = '''ffmpeg -i {} {} {}'''.format(input_file, ' '.join(options), outputfile)
        os.system(cmd)
    last_data["duration"] = int(duration)
    last_data["width"] = width
    last_data["height"] = height
    logging.warning(f"ffmpeg finished turning {input_file} into {outputfile}")
    return last_data