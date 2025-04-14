import {WebSocketServer, WebSocket} from 'ws';
import {logger} from './Logger.js';
import { DBManager } from './DBManager.js';

const log = logger.logInfo;
const logError = logger.logError;

class WebRTCSigServer {
    private static inst: WebRTCSigServer | null = null;
    private db!: DBManager;
    private wss!: WebSocketServer;
    private clients: Map<any, {room: string, name: string}>;
    private rooms: Map<string, Set<string>>;

    constructor() {
        log('WebRTCSigServer singleton created');
        this.clients = new Map(); // Map of WebSocket -> {room, name}
        this.rooms = new Map();   // Map of roomId -> Set of client names in the room
    }

    static getInst(db: DBManager, host: string, port: string, server: any) {
        // Create instance if it doesn't exist
        if (!WebRTCSigServer.inst) {
            WebRTCSigServer.inst = new WebRTCSigServer();
            WebRTCSigServer.inst.init(db, host, port, server);
        }
        return WebRTCSigServer.inst;
    }

    async init(db: DBManager, host: string, port: string, server: any) {
        this.db = db;
        
        log(`Starging Signaling Server on ${host}:${port}`);
        this.wss = new WebSocketServer({host, server });

        this.wss.on('connection', (ws, req) => {
            const clientIp = req.socket.remoteAddress;
            log(`New WebSocket client connected from ${clientIp}`);

            ws.on('message', (message: any) => {
                this.onMessage(ws, message);
            });
            ws.on('close', (code, reason) => {
                this.onClose(ws, code, reason);
            });
            ws.on('error', (error) => {
                this.onError(ws, error);
            });
        });

        // Add error handler to WebSocket server
        this.wss.on('error', (error) => {
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

    onMessage = (ws: any, message: any) => {
        try {
            const data = JSON.parse(message);
            log(`Received message: ${data.type} from ${this.clients.get(ws)?.name || 'unknown'}`);

            switch (data.type) {
            case 'join':
                this.onJoin(ws, data);
                break;
            case 'signal':
                this.onSignal(ws, data);
                break;
            case 'broadcast':
                this.onBroadcast(ws, data);
                break;
            case 'persist':
                this.onPersist(ws, data);
                break;
            
            default:
                logError(`Unknown message type: ${data.type}`);
                break;  
            }
        } catch (error) {
            logError("Error processing WebSocket message", error);
        }
    }

    onJoin = (ws: any, data: any) => {
        const room = data.room;
        const name = data.name || `user-${Math.floor(Math.random() * 10000)}`;

        // Store client info
        this.clients.set(ws, { room, name });

        // Update room participants
        if (!this.rooms.has(room)) {
            this.rooms.set(room, new Set());
        }
        this.rooms.get(room)?.add(name);
        log(`Client ${name} joined room: ${room}`);

        // Send the current participants list to the new client
        if (this.rooms.has(room)) {
            const roomSet = this.rooms.get(room);
            const participants = Array.from(roomSet || []);
            ws.send(JSON.stringify({
                type: 'room-info',
                participants: participants.filter(p => p !== name),
                room
            }));
        }

        // Notify others about the new participant
        this.wss.clients.forEach((client) => {
            if (client !== ws &&
        client.readyState === WebSocket.OPEN &&
        this.clients.get(client)?.room === room) {
                client.send(JSON.stringify({
                    type: 'user-joined',
                    name: name,
                    room
                }));
            }
        });
    }

    onSignal = (ws: any, data: any) => {
        if (!data.target) {
            logError("Signal message missing target");
            return;
        }
        const clientInfo = this.clients.get(ws);
        if (clientInfo) {
            const sender = clientInfo.name;
            const room = clientInfo.room;
    
            // Add sender info and forward the signal data
            const messageToSend = JSON.stringify({
                type: 'signal',
                sender: sender,
                target: data.target, // Keep original target
                data: data.data      // Forward the payload from simple-peer
            });
    
            // Find the target client and send the message
            this.wss.clients.forEach((targetClient) => {
                const targetClientInfo = this.clients.get(targetClient);
                if (targetClient.readyState === WebSocket.OPEN &&
                    targetClientInfo &&
                    targetClientInfo.room === room &&
                    targetClientInfo.name === data.target) {
    
                    log(`Relaying signal from ${sender} to ${data.target} in room ${room}`);
                    targetClient.send(messageToSend);
                }
            });
        } else {
            log("Received signal message but sender client info not found");
        }
    }

    onBroadcast = (ws: any, data: any) => {
        if (!data.room) {
            logError("Broadcast message missing room");
            return;
        }
        const client = this.clients.get(ws);
        if (client) {
            data.sender = client.name;
            this.wss.clients.forEach((c) => {
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
        this.onPersist(ws, data);
    }

    onPersist = (ws: any, data: any) => {
        // This is a silent persist-only message (no broadcast)
        if (data.room && data.message) {
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

    onClose = (ws: any, code: any, reason: any) => {
        const client = this.clients.get(ws);
        if (client) {
            const { room, name } = client;
            log(`Client ${name} disconnected from room: ${room} (Code: ${code}, Reason: ${reason || 'none'})`);

            // Remove from room participants
            if (this.rooms.has(room)) {
                this.rooms.get(room)?.delete(name);

                // If room is empty, remove it
                if (this.rooms.get(room)?.size === 0) {
                    this.rooms.delete(room);
                    log(`Room ${room} deleted as it's now empty`);
                } else {
                    // Notify others about the participant leaving
                    this.wss.clients.forEach((c) => {
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

    onError = (ws: any, error: any) => {
        logError("WebSocket client error", error);

        // Try to get client info for better logging
        const client = this.clients.get(ws);
        if (client) {
            logError(`Error for client ${client.name} in room ${client.room}`);
        }
    }
}

export default WebRTCSigServer;
