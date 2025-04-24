export interface SignableObject {
    signature?: string;
    publicKey?: string;
}

export interface ChatMessageIntf extends SignableObject {
    id: string;
    timestamp: number;
    sender: string;
    content: string;
    publicKey?: string;
    signature?: string;
    attachments?: MessageAttachmentIntf[];
}

export interface MessageAttachmentIntf {
    name: string;
    type: string;
    size: number;
    data: string;
}

export interface User {
    name: string;
    publicKey: string;
}

export interface WebRTCJoin extends SignableObject {
    type: 'join';
    room: string,
    user: User;
    publicKey?: string;
    signature?: string;
}

export interface WebRTCBroadcast extends SignableObject{
    type: 'broadcast',
    message: ChatMessageIntf, // currently we make this scrict as a messge, but probably will be a polymorphic base-type later on.
    room: string,
    sender?: User,
    publicKey?: string;
    signature?: string;
}

export interface WebRTCSignal {
    type: string;
    target: User;
    sender?: User;
    room?: string;
}

export interface WebRTCOffer extends WebRTCSignal {
    type: 'offer';
    offer: RTCSessionDescription;
}

export interface WebRTCAnswer extends WebRTCSignal {    
    type: 'answer';
    answer: RTCSessionDescription;
}

export interface WebRTCICECandidate extends WebRTCSignal {
    type: 'ice-candidate',
    candidate: RTCIceCandidate;
}

export interface WebRTCRoomInfo {
    type: 'room-info',
    participants: User[];
    room: string;
}

export interface WebRTCUserJoined {
    type: 'user-joined';
    user: User;
    room: string;
}

export interface WebRTCUserLeft {
    type: 'user-left';
    user: User;
    room: string;
}
