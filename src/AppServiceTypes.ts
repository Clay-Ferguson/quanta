import { ChatMessageIntf, MessageAttachmentIntf } from '../common/CommonTypes';
export interface AppServiceTypes {
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

export enum DBKeys {
    userName = 'userName',
    roomName = 'roomName',
    contacts = 'contacts',
    keyPair = 'keyPair',
    roomPrefix = 'room_',
    connected = 'connected',
    saveToServer = 'saveToServer',
    linkPreview = 'linkPreview',
    daysOfHistory = 'daysOfHistory',
}

export enum PageNames{
    contacts = 'ContactsPage',
    settings = 'SettingsPage',
    userGuide = 'UserGuidePage',
    quantaChat = 'QuantaChat',
    admin  = 'AdminPage',
}

export type MessageAttachment = MessageAttachmentIntf & {
}

export type ChatMessage = ChatMessageIntf & {
    sigVersion?: string; // todo-0: need to put this in the base class and have stored on server as well.
    sigOk?: boolean; // signature valid, regardless of presence in our Contact List
    trusted?: boolean; // trusted contact (in our Contact List, at time of receipt)
}

export type Contact = {
    name: string;
    alias?: string;
    publicKey: string;
}

