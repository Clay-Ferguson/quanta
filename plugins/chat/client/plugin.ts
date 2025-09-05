import React from 'react';
import { DBKeys, RoomHistoryItem, IClientPlugin } from "../../../client/AppServiceTypes";
import appRooms from "./AppRooms";
import { rtc } from "./WebRTC";
import ContactsPage from "./pages/ContactsPage";
import RecentAttachmentsPage from "./pages/RecentAttachmentsPage";
import RoomInfoPage from "./pages/RoomInfoPage";
import RoomsPage from "./pages/RoomsPage";
import RoomsAdminPage from "./pages/RoomsAdminPage";
import QuantaChatPage from "./pages/QuantaChatPage";
import ChatSettingsPageComp from './comps/SettingsPageComp';
import { Contact, User, UserProfile } from '../../../common/types/CommonTypes';
import { ChatGlobalState, ChatPageNames } from './ChatTypes';
import { idb } from '../../../client/IndexedDB';
import UserProfileChatComp from './UserProfileChatComp';
import SettingsPage from '../../../client/pages/SettingsPage';
import { app } from '../../../client/AppService';
import { ChatAdminPageComp } from './ChatAdminPageComp';
import DocViewerPage from '../../../client/pages/DocViewerPage';

declare const CLIENT_HOST: string;
declare const PORT: string;
declare const SECURE: boolean;

class ChatClientPlugin implements IClientPlugin {

    getKey(): string {
        return 'chat';
    }

    async init(context: any) {
        console.log('Initializing Quanta Chat plugin...');

        const gs: ChatGlobalState = context.initGs;
        gs.chatConnecting = false;
        gs.chatConnected = false;
        gs.chatRoom = '';
        gs.chatMessages = [];
        gs.chatParticipants = new Map<string, User>(); 
        gs.chatContacts = [];
        gs.chatSaveToServer = true; 
        gs.chatDaysOfHistory = 30;
        gs.chatRoomHistory = []; 

        const chatSaveToServer = await context.idb.getItem(DBKeys.chatSaveToServer, true);
        rtc.init(CLIENT_HOST, PORT, SECURE, chatSaveToServer);
    }

    async notify() {
        appRooms.restoreConnection();
        setTimeout(() => {
            appRooms.runRoomCleanup();
        }, 10000);
    }

    applyStateRules(gs: ChatGlobalState) {
        if (!gs.chatConnected) {
            gs.headerExpanded = true;
        }
    }

    async restoreSavedValues(gs: ChatGlobalState) {
        const chatContacts: Contact[] = await idb.getItem(DBKeys.chatContacts);
        const chatRoom: string = await idb.getItem(DBKeys.chatRoom);
        const chatSaveToServer: boolean = await idb.getItem(DBKeys.chatSaveToServer, true) === true;
        const chatDaysOfHistory: number = await idb.getItem(DBKeys.chatDaysOfHistory) || 30;
        const chatRoomHistory: RoomHistoryItem[] = await idb.getItem(DBKeys.chatRoomHistory) || [];
    
        gs.chatContacts = chatContacts || [];
        gs.chatRoom = chatRoom || '';
        gs.chatSaveToServer = chatSaveToServer;
        gs.chatDaysOfHistory = chatDaysOfHistory;
        gs.chatRoomHistory = chatRoomHistory || [];
    }

    getRoute(gs: ChatGlobalState, pageName: string) {
        // If user has no saved name yet and is trying to go to chat page, send them to Settings Page instead.
        if (!gs.userProfile!.name && pageName === ChatPageNames.quantaChat) {
            return React.createElement(SettingsPage);
        }

        const pluginTitle = "Quanta Chat";

        switch (pageName) {
        case ChatPageNames.contacts:
            return React.createElement(ContactsPage, { pluginTitle });
        case ChatPageNames.recentAttachments:
            return React.createElement(RecentAttachmentsPage, { pluginTitle });
        case ChatPageNames.roomMembers:
            return React.createElement(RoomInfoPage, { pluginTitle });
        case ChatPageNames.rooms:
            return React.createElement(RoomsPage, { pluginTitle });
        case ChatPageNames.roomsAdmin:
            return React.createElement(RoomsAdminPage, { pluginTitle });
        case ChatPageNames.quantaChat: 
            return React.createElement(QuantaChatPage, { pluginTitle });
        case ChatPageNames.chatUserGuide:
            return React.createElement(DocViewerPage, { filename: "/docs/extensions/chat/chat_user_guide.md", title: "Quanta Chat User Guide" });
        default: return null;
        }
    }

    // Gets component to display on settings page, for this plugin. 
    getSettingsPageComponent() {
        return React.createElement(ChatSettingsPageComp);
    }

    getAdminPageComponent() {
        return React.createElement(ChatAdminPageComp);
    }

    getUserProfileComponent(profileData: UserProfile) {
        return React.createElement(UserProfileChatComp, { profileData });
    }

    goToMainPage() {
        app.goToPage(ChatPageNames.quantaChat);
    }
}

export const plugin = new ChatClientPlugin();