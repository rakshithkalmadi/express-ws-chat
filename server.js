const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const rooms = {};

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        const { type, room, payload } = data;

        switch (type) {
            case 'join':
                if (!rooms[room]) {
                    rooms[room] = [];
                }
                rooms[room].push(ws);
                break;
            case 'signal':
                rooms[room].forEach(client => {
                    if (client !== ws) {
                        client.send(JSON.stringify(payload));
                    }
                });
                break;
        }
    });

    ws.on('close', () => {
        for (const room in rooms) {
            rooms[room] = rooms[room].filter(client => client !== ws);
        }
    });
});

app.use(express.static(path.join(__dirname, 'public')));

server.listen(process.env.PORT || 3000, () => {
    console.log(`Server is listening on port ${process.env.PORT || 3000}`);
});
