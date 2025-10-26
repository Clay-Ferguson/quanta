import { AttachmentInfo, ChatMessageIntf, RoomInfo, UserProfileCompact } from "./CommonTypes.js";


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

// &&&

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

