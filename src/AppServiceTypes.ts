import { ChatMessage } from "../common/CommonTypes";

export interface AppServiceTypes {
    rtcStateChange(): void;
    persistInboundMessage(msg: ChatMessage): Promise<void>;
    acknowledgeMessage(id: string): Promise<void>;
    inboundDeleteMessage(roomName: string, id: string): Promise<void>;
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
    headerExpanded = 'headerExpanded',
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

