import { DBKeys } from "../../AppServiceTypes";
import { rtc } from "./WebRTC";

declare const HOST: string;
declare const PORT: string;
declare const SECURE: string;

export async function init(context: any) {
    console.log('Initializing Quanta Chat plugin...');
    const saveToServer = await context.idb.getItem(DBKeys.saveToServer, true);
    rtc.init(HOST, PORT, SECURE==='y', saveToServer);
}