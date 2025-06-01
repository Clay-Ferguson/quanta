export interface DBManagerIntf {
    get: (sql: string, ...params: any[]) => Promise<any>;
    all: (sql: string, ...params: any[]) => Promise<any[]>;
    run(sql: any, ...params: any[]): Promise<any>;
    checkDb: () => void;
}

export type KeyPairHex = {
    privateKey: string;
    publicKey: string
};

export type SignableObject = {
    signature?: string;
    publicKey?: string;
}

export enum MessageStates {
    SENT = 's', // sent to server, not proven stored in DB yet
    FAILED = 'f', // failed to send
    SAVED = 'a' // acknowledged by server (stored in DB)
}

// Note: type inherits from SignableObject
export type ChatMessageIntf = SignableObject & {
    id: string;
    timestamp: number;
    sender: string;
    content: string;
    publicKey?: string;
    signature?: string;
    attachments?: FileBase64Intf[];
    state?: MessageStates;
}

export type UserProfile = {
    name: string;
    description: string;
    avatar: FileBase64Intf | null;
    publicKey: string;
    signature?: string; // will be null if not signed
}

export type User = {
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

export type FileBase64Intf = {
    id?: number; // Attachments table ID if stored in DB
    name: string;
    type: string;
    size: number;
    data: string; // base64 encoded
}

export type FileBlob = {
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

export type TreeNode = {
    name: string; // filename
    createTime: number;
    modifyTime: number;
    content: string;
    mimeType: string;
    children?: TreeNode[] | null; // subdirectories or files (pullups only)
}

