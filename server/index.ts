import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import {WebSocketServer} from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const HOST = process.env.QUANTA_CHAT_HOST || 'localhost';
const PORT = process.env.QUANTA_CHAT_PORT || '8080';
const HTTP_PORT = process.env.QUANTA_CHAT_HTTP_PORT || 8000;

app.use(express.json());

app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

app.get('/api/data', (req: Request, res: Response) => {
    res.json({ message: 'This is data from the API' });
});

const distPath = path.join(__dirname, '../../dist');

// Function to serve index.html with replaced placeholders
const serveIndexHtml = (req: Request, res: Response) => {
    const filePath = path.resolve(distPath, 'index.html');
    // console.log(`Serving index.html from: ${filePath}`);
  
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading index.html:', err);
            return res.status(500).send('Error loading page');
        }
    
        // Replace the placeholders with actual values
        const result = data
            .replace('{{HOST}}', process.env.QUANTA_CHAT_HOST || 'localhost')
            .replace('{{PORT}}', process.env.QUANTA_CHAT_PORT || '8080');
    
        // Set the content type and send the modified HTML
        res.contentType('text/html');
        res.send(result);
    });
};

// Define HTML routes BEFORE static middleware
// Explicitly serve index.html for root path
app.get('/', serveIndexHtml);

// Serve static files from the dist directory, but disable index serving
app.use(express.static(distPath, { index: false }));

// Fallback for any other routes not handled above
app.get('*', serveIndexHtml);

// Start the server
app.listen(HTTP_PORT, () => {
    console.log(`Server running on http://localhost:${HTTP_PORT}`);
});

// logging

// Setup logging
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}
const logFile = path.join(logDir, `server-${new Date().toISOString().split('T')[0]}.log`);

// Logger function
function log(message: any, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;

    // Log to console
    console.log(logMessage);

    // Log to file
    fs.appendFileSync(logFile, logMessage + '\n');
}

// Error logger
function logError(message: any, error: any) {
    const errorDetails = error ? `\n${error.stack || error}` : '';
    log(`${message}${errorDetails}`, 'ERROR');
}

// The rest of this file is for WebSocket handling
// Create WebSocket server (separate from HTTP)
const wss = new WebSocketServer({
    host: HOST,
    port: parseInt(PORT)
});

log(`Signaling server running on ws://${HOST}:${PORT}`);

// Track client connections with more information
const clients = new Map(); // Map of WebSocket -> {room, name}
const rooms = new Map();   // Map of roomId -> Set of client names in the room

wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    log(`New WebSocket client connected from ${clientIp}`);

    ws.on('message', (message: any) => {
        try {
            const data = JSON.parse(message);
            log(`Received message: ${data.type} from ${clients.get(ws)?.name || 'unknown'}`);

            // Handle join message
            if (data.type === 'join') {
                const room = data.room;
                const name = data.name || `user-${Math.floor(Math.random() * 10000)}`;

                // Store client info
                clients.set(ws, { room, name });

                // Update room participants
                if (!rooms.has(room)) {
                    rooms.set(room, new Set());
                }
                rooms.get(room).add(name);

                log(`Client ${name} joined room: ${room}`);

                // Send the current participants list to the new client
                const participants = Array.from(rooms.get(room));
                ws.send(JSON.stringify({
                    type: 'room-info',
                    participants: participants.filter(p => p !== name),
                    room
                }));

                // Notify others about the new participant
                wss.clients.forEach((client) => {
                    if (client !== ws &&
                        client.readyState === WebSocket.OPEN &&
                        clients.get(client)?.room === room) {
                        client.send(JSON.stringify({
                            type: 'user-joined',
                            name: name,
                            room
                        }));
                    }
                });
            }

            // For WebRTC signaling messages (offer, answer, ice-candidate)
            if ((data.type === 'offer' || data.type === 'answer' || data.type === 'ice-candidate') && data.target) {
                const client = clients.get(ws);

                if (client) {
                    const room = client.room;
                    const sender = client.name;

                    // Add sender info to the message
                    data.sender = sender;
                    data.room = room;

                    // Find the target client and send the message
                    wss.clients.forEach((client) => {
                        const clientInfo = clients.get(client);
                        if (client.readyState === WebSocket.OPEN &&
                            clientInfo &&
                            clientInfo.room === room &&
                            clientInfo.name === data.target) {
                            log(`Sending ${data.type} from ${sender} to ${data.target} in room ${room}`);
                            client.send(JSON.stringify(data));
                        }
                    });
                } else {
                    log("Received signaling message but client not in a room", "WARN");
                }
            }
            // Handle broadcast messages to everyone in a room
            else if (data.type === 'broadcast' && data.room) {
                const client = clients.get(ws);
                if (client) {
                    data.sender = client.name;
                    wss.clients.forEach((c) => {
                        const clientInfo = clients.get(c);
                        if (c !== ws &&
                            c.readyState === WebSocket.OPEN &&
                            clientInfo &&
                            clientInfo.room === data.room) {
                            log(`Broadcasting message in room ${data.room} from ${client.name}`);
                            c.send(JSON.stringify(data));
                        }
                    });
                }
            }

        } catch (error) {
            logError("Error processing WebSocket message", error);
        }
    });

    ws.on('close', (code, reason) => {
        const client = clients.get(ws);
        if (client) {
            const { room, name } = client;
            log(`Client ${name} disconnected from room: ${room} (Code: ${code}, Reason: ${reason || 'none'})`);

            // Remove from room participants
            if (rooms.has(room)) {
                rooms.get(room).delete(name);

                // If room is empty, remove it
                if (rooms.get(room).size === 0) {
                    rooms.delete(room);
                    log(`Room ${room} deleted as it's now empty`);
                } else {
                    // Notify others about the participant leaving
                    wss.clients.forEach((c) => {
                        if (c.readyState === WebSocket.OPEN &&
                            clients.get(c)?.room === room) {
                            c.send(JSON.stringify({
                                type: 'user-left',
                                name: name,
                                room
                            }));
                        }
                    });
                }
            }

            clients.delete(ws);
        } else {
            log(`Unknown client disconnected (Code: ${code})`, "WARN");
        }
    });

    ws.on('error', (error) => {
        logError("WebSocket client error", error);

        // Try to get client info for better logging
        const client = clients.get(ws);
        if (client) {
            log(`Error for client ${client.name} in room ${client.room}`, "ERROR");
        }
    });
});

// Add error handler to WebSocket server
wss.on('error', (error) => {
    logError("WebSocket server error", error);
});

// Global error handler for uncaught exceptions
process.on('uncaughtException', (error) => {
    logError("UNCAUGHT EXCEPTION - Server continuing to run:", error);
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason) => {
    logError("UNHANDLED PROMISE REJECTION:", reason);
});

log("QuantaChatServer initialization complete");
