export const ANON_USER_ID = -1;

// todo-0: Everything plugin-specific needs to be moved out of common/types and into the plugin itself.

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

export type CompactTreeNode = {
    uuid: string;
    parent_path: string;
    filename: string;
    ordinal: number;
}

export type TreeNode = {
    uuid?: string; // unique identifier for the node, used for VFS
    owner_id?: number; // owner user ID, if applicable
    is_directory?: boolean; 
    is_public?: boolean; 
    name: string; // filename
    url?: string; // this will be the FULL url independent of currently viewed root, so we can show 'pull up' images in the tree easier.
    createTime: number;
    modifyTime: number;
    content: string;
    children?: TreeNode[] | null; // subdirectories or files (pullups only)
    fsChildren?: boolean; // true if this node has children in the file system
    ordinal?: number; // ordinal value for file/folder ordering (used in VFS)
}

export interface AuthenticationInfo {
    userProfile?: UserProfileCompact;
    validSignature?: boolean; 
}

export interface BaseResponse {
    message?: string;
    error?: string;
}

