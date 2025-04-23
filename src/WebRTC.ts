import { User } from '../common/CommonTypes.ts';
import { KeyPairHex } from '../common/CryptoIntf.ts';
import {AppServiceTypes, ChatMessage} from './AppServiceTypes.ts';
import IndexedDB from './IndexedDB.ts';
import {util} from './Util.ts';

/**
 * WebRTC class for handling WebRTC connections on the P2P clients.
 * 
 * Designed as a singleton that can be instantiated once and reused
 */
export default class WebRTC {
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

    constructor(storage: IndexedDB, app: AppServiceTypes, host: string, port: string, secure: boolean, saveToServer: boolean) {
        this.storage = storage;
        this.app = app;
        this.host = host;
        this.port = port;
        this.saveToServer=saveToServer;
        this.secure = secure;
    }

    initRTC() {
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

    // todo-0: this is not yet updated to handle User objects as the participants
    _onRoomInfo = (evt: any) => {
        util.log('Room info received with participants');
        this.participants = new Map<string, User>();

        // build up a list of strings which is what 'this.participants' currently is.
        evt.participants.forEach((user: User) => {
            util.log('    User in room: ' + user.name);
            this.participants.set(user.publicKey, user);
      
            if (!this.peerConnections.has(user.publicKey)) {
                util.log('Initiate a connection with ' + user.name+' because he is in room');
                this.createPeerConnection(user, true);
            }
            else {
                util.log('Already have connection with ' + user.name);
            }
        });
        
        // Schedule a debug check after connections should be established
        // todo-0: Not sure if this is needed or not.
        // setTimeout(() => {
        //     this.debugDataChannels();
        //     // If still no working channels, try to recreate them
        //     if (!this.hasWorkingDataChannels()) {
        //         util.log('No working data channels after timeout, attempting recovery');
        //         this.attemptConnectionRecovery();
        //     }
        // }, 5000);
    }

    // Helper method to check for any working data channels
    hasWorkingDataChannels() {
        let hasWorking = false;
        // todo-0: We could've used an 'any' call here instead of 'forEach' right?
        this.dataChannels.forEach(channel => {
            if (channel.readyState === 'open') {
                hasWorking = true;
            }
        });
        return hasWorking;
    }

    // Recovery method
    // attemptConnectionRecovery() {
    //     util.log('Attempting connection recovery');
        
    //     // Close any stalled connections and recreate them
    //     this.participants.forEach(participant => {
    //         const pc = this.peerConnections.get(participant); <--- this obsolete, we key peeConnsctions by publicKey now.
    //         if (pc && (pc.connectionState !== 'connected' || !this.hasOpenChannelFor(participant))) {
    //             util.log(`Recreating connection with ${participant}`);
                
    //             // Close old connection
    //             pc.close();
    //             this.peerConnections.delete(participant); <--- ditto warning above
                
    //             // Create a new connection
    //             this.createPeerConnection(participant, true);
    //         }
    //     });
    // }

    hasOpenChannelFor(peerName: string) {
        const channel = this.dataChannels.get(peerName);
        return channel && channel.readyState === 'open';
    }

    _onUserJoined = (evt: any) => {
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

    _onUserLeft = (evt: any) => {
        const user: User = evt.user;
        util.log('User left: ' + user.name);
        this.participants.delete(user.publicKey);

        // Clean up connections
        const pc = this.peerConnections.get(user.publicKey);
        if (pc) {
            pc.close();
            this.peerConnections.delete(user.publicKey);
        }

        if (this.dataChannels.has(user.name)) {
            this.dataChannels.delete(user.name);
        }
    }

    _onOffer = (evt: any) => {
        let pc = this.peerConnections.get(evt.sender.publicKey);
        util.log('Received offer from ' + evt.sender.name + ', signaling state: ' + 
                 (pc?.signalingState || 'no connection yet'));

        // Create a connection if it doesn't exist
        // let pc: RTCPeerConnection | undefined;
        if (!pc) {
            util.log('Creating connection with ' + evt.sender.name+' because of onOffer');
            pc = this.createPeerConnection(evt.sender, false);
        } 
       
        // todo-0: convert this to await style calls
        pc.setRemoteDescription(new RTCSessionDescription(evt.offer))
            .then(() => {
                const answer = pc.createAnswer();
                util.log('Creating answer for ' + evt.sender.name);
                return answer;
            })
            .then((answer: any) => {
                const desc = pc.setLocalDescription(answer);
                util.log('Setting local description for ' + evt.sender.name);
                return desc;
            })
            .then(() => {
                if (this.socket) {
                    console.log('Sending answer to ' + evt.sender.name);
                    this.socket.send(JSON.stringify({
                        type: 'answer',
                        answer: pc.localDescription,
                        target: evt.sender,
                        room: this.roomId
                    }));
                }
                else {
                    console.error('Error: WebSocket not open. Cannot send answer.');
                }
            })
            .catch((error: any) => util.log('Error creating answer: ' + error));
    }

    _onAnswer = (evt: any) => {
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

    _onIceCandidate = (evt: any) => {
        util.log('Received ICE candidate from ' + evt.sender.name);
        const pc = this.peerConnections.get(evt.sender.publicKey);
        if (pc) {
            pc.addIceCandidate(new RTCIceCandidate(evt.candidate))
                .catch((error: any) => util.log('Error adding ICE candidate: ' + error));
        }
        else {
            util.log('No peer connection found for ' + evt.sender.name);
        }
    }

    _onBroadcast = (evt: any) => {
        util.log('broadcast. Received broadcast message from ' + evt.sender.name);
        this.app?._persistMessage(evt.message);           
    }

    _onmessage = (event: any) => {
        const evt = JSON.parse(event.data);

        util.log('>>>> Received message from signaling server: ' + event.data);

        if (evt.type === 'room-info') {
            this._onRoomInfo(evt);
        }
        else if (evt.type === 'user-joined') {
            this._onUserJoined(evt);
        }
        else if (evt.type === 'user-left') {
            this._onUserLeft(evt);
        }
        else if (evt.type === 'offer' && evt.sender) {
            this._onOffer(evt);
        }
        else if (evt.type === 'answer' && evt.sender) {
            this._onAnswer(evt);
        }
        else if (evt.type === 'ice-candidate' && evt.sender) {
            this._onIceCandidate(evt);
        }
        else if (evt.type === 'broadcast' && evt.sender) {
            this._onBroadcast(evt); 
        }
        this.app?._rtcStateChange();
    }

    _onopen = () => {
        util.log('Connected to signaling server.');
        this.connected = true;

        // Join a room with user name
        if (this.socket) {
            this.socket.send(JSON.stringify({
                type: 'join',
                room: this.roomId,
                name: this.userName,
                publicKey: this.keyPair?.publicKey
            }));
        }
        util.log('Joining room: ' + this.roomId + ' as ' + this.userName);
        this.app?._rtcStateChange();
    }

    _onerror = (error: any) => {
        util.log('WebSocket error: ' + error);
        this.connected = false;
        this.app?._rtcStateChange();
    };

    _onclose = () => {
        util.log('Disconnected from signaling server');
        this.connected = false;
        this.closeAllConnections();
        this.app?._rtcStateChange();
    }

    //peerName = user.name
    createPeerConnection(user: User, isInitiator: boolean) {
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
                this.socket.send(JSON.stringify({
                    type: 'ice-candidate',
                    candidate: event.candidate,
                    target: user,
                    room: this.roomId
                }));
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
            this.setupDataChannel(event.channel, user.name);
        };

        // If we're the initiator, create a data channel
        if (isInitiator) {
            try {
                util.log('Creating data channel as initiator for ' + user.name);
                
                const channel = pc.createDataChannel('chat', {
                    ordered: true,        // Guaranteed delivery order
                    negotiated: false     // Let WebRTC handle negotiation
                });
                this.setupDataChannel(channel, user.name);
                
                // todo-0: convert this to async/await pattern
                pc.createOffer({
                    offerToReceiveAudio: false,
                    offerToReceiveVideo: false
                })
                    .then(offer => {
                        // Log the offer SDP for debugging
                        util.log(`Created offer SDP type: ${offer.type}`);
                        return pc.setLocalDescription(offer);
                    })
                    .then(() => {
                        if (this.socket && pc.localDescription) {
                            this.socket.send(JSON.stringify({
                                type: 'offer',
                                offer: pc.localDescription,
                                target: user,
                                room: this.roomId
                            }));
                            util.log('Sent offer to ' + user.name);
                        }
                    })
                    .catch(error => util.log('Error creating offer: ' + error));
            } catch (err) {
                util.log('Error creating data channel: ' + err);
            }
        }
        return pc;
    }

    _connect = async (userName: string, keyPair: KeyPairHex, roomName: string) => {
        console.log( 'WebRTC Connecting to room: ' + roomName + ' as user: ' + userName);
        this.userName = userName;
        this.keyPair = keyPair;
        this.roomId = roomName;

        // If already connected, reset connection with new name and room
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.closeAllConnections();

            // Rejoin with new name and room
            this.socket.send(JSON.stringify({
                type: 'join',
                room: this.roomId,
                name: this.userName,
                publicKey: this.keyPair?.publicKey
            }));
            util.log('Joining room: ' + this.roomId + ' as ' + this.userName);
        } else {
            // todo-0: this seems odd to run init here, when we're actually trying to connect to a room, because
            // this connect doesn't result in creation of the room does it?????
            this.initRTC();
        }
    }

    _disconnect = () => {
        // Close the signaling socket
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.close();
        }
        this.closeAllConnections();

        // Reset participants
        this.participants.clear();
        this.connected = false;
    }

    closeAllConnections() {
        // Clean up all connections
        this.peerConnections.forEach(pc => pc.close());
        this.peerConnections.clear();
        this.dataChannels.clear();
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
            this.dataChannels.forEach((channel, peer) => {
                util.log(`Channel to ${peer}: state=${channel.readyState}, ordered=${channel.ordered}, reliable=${!channel.maxRetransmits && !channel.maxPacketLifeTime}`);
            });
        }
        util.log('------------------------------------------');
    }

    setupDataChannel(channel: RTCDataChannel, peerName: string) {
        util.log('Setting up data channel for ' + peerName);
        this.dataChannels.set(peerName, channel);

        channel.onopen = () => {
            util.log(`Data channel OPENED with ${peerName}`);
            // Try sending a test message to confirm functionality
            try {
                channel.send(JSON.stringify({type: 'ping', timestamp: Date.now()}));
                util.log(`Test message sent to ${peerName}`);
            } catch (err) {
                util.log(`Error sending test message: ${err}`);
            }
        };

        channel.onclose = () => {
            util.log('Data channel closed with ' + peerName);
            this.dataChannels.delete(peerName);
        };

        channel.onmessage = (event: MessageEvent) => {
            util.log('onMessage. Received message from ' + peerName);
            try {
                const msg = JSON.parse(event.data);
                // ignore if a 'ping' message
                if (msg.type === 'ping') {
                    util.log(`Ping received from ${peerName} at ${msg.timestamp}`);
                }
                else {
                    this.app?._persistMessage(msg);
                }
            } catch (error) {
                util.log('Error parsing message: ' + error);
            }
        };

        channel.onerror = (error: any) => {
            util.log('Data channel error with ' + peerName + ': ' + error);
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
            this.dataChannels.forEach((channel, peer) => {
                if (channel.readyState === 'open') {
                    try {
                        channel.send(jsonMsg);
                        util.log(`Successfully sent message to ${peer}`);
                        sent = true;
                    } catch (err) {
                        // todo-1: we could use a timer here, and attempt to call 'send' one more time, in a few seconds.
                        util.log(`Error sending to ${peer}: ${err}`);
                    }
                }
                else {
                    // todo-0: looks like if P2P mode is enabled (no save to server) the channels are failing and we end up here.
                    util.log(`Channel to ${peer} is not open, skipping send`);
                }
            });
        }
        // If non-P2P mode, send via signaling server broadcast
        else {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({
                    type: 'broadcast',
                    message: msg, 
                    room: this.roomId
                }));
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
