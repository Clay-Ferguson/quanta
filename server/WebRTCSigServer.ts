import {WebSocketServer} from 'ws';
import Logger from './Logger.js';

const logger = Logger.getInst();
const log = logger.logInfo;
const logError = logger.logError;

class WebRTCSigServer {
    private static inst: WebRTCSigServer | null = null;

    constructor() {
        log('WebRTCSigServer singleton created');
    }

    static getInst(host: string, port: string) {
        // Create instance if it doesn't exist
        if (!WebRTCSigServer.inst) {
            WebRTCSigServer.inst = new WebRTCSigServer();
            WebRTCSigServer.inst.init(host, port);
        }
        return WebRTCSigServer.inst;
    }

    async init(host: string, port: string) {
        const wss = new WebSocketServer({
            host,
            port: parseInt(port)
        });

        log(`Signaling Server running on ws://${host}:${port}`);

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
                            log("Received signaling message but client not in a room");
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
                    log(`Unknown client disconnected (Code: ${code})`);
                }
            });

            ws.on('error', (error) => {
                logError("WebSocket client error", error);

                // Try to get client info for better logging
                const client = clients.get(ws);
                if (client) {
                    logError(`Error for client ${client.name} in room ${client.room}`);
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
    }
}

export default WebRTCSigServer;
