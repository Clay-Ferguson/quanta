import { AttachmentInfo, ChatMessage, ChatMessageIntf, RoomInfo, TreeNode, UserProfileCompact } from "./CommonTypes.js";

export type TreeRender_Response = {
    user_id: number | null;
    treeNodes: TreeNode[];
    rootNode: TreeNode;
    treeFolder?: string;
}


// todo-0: These are incomplete, not consistently used throughout the codebase, and even once done we need to split
// apart to where each plugin has it's own copy of these types rather than having them all in common/types

export interface AuthenticationInfo {
    userProfile?: UserProfileCompact;
    validSignature?: boolean; 
}

export interface BaseResponse {
    message?: string;
    error?: string;
}

export type DeleteMessage_ReqInfo = {
    messageId: string;
    roomName: string;
}

export type DeleteMessage_ResInfo = BaseResponse & {
}

export type BlockUser_ReqInfo = {
    publicKey: string;
}

export type BlockUser_ResInfo = BaseResponse & {
}


export type GetMessagesByIds_ReqInfo = {
    ids: string[];
}

export type SendMessages_ReqInfo = {
    messages: ChatMessage[];
}

export type GetMessageIdsForRoom_ReqInfo = {
    daysOfHistory?: number;
}

export type GetMessageIdsForRoom_ResInfo = BaseResponse & {
    messageIds: string[];
}

export type GetMessageHistory_ReqInfo = {
    roomName: string;
    limit?: number;
    offset?: number;
}

export type GetMessageHistory_ResInfo = BaseResponse & {
    messages: ChatMessageIntf[];
}

export type GetRoomInfo_ReqInfo = Record<string, never>;

export type GetRoomInfo_ResInfo = BaseResponse & {
    rooms: RoomInfo[];
}

export type DeleteRoom_ReqInfo = {
    roomName: string;
}

export type DeleteRoom_ResInfo = BaseResponse & {
    message?: string;
}

export type GetRecentAttachments_ReqInfo = Record<string, never>;

export type GetRecentAttachments_ResInfo = {
    attachments: AttachmentInfo[]
}

export type GetMessagesByIds_Response = {
    messages: ChatMessageIntf[];
}


// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type DeleteAttachment_ReqInfo = {
}

export type DeleteAttachment_ResInfo = BaseResponse & {
}

