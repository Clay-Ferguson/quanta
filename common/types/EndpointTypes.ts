import { AttachmentInfo, ChatMessage, ChatMessageIntf, RoomInfo, TreeNode } from "./CommonTypes.js";

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

export type ExtractTags_Response = {
    success: boolean;
    message?: string;
    tags: string[];
}

export type ScanTags_Response = {
    success: boolean;
    message: string;
    existingTags: number;
    newTags: number;
    totalTags: number;
}

