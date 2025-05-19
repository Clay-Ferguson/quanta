import { AttachmentInfo, ChatMessage, ChatMessageIntf, RoomInfo } from "./CommonTypes.js";

export type DeleteRoom_Request = {
    roomName: string;
}

export type DeleteMessage_Request = {
    messageId: string;
    roomName: string;
    publicKey: string;
}

export type BlockUser_Request = {
    publicKey: string;
}

export type GetMessagesByIds_Request = {
    ids: string[];
}

export type SendMessages_Request = {
    messages: ChatMessage[];
    publicKey: string;
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

