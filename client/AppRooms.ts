import { ChatMessage } from "../common/types/CommonTypes.ts";
import { app } from "./AppService.ts";
import { DBKeys, RoomHistoryItem } from "./AppServiceTypes.ts";
import { confirmModal } from "./components/ConfirmModalComp";
import { gd, gs } from "./GlobalState";
import {idb} from './IndexedDB.ts';

class AppRooms {
    runRoomCleanup = async () => {
        // Get all room keys
        const roomKeys = await idb.findKeysByPrefix(DBKeys.roomPrefix);
        if (roomKeys) {
            // Loop through each room and delete all messages older than gs.daysOfHistory
            for (const roomKey of roomKeys) {
                console.log(`Cleaning up room: ${roomKey}`);
                const roomData: any = await idb.getItem(roomKey);
                if (roomData?.messages) {
                    const cleanedSome = await this.cleanRoomMessages(roomData);
                    if (cleanedSome) {
                        console.log(`Removed messages from room: ${roomKey} older than ${gs().daysOfHistory || 30} days`);
                        await idb.setItem(roomKey, roomData);
                    }
                }
            }
            console.log("Room cleanup complete.");
        }
    }
    
    /**
     * Cleans up messages older than the specified number of days in the room data.
     * 
     * @param roomData The room data containing messages to clean.
     * @returns A promise that resolves to true if any messages were removed, false otherwise.
     */
    cleanRoomMessages = async (roomData: any): Promise<boolean> => {
        if (!roomData || !roomData.messages) {
            return false; // No messages to clean
        }
        const now = new Date().getTime();
        let days = gs().daysOfHistory || 30; // default to 30 days if not set
        if (days < 2) {
            days = 2;
        }
        const daysInMs = days * 24 * 60 * 60 * 1000;

        // before we even run this filter let's see if there are any messages older than the threshold using 'any'
        const hadOldMessages = roomData.messages.some((msg: ChatMessage) => (now - msg.timestamp) >= daysInMs);
        if (hadOldMessages) {
            console.log("Initial Message Count: " + roomData.messages.length);
            roomData.messages = roomData.messages.filter((msg: ChatMessage) => {
                const keepMsg = (now - msg.timestamp) < daysInMs;
                if (!keepMsg) {
                    console.log(`Removing message from ${msg.sender} at ${new Date(msg.timestamp).toLocaleString()}: ${msg.content}`);
                }
                return keepMsg;
            });
            console.log("Cleaned Message Count: " + roomData.messages.length);
        }
        return hadOldMessages; // return true if we removed any messages
    }

    /**
     * Updates just our list of known room names what we maintain a history of 
     */
    updateRoomHistory = async (roomName: string): Promise<RoomHistoryItem[]> => {
        // Get the current room history from IndexedDB
        const roomHistory: RoomHistoryItem[] = await idb.getItem(DBKeys.roomHistory) || [];
    
        // Check if the room is already in the history
        const roomExists = roomHistory.some((item) => item.name === roomName);
        if (!roomExists) {
            // Add the new room to the history
            roomHistory.push({ name: roomName });
            await idb.setItem(DBKeys.roomHistory, roomHistory);
        }
        return roomHistory;
    }
    
    forgetRoom = async (roomName: string) => {
        if (!await confirmModal("Clear all chat history for room?")) return;
        
        let _gs = gs();
        if (!_gs.connected) {
            console.log("Not connected, cannot clear messages.");
            return;
        }

        // if deleting current room disconnect
        if (roomName===_gs.roomName) {
            await app.disconnect();
            _gs = gs();
            _gs.messages = []; 
        }

        // remove room from history
        const roomHistory: RoomHistoryItem[] = await idb.getItem(DBKeys.roomHistory) || [];
        const roomIndex = roomHistory.findIndex((item) => item.name === roomName);
        if (roomIndex !== -1) {
            roomHistory.splice(roomIndex, 1);
            await idb.setItem(DBKeys.roomHistory, roomHistory);
        }

        _gs.roomHistory = roomHistory;

        // remove room from IndexedDB
        await idb.removeItem(DBKeys.roomPrefix + roomName);
        console.log("Cleared messages for room: " + roomName);

        gd({ type: 'forgetRoom', payload: _gs });
    }
}

const appRooms = new AppRooms();
export default appRooms;
