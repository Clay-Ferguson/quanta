export const ANON_USER_ID = -1;

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

export type UserProfileCompact = {
    id?: number;
    name?: string;
    publicKey?: string;
}

export type UserProfile = UserProfileCompact & {
    userId?: number | null; // will be null if not set
    description?: string;
    avatar?: FileBase64Intf | null;
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
    owner_id?: number; // owner user ID, if applicable
    is_directory?: boolean; 
    is_public?: boolean; // todo-1: I could possibly make this non-optional
    name: string; // filename
    url?: string; // this will be the FULL url independent of currently viewed root, so we can show 'pull up' images in the tree easier.
    createTime: number;
    modifyTime: number;
    content: string;
    type: string; // <--- this is obsolete and will eventually be removed, use 'is_directory' and/or file extension instead
    children?: TreeNode[] | null; // subdirectories or files (pullups only)
    fsChildren?: boolean; // true if this node has children in the file system
}

