export interface RoomHistoryItem {
    name: string;
}

export enum DBKeys {
    userName = 'userName',
    userDescription = 'userDescription',
    userAvatar = 'userAvatar',
    chatRoom = 'chatRoom',
    chatContacts = 'chatContacts',
    keyPair = 'keyPair',
    roomPrefix = 'room_',
    chatSaveToServer = 'chatSaveToServer',
    chatDaysOfHistory = 'chatDaysOfHistory',
    chatRoomHistory = 'chatRoomHistory',
    headerExpanded = 'headerExpanded',

    // chat plugin
    chatConnected = 'chatConnected',

    // docs plugin
    docsViewWidth = 'docsViewWidth',
    docsEditMode = 'docsEditMode',
    docsMetaMode = 'docsMetaMode',
    docsNamesMode = 'docsNamesMode',
}

export enum PanelKeys {
    settings_userInfo = 'settings_userInfo',
    settings_storageSpace = 'settings_storageSpace',
    settings_options = 'settings_options',
    settings_identityKeys = 'settings_identityKeys',
    settings_dangerZone = 'settings_dangerZone',
    settings_Diagnostics = 'settings_Diagnostics',
}

export enum PageNames {
    contacts = 'ContactsPage',
    settings = 'SettingsPage',
    userGuide = 'UserGuidePage',
    admin  = 'AdminPage',
    userProfile = 'UserProfilePage',
    logViewer = "LogViewerPage",
}

