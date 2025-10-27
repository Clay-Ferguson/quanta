import { SignableObject, User } from "../../../common/types/CommonTypes.js";
import { ChatMessageIntf } from "./CommonTypes.js";

export type WebRTCJoin = SignableObject & {
    type: 'join';
    room: string,
    user: User;
    publicKey?: string;
    signature?: string;
}

export type WebRTCBroadcast = SignableObject & {
    type: 'broadcast',
    message: ChatMessageIntf,
    room: string,
    sender?: User,
    publicKey?: string;
    signature?: string;
}

export type WebRTCDeleteMsg = SignableObject & {
    type: 'delete-msg',
    messageId: string,
    room: string,
    publicKey?: string;
    signature?: string;
}

export type WebRTCAck = SignableObject & {
    type: 'ack',
    id: string, // message that is being acknowledged
}

export type WebRTCSignal = {
    id?: string;
    type: string;
    target: User;
    sender?: User;
    room?: string;
}

export type WebRTCOffer = WebRTCSignal & SignableObject & {
    type: 'offer';
    offer: RTCSessionDescription;
    target: User;
    room: string;
    publicKey?: string;
    signature?: string;
}

export type WebRTCAnswer = WebRTCSignal & {    
    type: 'answer';
    answer: RTCSessionDescription;
}

export type WebRTCICECandidate = WebRTCSignal & {
    type: 'ice-candidate',
    candidate: RTCIceCandidate;
}

export type WebRTCRoomInfo = {
    type: 'room-info',
    participants: User[];
    room: string;
}

// NOTE: This object not signed because it only originates from server, not peers
export type WebRTCUserJoined = {
    type: 'user-joined';
    user: User;
    room: string;
    publicKey?: string;
    signature?: string;
}

// NOTE: This object not signed because it only originates from server, not peers
export type WebRTCUserLeft = {
    type: 'user-left';
    user: User;
    room: string;
}

