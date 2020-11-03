const PORT = 80;

import cors from 'cors';
import express from 'express';
import http from 'http';
import config from 'config';
import pg from 'pg';
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
                username VARCHAR(50),
                fromsite BOOLEAN,
                success BOOLEAN
            );
        `;
        await this.pool.query(query);
    }

    async insert(id, meta) {
        const { extension, title, description, uploaded, thumbnailURL, duration, user, fromsite = false, success = true } = meta;
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
        const query = `INSERT INTO logs(time, filename, description, thumbnail, extension, title, uploaded, duration, username, fromsite, success) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`
        const values = [
            new Date(),
            id,
            description,
            thumbnailURL,
            extension,
            title,
            uploadDate,
            duration,
            username,
            fromsite,
            success
        ]
        await this.pool.query(query, values);
    }

    async getTimeSummary() {
        const query = `
            SELECT date_trunc('day', time) as time, count(*) as count FROM logs GROUP BY 1 ORDER BY 1 DESC
        `
        return (await this.pool.query(query)).rows;
    }

    async getSummary(limit) {
        if (limit) {
            const query = `
                SELECT filename, COUNT(filename) as count, MAX(title) as title,
                MAX(username) as username, COUNT(CASE WHEN fromsite THEN 1 END) as fromsite
                FROM logs GROUP BY filename
                ORDER BY count(*) DESC
                LIMIT $1
            `;
            return (await this.pool.query(query, [limit])).rows;
        } else {
            const query = `
                SELECT filename, COUNT(filename) as count, MAX(title) as title,
                MAX(username) as username, COUNT(CASE WHEN fromsite THEN 1 END) as fromsite
                FROM logs GROUP BY filename
                ORDER BY count(*) DESC
            `;
            return (await this.pool.query(query)).rows;
        }
    }

    async getIndivTimeSummary() {
        const query = `
            SELECT filename, date_trunc('day', time) as time, MAX(title) as title, count(*) as count
            FROM logs
            GROUP BY (1, 2)
            ORDER BY 1
        `;
        return (await this.pool.query(query)).rows;
    }

    async getFileHistory(id) {
        if (id) {
            const query = 'SELECT * FROM logs WHERE filename=$1';
            return (await this.pool.query(query, [id])).rows;
        } else {
            const query = 'SELECT * FROM logs';
            return (await this.pool.query(query)).rows;
        }
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
    });

    app.get('/setMeta/:id', (req, res) => {
        const { id } = req.params;
        try {
            db.insert(id, {});
        } catch(err) {
            console.log("Failed to insert: ", err);
        }
        res.send("recieved");
    });

    app.get('/timeSummary', async (_, res) => {
        try {
            const summary = await db.getTimeSummary();
            res.json(summary);
        } catch(err) {
            console.log("Failed to get time summary: ", err);
            res.json({ success: false });
        }
    })

    app.get('/indivTimeSummary', async (_, res) => {
        try {
            const summary = await db.getIndivTimeSummary();
            res.json(summary);
        } catch(err) {
            console.log("Failed to get individual time summary: ", err);
            res.json({ success: false });
        }
    })

    app.get('/summary/:limit?', async (req, res) => {
        const { limit } = req.params;
        try {
            const summary = await db.getSummary(limit);
            res.json(summary);
        } catch(err) {
            console.log("Failed to get summary: ", err);
            res.json({ success: false });
        }
    })

    app.get('/file/:id?', async (req, res) => {
        const { id } = req.params;
        try {
            const history = await db.getFileHistory(id);
            res.json(history);
        } catch(err) {
            console.log("Failed to get history: ", err);
            res.json({success: false});
        }
    })

    server.listen(PORT, () => {
        console.log(`Listening on port: ${PORT}`);
    });
}

main();