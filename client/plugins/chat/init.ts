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

declare const HOST: string;
declare const PORT: string;
declare const SECURE: string;

export async function init(context: any) {
    console.log('Initializing Quanta Chat plugin...');

    const gs: ChatGlobalState = context.initGs;
    gs.chatConnecting = false;
    gs.chatConnected = false;
    gs.chatRoom = '';
    gs.chatMessages = [];  // todo-0: needs chat prefix
    gs.chatParticipants = new Map<string, User>(); // todo-0: needs chat prefix
    gs.chatContacts = [];
    gs.chatSaveToServer = true; // todo-0: needs chat prefix
    gs.chatDaysOfHistory = 30; // todo-0: needs chat prefix
    gs.chatRoomHistory = []; // todo-0: needs chat prefix

    // todo-0: initialize chat global state onto 'context.initGs' here.
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

export function getRoute(pageName: string) {
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

export function getUserProfileComponent(profileData: UserProfile) {
    return React.createElement(UserProfileChatComp, { profileData });
}

 