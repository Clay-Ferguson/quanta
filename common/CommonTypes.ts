export interface ChatMessageIntf {
    id: string;
    timestamp: number;
    sender: string;
    content: string;
    publicKey?: string;
    signature?: string;
    attachments?: MessageAttachmentIntf[];
}

export interface MessageAttachmentIntf {
    name: string;
    type: string;
    size: number;
    data: string;
}

export interface User {
    name: string;
    publicKey: string;
}
