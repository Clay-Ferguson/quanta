import IndexedDB from './IndexedDB.ts';

import {util} from './Util.js';
import {AppServiceTypes, ChatMessage, Contact, DBKeys, PageNames, RoomHistoryItem} from './AppServiceTypes.ts';
import {GlobalAction, GlobalState} from './GlobalState.tsx';
import {crypt} from '../common/Crypto.ts';  
import { KeyPairHex } from '../common/CryptoIntf.ts';
import WebRTC from './WebRTC.ts';
import { FileBase64Intf, User } from '../common/CommonTypes.ts';

// Vars are injected diretly into HTML by server
declare const HOST: string;
declare const PORT: string;
declare const SECURE: string;

export class AppService implements AppServiceTypes  {
    public storage: IndexedDB | null = null;
    public rtc: WebRTC | null = null;
    private static initComplete: boolean = false;
    gd: React.Dispatch<GlobalAction> | null = null; // Global Dispatch Function
    gs: GlobalState | null = null; // Global State Object

    async init() {
        this.storage = await IndexedDB.getInst("quantaChatDB", "quantaChatStore", 1);
        const saveToServer = await this.storage?.getItem(DBKeys.saveToServer);
        this.rtc = new WebRTC(this.storage, this, HOST, PORT, SECURE==='y', saveToServer);
        await this.restoreSavedValues();

        // Load the keyPair from IndexedDB
        const keyPair: KeyPairHex = await this.storage?.getItem(DBKeys.keyPair);
        if (!keyPair) {
            await this._createIdentity(false);
        }
        else {
            this.gd!({ type: 'setIdentity', payload: { 
                keyPair
            }});
        }

        this.gd!({ type: 'setAppInitialized', payload: { 
            appInitialized: true
        }});

        this.restoreConnection();

        setTimeout(() => {
            this.runRoomCleanup();
        }, 10000);
    }

    setGlobals = (gd: any, gs: any) => {
        if (!gd || !gs) {
            console.warn('Global dispatch or state not yet available');
            return;
        }

        this.gd = gd;
        this.gs = gs;

        if (!AppService.initComplete) {
            AppService.initComplete = true;
            this.init();
        }
    }

    runRoomCleanup = async () => {
    // Get all room keys
        const roomKeys = await this.storage?.findKeysByPrefix(DBKeys.roomPrefix);
        if (roomKeys) {
            // Loop through each room and delete all messages older than gs.daysOfHistory
            for (const roomKey of roomKeys) {
                console.log(`Cleaning up room: ${roomKey}`);
                const roomData: any = await this.storage?.getItem(roomKey);
                if (roomData?.messages) {
                    const cleanedSome = await this.cleanRoomMessages(roomData);
                    if (cleanedSome) {
                        console.log(`Removed messages from room: ${roomKey} older than ${this.gs?.daysOfHistory || 30} days`);
                        await this.storage?.setItem(roomKey, roomData);
                    }
                }
            }
            console.log("Room cleanup complete.");
        }
    }

    cleanRoomMessages = async (roomData: any): Promise<boolean> => {
        if (!roomData || !roomData.messages) {
            return false; // No messages to clean
        }
        const now = new Date().getTime();
        let days = this.gs?.daysOfHistory || 30; // default to 30 days if not set
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

    showUserProfile = async (publicKey: string) => {
        // set page to userprofile 
        this.setTopPage(this.gs, PageNames.userProfile);
        this.gs!.userProfile = {name: '', publicKey, description: '', avatar: null};
        this.gd!({ type: 'setUserProfile', payload: this.gs});
    }

    saveLinkPreviewInfo = async (url: string, data: any) => {
        // Save the link preview data to IndexedDB
        await this.storage?.setItem(DBKeys.linkPreview + url, data);
    }

    getLinkPreviewInfo = async (url: string): Promise<any> => {
        // Retrieve the link preview data from IndexedDB
        const data = await this.storage?.getItem(DBKeys.linkPreview + url);
        return data;
    }

    restoreConnection = async () => {
        const userName = await this.storage?.getItem(DBKeys.userName);
        const keyPair = await this.storage?.getItem(DBKeys.keyPair);
        const roomName = await this.storage?.getItem(DBKeys.roomName);
        const connected = await this.storage?.getItem(DBKeys.connected);


        if (userName && roomName && connected) {
            // in this branch of code after the connect we put the 'appInitialized' setter into the place AFTER we've scrolled to bottom 
            await this._connect(userName, keyPair, roomName);
        }
    }

    restoreSavedValues = async () => {
        // console.log("Restoring saved values from IndexedDB");
        const userName: string= await this.storage?.getItem(DBKeys.userName);
        const contacts: Contact[] = await this.storage?.getItem(DBKeys.contacts);
        const roomName: string = await this.storage?.getItem(DBKeys.roomName);
        const saveToServer: boolean = await this.storage?.getItem(DBKeys.saveToServer);
        const daysOfHistory: number = await this.storage?.getItem(DBKeys.daysOfHistory) || 30;
        const roomHistory: RoomHistoryItem[] = await this.storage?.getItem(DBKeys.roomHistory) || [];
        const userDescription: string = await this.storage?.getItem(DBKeys.userDescription);
        const userAvatar: FileBase64Intf = await this.storage?.getItem(DBKeys.userAvatar);

        const state: GlobalState = {
            userName,
            contacts,
            roomName,
            saveToServer,
            daysOfHistory,
            roomHistory,
            userDescription,
            userAvatar,
        };

        // if no username we send to settings page.
        if (!userName) {
            state.pages?.push(PageNames.settings);
        }

        this.gd!({ type: 'restoreSavedValues', payload: state});
    }
    
    setFullSizeImage = (att: FileBase64Intf | null) => {
        this.gs!.fullSizeImage = att ? {src: att.data, name: att.name} : null;
        this.gd!({ type: 'setFullSizeImage', payload: this.gs});
    }

    setTopPage = (gs: GlobalState | null, page: string): Array<string> | undefined => {
        // if the page is NOT already on top of the stack, then push it
        if (gs!.pages && gs!.pages[gs!.pages.length - 1] !== page) {
            gs!.pages?.push(page);
        } 
        return gs!.pages;
    }

    goToPage = (page: string) => {
        this.setTopPage(this.gs, page);
        this.gd!({ type: 'setPage', payload: this.gs });
    }

    goBack = () => {
        if (this.gs && this.gs.pages && this.gs.pages.length > 1) {
            // Remove the last page from the stack
            this.gs.pages.pop();
        }
        this.gd!({ type: 'setPage', payload: this.gs });
    }

    saveUserInfo = async (userName: string, userDescription: string, userAvatar: FileBase64Intf | null) => {
        this.gd!({ type: `setUserInfo`, payload: { 
            userName, userDescription, userAvatar
        }});
        await this.storage?.setItem(DBKeys.userName, userName);
        await this.storage?.setItem(DBKeys.userDescription, userDescription);
        await this.storage?.setItem(DBKeys.userAvatar, userAvatar);

        // Save user info to server if saving to server is enabled
        if (this.gs?.saveToServer && this.gs?.keyPair?.publicKey) {
            try {
                const postData = {
                    pubKey: this.gs.keyPair.publicKey,
                    userName: userName,
                    userDesc: userDescription,
                    avatar: userAvatar
                };

                // Make API call to persist user info to server
                const response = await fetch('/api/users/info', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(postData)
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    console.error('Failed to save user info to server:', errorData.error);
                } else {
                    console.log('User info successfully saved to server');
                }
            } catch (error) {
                console.error('Error saving user info to server:', error);
            }
        }
    }

    setSaveToServer  = async (saveToServer: boolean) => {
        this.persistGlobalValue(DBKeys.saveToServer, saveToServer);
        if (this.rtc) {
            this.rtc.setSaveToServer(saveToServer);
        }
    }

    setDaysOfHistory  = async (days: number) => {
        this.persistGlobalValue(DBKeys.daysOfHistory, days);
        this.runRoomCleanup();
    }

    // we have this method only for effeciency to do a single state update.
    setRoomAndUserName = async (roomName: string, userName: string, ) => {
        this.gd!({ type: `setRoomAndUser`, payload: { 
            roomName, userName
        }});
        // Save the keyPair to IndexedDB
        await this.storage?.setItem(DBKeys.roomName, roomName);
        await this.storage?.setItem(DBKeys.userName, userName);
    }        

    persistGlobalValue = async (key: string, value: any) => {
        // save to global state
        this.gd!({ type: `persistGlobalValue-${key}`, payload: { 
            [key]: value
        }});
        // Save the keyPair to IndexedDB
        await this.storage?.setItem(key, value);
    }

    _importKeyPair = async () => {
        if (this.gs!.keyPair && this.gs!.keyPair.publicKey && this.gs!.keyPair.privateKey) {
            if (!confirm("Are you sure? This will overwrite your existing key pair.")) {
                return;
            }
        }

        const privateKey = prompt("Enter Private Key String:");
        console.log("Importing Key Pair: " + privateKey);

        if (!privateKey) {
            return;
        }

        const keyPair = crypt.makeKeysFromPrivateKeyHex(privateKey);
        if (!keyPair) {
            console.error("Invalid private key provided.");
            return;
        }
        this.gd!({ type: 'importIdentity', payload: { 
            keyPair
        }});
        // Save the keyPair to IndexedDB
        await this.storage?.setItem(DBKeys.keyPair, keyPair);
    }

    _createIdentity = async (askFirst: boolean = true) => {
        // if they already have a keyPair, ask if they want to create a new one
        if (askFirst && this.gs!.keyPair && this.gs!.keyPair.publicKey && this.gs!.keyPair.privateKey) {
            if (!confirm("Create new Identity Keys?")) {
                return;
            }
        }

        const keyPair: KeyPairHex= crypt.generateKeypair();
        this.gd!({ type: 'creatIdentity', payload: { 
            keyPair
        }});
        // Save the keyPair to IndexedDB
        await this.storage?.setItem(DBKeys.keyPair, keyPair);
    }

    _rtcStateChange = () => {
        if (!this.gd || !this.rtc) {
            console.warn('Global dispatch not yet available for RTC state change');
            return;
        }
        
        const participants = this.rtc.participants || new Map<string, User>();
        const connected = this.rtc.connected || false;
        this.gd!({ 
            type: 'updateRtcState', 
            payload: { 
                participants,
                connected
            }
        });
    }

    // userName is optional and will default to global state if not provided
    _connect = async (userName: string | null, keyPair: KeyPairHex | null, roomName: string) => {
        userName = userName || this.gs!.userName!;
        keyPair = keyPair || this.gs!.keyPair!;

        if (!this.rtc) {
            console.warn('Global dispatch not yet available for RTC state change');
            return;
        }
        this.gd!({ type: 'connect', payload: { 
            connecting: true
        }});

        const messages = await this.loadRoomMessages(roomName);
        const success = await this.rtc._connect(userName!, keyPair, roomName);
        if (!success) {
            this.gd!({ type: 'connectTooSoon', payload: { 
                connected: false,
                connecting: false
            }});
            return;
        }
        await this.setRoomAndUserName(roomName, userName!);
        
        const roomHistory: RoomHistoryItem[] = await this.updateRoomHistory(roomName);
        this.gd!({ type: 'connect', payload: { 
            userName,
            roomName,
            messages,
            connected: true,
            connecting: false,
            roomHistory,
            pages: this.setTopPage(this.gs, PageNames.quantaChat)
        }});

        // set connected DB key
        await this.storage?.setItem(DBKeys.connected, true);
    }

    updateRoomHistory = async (roomName: string): Promise<RoomHistoryItem[]> => {
        // Get the current room history from IndexedDB
        const roomHistory: RoomHistoryItem[] = await this.storage?.getItem(DBKeys.roomHistory) || [];

        // Check if the room is already in the history
        const roomExists = roomHistory.some((item) => item.name === roomName);

        if (!roomExists) {
            // Add the new room to the history
            roomHistory.push({ name: roomName });
            await this.storage?.setItem(DBKeys.roomHistory, roomHistory);
        }
        return roomHistory;
    }

    _setContacts = (contacts: any) => {
        // Save into global state
        this.gd!({ type: 'setContacts', payload: { contacts }});

        // Save to IndexedDB
        this.storage?.setItem(DBKeys.contacts, contacts);
    }

    _disconnect = async () => {
        this.rtc?._disconnect();
        this.gd!({ type: 'disconnect', payload: { 
            messages: [], 
            participants: new Map<string, User>(), 
            connected: false, 
        }});
        await this.storage?.setItem(DBKeys.connected, false);
    }

    _forgetRoom = async (roomName: string) => {
        if (confirm("Clear all chat history for room?")) {
            if (!this.gs || !this.gs!.connected) {
                console.log("Not connected, cannot clear messages.");
                return;
            }

            // if deleting current room disconnect
            if (roomName===this.gs!.roomName) {
                await this._disconnect();
                this.gs!.messages = []; 
            }

            // remove room from history
            const roomHistory: RoomHistoryItem[] = await this.storage?.getItem(DBKeys.roomHistory) || [];
            const roomIndex = roomHistory.findIndex((item) => item.name === roomName);
            if (roomIndex !== -1) {
                roomHistory.splice(roomIndex, 1);
                await this.storage?.setItem(DBKeys.roomHistory, roomHistory);
            }
            this.gs.roomHistory = roomHistory;

            // remove room from IndexedDB
            await this.storage?.removeItem(DBKeys.roomPrefix + roomName);
            console.log("Cleared messages for room: " + roomName);

            this.gd!({ type: 'forgetRoom', payload: this.gs });}
    }

    _send = async (message: string, selectedFiles: any) => {
        if (!this.rtc) {
            console.warn('RTC instance not available for sending message');
            return;
        }
        if (message || selectedFiles.length > 0) {
            const msg: ChatMessage = this.createMessage(message, this.gs!.userName!, selectedFiles);
            
            if (this.gs!.keyPair && this.gs!.keyPair.publicKey && this.gs!.keyPair.privateKey) {   
                try {
                    await crypt.signObject(msg, crypt.canonical_ChatMessage, this.gs!.keyPair);
                } catch (error) {
                    console.error('Error signing message:', error);
                }
            }
            this._persistMessage(msg);
            const sentOk = this.rtc._sendMessage(msg);
            if (!sentOk) {
                console.warn("Failed to send message immediately, will retry in 20 seconds");
                // try again in 20 seconds
                setTimeout(() => {
                    console.warn("Retrying message send.");
                    const retryOk = this.rtc?._sendMessage(msg);
                    if (!retryOk) {
                        alert("There was a probelm delivering that message, so it may not immediately appear for others.");
                    }
                }, 20000);
            }

            this.gd!({ type: 'send', payload: this.gs});
        }
    }

    _persistMessage = async (msg: ChatMessage) => {
        console.log("Persisting message: ", msg);

        if (this.messageExists(msg)) {
            return; // Message already exists, do not save again
        }

        if (!msg.id) {
            msg.id = util.generateShortId();
        }

        if (msg.signature) {
            msg.sigOk = await crypt.verifySignature(msg, crypt.canonical_ChatMessage);
        }
        else {
            // console.log("No signature found on message: "+ msg.content);
            msg.sigOk = false;
        }

        this.gs!.messages!.push(msg);
        try {
            await this.pruneDB(msg);
        } catch (error) {
            util.log('Error checking storage or saving message: ' + error);
        }

        this.gd!({ type: 'persistMessage', payload: this.gs});
        this.saveMessages();
    }

    existsInContacts(msg: ChatMessage) {
        if (!this.gs || !this.gs!.contacts) {
            return false;
        }
        return this.gs!.contacts.some((contact: any) => contact.publicKey === msg.publicKey);
    }

    async pruneDB(msg: any) {
        if (navigator.storage && navigator.storage.estimate) {
            const estimate: any = await navigator.storage.estimate();
            const remainingStorage = estimate.quota - estimate.usage;
            const usagePercentage = (estimate.usage / estimate.quota) * 100;
            const forceClean = false; // set to true to simuilate low storage, and cause pruning, after every message send

            console.log(`Storage: (${Math.round(usagePercentage)}% used). Quota: ${util.formatStorageSize(estimate.quota)}`);

            // Calculate message size and check storage limits
            const msgSize = this.calculateMessageSize(msg);

            // If we're within 10% of storage limit
            if (remainingStorage < msgSize || usagePercentage > 90 || forceClean) {
                const warningMsg = `You're running low on storage space (${Math.round(usagePercentage)}% used). ` +
                    `Would you like to remove the oldest 20% of messages from the current room to free up space?`;

                if (confirm(warningMsg)) {
                    // Sort messages by timestamp and remove oldest 20%
                    this.gs!.messages!.sort((a: any, b: any) => a.timestamp - b.timestamp);
                    const countToRemove = Math.ceil(this.gs!.messages!.length * 0.20);
                    this.gs!.messages = this.gs!.messages!.slice(countToRemove);

                    // Save the pruned messages
                    this.saveMessages();
                    util.log(`Removed ${countToRemove} old messages due to storage constraints`);
                }
            }
        }
    }

    // Calculate the size of a message object in bytes
    calculateMessageSize(msg: any) {
        let totalSize = 0;

        // Text content size
        if (msg.content) {
            totalSize += new Blob([msg.content]).size;
        }

        // Metadata size (sender, timestamp, etc.)
        totalSize += new Blob([JSON.stringify({
            sender: msg.sender,
            timestamp: msg.timestamp
        })]).size;

        // Attachments size
        if (msg.attachments && msg.attachments.length > 0) {
            msg.attachments.forEach((attachment: any) => {
                // Base64 data URLs are approximately 33% larger than the original binary
                // The actual data portion is after the comma in "data:image/jpeg;base64,..."
                if (attachment.data) {
                    const dataUrl = attachment.data;
                    const base64Index = dataUrl.indexOf(',') + 1;
                    if (base64Index > 0) {
                        const base64Data = dataUrl.substring(base64Index);
                        // Convert from base64 size to binary size (approx)
                        totalSize += Math.floor((base64Data.length * 3) / 4);
                    } else {
                        // Fallback if data URL format is unexpected
                        totalSize += new Blob([dataUrl]).size;
                    }
                }

                // Add size of attachment metadata
                totalSize += new Blob([JSON.stringify({
                    name: attachment.name,
                    type: attachment.type,
                    size: attachment.size
                })]).size;
            });
        }
        return totalSize;
    }

    saveMessages() {
        if (!this.storage || !this.rtc) { 
            console.warn('No storage or rct instance available for saving messages');
            return;
        }

        try {
            const roomData = {
                messages: this.gs!.messages,
                lastUpdated: new Date().toISOString()
            };

            this.storage.setItem(DBKeys.roomPrefix + this.gs!.roomName, roomData);
            util.log('Saved ' + this.gs!.messages!.length + ' messages for room: ' + this.gs!.roomName);
        } catch (error) {
            util.log('Error saving messages: ' + error);
        }
    }

    messageExists(msg: ChatMessage) {
        return this.gs!.messages!.some((message: any) =>
            message.timestamp === msg.timestamp &&
            message.sender === msg.sender &&
            message.content === msg.content
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

    async loadRoomMessages(roomId: string): Promise<ChatMessage[]> {
        let messages: ChatMessage[] = [];
        
        if (!this.storage) {
            console.warn('No storage instance available for loading messages');
            return [];
        }
        console.log("Loading messages for room: " + roomId);
        
        // First get room messages from local storage
        try {
            const roomData: any = await this.storage.getItem(DBKeys.roomPrefix + roomId);
            if (roomData) {
                const cleanedSome: boolean = await this.cleanRoomMessages(roomData);
                console.log("cleanedSome = " + cleanedSome);
                if (cleanedSome) {
                    console.log("Saving new room data after cleaning old messages for room: " + roomId);
                    // If we cleaned old messages, save the updated room data
                    await this.storage.setItem(DBKeys.roomPrefix + roomId, roomData);
                    util.log(`Cleaned old messages for room: ${roomId}`);
                }

                util.log('Loaded ' + roomData.messages.length + ' messages from local storage for room: ' + roomId);
                messages = roomData.messages;
            }
        } catch (error) {
            util.log('Error loading messages from storage: ' + error);
        }

        // Next get room messages from server using our new optimized approach
        if (this.gs!.saveToServer) {
            try {
            // Step 1: Get all message IDs from the server for this room
                const idsResponse = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/message-ids?daysOfHistory=${this.gs?.daysOfHistory || 30}`);
                if (!idsResponse.ok) {
                    throw new Error(`Failed to fetch message IDs: ${idsResponse.status}`);
                }
            
                const idsData = await idsResponse.json();
                const serverMessageIds: string[] = idsData.messageIds || [];
            
                if (serverMessageIds.length === 0) {
                    util.log(`No messages found on server for room: ${roomId}`);
                    return messages;
                }
            
                // Step 2: Create a map of existing message IDs for quick lookup
                const existingMessageIds = new Set(messages.map(msg => msg.id));
            
                // Step 3: Determine which message IDs we're missing locally
                const missingIds = serverMessageIds.filter(id => !existingMessageIds.has(id));
            
                if (missingIds.length === 0) {
                    util.log(`Local message store is up to date for room: ${roomId}`);
                    return messages;
                }
            
                util.log(`Found ${missingIds.length} missing messages to fetch for room: ${roomId}`);
            
                // Step 4: Fetch only the missing messages from the server
                const messagesResponse = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/get-messages-by-id`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ ids: missingIds })
                });
            
                if (!messagesResponse.ok) {
                    throw new Error(`Failed to fetch missing messages: ${messagesResponse.status}`);
                }
            
                const messagesData = await messagesResponse.json();
                if (messagesData.messages && messagesData.messages.length > 0) {
                    // log all the messages content we got back along with number of attachments for each message
                    messagesData.messages.forEach((msg: ChatMessage) => {
                        console.log(`Fetched message: ${msg.content} with ${msg.attachments ? msg.attachments.length : 0} attachments`);
                    });

                    // Step 5: Add the fetched messages to our local array
                    messages = [...messages, ...messagesData.messages];
                
                    // Step 6: Sort messages by timestamp to ensure chronological order
                    messages.sort((a, b) => a.timestamp - b.timestamp);
                
                    // Step 7: Save the merged messages to local storage
                    await this.storage.setItem(DBKeys.roomPrefix + roomId, {
                        messages,
                        lastUpdated: new Date().toISOString()
                    });
                
                    util.log(`Merged ${messagesData.messages.length} server messages with local store. Total messages: ${messages.length}`);
                }
            } catch (error) {
                util.log('Error synchronizing messages with server, falling back to local storage: ' + error);
            }
        }
        return messages;
    }

    clear = async () => {
        await this.storage?.clear();
        console.log("Cleared IndexedDB");
        // refresh browser page
        window.location.reload();
    }
}

export const app = new AppService();

