import {AppServiceTypes} from './AppServiceTypes.ts';
import IndexedDB from './IndexedDB.ts';
import {util} from './Util.ts';
import { WebRTCIntf } from './WebRTCIntf.ts';

/**
 * WebRTC class for handling WebRTC connections on the P2P clients.
 * 
 * Designed as a singleton that can be instantiated once and reused
 * 
 * NOTE: See README.md, to unserstand why this Legacy class still exists.
 */
class WebRTC_Legacy implements WebRTCIntf {

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

    constructor(storage: IndexedDB, app: AppServiceTypes, host: string, port: string) {
        this.storage = storage;
        this.app = app;
        this.host = host;
        this.port = port;
    }

    initRTC() {
        util.log('Starting WebRTC connection setup...');

        // Create WebSocket connection to signaling server. 
        const url = `ws://${this.host}:${this.port}`;
        console.log('Connecting to signaling server at ' + url);
        this.socket = new WebSocket(url);
        this.socket.onopen = this._onopen;
        this.socket.onmessage = this._onmessage;
        this.socket.onerror = this._onerror;
        this.socket.onclose = this._onclose;
    }

    _onRoomInfo = (evt: any) => {
        util.log('Room info received with participants: ' + evt.participants.join(', '));
        this.participants = new Set(evt.participants);

        evt.participants.forEach((participant: any) => {
            if (!this.peerConnections.has(participant)) {
                this.createPeerConnection(participant, true);
            }
        });
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
        util.log('Received offer from ' + evt.sender);

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
        util.log('Received answer from ' + evt.sender);
        const pc = this.peerConnections.get(evt.sender);
        if (pc) {
            pc.setRemoteDescription(new RTCSessionDescription(evt.answer))
                .catch((error: any) => util.log('Error setting remote description: ' + error));
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
        const pc = new RTCPeerConnection();
        this.peerConnections.set(peerName, pc);

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
                const channel = pc.createDataChannel('chat');
                this.setupDataChannel(channel, peerName);

                // Create and send offer
                pc.createOffer()
                    .then(offer => pc.setLocalDescription(offer))
                    .then(() => {
                        if (this.socket) {
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

    setupDataChannel(channel: RTCDataChannel, peerName: string) {
        util.log('Setting up data channel for ' + peerName);
        this.dataChannels.set(peerName, channel);

        channel.onopen = () => {
            util.log('Data channel open with ' + peerName);
        };

        channel.onclose = () => {
            util.log('Data channel closed with ' + peerName);
            this.dataChannels.delete(peerName);
        };

        channel.onmessage = (event: MessageEvent) => {
            util.log('onMessage. Received message from ' + peerName);
            try {
                const msg = JSON.parse(event.data);
                this.app?._persistMessage(msg);
            } catch (error) {
                util.log('Error parsing message: ' + error);
            }
        };

        channel.onerror = (error: any) => {
            util.log('Data channel error with ' + peerName + ': ' + error);
        };
    }

    _sendMessage = (msg: string) => {
        // Try to send through data channels first
        let channelsSent = 0;
        this.dataChannels.forEach((channel: RTCDataChannel) => {
            if (channel.readyState === 'open') {
                channel.send(JSON.stringify(msg));
                channelsSent++;
            }
        });

        // If no channels are ready or no peers, send through signaling server
        if ((channelsSent === 0 || this.participants.size === 0) &&
            this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'broadcast',
                message: msg,
                room: this.roomId
            }));
            util.log('Sent message via signaling server');
        }
    }
}

export default WebRTC_Legacy;