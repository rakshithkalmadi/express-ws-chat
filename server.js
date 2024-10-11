const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const rooms = {}; // Track rooms and users in them
const roomMessages = {}; // Store room chat history

wss.on('connection', (ws) => {
    ws.on('message', (data) => {
        const parsedData = JSON.parse(data);
        const { type, name, message, room, target, privateMessage } = parsedData;

        if (type === 'join') {
            ws.name = name;
            ws.room = room;

            // Add user to room
            if (!rooms[room]) {
                rooms[room] = [];
                roomMessages[room] = []; // Initialize room messages
            }
            rooms[room].push(ws);

            // Send previous messages in the room
            if (roomMessages[room].length > 0) {
                ws.send(JSON.stringify({ type: 'history', messages: roomMessages[room] }));
            }

            // Notify room that user has joined
            broadcast(ws, { name: 'Server', message: `${name} has joined the room`, time: Date.now() }, room);

            // Send the updated list of active users in the room
            broadcastUserList(room);

        } else if (type === 'message') {
            const msgObj = { name, message, time: Date.now() };
            roomMessages[room].push(msgObj); // Store the message in room history

            // Broadcast message to all clients in the same room
            broadcast(ws, msgObj, room);

        } else if (type === 'privateMessage') {
            sendPrivateMessage(ws, target, privateMessage);
        } else if (type === 'typing') {
            // Notify other users in the room that someone is typing
            rooms[room].forEach(client => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ typing: true, name }));
                }
            });
        }
    });

    ws.on('close', () => {
        if (ws.room && ws.name) {
            rooms[ws.room] = rooms[ws.room].filter(client => client !== ws);
            // Notify the room that the user has left
            broadcast(ws, { name: 'Server', message: `${ws.name} has left the room`, time: Date.now() }, ws.room);

            // Send the updated list of active users in the room
            broadcastUserList(ws.room);
        }
    });
});

// Send private message to a specific user
function sendPrivateMessage(sender, targetName, message) {
    const room = sender.room;
    const targetUser = rooms[room].find(client => client.name === targetName);
    if (targetUser && targetUser.readyState === WebSocket.OPEN) {
        targetUser.send(JSON.stringify({
            name: sender.name,
            privateMessage: message,
            time: Date.now(),
        }));
    }
}

function broadcast(sender, data, room) {
    if (rooms[room]) {
        rooms[room].forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
            }
        });
    }
}

// Broadcast the list of active users in the room
function broadcastUserList(room) {
    const activeUsers = rooms[room]?.map(client => client.name) || [];
    rooms[room]?.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'activeUsers', users: activeUsers }));
        }
    });
}

app.use(express.static(path.join(__dirname, 'public')));

server.listen(process.env.PORT || 3000, () => {
    console.log(`Server is listening on port ${process.env.PORT || 3000}`);
});
