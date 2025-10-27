export const ANON_USER_ID = -1;

export type KeyPairHex = {
    privateKey: string;
    publicKey: string
};

export type SignableObject = {
    signature?: string;
    publicKey?: string;
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

export interface AuthenticationInfo {
    userProfile?: UserProfileCompact;
    validSignature?: boolean; 
}

export interface BaseResponse {
    message?: string;
    error?: string;
}

