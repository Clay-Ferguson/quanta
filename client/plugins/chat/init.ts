import { DBKeys } from "../../AppServiceTypes";
import appRooms from "./AppRooms";
import { rtc } from "./WebRTC";

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