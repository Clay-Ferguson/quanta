export interface AppServiceIntf {
    /**
     * Handle RTC state changes
     */
    _rtcStateChange(): void;

    /**
     * Persist a message to storage
     * @param msg The message to persist
     */
    _persistMessage(msg: ChatMessage): Promise<void>;
}

export type MessageAttachment = {
    name: string;
    type: string;
    size: number;
    data: string;
}

export type ChatMessage = {
    id: string;
    sender: string;
    content: string;
    timestamp: number;
    attachments?: MessageAttachment[];
    sigVersion?: string;
    signature?: string; // signature hex
    publicKey?: string; // public key hex
    sigOk?: boolean; // signature valid, regardless of presence in our Contact List
    trusted?: boolean; // trusted contact (in our Contact List, at time of receipt)
}

export type Contact = {
    name: string;
    alias?: string;
    publicKey: string;
}

