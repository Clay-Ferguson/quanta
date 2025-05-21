import { canon } from "../common/Canonicalizer.ts";
import { crypt } from "../common/Crypto.ts";
import { ChatMessage, ChatMessageIntf, MessageStates } from "../common/types/CommonTypes.ts";
import { DeleteMessage_Request, GetMessageIdsForRoom_Response, GetMessagesByIds_Response, SendMessages_Request } from "../common/types/EndpointTypes.ts";
import appRooms from "./AppRooms.ts";
import { app } from "./AppService";
import { DBKeys } from "./AppServiceTypes.ts";
import { alertModal } from "./components/AlertModalComp.tsx";
import { confirmModal } from "./components/ConfirmModalComp";
import { gd, gs } from "./GlobalState";
import { httpClientUtil } from "./HttpClientUtil";
import {idb} from './IndexedDB.ts';
import { util } from "./Util.ts";
import { rtc } from "./WebRTC.ts";

export class AppMessages {
    // Gets the messages for this room from IndexedDB by roomName, and then removes the messageId one and then resaves the room messsages
    // back into indexedDb
    inboundDeleteMessage = async (roomName: string, messageId: string) => {
        let _gs = gs();
        // if the room is the current room, then we need to remove it from the global state
        if (roomName == _gs.roomName) {
            // if the room is the current room, then we need to remove it from the global state
            const messageIndex = _gs.messages?.findIndex((msg: ChatMessage) => msg.id === messageId);
            if (messageIndex !== undefined && messageIndex >= 0) {
                _gs.messages!.splice(messageIndex, 1);
                _gs = gd({ type: 'deleteMessage', payload: _gs});
                this.saveMessages(roomName, _gs.messages!);
            }
        }
        // else we will delete from some other room.
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

    deleteMessage = async (messageId: string) => {
        const confirmed = await confirmModal(`Delete message?`);
        if (!confirmed) return;
        let _gs = gs();
        const messageIndex = _gs.messages?.findIndex((msg: ChatMessage) => msg.id === messageId);
        if (messageIndex !== undefined && messageIndex >= 0) {
            _gs.messages!.splice(messageIndex, 1);
            _gs = gd({ type: 'deleteMessage', payload: _gs});
            this.saveMessages(_gs.roomName!, _gs.messages!);

            // Make the secure POST request with body
            await httpClientUtil.secureHttpPost<DeleteMessage_Request, any>('/api/delete-message', {
                messageId,
                roomName: _gs.roomName!,
                publicKey: _gs.keyPair!.publicKey
            });
        }
    }

    sendMessage = async (message: string, selectedFiles: any) => {
        if (message || selectedFiles.length > 0) {
            let _gs = gs();
            const msg: ChatMessage = this.createMessage(message, _gs.userName!, selectedFiles);
                
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
                _gs.messages!.push(msg);
                _gs = gd({ type: 'persistMessage', payload: _gs});
    
                // persist in IndexedDB
                await this.saveMessages(_gs.roomName!, _gs.messages!);
    
                setTimeout(async () => {
                    const _gs = gs();
                    // after a few seconds check if the message was acknowledged by the server
                    // todo-1: we could add a resend button for these kinds of messages, which would
                    // come in handy for P2P mode also, which also needs to have some kind of ACK 
                    // mechanism, which we don't have yet.
                    if (_gs.messages && _gs.saveToServer) {
                        // lookup the message by 'id' and verify it has the 'ack' state on it now.
                        const message = _gs.messages!.find((m: ChatMessage) => m.id === msg.id);
                        if (message && message.state!==MessageStates.SAVED) {
                            await alertModal('There was a problem sending that last message. The server did not acknowledge acceptance of the message');
                        }
                    }
    
                    try {
                        app.pruneDB(msg);
                    } catch (error) {
                        console.log('Error checking storage or saving message: ' + error);
                    }
                }, 3000);
        }
    }
    
    acknowledgeMessage = async (id: string): Promise<void> => {
        let _gs = gs();
        if (!_gs.messages) {
            console.warn('No messages available to acknowledge');
            return;
        }
    
        const message = _gs.messages!.find((msg: ChatMessage) => msg.id === id);
        if (message) {
            message.state = MessageStates.SAVED;
            _gs = gd({ type: 'acknowledgeMessage', payload: _gs});
            await this.saveMessages(_gs.roomName!, _gs.messages!);
            console.log(`Message ID ${id} acknowledged`); 
        } else {
            console.warn(`Message with ID ${id} not found`);
        }
    }
    
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
            _gs.messages!.push(msg);
            try {
                await app.pruneDB(msg);
                _gs = gs();
            } catch (error) {
                console.log('Error checking storage or saving message: ' + error);
            }
    
            _gs = gd({ type: 'persistMessage', payload: _gs});
            this.saveMessages(_gs.roomName!, _gs.messages!);
    }
    
    /* Saves messages into the room by roomName to IndexedDB */
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
    
    messageExists(msg: ChatMessage) {
        return gs().messages!.some((message: any) =>
            message.timestamp === msg.timestamp &&
                message.sender === msg.sender &&
                message.content === msg.content &&
                message.state === msg.state
        );
    }
    
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

    setMessages = (messages: ChatMessageIntf[]) => {
        // Save into global state
        gd({ type: 'setMessages', payload: { messages }});
    
        // Save to IndexedDB
        this.saveMessages(gs().roomName!, messages);
    }

    // DO NOT DELETE THIS METHOD 
    reSendFailedMessages = () => {
        let _gs = gs();
        if (!_gs.messages) {
            console.warn('Cannot resend messages: RTC not initialized or no messages available');
            return;
        }
        const unsentMessages = _gs.messages.filter(msg => msg.state !== MessageStates.SENT && msg.publicKey === _gs.keyPair?.publicKey);
            
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
            this.saveMessages(_gs.roomName!, _gs.messages!);
        } else {
            console.log('No unsent messages to resend');
        }
    }

    /**
     * Finds all messages that have failed to send to server, by detecting which ones are not state==SAVED, and then
     * builds up a list of those messages to send to the server, and sends them. 
     */
    resendFailedMessages = async (roomName: string, messages: ChatMessage[]): Promise<ChatMessage[]> => {
        if (!gs().saveToServer) return messages;
        if (!roomName) {
            console.warn('No room name available for resending messages');
            return messages;
        }
        const messagesToSend: ChatMessage[] = [];
        // iterate with a for loop to get the messages from the server
        for (const message of messages) {
            // if this is our message, and it doesn't have state==SAVED, then we need to resend it
            if (message.publicKey===gs().keyPair?.publicKey && message.state !== MessageStates.SAVED) {
                messagesToSend.push(message);
                console.log("Will resend message: " + message.id);
            }
        }

        if (messagesToSend.length == 0) return messages;

        // todo-1: let's ask user to confirm they want to resend because this also indicates to them
        // there may be a problem with their connectivity to the server.
        try {
            console.log("Resending " + messagesToSend.length + " messages to server: ", messagesToSend);
            // Send the messages to the server
            const response = await httpClientUtil.secureHttpPost<SendMessages_Request, any>(
                `/api/rooms/${encodeURIComponent(roomName!)}/send-messages`, { 
                    messages: messagesToSend,
                    publicKey: gs().keyPair!.publicKey
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
     * Loads messages for a specific room from local storage and also gets any from server what we don't have yet.
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
        if (gs().saveToServer) {
            let messagesDirty = false;
            try {
                const daysOfHistory = gs().daysOfHistory || 30;
                // Get all message IDs from the server for this room
                const respIds: GetMessageIdsForRoom_Response = await httpClientUtil.httpGet(`/api/rooms/${encodeURIComponent(roomId)}/message-ids?daysOfHistory=${daysOfHistory}`);
               
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
                //    'daysOfHistory' such that anything older than that is removed, we don't need to worry about messages that are older than that, or the fact
                //     that what we just pulled from the server is only the last 'daysOfHistory' worth of messages. 
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
            
                    if (respMessages.messages && respMessages.messages.length > 0) {
                        messagesDirty = true;
                        console.log(`Fetched ${respMessages.messages.length} messages from server for room: ${roomId}`);

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
}

const appMessages = new AppMessages();
export default appMessages;
