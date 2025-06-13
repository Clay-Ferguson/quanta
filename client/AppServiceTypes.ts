import { UserProfile } from "../common/types/CommonTypes";
import { GlobalState } from "./GlobalState";

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
    docsRequireDate = 'docsRequireDate',
    docsSearchTextOnly = 'docsSearchTextOnly',
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
    admin  = 'AdminPage',
    userProfile = 'UserProfilePage',
    logViewer = "LogViewerPage",
}

export interface IClientPlugin {
    getKey(): string; 
    init(context: any): Promise<void>;
    notify(): Promise<void>;
    applyStateRules(gs: GlobalState): void;
    restoreSavedValues(gs: GlobalState): Promise<void>;
    getRoute(gs: GlobalState, pageName: string): React.ReactElement | null;
    getSettingsPageComponent(): React.ReactElement | null;
    getAdminPageComponent(): React.ReactElement | null;
    getUserProfileComponent(profileData: UserProfile): React.ReactElement | null;
    goToMainPage(): void;
}


