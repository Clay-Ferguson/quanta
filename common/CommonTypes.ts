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

export enum MessageStates {
    SENT = 's', // sent to server, not proven stored in DB yet
    FAILED = 'f', // failed to send
    SAVED = 'a' // acknowledged by server (stored in DB)
}

export interface ChatMessageIntf extends SignableObject {
    id: string;
    timestamp: number;
    sender: string;
    content: string;
    publicKey?: string;
    signature?: string;
    attachments?: FileBase64Intf[];
    state?: MessageStates;
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

export type RoomInfo = {
    id: string;
    name: string;
    messageCount: number;
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

export interface FileBlob {
    id?: number; // Attachments table ID if stored in DB
    name: string;
    type: string;
    size: number;
    data: Buffer; 
}

export type AttachmentInfo = {
    id: number;
    name: string;
    type: string;
    size: number;
    messageId: string;
    sender: string;
    publicKey: string;
    timestamp: number;
    roomName: string;
}

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

export type GetMessageIdsForRoom_Response = {
    messageIds: string[];
}

export type GetMessageHistory_Response = {
    messages: ChatMessageIntf[];
}

export type GetRoomInfo_Response = {
    rooms: RoomInfo[];
}

export type DeleteRoom_Response = {
    message: string;
}

export type GetRecentAttachments_Response = {
    attachments: AttachmentInfo[]
}

export type GetMessagesByIds_Response = {
    messages: ChatMessageIntf[];
}