import {WebSocketServer, WebSocket} from 'ws';
import {crypt} from '../common/Crypto.js';
import {canon} from '../common/Canonicalizer.js';
import { User, WebRTCAck, WebRTCBroadcast, WebRTCDeleteMsg, WebRTCJoin, WebRTCRoomInfo, WebRTCSignal, WebRTCUserJoined, WebRTCUserLeft } from '../common/types/CommonTypes.js';
import { dbMessages } from './db/DBMessages.js';
import { dbUsers } from './db/DBUsers.js';

// Represents a room, it's name and participants
interface RoomInfo {
    name: string;
    // all Users in the room by publicKey.
    participants: Map<string, User>;
}

// Represents a specific user+room per WebSocket connection
interface ClientInfo {
    room: string;
    user: User;
}

export default class WebRTCServer {
    private wss: WebSocketServer | null = null;
    private clientsMap = new Map<WebSocket, ClientInfo>(); 

    // map of RoomInfo objects, keyed by room name
    private roomsMap = new Map<string, RoomInfo>(); 

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
            console.log(`Received message: ${msg.type}`);

            switch (msg.type) {
            case 'join':
                this.onJoin(ws, msg);
                break;
            case 'offer':
            case 'answer':
            case 'ice-candidate':
                this.onSignaling(ws, msg);
                break;
            case 'broadcast':
                this.onBroadcast(ws, msg);
                break;
            // case 'persist':
            //     this.persist(msg);
            //     break;
            default:
                console.error(`Unknown message type: ${msg.type}`);
                break;
            }
        } catch (error) {
            console.error("Error processing WebSocket message", error);
        }
    }
    
    // Finds the target client for this msg and sends the message to them
    onSignaling = (ws: WebSocket, msg: WebRTCSignal) => {
        if (!msg.target) {
            console.error("No target in signaling message");
            return;
        }
        const fromClientInfo = this.clientsMap.get(ws);

        if (fromClientInfo) {
            // Add sender info to the message
            msg.sender = fromClientInfo.user;
            msg.room = fromClientInfo.room;
            const payload = JSON.stringify(msg);

            // Find the target the message is targeted to and end the message
            this.wss!.clients.forEach((cws) => {
                const clientInfo = this.clientsMap.get(cws);
                if (cws.readyState === WebSocket.OPEN && clientInfo &&
                    clientInfo.room === clientInfo.room &&
                    clientInfo.user.publicKey === msg.target.publicKey
                ) {
                    console.log(`Sending msg.id=${msg.id} type=${msg.type} from ${msg.sender?.name} to ${msg.target.name} in room ${clientInfo.room}`);
                    cws.send(payload);
                }
            });
        } else {
            console.log("Received signaling message but client not in a room");
        }
    }

    // Broadcasts a message to all clients in the same room, except the sender
    onBroadcast = async (ws: WebSocket, msg: WebRTCBroadcast) => {
        if (!msg.room) {
            console.error("No room in broadcast message");
            return;
        }
        // First save message to DB
        await this.persist(msg);

        const senderClientInfo = this.clientsMap.get(ws);
        if (senderClientInfo) {
            // put the 'from' (i.e. sender) name in the message. The sender itself doesn't do this. Not sure why, bc AI wrote that piece.
            msg.sender = senderClientInfo.user;
            const payload = JSON.stringify(msg);

            // Send the message to all clients in the same room, except the sender
            this.wss!.clients.forEach((cws) => {
                const clientInfo = this.clientsMap.get(cws);
                if (cws.readyState === WebSocket.OPEN && clientInfo &&
                    clientInfo.room === msg.room) {
                    // If this is the sender, we only send back the ACK so their local message can know the DB ID also know of successful storage
                    if (cws === ws) {
                        const ack: WebRTCAck = {
                            type: 'ack',
                            id: msg.message.id,
                        };
                        console.log(`Sending ACK to sender ${senderClientInfo.user.name} for message ${msg.message.id}`);
                        cws.send(JSON.stringify(ack));
                    }
                    else {
                        console.log(`Broadcasting message in room ${msg.room} from ${clientInfo.user.name}`);
                        cws.send(payload);
                    }
                }
            });
        }
        else {
            console.log("Received broadcast message from unknown client WebSocket");
        }
    }

    onJoin = (ws: WebSocket, msg: WebRTCJoin) => {
        if (!msg.user.publicKey) {
            console.error("No publicKey in join message");
            return;
        }

        // validate the signature
        const sigOk = crypt.verifySignature(msg, canon.canonical_WebRTCJoin); 
        if (!sigOk) {
            console.error("Signature verification failed for join message:", msg);
            return;
        }

        // Store client info
        this.clientsMap.set(ws, { room: msg.room, user: msg.user});

        // lookup the Room by this name
        const roomInfo = this.getOrCreateRoom(msg.room);
        
        // Add to participants if not already present
        roomInfo.participants.set(msg.user.publicKey, msg.user); 
        console.log(`Client ${msg.user.name} joined room: ${msg.room}`);
        
        // Build an array of Users objects from the map for all users in roomInfo except for msg.user.
        const participants = Array.from(roomInfo.participants.values()).filter((p: User) => p.publicKey !== msg.user.publicKey);

        // NOTE: We don't sign this message becasue, comming fom the server, we trust it.
        const roomInfoMsg: WebRTCRoomInfo = {
            type: 'room-info',
            participants,
            room: msg.room
        };

        // Send the current participants list to the new client
        ws.send(JSON.stringify(roomInfoMsg));

        // ------------------------------
        // DO NOT DELETE
        // AI originally implemented our WebRTC to have this onJoin message sent out, and made it where the recievers
        // attempt to initiate a connection to the new user joining the room, but this is redundant because when someone 
        // joins a room, their browser will ALSO try to initialize a connection to all peers, so doing this here, while
        // harmless, is redundant.
        //
        // this.sendUserJoined(ws, msg);
        // ------------------------------
    }

    sendDeleteMessage = (roomName: string, messageId: string, publicKey: string) => {
        console.log(`Sending delete message for ID ${messageId} in room ${roomName}`);
        const deleteMsg: WebRTCDeleteMsg = {
            type: 'delete-msg',
            messageId,
            room: roomName,
        };
        // build message to send to all OTHER clients.
        const payload = JSON.stringify(deleteMsg);
        
        // Notify others about the new participant
        this.wss!.clients.forEach((cws) => {
            const clientInfo = this.clientsMap.get(cws);
            if (clientInfo?.user.publicKey !== publicKey && // don't send to the sender 
                //cws !== ws && // NOTE: This is the other way to avoid sending to the sender, but we don't have ws here.
                cws.readyState === WebSocket.OPEN && clientInfo &&  clientInfo.room === roomName) {
                cws.send(payload);
            }
        });
    }

    sendUserJoined = (ws: WebSocket, msg: WebRTCJoin) => {
        // NOTE: We don't sign this message because, comming fom the server, we trust it.
        const userJoined: WebRTCUserJoined = {
            type: 'user-joined',
            user: msg.user,
            room: msg.room
        };

        // build message to send to all OTHER clients.
        const payload = JSON.stringify(userJoined);
        
        // Notify others about the new participant
        this.wss!.clients.forEach((cws) => {
            const clientInfo = this.clientsMap.get(cws);
            if (cws !== ws && cws.readyState === WebSocket.OPEN && clientInfo &&  clientInfo.room === msg.room) {
                cws.send(payload);
            }
        });
    }

    onClose = (ws: WebSocket, code: any, reason: any) => {
        const msgClientInfo = this.clientsMap.get(ws);
        if (msgClientInfo) {
            const { room, user } = msgClientInfo;
            console.log(`Client ${user.name} disconnected from room: ${room} (Code: ${code}, Reason: ${reason || 'none'})`);

            const roomInfo = this.roomsMap.get(room);

            // Remove user from room participants
            if (roomInfo) {
                roomInfo.participants.delete(user.publicKey);

                // If room is empty, remove it, and there's no one to notify either
                if (roomInfo.participants.size === 0) {
                    this.roomsMap.delete(room);
                    console.log(`Room ${room} deleted as it's now empty`);
                } else {
                    const userLeft: WebRTCUserLeft = {type: 'user-left', user, room};
                    // Else, notify others about the participant leaving
                    const payload = JSON.stringify(userLeft);
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
            console.log(`Unknown client disconnected (Code: ${code})`);
        }
    }

    onError = (ws: WebSocket, error: any) => {
        console.error("WebSocket client error", error);

        // Try to get client info for better logging
        const clientInfo = this.clientsMap.get(ws);
        if (clientInfo) {
            console.error(`Error for client ${clientInfo.user.name} in room ${clientInfo.room}`);
        }
    }

    async init(host: string, port: string, server: any) {
        this.wss = new WebSocketServer({host, server });
        console.log(`Signaling Server running on ${host}:${port}`);

        this.wss.on('connection', (ws, req) => {
            console.log(`New WebSocket client connected from ${req.socket.remoteAddress}`);
            ws.on('message', (message) => this.onMessage(ws, message));
            ws.on('close', (code, reason) => this.onClose(ws, code, reason));
            ws.on('error', (error) => this.onError(ws, error));
        });

        // Add error handler to WebSocket server
        this.wss!.on('error', (error) => {
            console.error("WebSocket server error", error);
        });

        // Global error handler for uncaught exceptions
        process.on('uncaughtException', (error) => {
            console.error("UNCAUGHT EXCEPTION - Server continuing to run:", error);
        });

        // Global error handler for unhandled promise rejections
        process.on('unhandledRejection', (reason) => {
            console.error("UNHANDLED PROMISE REJECTION:", reason);
        });

        console.log("ChatServer initialization complete");
    }

    persist = async (data: WebRTCBroadcast) => {
        if (data.room && data.message) {
            // todo-1: here, for now we only verify the signature of the message, not the broadcast object, but we will eventually check both.
            const sigOk = await crypt.verifySignature(data.message, canon.canonical_ChatMessage);
            if (!sigOk) {
                console.error("Signature verification failed for message:", data.message);
                return;
            }

            const userBlocked = await dbUsers.isUserBlocked(data.message.publicKey!);
            if (userBlocked) {
                console.log("User is blocked. Not persisting.");
                return;
            }
          
            const saved = await dbMessages.persistMessageToRoomName(data.room, data.message)
            if (saved) {
                console.log(`Message from ${data.message.sender} persisted to database`);
            }
            else {
                console.error("Failed to persist message to database: ", data.message);
            }
        }
    }
}

export const rtc = new WebRTCServer();
