import { ChatMessage } from "../common/CommonTypes";

export interface AppServiceTypes {
    rtcStateChange(): void;
    persistInboundMessage(msg: ChatMessage): Promise<void>;
    alert(msg: string): void;
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
    roomsAdmin = 'RoomsAdminPage',
    userProfile = 'UserProfilePage',
}

