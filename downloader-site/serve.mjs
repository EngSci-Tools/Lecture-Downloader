const PORT = 80;

import cors from 'cors';
import express from 'express';
import http from "http";
import config from 'config';
import pg from 'pg';
import { Console } from 'console';
const { Pool } = pg;

class DB {
    constructor() {
        const dbConfig = config.get('dbConfig');
        this.pool = new Pool(dbConfig);
        this.setupDb();
    }

    async setupDb() {
        const query = `
            CREATE TABLE IF NOT EXISTS logs (
                time timestamptz PRIMARY KEY,
                filename VARCHAR(50) NOT NULL,
                description TEXT,
                thumbnail TEXT,
                extension VARCHAR(5),
                title TEXT,
                uploaded timestamptz,
                duration NUMERIC,
                username VARCHAR(50)
            );
        `;
        await this.pool.query(query);
    }

    async insert(id, meta) {
        const { extension, title, description, uploaded, thumbnailURL, duration, user } = meta;
        let username = undefined;
        if (user) {
            try {
                username = `${user.firstName} ${user.lastName}`;
            } catch(err) {
                console.log("User existed but failed to get name:", err);
            }
        }
        let uploadDate = undefined;
        if (uploaded) {
            uploadDate = new Date(uploaded);
        }
        const query = `INSERT INTO logs(time, filename, description, thumbnail, extension, title, uploaded, duration, username) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`
        const values = [
            new Date(),
            id,
            description,
            thumbnailURL,
            extension,
            title,
            uploadDate,
            duration,
            username
        ]
        await this.pool.query(query, values);
    }
}

async function main() {
    const app = express();
    const server = http.createServer(app);
    app.use(express.static("./dist"));
    app.use(express.json());
    app.use(cors());

    const db = new DB();

    app.post('/setMeta/:id', (req, res) => {
        const { id } = req.params;
        const body = req.body;
        try {
            db.insert(id, body);
        } catch(err) {
            console.log("Failed to insert: ", err);
        }
        res.send("recieved");
    })

    server.listen(PORT);
}

main();