import {WebSocketServer, WebSocket} from 'ws';
import { logger } from './Logger.js';
import { DBManager } from './DBManager.js';
import {crypto} from '../common/Crypto.js'
import { User } from '@common/CommonTypes.js';

const log = logger.logInfo;
const logError = logger.logError;

// Represents a room, it's name and participants
interface RoomInfo {
    name: string;
    // all Users in the room keyed by username. Eventually we'll use publicKey as the key
    participants: Map<string, User>;
}

// Represents a specific user+room per WebSocket connection
interface ClientInfo {
    room: string;
    name: string;
}

export default class WebRTCSigServer {
    private static inst: WebRTCSigServer | null = null;
    private db!: DBManager;
    private wss: WebSocketServer | null = null;
    private clientsMap = new Map<WebSocket, ClientInfo>(); 

    // map of RoomInfo objects, keyed by room name
    private roomsMap = new Map<string, RoomInfo>(); 

    static getInst(db: DBManager,host: string, port: string, server: any) {
        // Create instance if it doesn't exist
        if (!WebRTCSigServer.inst) {
            WebRTCSigServer.inst = new WebRTCSigServer();
            WebRTCSigServer.inst.init(db, host, port, server);
        }
        return WebRTCSigServer.inst;
    }

    // Get room by room name
    getOrCreateRoom = (name: string): RoomInfo => {
        // Check if the room already exists
        let room = this.roomsMap.get(name);
        if (!room) {
            // If not, create a new RoomInfo object
            room = { name, participants: new Map<string, User>() };
            this.roomsMap.set(name, room);
        }
        return room;
    }

    onMessage = (ws: WebSocket, message: any) => {
        try {
            const msg = JSON.parse(message);
            log(`Received message: ${msg.type}`);

            // Handle join message
            if (msg.type === 'join') {
                this.onJoin(ws, msg);
            }
            // For WebRTC signaling messages (offer, answer, ice-candidate)
            else if ((msg.type === 'offer' || msg.type === 'answer' || msg.type === 'ice-candidate') && msg.target) {
                this.onSignaling(ws, msg);
            }
            // Handle broadcast messages to everyone in a room
            else if (msg.type === 'broadcast' && msg.room) {
                this.onBroadcast(ws, msg);
            }
            // todo-1: we can eventually remove type 'persist' because we now let 'broadcast' handle persistence, so we kill two birds
            // with one stone, which is get message out to everyone in realtime and also persist into room, all done by 'broadcast' now.
            // Handle persist messages (silent, no broadcast)
            // else if (data.type === 'persist' && data.room && data.message) {
            //     this.persist(data);
            // } 
            else {
                logError(`Unknown message type: ${msg.type}`);
            }

        } catch (error) {
            logError("Error processing WebSocket message", error);
        }
    }
    
    // Finds the target client for this msg and sends the message to them
    onSignaling = (ws: WebSocket, msg: any) => {
        const fromClientInfo = this.clientsMap.get(ws);

        if (fromClientInfo) {
            // Add sender info to the message
            msg.sender = fromClientInfo.name;
            msg.room = fromClientInfo.room;
            const payload = JSON.stringify(msg);

            // Find the target the message is targeted to and end the message
            this.wss!.clients.forEach((cws) => {
                const clientInfo = this.clientsMap.get(cws);
                if (cws.readyState === WebSocket.OPEN && clientInfo &&
                    clientInfo.room === clientInfo.room &&
                    clientInfo.name === msg.target) {
                    log(`Sending ${msg.type} from ${clientInfo.name} to ${msg.target} in room ${clientInfo.room}`);

                    // todo-0: how to make this forEach abort/stop after this send.
                    cws.send(payload);
                }
            });
        } else {
            log("Received signaling message but client not in a room");
        }
    }

    // Currently the only data being broadcast are chat messages so we don't check for any type we juset assume it's a message.
    onBroadcast = (ws: WebSocket, msg: any) => {
        // First save message to DB
        this.persist(msg);

        const clientInfo = this.clientsMap.get(ws);
        if (clientInfo) {
            // put the 'from' (i.e. sender) name in the message
            msg.sender = clientInfo.name;
            const payload = JSON.stringify(msg);

            // Send the message to all clients in the same room, except the sender
            this.wss!.clients.forEach((cws) => {
                const clientInfo = this.clientsMap.get(cws);
                if (cws !== ws && cws.readyState === WebSocket.OPEN && clientInfo &&
                    clientInfo.room === msg.room) {
                    log(`Broadcasting message in room ${msg.room} from ${clientInfo.name}`);
                    cws.send(payload);
                }
            });
        }
        else {
            log("Received broadcast message from unknown client WebSocket");
        }
    }

    onJoin = (ws: WebSocket, msg: any) => {
        // Store client info
        this.clientsMap.set(ws, { room: msg.room, name: msg.name });

        // lookup the Room by this name
        const roomInfo = this.getOrCreateRoom(msg.room);
        
        // Add to participants if not already present
        // todo-0: add publicKey value here, and we'll be doing the 'find' based on publicKey too, as the true 'uniqueness' (identity)
        roomInfo.participants.set(msg.name, {name: msg.name, publicKey: ""}); 
        log(`Client ${msg.name} joined room: ${msg.room}`);
        
        // Build an array of Users objects from the map for all users in roomInfo except for msg.name.
        const participants = Array.from(roomInfo.participants.values()).filter((p: User) => p.name !== msg.name);

        // Send the current participants list to the new client
        ws.send(JSON.stringify({
            type: 'room-info',
            participants,
            room: msg.room
        }));
        
        // build message to send to all OTHER clients.
        const payload = JSON.stringify({
            type: 'user-joined',
            user: {name: msg.name},
            room: msg.room
        });
        
        // Notify others about the new participant
        this.wss!.clients.forEach((cws) => {
            if (cws !== ws && cws.readyState === WebSocket.OPEN && this.clientsMap.get(cws)?.room === msg.room) {
                cws.send(payload);
            }
        });
    }

    onClose = (ws: WebSocket, code: any, reason: any) => {
        const msgClientInfo = this.clientsMap.get(ws);
        if (msgClientInfo) {
            const { room, name } = msgClientInfo;
            log(`Client ${name} disconnected from room: ${room} (Code: ${code}, Reason: ${reason || 'none'})`);

            const roomInfo = this.roomsMap.get(room);

            // Remove user from room participants
            if (roomInfo) {
                roomInfo.participants.delete(name);

                // If room is empty, remove it, and there's no one to notify either
                if (roomInfo.participants.size === 0) {
                    this.roomsMap.delete(room);
                    log(`Room ${room} deleted as it's now empty`);
                } else {
                    // Else, notify others about the participant leaving
                    const payload = JSON.stringify({type: 'user-left', user: {name}, room});
                    this.wss!.clients.forEach((cws) => {
                        const clientInfo = this.clientsMap.get(cws);

                        // Send to all clients in the same room except the one that left
                        if (clientInfo && cws.readyState === WebSocket.OPEN && clientInfo.room === room) {
                            cws.send(payload);
                        }
                    });
                }
            }

            this.clientsMap.delete(ws);
        } else {
            log(`Unknown client disconnected (Code: ${code})`);
        }
    }

    onError = (ws: WebSocket, error: any) => {
        logError("WebSocket client error", error);

        // Try to get client info for better logging
        const client = this.clientsMap.get(ws);
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

