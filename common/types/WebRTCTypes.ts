import { ChatMessageIntf, SignableObject, User } from "./CommonTypes.js";

export interface WebRTCJoin extends SignableObject {
    type: 'join';
    room: string,
    user: User;
    publicKey?: string;
    signature?: string;
}

export interface WebRTCBroadcast extends SignableObject {
    type: 'broadcast',
    message: ChatMessageIntf,
    room: string,
    sender?: User,
    publicKey?: string;
    signature?: string;
}

export interface WebRTCDeleteMsg extends SignableObject {
    type: 'delete-msg',
    messageId: string,
    room: string,
    publicKey?: string;
    signature?: string;
}

export interface WebRTCAck extends SignableObject{
    type: 'ack',
    id: string, // message that is being acknowledged
}

export interface WebRTCSignal {
    id?: string;
    type: string;
    target: User;
    sender?: User;
    room?: string;
}

export interface WebRTCOffer extends WebRTCSignal, SignableObject {
    type: 'offer';
    offer: RTCSessionDescription;
    target: User;
    room: string;
    publicKey?: string;
    signature?: string;
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

// NOTE: This object not signed because it only originates from server, not peers
export interface WebRTCUserJoined  {
    type: 'user-joined';
    user: User;
    room: string;
    publicKey?: string;
    signature?: string;
}

// NOTE: This object not signed because it only originates from server, not peers
export interface WebRTCUserLeft {
    type: 'user-left';
    user: User;
    room: string;
}

