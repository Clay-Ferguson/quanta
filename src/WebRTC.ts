import { ChatMessage, User, WebRTCAck, WebRTCAnswer, WebRTCBroadcast, WebRTCICECandidate, WebRTCJoin, WebRTCOffer, WebRTCRoomInfo, WebRTCUserJoined, WebRTCUserLeft } from '../common/CommonTypes.ts';
import { KeyPairHex } from '../common/CryptoIntf.ts';
import {AppServiceTypes} from './AppServiceTypes.ts';
import IndexedDB from './IndexedDB.ts';
import {util} from './Util.ts';
import {crypt} from '../common/Crypto.ts';  
import { canon } from '../common/Canonicalizer.ts';

/**
 * WebRTC class for handling WebRTC connections on the P2P clients.
 * 
 * Designed as a singleton that can be instantiated once and reused
 */
export default class WebRTC {
    disconnectTime: number = 0;
    // Maps RTCPeerConnection by PublicKey
    peerConnections: Map<string, RTCPeerConnection> = new Map();

    // maps user names to their RTCDataChannel objects
    dataChannels: Map<string, RTCDataChannel> = new Map();

    socket: WebSocket | null = null;
    roomId = "";
    userName = "";
    keyPair: KeyPairHex | null = null;

    // all room participants by publicKey
    participants = new Map<string, User>();
    connected: boolean = false;
    storage: IndexedDB | null = null;
    app: AppServiceTypes | null = null;
    host: string = "";
    port: string = "";
    secure: boolean = false;
    saveToServer: boolean = false;

    // for debugging
    pingChecks = false;

    constructor(storage: IndexedDB, app: AppServiceTypes, host: string, port: string, secure: boolean, saveToServer: boolean) {
        this.storage = storage;
        this.app = app;
        this.host = host;
        this.port = port;
        this.saveToServer=saveToServer;
        this.secure = secure;
    }

    initRTC() {
        if (this.socket) {
            console.error('******** WebRTC ran with existing socket. Should be closed first.');
            return;
        }
        util.log('Starting WebRTC connection setup...');

        // Create WebSocket connection to signaling server. 
        const url = `${this.secure ? 'wss' : 'ws'}://${this.host}:${this.port}`;
        console.log('Connecting to signaling server at ' + url);
        this.socket = new WebSocket(url);
        this.socket.onopen = this._onopen;
        this.socket.onmessage = this._onmessage;
        this.socket.onerror = this._onerror;
        this.socket.onclose = this._onclose;
    }

    setSaveToServer = (save: boolean) => {
        this.saveToServer = save;
    }

    _onRoomInfo = async (evt: WebRTCRoomInfo) => {
        util.log('Room info received with participants');
        this.participants = new Map<string, User>();

        // build up a list of strings which is what 'this.participants' currently is.
        for (const user of evt.participants) {
            util.log('    User in room: ' + user.name);
            this.participants.set(user.publicKey, user);
      
            if (!this.peerConnections.has(user.publicKey)) {
                util.log('Initiate a connection with ' + user.name+' because he is in room');
                await this.createPeerConnection(user, true);
            }
            else {
                util.log('Already have connection with ' + user.name);
            }
        }
        
        // Schedule a debug check after connections should be established
        setTimeout(() => {
            console.log("Verifying data channels and connection states, after 5s wait...");
            this.debugDataChannels();
            this.attemptConnectionRecovery();
        }, 5000);
    }

    // Recovery method
    attemptConnectionRecovery() {
        util.log('Checking participant connectivity');
        
        // Close any stalled connections and recreate them
        this.participants.forEach(participant => {
            const pc = this.peerConnections.get(participant.publicKey);
            if (pc && (pc.connectionState !== 'connected' || !this.hasOpenChannelFor(participant.publicKey))) {
                util.log(`Recreating connection with ${participant}`);
                
                // Close old connection
                pc.close();
                this.peerConnections.delete(participant.publicKey); 
                
                // Create a new connection
                this.createPeerConnection(participant, true);
            }
        });
    }

    hasOpenChannelFor(publicKey: string) {
        const channel = this.dataChannels.get(publicKey);
        return channel && channel.readyState === 'open';
    }

    _onUserJoined = (evt: WebRTCUserJoined) => {
        const user: User = evt.user;
        if (!user.publicKey) {
            util.log('User joined without a public key, ignoring.');
            return;
        }
        util.log('User joined: ' + user.name);
        this.participants.set(user.publicKey, user);

        // Initiate a connection with the new user
        if (!this.peerConnections.has(user.publicKey)) {
            util.log('Creating connection with ' + user.name+' because of onUserJoined');
            this.createPeerConnection(user, true); 
        }
        else {
            util.log('Already have connection with ' + user.name);
        }
    }

    _onUserLeft = (evt: WebRTCUserLeft) => {
        const user: User = evt.user;
        util.log('User left: ' + user.name);
        this.participants.delete(user.publicKey);

        // Clean up connections
        const pc = this.peerConnections.get(user.publicKey);
        if (pc) {
            pc.close();
            this.peerConnections.delete(user.publicKey);
        }

        if (this.dataChannels.has(user.publicKey)) {
            this.dataChannels.delete(user.publicKey);
        }
    }

    _onOffer = async (evt: WebRTCOffer) => {
        if (!evt.sender) {
            util.log('Received offer without sender, ignoring.');
            return;
        }
        if (evt.sender.publicKey != evt.publicKey) {
            util.log('Received offer with event of a mismatched publicKey. ignoring.');
            return;
        }
        const sigOk = crypt.verifySignature(evt, canon.canonical_WebRTCOffer); 
        if (!sigOk) {
            console.error("Signature verification failed for offer message:", evt);
            return;
        }

        let pc = this.peerConnections.get(evt.sender.publicKey);
        
        // Handle the "glare" condition - two peers creating offers simultaneously
        if (pc && pc.signalingState === 'have-local-offer') {
            // Use a tie-breaker mechanism based on public keys
            const localKeyIsLower = this.keyPair!.publicKey.localeCompare(evt.sender.publicKey) < 0;
            
            if (localKeyIsLower) {
                // Local peer wins - ignore the remote offer and wait for our offer to be accepted
                util.log(`Received competing offer from ${evt.sender.name}, but we'll prioritize our local offer based on key comparison`);
                return;
            } else {
                // Remote peer wins - rollback our offer and accept the remote one
                util.log(`Resolving signaling conflict with ${evt.sender.name} by rolling back our offer`);
                pc.close();
                this.peerConnections.delete(evt.sender.publicKey);
                // Create a new connection as a non-initiator
                pc = await this.createPeerConnection(evt.sender, false);
            }
        }
        
        // Create a connection if it doesn't exist
        if (!pc) {
            util.log('Creating connection with ' + evt.sender.name+' because of onOffer');
            pc = await this.createPeerConnection(evt.sender, false);
        }
        
        // Rest of the existing code for handling the offer...
        util.log('Received offer from ' + evt.sender.name + ', signaling state: ' + 
                 (pc?.signalingState || 'no connection yet'));

        // Continue with existing code to set remote description and create answer
        pc.setRemoteDescription(new RTCSessionDescription(evt.offer))
            .then(() => {
                const answer = pc.createAnswer();
                util.log('Creating answer for ' + evt.sender!.name);
                return answer;
            })
            .then((answer: any) => {
                const desc = pc.setLocalDescription(answer);
                util.log('Setting local description for ' + evt.sender!.name);
                return desc;
            })
            .then(() => {
                if (this.socket) {
                    console.log('Sending answer to ' + evt.sender!.name);
                    const answer: WebRTCAnswer = {
                        type: 'answer',
                        answer: pc.localDescription!,
                        target: evt.sender!,
                        room: this.roomId
                    }
                    this.socketSend(answer);
                }
                else {
                    console.error('Error: WebSocket not open. Cannot send answer.');
                }
            })
            .catch((error: any) => util.log('Error creating answer: ' + error));
    }

    _onAnswer = (evt: WebRTCAnswer) => {
        if (!evt.sender) {
            util.log('Received answer without sender, ignoring.');
            return;
        }
        const pc = this.peerConnections.get(evt.sender.publicKey);
        util.log('Received answer from ' + evt.sender.name + ', signaling state: ' + 
                 (pc?.signalingState || 'no connection'));
        if (pc) {
            // Check the signaling state before setting remote description
            if (pc.signalingState === 'have-local-offer') {
                pc.setRemoteDescription(new RTCSessionDescription(evt.answer))
                    .catch((error: any) => util.log('Error setting remote description: ' + error));
            } else {
                util.log(`Cannot set remote answer in current state: ${pc.signalingState}`);
                // Optionally implement recovery logic here
            }
        }
        else {
            util.log('No peer connection found for ' + evt.sender.name);
        }
    }

    _onIceCandidate = (evt: WebRTCICECandidate) => {
        util.log('Received ICE candidate from ' + evt.sender!.name);
        const pc = this.peerConnections.get(evt.sender!.publicKey);
        if (pc) {
            pc.addIceCandidate(new RTCIceCandidate(evt.candidate))
                .catch((error: any) => util.log('Error adding ICE candidate: ' + error));
        }
        else {
            util.log('No peer connection found for ' + evt.sender!.name);
        }
    }

    _onAcknowledge = (evt: WebRTCAck) => {
        this.app?.acknowledgeMessage(evt.id);
    }

    _onBroadcast = (evt: WebRTCBroadcast) => {
        util.log('broadcast. Received broadcast message from ' + evt.sender!.name);
        this.app?.persistInboundMessage(evt.message);           
    }

    _onmessage = (event: any) => {
        const evt = JSON.parse(event.data);
        util.log('Received message from signaling server: ' + event.data);

        switch (evt.type) {
        case 'room-info':
            this._onRoomInfo(evt);
            break;
        case 'user-joined':
            this._onUserJoined(evt);
            break;
        case 'user-left':
            this._onUserLeft(evt);
            break;
        case 'offer':
            this._onOffer(evt);
            break;
        case 'answer':
            this._onAnswer(evt);
            break;
        case 'ice-candidate':
            this._onIceCandidate(evt);
            break;
        case 'broadcast':
            this._onBroadcast(evt);
            break;
        case 'ack':
            this._onAcknowledge(evt);
            break;
        default:
            util.log('Unknown message type: ' + evt.type);
        } 
        this.app?.rtcStateChange();
    }

    _onopen = async () => {
        util.log('Connected to signaling server.');
        this.connected = true;

        // Join a room with user name
        if (this.socket) {
            const joinMessage: WebRTCJoin = {
                type: 'join',
                room: this.roomId,
                user: {
                    name: this.userName,
                    publicKey: this.keyPair!.publicKey
                }
            };

            this.signedSocketSend(joinMessage, canon.canonical_WebRTCJoin);
        }
        util.log('Joining room: ' + this.roomId + ' as ' + this.userName);
        this.app?.rtcStateChange();
    }

    _onerror = (error: any) => {
        util.log('WebSocket error: ' + error);
        this.connected = false;
        this.app?.rtcStateChange();
    };

    _onclose = () => {
        util.log('Disconnected from signaling server');
        this.connected = false;
        this.closeAllConnections();
        this.app?.rtcStateChange();
    }

    //peerName = user.name
    createPeerConnection = async (user: User, isInitiator: boolean): Promise<RTCPeerConnection> => {
        util.log('Creating peer connection with ' + user.name + (isInitiator ? ' (as initiator)' : ''));
        const pc = new RTCPeerConnection({
            iceCandidatePoolSize: 10 // Increase candidate gathering
        });
        this.peerConnections.set(user.publicKey, pc);

        // Add monitoring for ICE gathering state
        pc.onicegatheringstatechange = () => {
            util.log(`ICE gathering state with ${user.name}: ${pc.iceGatheringState}`);
        };

        // Add monitoring for signaling state
        pc.onsignalingstatechange = () => {
            util.log(`Signaling state with ${user.name}: ${pc.signalingState}`);
        };

        // Set up ICE candidate handling
        pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
            if (event.candidate && this.socket) {
                const iceCandidate: WebRTCICECandidate = {
                    type: 'ice-candidate',
                    candidate: event.candidate,
                    target: user,
                    room: this.roomId
                };
                this.socketSend(iceCandidate);
                util.log('Sent ICE candidate to ' + user.name);
            }
        };

        // Connection state changes
        pc.onconnectionstatechange = () => {
            util.log('Connection state with ' + user.name + ': ' + pc.connectionState);
            if (pc.connectionState === 'connected') {
                util.log('WebRTC connected with ' + user.name + '!');
            } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                util.log('WebRTC disconnected from ' + user.name);
            }
        };

        // Handle incoming data channels
        pc.ondatachannel = (event: RTCDataChannelEvent) => {
            util.log('Received data channel from ' + user.name);
            this.setupDataChannel(event.channel, user);
        };

        // If we're the initiator, create a data channel
        if (isInitiator) {
            // Convert promise chains to async/await pattern
            try {
                util.log('Creating data channel as initiator for ' + user.name);
                
                const channel = pc.createDataChannel('chat', {
                    ordered: true,        // Guaranteed delivery order
                    negotiated: false     // Let WebRTC handle negotiation
                });
                this.setupDataChannel(channel, user);
                
               
                // Create the offer with specific options
                const offer = await pc.createOffer({
                    offerToReceiveAudio: false,
                    offerToReceiveVideo: false
                });
                    
                // Log the offer SDP for debugging
                util.log(`Created offer SDP type: ${offer.type}`);
                    
                // Set the local description
                await pc.setLocalDescription(offer);
                    
                // Send the offer if socket is available and local description is set
                if (this.socket && pc.localDescription) {
                    const offer: WebRTCOffer = {
                        type: 'offer',
                        offer: pc.localDescription,
                        target: user,
                        room: this.roomId
                    };
                    this.signedSocketSend(offer, canon.canonical_WebRTCOffer);
                    util.log('Sent offer to ' + user.name);
                }
            } catch (err) {
                util.log('Error creating data channel: ' + err);
            }
        }
        return pc;
    }

    _connect = async (userName: string, keyPair: KeyPairHex, roomName: string): Promise<boolean> => {
        if (this.disconnectTime > 0) {
            const timeSinceDisconnect = Date.now() - this.disconnectTime;
            if (timeSinceDisconnect < 5000) {
                util.log('WebRTC: Attempting to reconnect too quickly after disconnect. Waiting...');
                this.app!.alert('Too soon after disconnect. Please wait a few seconds before reconnecting.');
                return false;
            }
        }

        console.log( 'WebRTC Connecting to room: ' + roomName + ' as user: ' + userName);
        // If already connected, reset connection with new name and room
        this._disconnect();

        this.userName = userName;
        this.keyPair = keyPair;
        this.roomId = roomName;

        this.initRTC();
        return true;
    }

    _disconnect = () => {
        // Close the signaling socket if it exists and is open
        if (this.socket) {
            if (this.socket.readyState === WebSocket.OPEN) {
                util.log('Closing WebSocket connection...');
                this.socket.close();
            } else if (this.socket.readyState === WebSocket.CONNECTING) {
                util.log('Aborting connection attempt...');
                this.socket.close();
            }
            // Clear the socket reference
            this.socket = null;
        }
    
        // Close all peer connections
        this.closeAllConnections();
    
        // Reset other state
        this.participants.clear();
        this.connected = false;
    
        util.log('Disconnected from WebRTC session');
        this.app?.rtcStateChange();
    }

    closeAllConnections() {
        // Close all data channels first
        this.dataChannels.forEach((channel, publicKey) => {
            if (channel.readyState !== 'closed') {
                util.log(`Explicitly closing data channel to ${publicKey}`);
                try {
                    channel.close();
                } catch (err) {
                    util.log(`Error closing channel to ${publicKey}: ${err}`);
                }
            }
        });
    
        // Clean up all peer connections
        this.peerConnections.forEach(pc => pc.close());
        this.peerConnections.clear();
        this.dataChannels.clear();

        this.disconnectTime = Date.now();
    }

    // Add this new method to help diagnose channel issues
    debugDataChannels() {
        util.log('---------- DATA CHANNEL DEBUG INFO ----------');
        if (this.dataChannels.size === 0) {
            util.log('No data channels established');
        
            // Check if connections exist
            if (this.peerConnections.size > 0) {
                util.log(`Have ${this.peerConnections.size} peer connections but no channels`);
                this.peerConnections.forEach((pc, peer) => {
                    util.log(`Connection to ${peer}: state=${pc.connectionState}, signaling=${pc.signalingState}`);
                });
            }
        } else {
            this.dataChannels.forEach((channel, publicKey) => {
                util.log(`Channel to ${publicKey}: state=${channel.readyState}, ordered=${channel.ordered}, reliable=${!channel.maxRetransmits && !channel.maxPacketLifeTime}`);
            });
        }
        util.log('------------------------------------------');
    }

    setupDataChannel(channel: RTCDataChannel, user: User) {
        util.log('Setting up data channel for ' + user.name);
        this.dataChannels.set(user.publicKey, channel);

        channel.onopen = () => {
            util.log(`Data channel OPENED with ${user.name}`);
            if (this.pingChecks) {
                // Try sending a test message to confirm functionality
                try {
                    channel.send(JSON.stringify({type: 'ping', timestamp: Date.now()}));
                    util.log(`Test message sent to ${user.name}`);
                } catch (err) {
                    util.log(`Error sending test message: ${err}`);
                }}
        };

        channel.onclose = () => {
            util.log('Data channel closed with ' + user.name);
            this.dataChannels.delete(user.publicKey);
        };

        channel.onmessage = (event: MessageEvent) => {
            util.log('onMessage. Received message from ' + user.name);
            try {
                const msg = JSON.parse(event.data);
                // ignore if a 'ping' message
                if (msg.type === 'ping') {
                    util.log(`Ping received from ${user.name} at ${msg.timestamp}`);
                }
                else {
                    if (!msg.signature) {
                        console.log('Received message without signature, ignoring.');
                        return;
                    }
                    this.app?.persistInboundMessage(msg);
                }
            } catch (error) {
                util.log('Error parsing message: ' + error);
            }
        };

        channel.onerror = (error: any) => {
            util.log('Data channel error with ' + user.name + ': ' + error);
        };
    }

    // Returns false if unable to send to anyone at all, else true of sent to at lest one person. If the user trie to send
    // chat messages too fast before connections are 'open' we return false here and the calling method can retry.
    _sendMessage = (msg: ChatMessage): boolean => {
        let sent = false;
        
        // If Pure P2P mode.
        if (!this.saveToServer) {
            const jsonMsg = JSON.stringify(msg);
            util.log(`Attempting to send message through ${this.dataChannels.size} data channels`);
        
            // Try to send through all open channels
            this.dataChannels.forEach((channel, publicKey) => {
                if (channel.readyState === 'open') {
                    try {
                        channel.send(jsonMsg);
                        util.log(`Successfully sent message to ${publicKey}`);
                        sent = true;
                    } catch (err) {
                        // todo-1: we could use a timer here, and attempt to call 'send' one more time, in a few seconds.
                        util.log(`Error sending to ${publicKey}: ${err}`);
                    }
                }
                else {
                    util.log(`Channel to ${publicKey} is not open, skipping send`);
                }
            });
        }
        // If non-P2P mode, send via signaling server broadcast
        else {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                // Send the message to the signaling server for broadcast, note there's no 'sender' on it yet.
                const broadcastMessage = {
                    type: 'broadcast',
                    message: msg, 
                    room: this.roomId
                }
                this.socketSend(broadcastMessage);
                util.log('Sent message via signaling server broadcast.');
                sent = true;
            } else {
                console.error('Cannot send broadcast message: WebSocket not open.');
            }
        }
        if (!sent) {
            util.log('ERROR: Failed to send message through any channel');
        }
        return sent;
    }

    signedSocketSend = async (msg: any, canonicalizr: (obj: any) => string) => {
        await crypt.signObject(msg, canonicalizr, this.keyPair!);
        this.socketSend(msg);
    }

    socketSend(msg: any) {
        this.socket!.send(JSON.stringify(msg));
    }

    // todo-1: we now use a broadcast for this, so the 'persist' code on the server can be removed.
    // persistOnServer(msg: any) {
    //     if (this.socket && this.socket.readyState === WebSocket.OPEN) {
    //         this.socket.send(JSON.stringify({
    //             type: 'persist', // Use a dedicated type for server-only persistence
    //             message: msg,
    //             room: this.roomId
    //         }));
    //         util.log('Message persisted to server database.');
    //     } else {
    //         console.warn('Cannot persist message: WebSocket not open.');
    //         // Could implement a retry mechanism or queue for offline messages
    //     }
    // }
}
