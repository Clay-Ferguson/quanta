import { canon } from "../../../common/Canonicalizer.ts";
import { crypt } from "../../../common/Crypto.ts";
import { ChatMessage, ChatMessageIntf, MessageStates } from "../../../common/types/CommonTypes.ts";
import { DeleteMessage_Request, GetMessageIdsForRoom_Response, GetMessagesByIds_Response, SendMessages_Request } from "../../../common/types/EndpointTypes.ts";
import appRooms from "./AppRooms.ts";
import { DBKeys } from "../../../client/AppServiceTypes.ts";
import { alertModal } from "../../../client/components/AlertModalComp.tsx";
import { confirmModal } from "../../../client/components/ConfirmModalComp.tsx";
import { gd, gs } from "./ChatTypes.ts"
import { httpClientUtil } from "../../../client/HttpClientUtil.ts";
import {idb} from '../../../client/IndexedDB.ts';
import { util } from "../../../client/Util.ts";
import { rtc } from "./WebRTC.ts";

/**
 * AppMessages - Centralized message management service for the Quanta Chat application
 * 
 * This class handles all message-related operations including:
 * - Creating, sending, and receiving chat messages
 * - Message persistence in IndexedDB and server synchronization
 * - Message deletion and acknowledgment
 * - Cryptographic signing and verification of messages
 * - Storage management and automatic pruning
 * - Resending failed messages
 * - Loading and synchronizing messages between local storage and server
 * 
 * The class maintains message state consistency between:
 * - Global application state (for current room display)
 * - Local IndexedDB storage (for offline access)
 * - Remote server storage (for persistence and multi-device sync)
 * 
 * Message states: SENT (via WebRTC), SAVED (acknowledged by server), FAILED
 */
export class AppMessages {
    /**
     * Handles inbound message deletion requests from other users or the server.
     * Removes the specified message from both global state (if current room) and IndexedDB.
     * 
     * @param roomName - The name of the room containing the message to delete
     * @param messageId - The unique identifier of the message to delete
     */
    inboundDeleteMessage = async (roomName: string, messageId: string) => {
        let _gs = gs();
        
        // Handle deletion for the currently active room
        if (roomName == _gs.chatRoom) {
            const messageIndex = _gs.chatMessages?.findIndex((msg: ChatMessage) => msg.id === messageId);
            if (messageIndex !== undefined && messageIndex >= 0) {
                _gs.chatMessages!.splice(messageIndex, 1);
                _gs = gd({ type: 'deleteMessage', payload: _gs});
                this.saveMessages(roomName, _gs.chatMessages!);
            }
        }
        // Handle deletion for non-active rooms (update IndexedDB only)
        else {
            const roomData: any = await idb.getItem(DBKeys.roomPrefix + roomName);
            if (roomData && roomData.messages) {
                const messageIndex = roomData.messages.findIndex((msg: ChatMessage) => msg.id === messageId);
                if (messageIndex !== undefined && messageIndex >= 0) {
                    roomData.messages.splice(messageIndex, 1);
                    this.saveMessages(roomName, roomData.messages);
                }
            }
        }
    }

    /**
     * Initiates message deletion by the current user with confirmation dialog.
     * Removes message from local state, IndexedDB, and sends deletion request to server.
     * 
     * @param messageId - The unique identifier of the message to delete
     */
    deleteMessage = async (messageId: string) => {
        const confirmed = await confirmModal(`Delete message?`);
        if (!confirmed) return;
        let _gs = gs();
        const messageIndex = _gs.chatMessages?.findIndex((msg: ChatMessage) => msg.id === messageId);
        if (messageIndex !== undefined && messageIndex >= 0) {
            _gs.chatMessages!.splice(messageIndex, 1);
            _gs = gd({ type: 'deleteMessage', payload: _gs});
            this.saveMessages(_gs.chatRoom!, _gs.chatMessages!);

            // Make the secure POST request with body
            await httpClientUtil.secureHttpPost<DeleteMessage_Request, any>('/api/delete-message', {
                messageId,
                roomName: _gs.chatRoom!,
            });
        }
    }

    /**
     * Sends a new message with optional file attachments.
     * Handles the complete message lifecycle:
     * - Creates and cryptographically signs the message
     * - Sends via WebRTC to other room participants
     * - Persists to global state and IndexedDB
     * - Monitors for server acknowledgment
     * - Triggers storage pruning if needed
     * 
     * @param message - The text content of the message
     * @param selectedFiles - Array of file attachments to include with the message
     */
    sendMessage = async (message: string, selectedFiles: any) => {
        if (message || selectedFiles.length > 0) {
            let _gs = gs();
            const msg: ChatMessage = this.createMessage(message, _gs.userProfile!.name!, selectedFiles);
                
            if (_gs.keyPair && _gs.keyPair!.publicKey && _gs.keyPair!.privateKey) {   
                try {
                    await crypt.signObject(msg, canon.canonical_ChatMessage, _gs.keyPair!);
                    msg.sigOk = true;
                } catch (error) {
                    console.error('Error signing message:', error);
                }
            }
                
            const sentOk = rtc._sendMessage(msg);
            msg.state = sentOk ? MessageStates.SENT : MessageStates.FAILED;
    
                // persist in global state
                _gs.chatMessages!.push(msg);
                _gs = gd({ type: 'persistMessage', payload: _gs});
    
                // persist in IndexedDB
                await this.saveMessages(_gs.chatRoom!, _gs.chatMessages!);
    
                setTimeout(async () => {
                    const _gs = gs();
                    // Monitor for server acknowledgment after 3 seconds
                    // TODO: Add resend button for failed messages (useful for P2P mode)
                    // P2P mode also needs ACK mechanism which is not yet implemented
                    if (_gs.chatMessages && _gs.chatSaveToServer) {
                        // Verify the message has been acknowledged by the server
                        const message = _gs.chatMessages!.find((m: ChatMessage) => m.id === msg.id);
                        if (message && message.state!==MessageStates.SAVED) {
                            await alertModal('There was a problem sending that last message. The server did not acknowledge acceptance of the message');
                        }
                    }
        
                    try {
                        this.pruneDB(msg);
                    } catch (error) {
                        console.log('Error checking storage or saving message: ' + error);
                    }
                }, 3000);
        }
    }
    
    /**
     * Marks a message as acknowledged (SAVED state) by the server.
     * Updates both global state and IndexedDB to reflect server confirmation.
     * 
     * @param id - The unique identifier of the message to acknowledge
     */
    acknowledgeMessage = async (id: string): Promise<void> => {
        let _gs = gs();
        if (!_gs.chatMessages) {
            console.warn('No messages available to acknowledge');
            return;
        }
    
        const message = _gs.chatMessages!.find((msg: ChatMessage) => msg.id === id);
        if (message) {
            message.state = MessageStates.SAVED;
            _gs = gd({ type: 'acknowledgeMessage', payload: _gs});
            await this.saveMessages(_gs.chatRoom!, _gs.chatMessages!);
            console.log(`Message ID ${id} acknowledged`); 
        } else {
            console.warn(`Message with ID ${id} not found`);
        }
    }
    
    /**
     * Processes and persists incoming messages from other users.
     * Performs message validation, cryptographic verification, and deduplication
     * before adding to global state and IndexedDB.
     * 
     * @param msg - The incoming ChatMessage to persist
     */
    persistInboundMessage = async (msg: ChatMessage) => {
        // console.log("App Persisting message: ", msg);
        if (this.messageExists(msg)) {
            return; // Message already exists, do not save again
        }
    
        if (!msg.id) {
            msg.id = util.generateShortId();
        }
    
        if (msg.signature) {
            msg.sigOk = await crypt.verifySignature(msg, canon.canonical_ChatMessage);
        }
        else {
            // console.log("No signature found on message: "+ msg.content);
            msg.sigOk = false;
        }
    
        let _gs = gs();   
            _gs.chatMessages!.push(msg);
            try {
                await this.pruneDB(msg);
                _gs = gs();
            } catch (error) {
                console.log('Error checking storage or saving message: ' + error);
            }
    
            _gs = gd({ type: 'persistMessage', payload: _gs});
            this.saveMessages(_gs.chatRoom!, _gs.chatMessages!);
    }
    
    /**
     * Saves messages to IndexedDB for a specific room.
     * Creates a room data structure with messages and timestamp for persistence.
     * 
     * @param roomName - The name of the room to save messages for
     * @param messages - Array of ChatMessage objects to save
     */
    saveMessages = async (roomName: string, messages: ChatMessage[]) => {
        if (!roomName) {
            console.error('No room name available for saving messages');
            return;
        }
    
        try {
            const roomData = {
                messages,
                lastUpdated: new Date().toISOString()
            };
    
            await idb.setItem(DBKeys.roomPrefix + roomName, roomData);
            console.log('Saved ' + messages!.length + ' messages for room: ' + roomName);
        } catch (error) {
            console.log('Error saving messages: ' + error);
        }
    }
    
    /**
     * Checks if a message already exists in the current global state.
     * Uses timestamp, sender, content, and state for duplicate detection.
     * 
     * @param msg - The ChatMessage to check for existence
     * @returns True if the message already exists, false otherwise
     */
    messageExists(msg: ChatMessage) {
        return gs().chatMessages!.some((message: any) =>
            message.timestamp === msg.timestamp &&
                message.sender === msg.sender &&
                message.content === msg.content &&
                message.state === msg.state
        );
    }
    
    /**
     * Creates a new ChatMessage object with generated ID and current timestamp.
     * 
     * @param content - The text content of the message
     * @param sender - The username of the message sender
     * @param attachments - Optional array of file attachments (defaults to empty array)
     * @returns A new ChatMessage object ready for sending
     */
    createMessage(content: string, sender: string, attachments = []): ChatMessage {
        // console.log("Creating message from sender: " + sender);
        const msg: ChatMessage = {
            id: util.generateShortId(),
            timestamp: new Date().getTime(),
            sender,
            content,
            attachments
        };
        return msg;
    }

    /**
     * Sets the complete message list for the current room.
     * Updates both global state and IndexedDB with the provided messages.
     * 
     * @param messages - Array of ChatMessageIntf objects to set as the current messages
     */
    setMessages = (messages: ChatMessageIntf[]) => {
        // Save into global state - cast to ChatMessage[] since ChatMessage extends ChatMessageIntf
        gd({ type: 'setMessages', payload: { chatMessages: messages as ChatMessage[] }});
    
        // Save to IndexedDB
        this.saveMessages(gs().chatRoom!, messages);
    }

    /**
     * Resends messages that failed to send via WebRTC.
     * Filters for unsent messages from the current user and attempts to resend them.
     * Updates message states and persists changes to storage.
     * 
     * Note: This method handles WebRTC transmission failures, not server acknowledgment.
     * For server-side failures, use resendFailedMessages() instead.
     * 
     * DO NOT DELETE THIS METHOD - Required for WebRTC failure recovery
     */
    reSendFailedMessages = () => {
        let _gs = gs();
        if (!_gs.chatMessages) {
            console.warn('Cannot resend messages: RTC not initialized or no messages available');
            return;
        }
        const unsentMessages = _gs.chatMessages.filter(msg => msg.state !== MessageStates.SENT && msg.publicKey === _gs.keyPair?.publicKey);
            
        if (unsentMessages.length > 0) {
            console.log(`Attempting to resend ${unsentMessages.length} unsent messages`);
                
            for (const msg of unsentMessages) {
                console.log(`Resending message: ${msg.id}`);
                const sentOk = rtc._sendMessage(msg);
                // we really need a more robust way to verify the server did indeed get saved on the server
                // because we can't do it thru WebRTC
                msg.state = sentOk ? MessageStates.SENT : MessageStates.FAILED;
            }
                
            // Update the global state and save messages after resending
            _gs = gd({ type: 'resendMessages', payload: _gs });
            this.saveMessages(_gs.chatRoom!, _gs.chatMessages!);
        } else {
            console.log('No unsent messages to resend');
        }
    }

    /**
     * Resends messages that failed to be acknowledged by the server.
     * Identifies messages from the current user that aren't in SAVED state and attempts
     * to resend them to the server for persistence. Updates message states upon success.
     * 
     * @param roomName - The name of the room containing messages to resend
     * @param messages - Array of ChatMessage objects to check for failed sends
     * @returns Promise resolving to the updated messages array
     */
    resendFailedMessages = async (roomName: string, messages: ChatMessage[]): Promise<ChatMessage[]> => {
        if (!gs().chatSaveToServer) return messages;
        if (!roomName) {
            console.warn('No room name available for resending messages');
            return messages;
        }
        const messagesToSend: ChatMessage[] = [];
        // Identify messages from current user that need server acknowledgment
        for (const message of messages) {
            // Check if this is our message and hasn't been saved to server yet
            if (message.publicKey===gs().keyPair?.publicKey && message.state !== MessageStates.SAVED) {
                messagesToSend.push(message);
                console.log("Will resend message: " + message.id);
            }
        }

        if (messagesToSend.length == 0) return messages;

        // TODO: Ask user to confirm resend as this indicates potential connectivity issues
        try {
            console.log("Resending " + messagesToSend.length + " messages to server: ", messagesToSend);
            // Send the messages to the server
            const response = await httpClientUtil.secureHttpPost<SendMessages_Request, any>(
                `/api/rooms/${encodeURIComponent(roomName!)}/send-messages`, { 
                    messages: messagesToSend,
                }
            );
                
            if (response && response.allOk) {
                for (let i = 0; i < messagesToSend.length; i++) {
                    const message = messages.find(m => m.id === messagesToSend[i].id);
                    if (message) {
                        message.state = MessageStates.SAVED; // Mark as saved
                        console.log(`Message ${message.id} asknowledged`);
                    }
                    else {
                        console.warn(`Message ${messagesToSend[i].id} not found in local messages`);
                    }
                }
                // Save the updated messages to storage
                this.saveMessages(roomName!, messages!);
            }
            else {
                console.warn("Server did not save all messages");
            }
        } catch (error) {
            console.error("Error sending messages to server:", error);
        }

        console.log("Resend failed messages complete. Messages: ", messages);
        return messages;
    }

    /**
     * Loads and synchronizes messages for a specific room from multiple sources.
     * 
     * This method performs a comprehensive message loading and synchronization process:
     * 1. Loads messages from local IndexedDB storage
     * 2. Cleans old messages if necessary (via appRooms.cleanRoomMessages)
     * 3. Fetches message IDs from server within the specified history window
     * 4. Synchronizes local and server message states:
     *    - Marks server-confirmed messages as SAVED
     *    - Removes locally SAVED messages that no longer exist on server
     *    - Identifies and fetches missing messages from server
     * 5. Sorts messages chronologically and saves updated state
     * 
     * @param roomId - The unique identifier of the room to load messages for
     * @returns Promise resolving to array of ChatMessage objects for the room
     */
    loadRoomMessages = async (roomId: string): Promise<ChatMessage[]> => {
        let messages: ChatMessage[] = [];
        console.log("Loading messages for room: " + roomId);
        
        // First get room messages from local storage
        try {
            const roomData: any = await idb.getItem(DBKeys.roomPrefix + roomId);
            if (roomData) {
                const cleanedSome: boolean = await appRooms.cleanRoomMessages(roomData);
                console.log("cleanedSome = " + cleanedSome);
                if (cleanedSome) {
                    console.log("Saving new room data after cleaning old messages for room: " + roomId);
                    // If we cleaned old messages, save the updated room data
                    await idb.setItem(DBKeys.roomPrefix + roomId, roomData);
                    console.log(`Cleaned old messages for room: ${roomId}`);
                }

                console.log('Loaded ' + roomData.messages.length + ' messages from local storage for room: ' + roomId);
                messages = roomData.messages;
            }
            else {
                console.log('No messages found in local storage for room: ' + roomId);
            }
        } catch (error) {
            console.log('Error loading messages from storage: ' + error);
        }

        // Next get room messages from server
        if (gs().chatSaveToServer) {
            let messagesDirty = false;
            try {
                const chatDaysOfHistory = gs().chatDaysOfHistory || 30;
                // Get all message IDs from the server for this room
                const respIds: GetMessageIdsForRoom_Response = await httpClientUtil.httpGet(`/api/rooms/${encodeURIComponent(roomId)}/message-ids?daysOfHistory=${chatDaysOfHistory}`);
               
                const serverMessageIds: string[] = respIds.messageIds || [];
                if (serverMessageIds.length === 0) {
                    console.log(`No messages found on server for room: ${roomId}`);
                    return messages;
                }
            
                // Create a map of existing message IDs for quick lookup
                const serverIdsSet = new Set(serverMessageIds);

                // This filter loop does two things: 
                // 1) Makes sure that any messages that are on the server are marked as SAVED (acknowledged). This should not be necessary,
                //    but we do it just to be sure the SAVED state is as correct as we can make it, in case there were any problems in the past.
                // 2) Removes any messages that are no longer on the server but were at one time (state==SAVED). Note that since we always enforce
                //    'chatDaysOfHistory' such that anything older than that is removed, we don't need to worry about messages that are older than that, or the fact
                //     that what we just pulled from the server is only the last 'chatDaysOfHistory' worth of messages. 
                messages = messages.filter((msg: ChatMessage) => {
                    if (serverIdsSet.has(msg.id)) {
                        if (msg.state !== MessageStates.SAVED) {
                            msg.state = MessageStates.SAVED; // Mark as acknowledged
                            messagesDirty = true;
                        }
                    }
                    else {
                        // if the message is not on the server, and it has state==SAVED, then we need to remove it from our local storage
                        if (msg.state === MessageStates.SAVED) {
                            console.log(`Removing message ${msg.id} from local storage as it no longer exists on the server`);
                            messagesDirty = true;
                            return false; // Remove this message
                        }
                    }
                    return true; // Keep this message
                });

                // Create a map of existing message IDs for quick lookup
                const existingMessageIdsSet = new Set(messages.map(msg => msg.id));
            
                // Determine which message IDs we're missing locally
                const missingIds = serverMessageIds.filter(id => !existingMessageIdsSet.has(id));
                if (missingIds.length > 0) {
                    console.log(`Found ${missingIds.length} missing messages to fetch for room: ${roomId}`);
            
                    // Fetch only the missing messages from the server
                    const respMessages: GetMessagesByIds_Response = await httpClientUtil.httpPost(`/api/rooms/${encodeURIComponent(roomId)}/get-messages-by-id`, { ids: missingIds });
            
                    // Debug the message response
                    console.log('GetMessagesByIds_Response:', JSON.stringify(respMessages, null, 2));
                    
                    if (respMessages.messages && respMessages.messages.length > 0) {
                        messagesDirty = true;
                        console.log(`Fetched ${respMessages.messages.length} messages from server for room: ${roomId}`);
                        console.log('First message sample:', JSON.stringify(respMessages.messages[0], null, 2));

                        // Add the fetched messages to our local array
                        messages = [...messages, ...respMessages.messages];
                
                        // Sort messages by timestamp to ensure chronological order
                        messages.sort((a, b) => a.timestamp - b.timestamp);
                    }
                }
                if (messagesDirty) {
                    await this.saveMessages(roomId, messages);
                    console.log(`Saved updated messages: ${messages.length}`);
                }
            } catch (error) {
                console.log('Error synchronizing messages with server, falling back to local storage: ' + error);
            }
        }
        console.log("**** Final: Loaded " + messages.length + " messages for room: " + roomId);
        return messages;
    }

    /**
     * Monitors and manages local storage usage, automatically pruning old messages when needed.
     * 
     * This method performs storage management by:
     * 1. Checking current storage quota and usage via Navigator Storage API
     * 2. Calculating the size of the incoming message
     * 3. Triggering cleanup if storage usage exceeds 90% or insufficient space remains
     * 4. Prompting user to confirm removal of oldest 20% of messages from current room
     * 5. Sorting messages by timestamp and removing the oldest ones
     * 
     * Storage cleanup helps prevent:
     * - Browser storage quota exceeded errors
     * - Performance degradation from large message datasets
     * - Application crashes due to storage constraints
     * 
     * @param msg - The message being processed (used for size calculation)
     */
    pruneDB = async (msg: any) => {
        if (navigator.storage && navigator.storage.estimate) {
            const estimate: any = await navigator.storage.estimate();
            const remainingStorage = estimate.quota - estimate.usage;
            const usagePercentage = (estimate.usage / estimate.quota) * 100;
            const forceClean = false; // set to true to simuilate low storage, and cause pruning, after every message send
    
            console.log(`Storage: (${Math.round(usagePercentage)}% used). Quota: ${util.formatStorageSize(estimate.quota)}`);
    
            // Calculate message size and check storage limits
            const msgSize = util.calculateMessageSize(msg);
    
            // If we're within 10% of storage limit
            if (remainingStorage < msgSize || usagePercentage > 90 || forceClean) {
                const warningMsg = `You're running low on storage space (${Math.round(usagePercentage)}% used). ` +
                        `Would you like to remove the oldest 20% of messages from the current room to free up space?`;
    
                if (await confirmModal(warningMsg)) {
                    const _gs = gs();
                        // Sort messages by timestamp and remove oldest 20%
                        _gs.chatMessages!.sort((a: any, b: any) => a.timestamp - b.timestamp);
                        const countToRemove = Math.ceil(_gs.chatMessages!.length * 0.20);
                        _gs.chatMessages = _gs.chatMessages!.slice(countToRemove);
    
                        // Save the pruned messages
                        appMessages.saveMessages(_gs.chatRoom!, _gs.chatMessages!);
                        console.log(`Removed ${countToRemove} old messages due to storage constraints`);
                }
            }
        }
    }
}

/**
 * Singleton instance of AppMessages for use throughout the application.
 * Provides centralized access to all message management functionality.
 */
const appMessages = new AppMessages();
export default appMessages;
