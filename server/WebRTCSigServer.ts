import {WebSocketServer, WebSocket} from 'ws';
import { logger } from './Logger.js';
import { DBManager } from './DBManager.js';
import {crypto} from '../common/Crypto.js'

const log = logger.logInfo;
const logError = logger.logError;

export default class WebRTCSigServer {
    private static inst: WebRTCSigServer | null = null;
    private db!: DBManager;
    private wss: WebSocketServer | null = null;
    private clients = new Map(); // Map of WebSocket -> {room, name}
    private rooms = new Map();   // Map of roomId -> Set of client names in the room

    static getInst(db: DBManager,host: string, port: string, server: any) {
        // Create instance if it doesn't exist
        if (!WebRTCSigServer.inst) {
            WebRTCSigServer.inst = new WebRTCSigServer();
            WebRTCSigServer.inst.init(db, host, port, server);
        }
        return WebRTCSigServer.inst;
    }

    onMessage = (ws: WebSocket, message: any) => {
        try {
            const data = JSON.parse(message);
            log(`Received message: ${data.type} from ${this.clients.get(ws)?.name || 'unknown'}`);

            // Handle join message
            if (data.type === 'join') {
                const room = data.room;
                const name = data.name || `user-${Math.floor(Math.random() * 10000)}`;

                // Store client info
                this.clients.set(ws, { room, name });

                // Update room participants
                if (!this.rooms.has(room)) {
                    this.rooms.set(room, new Set());
                }
                this.rooms.get(room).add(name);

                log(`Client ${name} joined room: ${room}`);

                // Send the current participants list to the new client
                const participants = Array.from(this.rooms.get(room));
                ws.send(JSON.stringify({
                    type: 'room-info',
                    participants: participants.filter(p => p !== name),
                    room
                }));

                // Notify others about the new participant
                this.wss!.clients.forEach((client) => {
                    if (client !== ws && client.readyState === WebSocket.OPEN && this.clients.get(client)?.room === room) {
                        client.send(JSON.stringify({
                            type: 'user-joined',
                            name: name,
                            room
                        }));
                    }
                });
            }

            // For WebRTC signaling messages (offer, answer, ice-candidate)
            else if ((data.type === 'offer' || data.type === 'answer' || data.type === 'ice-candidate') && data.target) {
                const client = this.clients.get(ws);

                if (client) {
                    const room = client.room;
                    const sender = client.name;

                    // Add sender info to the message
                    data.sender = sender;
                    data.room = room;

                    // Find the target client and send the message
                    this.wss!.clients.forEach((client) => {
                        const clientInfo = this.clients.get(client);
                        if (client.readyState === WebSocket.OPEN && clientInfo &&
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
                this.persist(data);
                const client = this.clients.get(ws);
                if (client) {
                    data.sender = client.name;
                    this.wss!.clients.forEach((c) => {
                        const clientInfo = this.clients.get(c);
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
            // todo-0: we can eventually remove type 'persist' because we now let 'broadcast' handle persistence, so we kill two birds
            // with one stone, which is get message out to everyone in realtime and also persist into room, all done by 'broadcast' now.
            // Handle persist messages (silent, no broadcast)
            // else if (data.type === 'persist' && data.room && data.message) {
            //     this.persist(data);
            // } 
            else {
                logError(`Unknown message type: ${data.type}`);
            }

        } catch (error) {
            logError("Error processing WebSocket message", error);
        }
    }

    onClose = (ws: WebSocket, code: any, reason: any) => {
        const client = this.clients.get(ws);
        if (client) {
            const { room, name } = client;
            log(`Client ${name} disconnected from room: ${room} (Code: ${code}, Reason: ${reason || 'none'})`);

            // Remove from room participants
            if (this.rooms.has(room)) {
                this.rooms.get(room).delete(name);

                // If room is empty, remove it
                if (this.rooms.get(room).size === 0) {
                    this.rooms.delete(room);
                    log(`Room ${room} deleted as it's now empty`);
                } else {
                    // Notify others about the participant leaving
                    this.wss!.clients.forEach((c: any) => {
                        if (c.readyState === WebSocket.OPEN &&
                            this.clients.get(c)?.room === room) {
                            c.send(JSON.stringify({
                                type: 'user-left',
                                name: name,
                                room
                            }));
                        }
                    });
                }
            }

            this.clients.delete(ws);
        } else {
            log(`Unknown client disconnected (Code: ${code})`);
        }
    }

    onError = (ws: WebSocket, error: any) => {
        logError("WebSocket client error", error);

        // Try to get client info for better logging
        const client = this.clients.get(ws);
        if (client) {
            logError(`Error for client ${client.name} in room ${client.room}`);
        }
    }

    async init(db: DBManager, host: string, port: string, server: any) {
        this.db = db;
        this.wss = new WebSocketServer({host, server });
        log(`Signaling Server running on ${host}:${port}`);

        this.wss.on('connection', (ws, req) => {
            log(`New WebSocket client connected from ${req.socket.remoteAddress}`);
            ws.on('message', (message) => this.onMessage(ws, message));
            ws.on('close', (code, reason) => this.onClose(ws, code, reason));
            ws.on('error', (error) => this.onError(ws, error));
        });

        // Add error handler to WebSocket server
        this.wss!.on('error', (error) => {
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

    persist = async (data: any) => {
        if (data.room && data.message) {
            const sigOk = await crypto.verifySignature(data.message);
            if (!sigOk) {
                logError("Signature verification failed for message:", data.message);
                return;
            }

            const userBlocked = await this.db.isUserBlocked(data.message.publicKey);
            if (userBlocked) {
                console.log("User is blocked. Not persisting.");
                return;
            }
          
            this.db.persistMessage(data.room, data.message)
                .then(success => {
                    if (success) {
                        console.log(`Message from ${data.message.sender} persisted to database (silent)`);
                    }
                })
                .catch(err => {
                    console.error('Error persisting silent message:', err);
                });
        }
    }
}

