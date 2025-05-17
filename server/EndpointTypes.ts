export interface DeleteRoomRequest {
    roomName: string;
}

export interface DeleteMessageRequest {
    messageId: string;
    roomName: string;
    publicKey: string;
}

export interface BlockUserRequest {
    pub_key: string;
}

export interface GetMessagesByIdsRequest {
    ids: string[];
}

export interface SendMessagesRequest {
    messages: any[];
}

