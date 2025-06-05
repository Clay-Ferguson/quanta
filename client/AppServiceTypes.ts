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

// todo-0: make a version of this specific to each plugin, and make them named like 'ChatPageNames' etc.
export enum PageNames {
    contacts = 'ContactsPage',
    settings = 'SettingsPage',
    userGuide = 'UserGuidePage',
    treeViewer = 'TreeViewerPage', 
    quantaChat = 'QuantaChatPage',
    admin  = 'AdminPage',
    recentAttachments = 'RecentAttachmentsPage',
    roomMembers = 'RoomInfoPage',
    rooms = 'RoomsPage',
    roomsAdmin = 'RoomsAdminPage',
    userProfile = 'UserProfilePage',
    logViewer = "LogViewerPage",
    searchView = "SearchViewPage",
}

