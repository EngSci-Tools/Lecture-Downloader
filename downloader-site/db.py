import configparser
import logging
import psycopg2
import datetime

# Set up logging
logging.basicConfig(filename='out.log', format='%(asctime)s %(levelname)-8s %(message)s', datefmt='%Y-%m-%d %H:%M:%S', level=logging.WARNING)

# Read config
configParse = configparser.RawConfigParser()
configParse.read('./config.cfg')

user = configParse.get('database', 'user')
host = configParse.get('database', 'host')
database = configParse.get('database', 'database')
password = configParse.get('database', 'password')
port = configParse.get('database', 'port')

class DB:
    def __init__(self):
        self.conn = psycopg2.connect(f"dbname='{database}' user='{user}' host='{host}' password='{password}' port='{port}'")
        self.setup_table()

    def setup_table(self):
        query = """
            CREATE TABLE IF NOT EXISTS logs (
                time timestamptz PRIMARY KEY,
                filename VARCHAR(50) NOT NULL,
                description TEXT,
                thumbnail TEXT,
                extension VARCHAR(5),
                title TEXT,
                uploaded timestamptz,
                duration NUMERIC,
                username VARCHAR(50),
                fromsite BOOLEAN,
                success BOOLEAN
            );
        """
        with self.conn.cursor() as cur:
            cur.execute(query)
            print("Added table")
        self.conn.commit()

    def insert(self, id, meta):
        try:
            extension = meta['extension']
            title = meta['title']
            description = meta['description']
            uploaded = meta['uploaded']
            thumbnailURL = meta['thumbnailURL']
            duration = meta['duration']
            user = meta['user']
            fromsite = meta['fromsite'] if 'fromsite' in meta else False
            success = meta['success'] if 'success' in meta else True
        except KeyError:
            print('Insert meta incomplete:', meta)
            return False

        username = ""
        if user:
            try:
                username = f"{user['firstName']} {user['lastName']}"
            except Exception as err:
                print("A thing went wrong with the username: ", err) # Eh, don't care enough
        
        upload_date = None
        if uploaded:
            uploaded_date = datetime.datetime.strptime(uploaded, "%d %b %Y")
        
        query = "INSERT INTO logs(time, filename, description, thumbnail, extension, title, uploaded, duration, username, fromsite, success) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
        values = ( datetime.datetime.now(), id, description, thumbnailURL, extension, title, upload_date, duration, username, fromsite, success )
        with self.conn.cursor() as cur:
            cur.execute(query, values)
        self.conn.commit()
