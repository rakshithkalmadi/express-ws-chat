const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const rooms = {}; // Track rooms and users in them

wss.on('connection', (ws) => {
    ws.on('message', (data) => {
        const parsedData = JSON.parse(data);
        const { type, name, message, room } = parsedData;

        if (type === 'join') {
            ws.name = name;
            ws.room = room;

            // Add user to room
            if (!rooms[room]) {
                rooms[room] = [];
            }
            rooms[room].push(ws);

            // Notify room that user has joined
            broadcast(ws, `${name} has joined the room`, room);

        } else if (type === 'message') {
            // Broadcast message to all clients in the same room
            broadcast(ws, `${name}: ${message}`, room);
        }
    });

    ws.on('close', () => {
        if (ws.room && ws.name) {
            rooms[ws.room] = rooms[ws.room].filter(client => client !== ws);
            // Notify the room that the user has left
            broadcast(ws, `${ws.name} has left the room`, ws.room);
        }
    });
});

function broadcast(sender, message, room) {
    if (rooms[room]) {
        rooms[room].forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ message }));
            }
        });
    }
}

app.use(express.static(path.join(__dirname, 'public')));

server.listen(process.env.PORT || 3000, () => {
    console.log(`Server is listening on port ${process.env.PORT || 3000}`);
});
