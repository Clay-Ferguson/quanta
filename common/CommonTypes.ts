export interface DBManagerIntf {
    runTrans: (callback: () => Promise<any>) => Promise<any>;
    get: (sql: string, ...params: any[]) => Promise<any>;
    all: (sql: string, ...params: any[]) => Promise<any[]>;
    run(sql: any, ...params: any[]): Promise<any>;
}
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
    attachments?: FileBase64Intf[];
    state?: 's' | 'f' | 'a'; //s=sent, f=failed, a=acknowledged (saved by server)
}

export interface UserProfile {
    name: string;
    description: string;
    avatar: FileBase64Intf | null;
    publicKey: string;
    signature?: string; // will be null if not signed
}

export interface User {
    name: string;
    publicKey: string;
}

export type ChatMessage = ChatMessageIntf & {
    sigVersion?: string; // todo-1: need to put this in the base class and have stored on server as well.
    sigOk?: boolean; // signature valid, regardless of presence in our Contact List
}

export type Contact = {
    alias: string;
    publicKey: string;
}

export interface FileBase64Intf {
    id?: number; // Attachments table ID if stored in DB
    name: string;
    type: string;
    size: number;
    data: string; // base64 encoded
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
