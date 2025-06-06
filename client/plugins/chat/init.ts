import React from 'react';
import { DBKeys, RoomHistoryItem } from "../../AppServiceTypes";
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
import { idb } from '../../IndexedDB';
import UserProfileChatComp from './UserProfileChatComp';
import SettingsPage from '../../pages/SettingsPage';
import { app } from '../../AppService';
import { ChatAdminPageComp } from './ChatAdminPageComp';

// todo-0: We need Plugins functions to be a class with a polymorphic interface, so that we can have a common interface for all plugins.

declare const HOST: string;
declare const PORT: string;
declare const SECURE: string;

export async function init(context: any) {
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
    rtc.init(HOST, PORT, SECURE==='y', chatSaveToServer);
}

export async function notify() {
    appRooms.restoreConnection();
    setTimeout(() => {
        appRooms.runRoomCleanup();
    }, 10000);
}

export function applyStateRules(gs: ChatGlobalState) {
    if (!gs.chatConnected) {
        gs.headerExpanded = true;
    }
}

export async function restoreSavedValues(gs: ChatGlobalState) {
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

export function getRoute(gs: ChatGlobalState, pageName: string) {
    if (!gs.userName) {
        return React.createElement(SettingsPage);
    }

    switch (pageName) {
    case ChatPageNames.contacts:
        return React.createElement(ContactsPage);
    case ChatPageNames.recentAttachments:
        return React.createElement(RecentAttachmentsPage);
    case ChatPageNames.roomMembers:
        return React.createElement(RoomInfoPage);
    case ChatPageNames.rooms:
        return React.createElement(RoomsPage);
    case ChatPageNames.roomsAdmin:
        return React.createElement(RoomsAdminPage);
    case ChatPageNames.quantaChat: // fall thru. to default
        return React.createElement(QuantaChatPage);
    default: return null;
    }
}

// Gets component to display on settings page, for this plugin. 
export function getSettingsPageComponent() {
    return React.createElement(ChatSettingsPageComp);
}

export function getAdminPageComponent() {
    return React.createElement(ChatAdminPageComp);
}

export function getUserProfileComponent(profileData: UserProfile) {
    return React.createElement(UserProfileChatComp, { profileData });
}

export function goToMainPage() {
    app.goToPage(ChatPageNames.quantaChat);
}


 