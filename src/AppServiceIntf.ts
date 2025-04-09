export interface AppServiceIntf {
    /**
     * Handle RTC state changes
     */
    _rtcStateChange(): void;

    /**
     * Persist a message to storage
     * @param msg The message to persist
     */
    _persistMessage(msg: any): Promise<void>;
}

export type MessageAttachment = {
    name: string;
    type: string;
    size: number;
    data: string;
}

export type ChatMessage = {
    sender: string;
    content: string;
    timestamp: number;
    attachments?: MessageAttachment[];
    sigVersion?: string;
    signature?: string; // signature hex
    publicKey?: string; // public key hex
}

