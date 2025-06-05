import React from 'react';
import { DBKeys, PageNames } from "../../AppServiceTypes";
import appRooms from "./AppRooms";
import { rtc } from "./WebRTC";
import ContactsPage from "./pages/ContactsPage";
import RecentAttachmentsPage from "./pages/RecentAttachmentsPage";
import RoomInfoPage from "./pages/RoomInfoPage";
import RoomsPage from "./pages/RoomsPage";
import RoomsAdminPage from "./pages/RoomsAdminPage";
import QuantaChatPage from "./pages/QuantaChatPage";

declare const HOST: string;
declare const PORT: string;
declare const SECURE: string;

export async function init(context: any) {
    console.log('Initializing Quanta Chat plugin...');
    const saveToServer = await context.idb.getItem(DBKeys.saveToServer, true);
    rtc.init(HOST, PORT, SECURE==='y', saveToServer);
}

export async function notify() {
    appRooms.restoreConnection();
    setTimeout(() => {
        appRooms.runRoomCleanup();
    }, 10000);
}

export function getRoute(pageName: string) {
    switch (pageName) {
    case PageNames.contacts:
        return React.createElement(ContactsPage);
    case PageNames.recentAttachments:
        return React.createElement(RecentAttachmentsPage);
    case PageNames.roomMembers:
        return React.createElement(RoomInfoPage);
    case PageNames.rooms:
        return React.createElement(RoomsPage);
    case PageNames.roomsAdmin:
        return React.createElement(RoomsAdminPage);
    case PageNames.quantaChat: // fall thru. to default
        return React.createElement(QuantaChatPage);
    default: return null;
    }
}

 