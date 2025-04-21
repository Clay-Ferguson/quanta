import {AppServiceTypes, ChatMessage} from './AppServiceTypes.ts';
import IndexedDB from './IndexedDB.ts';
import {util} from './Util.ts';


/**
 * WebRTC class for handling WebRTC connections on the P2P clients.
 * 
 * Designed as a singleton that can be instantiated once and reused
 */
export default class WebRTC {

    // maps user names to their RTCPeerConnection objects
    peerConnections: Map<string, RTCPeerConnection> = new Map();

    // maps user names to their RTCDataChannel objects
    dataChannels: Map<string, RTCDataChannel> = new Map();

    socket: WebSocket | null = null;
    roomId = "";
    userName = "";
    participants = new Set<string>();
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

    _onRoomInfo = (evt: any) => {
        util.log('Room info received with participants: ' + evt.participants.join(', '));
        this.participants = new Set(evt.participants);

        evt.participants.forEach((participant: any) => {
            if (!this.peerConnections.has(participant)) {
                this.createPeerConnection(participant, true);
            }
        });
        
        // Schedule a debug check after connections should be established
        setTimeout(() => {
            this.debugDataChannels();
            
            // If still no working channels, try to recreate them
            if (!this.hasWorkingDataChannels()) {
                util.log('No working data channels after timeout, attempting recovery');
                this.attemptConnectionRecovery();
            }
        }, 5000);
    }

    // Helper method to check for any working data channels
    hasWorkingDataChannels() {
        let hasWorking = false;
        this.dataChannels.forEach(channel => {
            if (channel.readyState === 'open') {
                hasWorking = true;
            }
        });
        return hasWorking;
    }

    // Recovery method
    attemptConnectionRecovery() {
        util.log('Attempting connection recovery');
        
        // Close any stalled connections and recreate them
        this.participants.forEach(participant => {
            const pc = this.peerConnections.get(participant);
            if (pc && (pc.connectionState !== 'connected' || !this.hasOpenChannelFor(participant))) {
                util.log(`Recreating connection with ${participant}`);
                
                // Close old connection
                pc.close();
                this.peerConnections.delete(participant);
                
                // Create a new connection
                this.createPeerConnection(participant, true);
            }
        });
    }

    hasOpenChannelFor(peerName: string) {
        const channel = this.dataChannels.get(peerName);
        return channel && channel.readyState === 'open';
    }

    _onUserJoined = (evt: any) => {
        util.log('User joined: ' + evt.name);
        this.participants.add(evt.name);

        // Create a connection with the new user (we are initiator)
        if (!this.peerConnections.has(evt.name)) {
            this.createPeerConnection(evt.name, true);
        }
    }

    _onUserLeft = (evt: any) => {
        util.log('User left: ' + evt.name);
        this.participants.delete(evt.name);

        // Clean up connections
        const pc = this.peerConnections.get(evt.name);
        if (pc) {
            pc.close();
            this.peerConnections.delete(evt.name);
        }

        if (this.dataChannels.has(evt.name)) {
            this.dataChannels.delete(evt.name);
        }
    }

    _onOffer = (evt: any) => {
        util.log('Received offer from ' + evt.sender + ', signaling state: ' + 
                 (this.peerConnections.get(evt.sender)?.signalingState || 'no connection'));

        // Create a connection if it doesn't exist
        let pc: RTCPeerConnection | undefined;
        if (!this.peerConnections.has(evt.sender)) {
            pc = this.createPeerConnection(evt.sender, false);
        } else {
            pc = this.peerConnections.get(evt.sender);
        }

        if (pc) {
            pc.setRemoteDescription(new RTCSessionDescription(evt.offer))
                .then(() => pc.createAnswer())
                .then((answer: any) => pc.setLocalDescription(answer))
                .then(() => {
                    if (this.socket) {
                        this.socket.send(JSON.stringify({
                            type: 'answer',
                            answer: pc.localDescription,
                            target: evt.sender,
                            room: this.roomId
                        }));
                    }
                    util.log('Sent answer to ' + evt.sender);
                })
                .catch((error: any) => util.log('Error creating answer: ' + error));
        }
    }

    _onAnswer = (evt: any) => {
        const pc = this.peerConnections.get(evt.sender);
        util.log('Received answer from ' + evt.sender + ', signaling state: ' + 
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
    }

    _onIceCandidate = (evt: any) => {
        util.log('Received ICE candidate from ' + evt.sender);
        const pc = this.peerConnections.get(evt.sender);
        if (pc) {
            pc.addIceCandidate(new RTCIceCandidate(evt.candidate))
                .catch((error: any) => util.log('Error adding ICE candidate: ' + error));
        }
    }

    _onBroadcast = (evt: any) => {
        util.log('broadcast. Received broadcast message from ' + evt.sender);
        this.app?._persistMessage(evt.message);           
    }

    _onmessage = (event: any) => {
        const evt = JSON.parse(event.data);

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
                name: this.userName
            }));}
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

    createPeerConnection(peerName: string, isInitiator: boolean) {
        util.log('Creating peer connection with ' + peerName + (isInitiator ? ' (as initiator)' : ''));
        const pc = new RTCPeerConnection({
            iceCandidatePoolSize: 10 // Increase candidate gathering
        });
        this.peerConnections.set(peerName, pc);

        // Add monitoring for ICE gathering state
        pc.onicegatheringstatechange = () => {
            util.log(`ICE gathering state with ${peerName}: ${pc.iceGatheringState}`);
        };

        // Add monitoring for signaling state
        pc.onsignalingstatechange = () => {
            util.log(`Signaling state with ${peerName}: ${pc.signalingState}`);
        };

        // Set up ICE candidate handling
        pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
            if (event.candidate && this.socket) {
                this.socket.send(JSON.stringify({
                    type: 'ice-candidate',
                    candidate: event.candidate,
                    target: peerName,
                    room: this.roomId
                }));
                util.log('Sent ICE candidate to ' + peerName);
            }
        };

        // Connection state changes
        pc.onconnectionstatechange = () => {
            util.log('Connection state with ' + peerName + ': ' + pc.connectionState);
            if (pc.connectionState === 'connected') {
                util.log('WebRTC connected with ' + peerName + '!');
            } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                util.log('WebRTC disconnected from ' + peerName);
            }
        };

        // Handle incoming data channels
        pc.ondatachannel = (event: RTCDataChannelEvent) => {
            util.log('Received data channel from ' + peerName);
            this.setupDataChannel(event.channel, peerName);
        };

        // If we're the initiator, create a data channel
        if (isInitiator) {
            try {
                util.log('Creating data channel as initiator for ' + peerName);
                
                // Configure data channel for reliability
                const channelOptions = {
                    ordered: true,        // Guaranteed delivery order
                    negotiated: false     // Let WebRTC handle negotiation
                };
                
                const channel = pc.createDataChannel('chat', channelOptions);
                this.setupDataChannel(channel, peerName);

                // Create and send offer with modified SDP for better connectivity
                const offerOptions = {
                    offerToReceiveAudio: false,
                    offerToReceiveVideo: false
                };
                
                pc.createOffer(offerOptions)
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
                                target: peerName,
                                room: this.roomId
                            }));
                            util.log('Sent offer to ' + peerName);
                        }
                    })
                    .catch(error => util.log('Error creating offer: ' + error));
            } catch (err) {
                util.log('Error creating data channel: ' + err);
            }
        }
        return pc;
    }

    _connect = async (userName: string, roomId: string) => {
        console.log( 'WebRTC Connecting to room: ' + roomId + ' as user: ' + userName);
        this.userName = userName;
        this.roomId = roomId;

        if (!this.storage) {
            util.log('Storage not initialized. Cannot connect.');
            return;
        }

        // If already connected, reset connection with new name and room
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.closeAllConnections();

            // Rejoin with new name and room
            this.socket.send(JSON.stringify({
                type: 'join',
                room: this.roomId,
                name: this.userName
            }));
            util.log('Joining room: ' + this.roomId + ' as ' + this.userName);
        } else {
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

    // New method to persist messages on the server
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
