import { ChatMessageIntf, MessageAttachmentIntf } from '../common/CommonTypes.js';
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

export interface RoomHistoryItem {
    name: string;
}

export enum DBKeys {
    userName = 'userName',
    userDescription = 'userDescription',
    userAvatar = 'userAvatar',
    roomName = 'roomName',
    contacts = 'contacts',
    keyPair = 'keyPair',
    roomPrefix = 'room_',
    connected = 'connected',
    saveToServer = 'saveToServer',
    linkPreview = 'linkPreview',
    daysOfHistory = 'daysOfHistory',
    roomHistory = 'roomHistory',
}

export enum PageNames{
    contacts = 'ContactsPage',
    settings = 'SettingsPage',
    userGuide = 'UserGuidePage',
    quantaChat = 'QuantaChat',
    admin  = 'AdminPage',
    recentAttachments = 'RecentAttachmentsPage',
    roomMembers = 'RoomInfoPage',
    rooms = 'RoomsPage',
}

export type MessageAttachment = MessageAttachmentIntf & {
}

export type ChatMessage = ChatMessageIntf & {
    sigVersion?: string; // todo-1: need to put this in the base class and have stored on server as well.
    sigOk?: boolean; // signature valid, regardless of presence in our Contact List
}

export type Contact = {
    alias: string;
    publicKey: string;
}

