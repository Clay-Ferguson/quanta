import SimplePeer, { Instance as SimplePeerInstance, SignalData } from 'simple-peer';
import {AppServiceTypes} from './AppServiceTypes.ts';
import IndexedDB from './IndexedDB.ts';
import {util} from './Util.ts';
import { WebRTCIntf } from './WebRTCIntf.ts';

// make this an argument passed to the constructor like other props
declare const SECURE: string;

/**
 * WebRTC class using simple-peer for handling P2P connections.
 * Designed as a singleton.
 */
export default class WebRTC implements WebRTCIntf {
    // Map peer names to their SimplePeer instances
    private peers: Map<string, SimplePeerInstance> = new Map();
    private socket: WebSocket | null = null;
    private roomId = "";
    private userName = "";

    storage: IndexedDB | null = null;
    app: AppServiceTypes | null = null;
    host: string = "";
    port: string = "";
    saveToServer: boolean = true;

    participants = new Set<string>(); // Keep track of expected participants in the room
    connected: boolean = false; // WebSocket connection status
    
    constructor(storage: IndexedDB, app: AppServiceTypes, host: string, port: string, saveToServer: boolean) {
        this.storage = storage;
        this.app = app;
        this.host = host;
        this.port = port;
        this.saveToServer = saveToServer;
    }

    private initRTC() {
        if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
            util.log('WebSocket connection already open or connecting.');
            return;
        }

        console.log('Starting WebSocket connection for signaling. Secure=' + SECURE);
        const url = `${SECURE==='y' ? 'wss' : 'ws'}://${this.host}:${this.port}`;
        
        console.log('Connecting to signaling server at ' + url);

        // Clean up any old socket listeners before creating a new one
        if (this.socket) {
            this.socket.removeEventListener('open', this._onopen);
            this.socket.removeEventListener('message', this._onmessage);
            this.socket.removeEventListener('error', this._onerror);
            this.socket.removeEventListener('close', this._onclose);
        }

        this.socket = new WebSocket(url);
        this.socket.onopen = this._onopen;
        this.socket.onmessage = this._onmessage;
        this.socket.onerror = this._onerror;
        this.socket.onclose = this._onclose;
    }

    // --- WebSocket Event Handlers ---

    private _onopen = () => {
        util.log('Connected to signaling server.');
        this.connected = true;

        // Join the room now that the socket is open
        if (this.socket && this.userName && this.roomId) {
            this.socket.send(JSON.stringify({
                type: 'join',
                room: this.roomId,
                name: this.userName
            }));
            util.log(`Sent join request for room: ${this.roomId} as ${this.userName}`);
        } else {
            console.error("Cannot join room: userName or roomId missing, or socket unavailable.");
        }
        this.app?._rtcStateChange();
    }

    private _onerror = (error: Event) => {
        console.error('WebSocket error:', error);
        this.connected = false;
        // Consider attempting reconnection here?
        this.app?._rtcStateChange();
    };

    private _onclose = () => {
        util.log('Disconnected from signaling server');
        this.connected = false;
        this.closeAllConnections(); // Clean up all peers
        this.app?._rtcStateChange();
        // Consider attempting reconnection here?
    }

    private _onmessage = (event: MessageEvent) => {
        try {
            const msg = JSON.parse(event.data);
            util.log(`Received message type: ${msg.type} from ${msg.sender || 'server'}`);

            switch (msg.type) {
            case 'room-info': // Received initial list of participants from server
                this._handleRoomInfo(msg);
                break;
            case 'user-joined': // A new user joined the room
                this._handleUserJoined(msg);
                break;
            case 'user-left': // A user left the room
                this._handleUserLeft(msg);
                break;
            case 'signal': // Received signaling data (offer/answer/candidate) from a peer
                this._handleSignal(msg);
                break;
            case 'broadcast': // Received a broadcast message via signaling server (fallback)
                this._handleBroadcast(msg);
                break;
            default:
                util.log('Received unknown message type: ' + msg.type);
            }
            this.app?._rtcStateChange(); // Notify app of potential state changes

        } catch (error) {
            console.error('Error processing WebSocket message:', error, event.data);
        }
    }

    // --- Signaling Message Handlers ---

    private _handleRoomInfo = (msg: { participants: string[], room: string }) => {
        util.log('Room info received. Participants: ' + msg.participants.join(', '));
        const existingParticipants = new Set(msg.participants);
        this.participants = existingParticipants; // Update our view of the room

        // Initiate connections TO existing users
        existingParticipants.forEach(peerName => {
            if (peerName !== this.userName && !this.peers.has(peerName)) {
                util.log(`Creating initiator peer connection with ${peerName}`);
                this.createPeer(peerName, true); // We initiate
            }
        });
    }

    private _handleUserJoined = (msg: { name: string, room: string }) => {
        util.log('User joined: ' + msg.name);
        if (msg.name === this.userName || this.peers.has(msg.name)) {
            return; // Ignore self or existing connections
        }
        this.participants.add(msg.name);

        // New user joined, WE initiate the connection TO them.
        this.createPeer(msg.name, true);
    }

    private _handleUserLeft = (msg: { name: string, room: string }) => {
        util.log('User left: ' + msg.name);
        this.participants.delete(msg.name);

        const peer = this.peers.get(msg.name);
        if (peer) {
            util.log(`Destroying connection to ${msg.name}`);
            peer.destroy(); // Cleanly close the connection
            // The 'close' event handler on the peer will remove it from the map
        }
    }

    private _handleSignal = (msg: { sender: string, target: string, data: SignalData }) => {
        if (msg.sender === this.userName) return; // Ignore signals sent by ourselves (shouldn't happen)

        util.log(`Received signal from ${msg.sender}`);
        let peer = this.peers.get(msg.sender);

        // If we receive a signal (likely an offer) from someone we aren't connected to yet,
        // create a peer instance for them (non-initiator).
        if (!peer) {
            util.log(`Received signal from new peer ${msg.sender}, creating non-initiator peer.`);
            const newPeer = this.createPeer(msg.sender, false); // They initiated
            if (newPeer) {
                peer = newPeer;
            }
        }

        // Pass the signal data to the simple-peer instance
        if (peer) {
            peer.signal(msg.data);
        } else {
            console.error(`Peer not found for signal from ${msg.sender}`);
        }
    }

    private _handleBroadcast = (msg: { sender: string, message: any, room: string }) => {
        util.log('Received broadcast message via signaling from ' + msg.sender);
        if (msg.sender !== this.userName) { // Avoid persisting our own fallback messages
            this.app?._persistMessage(msg.message);
        }
    }

    // --- Peer Connection Management ---

    private createPeer(peerName: string, isInitiator: boolean): SimplePeerInstance | null {
        if (this.peers.has(peerName)) {
            util.log(`Already have a peer connection with ${peerName}`);
            return this.peers.get(peerName) || null;
        }

        util.log(`Creating ${isInitiator ? 'initiator' : 'non-initiator'} peer connection with ${peerName}`);

        try {
            console.log("Creating a SimplePeer");
            const peer = new SimplePeer({
                initiator: isInitiator,
                trickle: true, // Enable trickle ICE for faster connection setup
                // objectMode: true, // Consider if you want to send JS objects directly (requires receiver support)
            });

            // Store the peer instance
            this.peers.set(peerName, peer);
            util.log(`Peer instance created for ${peerName}. Total peers: ${this.peers.size}`);


            // --- SimplePeer Event Handlers ---

            peer.on('signal', (data: SignalData) => {
                util.log(`Generated signal for ${peerName}`);
                if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                    this.socket.send(JSON.stringify({
                        type: 'signal',
                        target: peerName, // Send it TO the specific peer
                        sender: this.userName, // Let them know it's from us
                        data: data         // The actual signaling payload
                    }));
                    util.log(`Sent signal to ${peerName}`);
                } else {
                    console.error(`Cannot send signal to ${peerName}: WebSocket not open.`);
                    // Optional: Queue the signal and send when socket reopens?
                }
            });

            peer.on('connect', () => {
                util.log(`CONNECTED with ${peerName}!`);
                // You can optionally send a backlog of messages or a confirmation here if needed
                // peer.send(JSON.stringify({ type: 'hello', from: this.userName }));
                this.app?._rtcStateChange();
            });

            peer.on('data', (data: any) => {
                // Attempt to parse data, assuming JSON strings for messages
                try {
                    // simple-peer might return Buffer, convert to string
                    const messageString = data.toString();
                    const msg = JSON.parse(messageString);
                    util.log(`onData. Received P2P message from ${peerName}`);
                    this.app?._persistMessage(msg);
                } catch (error) {
                    console.error(`Error processing P2P data from ${peerName}:`, error, data);
                }
                this.app?._rtcStateChange();
            });

            peer.on('close', () => {
                util.log(`Connection CLOSED with ${peerName}`);
                this.peers.delete(peerName); // Remove from map on close
                this.participants.delete(peerName); // Also remove from participants list
                util.log(`Peer instance removed for ${peerName}. Total peers: ${this.peers.size}`);
                this.app?._rtcStateChange();
            });

            peer.on('error', (err: Error) => {
                console.error(`Connection ERROR with ${peerName}:`, err.message);
                // Attempt to clean up the connection
                if (this.peers.has(peerName)) {
                    this.peers.get(peerName)?.destroy(); // Ensure cleanup
                    this.peers.delete(peerName);
                    this.participants.delete(peerName);
                    util.log(`Peer instance removed for ${peerName} after error. Total peers: ${this.peers.size}`);
                }
                this.app?._rtcStateChange();
            });

            return peer;

        } catch (error) {
            // todo-0: I'm randomly getting failure to create SimplePeer instance here, with a cryoptic error and stack trace
            // and I'm really close to just abandon it and use the Legacy code, which we still have.
            console.error(`Failed to create SimplePeer instance for ${peerName}:`, error);
            alert("We've encountered a problem. Please refresh yor browser, and try again.");
            return null;
        }
    }

    private closeAllConnections = () => {
        util.log(`Closing all (${this.peers.size}) peer connections.`);
        this.peers.forEach((peer, name) => {
            util.log(`Destroying connection to ${name}`);
            peer.destroy();
        });
        this.peers.clear();
        this.participants.clear(); // Clear participants when fully disconnected
    }

    public async _connect(userName: string, roomId: string) {
        util.log(`Connecting to room: ${roomId} as user: ${userName}`);
        if (!userName || !roomId) {
            console.error("Username and Room ID are required to connect.");
            return;
        }
        if (!this.storage) {
            console.error('Storage not initialized. Cannot connect.');
            return;
        }

        // If already connected, disconnect cleanly first
        if (this.connected || this.peers.size > 0 || this.socket?.readyState === WebSocket.OPEN) {
            util.log("Already connected or connecting, disconnecting first...");
            this._disconnect(); // Clean up old state
            // Wait a moment for cleanup before reconnecting
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        this.userName = userName;
        this.roomId = roomId;

        // Start the signaling connection process
        this.initRTC();
    }

    public _disconnect() {
        util.log('Disconnecting...');
        // Close the signaling socket
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.close();
        }
        // Socket 'close' handler will trigger closeAllConnections
        // But call it explicitly in case socket wasn't open
        this.closeAllConnections();
        this.connected = false;
        this.userName = "";
        this.roomId = "";
        
        util.log('Disconnect process initiated.');
        this.app?._rtcStateChange(); // Notify app
    }

    public _sendMessage = (msg: any) => {
        if (!this.userName || !this.roomId) {
            console.error("Cannot send message: not connected to a room.");
            return;
        }

        const messageString = JSON.stringify(msg);

        this.peers.forEach((peer, peerName) => {
            if (peer.connected) {
                try {
                    peer.send(messageString);
                    util.log(`Sent P2P message to ${peerName}`);
                } catch (error) {
                    console.error(`Error sending P2P message to ${peerName}:`, error);
                }
            } else {
                util.log(`Skipping send to ${peerName}, not connected.`);
            }
        });

        // If no peers connected, also broadcast via server for real-time delivery
        const connectedPeerCount = Array.from(this.peers.values()).filter(p => p.connected).length;

        if (this.saveToServer) {
            this.persistOnServer(msg);
        }
        else {
            // Note: Theoretically this 'else' should never execute because we block the ability to 
            // even enter messages in the case of having no peers connected (and no server storage option)
            if (connectedPeerCount === 0) {
                util.log('Your message cannot be delivered since no one else is in this room, and you have "Save to Server" disabled.');
                return;
            }
        }
        
        if (connectedPeerCount === 0 && this.participants.size > 0) {
            util.log(`No connected P2P peers (${this.peers.size} total). Sending message via signaling broadcast.`);
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({
                    type: 'broadcast',
                    message: msg, // Send the original object for broadcast
                    room: this.roomId
                }));
                util.log('Sent message via signaling server broadcast.');
            } else {
                console.error('Cannot send broadcast message: WebSocket not open.');
            }
        } else if (connectedPeerCount > 0) {
            util.log(`Message sent via P2P to ${connectedPeerCount} peers.`);
        } else {
            util.log('No participants in the room to send the message to.');
        }
    }

    // New method to persist messages on the server
    private persistOnServer(msg: any) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'persist', // Use a dedicated type for server-only persistence
                message: msg,
                room: this.roomId
            }));
            util.log('Message persisted to server database.');
        } else {
            console.warn('Cannot persist message: WebSocket not open.');
            // Could implement a retry mechanism or queue for offline messages
        }
    }
}

