
import { AttachmentInfo, BaseResponse, FileBase64Intf, SignableObject } from "../../../common/types/CommonTypes.js";

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

export type ChatMessage = ChatMessageIntf & {
    sigVersion?: string; 
    sigOk?: boolean; 
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




