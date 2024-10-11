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
        let parsedData;
        try {
            parsedData = JSON.parse(data);
        } catch (err) {
            console.error('Invalid JSON received:', err);
            ws.send(JSON.stringify({ error: 'Invalid message format' }));
            return;
        }

        const { type, name, message, room } = parsedData;

        if (type === 'join') {
            if (!name || !room) {
                ws.send(JSON.stringify({ error: 'Name and room are required to join' }));
                return;
            }

            // Prevent duplicate usernames in the same room
            if (rooms[room] && rooms[room].some(client => client.name === name)) {
                ws.send(JSON.stringify({ error: 'Username already taken in this room' }));
                return;
            }

            ws.name = name;
            ws.room = room;

            // Add user to room
            if (!rooms[room]) {
                rooms[room] = [];
            }
            rooms[room].push(ws);

            // Notify the user if they created the room
            if (rooms[room].length === 1) {
                ws.send(JSON.stringify({ message: `You created the room "${room}"` }));
            }

            // Notify room that user has joined
            broadcast(ws, `${name} has joined the room`, room);

        } else if (type === 'message') {
            if (!ws.room || !ws.name) {
                ws.send(JSON.stringify({ error: 'You must join a room before sending messages' }));
                return;
            }
            if (!message) {
                ws.send(JSON.stringify({ error: 'Message cannot be empty' }));
                return;
            }

            // Broadcast message to all clients in the same room
            broadcast(ws, `${name}: ${message}`, ws.room);
        } else {
            ws.send(JSON.stringify({ error: 'Unknown message type' }));
        }
    });

    ws.on('close', () => {
        if (ws.room && ws.name) {
            if (rooms[ws.room]) {
                rooms[ws.room] = rooms[ws.room].filter(client => client !== ws);
                
                // If room is empty, delete it
                if (rooms[ws.room].length === 0) {
                    delete rooms[ws.room];
                } else {
                    // Notify the room that the user has left
                    broadcast(ws, `${ws.name} has left the room`, ws.room);
                }
            }
        }
    });

    ws.on('error', (err) => {
        console.error('WebSocket error:', err);
    });
});

/**
 * Broadcasts a message to all clients in a specific room.
 * @param {WebSocket} sender - The client sending the message.
 * @param {string} message - The message to send.
 * @param {string} room - The room to broadcast the message to.
 */
function broadcast(sender, message, room) {
    const data = {
        name: sender.name,
        message,
        time: new Date().toISOString(),
    };

    if (rooms[room]) {
        rooms[room].forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
            }
        });
    }
}

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
