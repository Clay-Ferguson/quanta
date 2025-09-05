import { ChatMessage, KeyPairHex, User } from "../../../common/types/CommonTypes.ts";
import { app } from "../../../client/AppService.ts";
import { DBKeys, RoomHistoryItem } from "../../../client/AppServiceTypes.ts";
import { confirmModal } from "../../../client/components/ConfirmModalComp.tsx";
import { ChatPageNames, gd, gs } from "./ChatTypes.ts"
import {idb} from '../../../client/IndexedDB.ts';
import appMessages from "./AppMessages.ts";
import { rtc } from "./WebRTC.ts";

declare const PAGE: string;

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
     * The retention period is determined by `gs().chatDaysOfHistory` with a minimum of 2 days
     * and a default of 30 days if not configured.
     * 
     * @returns Promise that resolves when cleanup is complete for all rooms
     */
    runRoomCleanup = async () => {
        // Get all room keys
        const roomKeys = await idb.findKeysByPrefix(DBKeys.roomPrefix);
        if (roomKeys) {
            // Loop through each room and delete all messages older than gs.chatDaysOfHistory
            for (const roomKey of roomKeys) {
                console.log(`Cleaning up room: ${roomKey}`);
                const roomData: any = await idb.getItem(roomKey);
                if (roomData?.messages) {
                    const cleanedSome = await this.cleanRoomMessages(roomData);
                    if (cleanedSome) {
                        console.log(`Removed messages from room: ${roomKey} older than ${gs().chatDaysOfHistory || 30} days`);
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
     * period is controlled by the global state `chatDaysOfHistory` setting.
     * 
     * @param roomData The room data object containing a messages array to clean
     * @returns Promise<boolean> that resolves to true if any messages were removed, false otherwise
     */
    cleanRoomMessages = async (roomData: any): Promise<boolean> => {
        if (!roomData || !roomData.messages) {
            return false; // No messages to clean
        }
        const now = new Date().getTime();
        let days = gs().chatDaysOfHistory || 30; // default to 30 days if not set
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
     * the `DBKeys.chatRoomHistory` key. The room history is used by the UI to display
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
        const chatRoomHistory: RoomHistoryItem[] = await idb.getItem(DBKeys.chatRoomHistory) || [];
    
        // Check if the room is already in the history
        const roomExists = chatRoomHistory.some((item) => item.name === roomName);
        if (!roomExists) {
            // Add the new room to the history
            chatRoomHistory.push({ name: roomName });
            await idb.setItem(DBKeys.chatRoomHistory, chatRoomHistory);
        }
        return chatRoomHistory;
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

        // if deleting current room disconnect
        if (roomName===_gs.chatRoom) {
            await this.disconnect();
            _gs = gs();
            _gs.chatMessages = []; 
        }

        // remove room from history
        const chatRoomHistory: RoomHistoryItem[] = await idb.getItem(DBKeys.chatRoomHistory) || [];
        const roomIndex = chatRoomHistory.findIndex((item) => item.name === roomName);
        if (roomIndex !== -1) {
            chatRoomHistory.splice(roomIndex, 1);
            await idb.setItem(DBKeys.chatRoomHistory, chatRoomHistory);
        }

        _gs.chatRoomHistory = chatRoomHistory;

        // remove room from IndexedDB
        await idb.removeItem(DBKeys.roomPrefix + roomName);
        console.log("Cleared messages for room: " + roomName);
        gd({ type: 'forgetRoom', payload: _gs });
    }

    /**
         * Restores a previous connection if valid credentials and connection state are found in IndexedDB.
         * Automatically reconnects the user to their previous room if they were previously connected.
         */
    restoreConnection = async () => {
        const userName = await idb.getItem(DBKeys.userName);
        const keyPair = await idb.getItem(DBKeys.keyPair);
        const roomName = await idb.getItem(DBKeys.chatRoom);
        const chatConnected = await idb.getItem(DBKeys.chatConnected);
    
        // We don't auto connect if a page was specified, unless it's the Quanta Chat page.
        if ((!PAGE || PAGE==ChatPageNames.quantaChat) && userName && roomName && chatConnected) {
            // in this branch of code after the connect we put the 'appInitialized' setter into the place AFTER we've scrolled to bottom 
            await this.connect(userName, keyPair, roomName);
        }
    }

    /**
         * Establishes a connection to a chat room with the specified credentials.
         * Loads room messages, handles failed message resending, and updates the application state.
         * @param userName - The user's display name (optional, defaults to global state)
         * @param keyPair - The user's cryptographic key pair (optional, defaults to global state)
         * @param roomName - The name of the room to connect to
         */
    connect = async (userName: string | null, keyPair: KeyPairHex | null, roomName: string) => {
        let _gs = gs();
        userName = userName || _gs.userProfile!.name!;
        keyPair = keyPair || _gs.keyPair!;
    
        _gs = gd({ type: 'connect', payload: { 
            chatConnecting: true
        }});
    
        let messages = await appMessages.loadRoomMessages(roomName);
        messages = await appMessages.resendFailedMessages(roomName, messages);
        const success = await rtc._connect(userName!, keyPair, roomName);
        if (!success) {
            gd({ type: 'connectTooSoon', payload: { 
                chatConnected: false,
                chatConnecting: false
            }});
            return;
        }
        await this.setRoomAndUserName(roomName, userName!);
            
        const chatRoomHistory: RoomHistoryItem[] = await appRooms.updateRoomHistory(roomName);
        
        // Get the current state to create updated userProfile
        const currentState = gs();
        const updatedUserProfile = { ...currentState.userProfile!, name: userName! };
        
        gd({ type: 'connect', payload: { 
            userProfile: updatedUserProfile,
            chatRoom: roomName,
            chatMessages: messages,
            chatConnected: true,
            chatConnecting: false,
            chatRoomHistory,
            pages: app.setTopPage(gs(), ChatPageNames.quantaChat)
        }});
        await idb.setItem(DBKeys.chatConnected, true);
    
        // DO NOT DELETE
        // Not currently used. We send all directly to server now, in one single call, BUT we may need to do something similar to this for pure P2P in the future.
        // setTimeout(() => {
        //     this.reSendFailedMessages();
        // }, 500);
        console.log("Connected to room: " + roomName);
    }
    
    /**
     * Disconnects from the current chat room and clears connection-related state.
     * Resets messages, participants, and connection status in both memory and IndexedDB.
     */
    disconnect = async () => {
        rtc._disconnect();
        gd({ type: 'disconnect', payload: { 
            chatMessages: [], 
            chatParticipants: new Map<string, User>(), 
            chatConnected: false, 
        }});
        await idb.setItem(DBKeys.chatConnected, false);
    }

    /**
     * Sets both room name and user name in a single state update for efficiency.
     * Also persists these values to IndexedDB.
     * @param roomName - The name of the room to join
     * @param userName - The user's display name
     */
    setRoomAndUserName = async (roomName: string, userName: string, ) => {
        const _gs = gs();
        // Create a copy of the userProfile to avoid mutating the original
        const updatedUserProfile = { ..._gs.userProfile, name: userName };
        
        gd({ type: `setRoomAndUser`, payload: { 
            chatRoom: roomName, 
            userProfile: updatedUserProfile
        }});
        // Save the keyPair to IndexedDB
        await idb.setItem(DBKeys.chatRoom, roomName);
        await idb.setItem(DBKeys.userName, userName);
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
