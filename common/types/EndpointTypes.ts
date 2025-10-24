import { AttachmentInfo, ChatMessage, ChatMessageIntf, RoomInfo, TreeNode, UserProfileCompact } from "./CommonTypes.js";

// Authentication properties that can be mixed into any Request type
export interface AuthenticationInfo {
    userProfile?: UserProfileCompact;
    validSignature?: boolean; // Indicates if the request has a valid signature
}

export type DeleteRoom_Request = {
    roomName: string;
}

export type DeleteMessage_Request = {
    messageId: string;
    roomName: string;
}

export type BlockUser_Request = {
    publicKey: string;
}

export type GetMessagesByIds_Request = {
    ids: string[];
}

export type SendMessages_Request = {
    messages: ChatMessage[];
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

export type TreeRender_Response = {
    user_id: number | null;
    treeNodes: TreeNode[];
    rootNode: TreeNode;
    treeFolder?: string; // Returns proper ordinal path for root node being viewed.
}

export type TagCategory = {
    heading: string;
    tags: string[];
}

export type ExtractTags_Response = {
    success: boolean;
    message?: string;
    tags: string[]; // Kept for backward compatibility, will be deprecated
    categories?: TagCategory[]; // New categorized format
}

export type ScanTags_Response = {
    success: boolean;
    message: string;
    existingTags: number;
    newTags: number;
    totalTags: number;
}

// HTTP Request info
export type Delete_ReqInfo = {
    fileOrFolderName?: string; // Single item mode
    fileNames?: string[]; // Multiple items mode  
    treeFolder: string; // Parent directory path
}

// HTTP Response info
export type Delete_ResInfo = {
    message?: string; // Success message
    error?: string; // Single error message (for validation errors)
    deletedCount?: number; // Present in multiple items mode
    errors?: string[]; // Present if there were errors in multiple items mode
}

