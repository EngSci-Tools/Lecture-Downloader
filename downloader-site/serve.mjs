const PORT = 80;

import cors from 'cors';
import express from 'express';
import http from "http";

async function main() {
    const app = express();
    const server = http.createServer(app);
    app.use(express.static("./dist"));
    app.use(express.json());
    app.use(cors());

    server.listen(PORT);
}

main();