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
    daysOfHistory = 'daysOfHistory',
    roomHistory = 'roomHistory',
    headerExpanded = 'headerExpanded',
}

export enum PanelKeys {
    settings_userInfo = 'settings_userInfo',
    settings_storageSpace = 'settings_storageSpace',
    settings_options = 'settings_options',
    settings_identityKeys = 'settings_identityKeys',
    settings_dangerZone = 'settings_dangerZone',
    settings_Diagnostics = 'settings_Diagnostics',
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
    logViewer = "LogViewer",
}

