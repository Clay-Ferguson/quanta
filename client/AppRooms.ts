import { ChatMessage } from "../common/types/CommonTypes.ts";
import { app } from "./AppService.ts";
import { DBKeys, RoomHistoryItem } from "./AppServiceTypes.ts";
import { confirmModal } from "./components/ConfirmModalComp";
import { gd, gs } from "./GlobalState";
import {idb} from './IndexedDB.ts';

/**
 * AppRooms class manages chat room operations and data persistence.
 * 
 * This class provides functionality for:
 * - Room message cleanup based on configurable history retention periods
 * - Room history management and persistence via IndexedDB
 * - Room deletion and data cleanup operations
 * 
 * The class works closely with IndexedDB for client-side data persistence,
 * storing room data with keys prefixed by `DBKeys.roomPrefix` and maintaining
 * a separate room history list for UI navigation.
 */
class AppRooms {
    /**
     * Runs cleanup across all rooms to remove messages older than the configured retention period.
     * 
     * This method:
     * 1. Finds all room keys in IndexedDB using the `DBKeys.roomPrefix`
     * 2. Loads each room's data and calls `cleanRoomMessages` to remove old messages
     * 3. Saves updated room data back to IndexedDB if any messages were removed
     * 
     * The retention period is determined by `gs().daysOfHistory` with a minimum of 2 days
     * and a default of 30 days if not configured.
     * 
     * @returns Promise that resolves when cleanup is complete for all rooms
     */
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
     * This method filters out messages that exceed the configured retention period,
     * logging details about removed messages for debugging purposes. The retention
     * period is controlled by the global state `daysOfHistory` setting.
     * 
     * @param roomData The room data object containing a messages array to clean
     * @returns Promise<boolean> that resolves to true if any messages were removed, false otherwise
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
     * Updates the list of known room names that we maintain a history of.
     * 
     * This method manages the client-side room history stored in IndexedDB under
     * the `DBKeys.roomHistory` key. The room history is used by the UI to display
     * a list of previously joined rooms that users can quickly reconnect to.
     * 
     * If the room is not already in the history, it will be added. Existing rooms
     * are not duplicated in the history list.
     * 
     * @param roomName The name of the room to add to the history
     * @returns Promise<RoomHistoryItem[]> The updated room history array
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
    
    /**
     * Completely removes a room from the client, including all associated data and history.
     * 
     * This method performs a comprehensive cleanup operation:
     * 1. Shows a confirmation modal to prevent accidental deletion
     * 2. Disconnects from the room if it's currently active
     * 3. Clears the current messages array if deleting the active room
     * 4. Removes the room from the room history list
     * 5. Deletes all room data from IndexedDB
     * 6. Updates the global state to reflect the changes
     * 
     * This operation is irreversible and will permanently delete all local chat history
     * for the specified room. The room can still be rejoined later, but previous messages
     * will only be available if stored on the server and within the server's retention policy.
     * 
     * @param roomName The name of the room to completely remove from local storage
     */
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

/**
 * Singleton instance of the AppRooms class for managing room operations.
 * 
 * This exported instance provides a centralized interface for all room-related
 * operations throughout the application. Other modules can import and use this
 * instance to perform room cleanup, history management, and deletion operations.
 */
const appRooms = new AppRooms();
export default appRooms;
