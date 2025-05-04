import IndexedDB from './IndexedDB.ts';

import {util} from './Util.js';
import {AppServiceTypes, DBKeys, PageNames, RoomHistoryItem} from './AppServiceTypes.ts';
import {GlobalAction, GlobalState} from './GlobalState.tsx';
import {crypt} from '../common/Crypto.ts';  
import { KeyPairHex } from '../common/CryptoIntf.ts';
import WebRTC from './WebRTC.ts';
import { ChatMessage, ChatMessageIntf, Contact, FileBase64Intf, User, UserProfile } from '../common/CommonTypes.ts';
import { setConfirmHandlers } from './components/ConfirmModalComp';
import { setPromptHandlers } from './components/PromptModalComp';
import { httpClientUtil } from './HttpClientUtil.ts';
import { canon } from '../common/Canonicalizer.ts';

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
            await this.createIdentity(false);
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

    toggleHeaderExpand = () => {
        this.gs!.headerExpanded = !this.gs!.headerExpanded;
        this.gd!({ type: 'toggleHeaderExpand', payload: this.gs});
        this.storage?.setItem(DBKeys.headerExpanded, this.gs!.headerExpanded);
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
    
    deleteMessage = async (messageId: string) => {
        this.alert(`Deleting message ${messageId}`);
        const messageIndex = this.gs?.messages?.findIndex((msg: ChatMessage) => msg.id === messageId);
        if (messageIndex !== undefined && messageIndex >= 0) {
            this.gs!.messages!.splice(messageIndex, 1);
            this.gd!({ type: 'deleteMessage', payload: this.gs});
            this.saveMessages();

            try {
                // Make the secure POST request with body
                await httpClientUtil.secureHttpPost('/api/admin/delete-message', this.gs!.keyPair!, {
                    messageId: messageId
                });
                
            } catch (error) {
                console.error('Error deleting message from server:', error);
            }
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
    
    prompt = (message: string, defaultValue: string = ''): Promise<string | null> => {
        return new Promise((resolve) => {
            // Set the handlers for this prompt dialog
            setPromptHandlers({ resolve });
            
            // Display the prompt dialog
            this.gd!({ type: 'openPrompt', payload: { 
                promptMessage: message,
                promptDefaultValue: defaultValue
            }});
        });
    }

    closePrompt = () => {
        this.gd!({ type: 'closePrompt', payload: { 
            promptMessage: null,
            promptDefaultValue: null
        }});
    }

    confirm = (message: string): Promise<boolean> => {
        return new Promise((resolve) => {
            // Set the handlers for this confirmation dialog
            setConfirmHandlers({ resolve });
            
            // Display the confirmation dialog
            this.gd!({ type: 'openConfirm', payload: { 
                confirmMessage: message
            }});
        });
    }

    closeConfirm = () => {
        this.gd!({ type: 'closeConfirm', payload: { 
            confirmMessage: null,
        }});
    }

    alert = (message: string) => {
        console.log("Alert: " + message);
        this.gd!({ type: 'openAlert', payload: { 
            modalMessage: message,
        }});
    }

    closeAlert = () => {
        this.gd!({ type: 'closeAlert', payload: { 
            modalMessage: null,
        }});
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
            await this.connect(userName, keyPair, roomName);
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
        const headerExpanded: boolean = await this.storage?.getItem(DBKeys.headerExpanded) || false;

        const state: GlobalState = {
            userName,
            contacts,
            roomName,
            saveToServer,
            daysOfHistory,
            roomHistory,
            userDescription,
            userAvatar,
            headerExpanded
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
                const userProfile: UserProfile = {
                    publicKey: this.gs.keyPair.publicKey,
                    name: userName,
                    description: userDescription,
                    avatar: userAvatar
                };

                await httpClientUtil.secureHttpPost('/api/users/info', this.gs!.keyPair!, userProfile);
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
        this.gd!({ type: `persistGlobal-${key}`, payload: { 
            [key]: value
        }});
        // Save the keyPair to IndexedDB
        await this.storage?.setItem(key, value);
    }

    importKeyPair = async () => {
        if (this.gs!.keyPair && this.gs!.keyPair.publicKey && this.gs!.keyPair.privateKey) {
            if (!await this.confirm("Are you sure? This will overwrite your existing key pair.")) {
                return;
            }
        }
        const privateKey = await app.prompt("Enter Private Key");
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

    createIdentity = async (askFirst: boolean = true) => {
        // if they already have a keyPair, ask if they want to create a new one
        if (askFirst && this.gs!.keyPair && this.gs!.keyPair.publicKey && this.gs!.keyPair.privateKey) {
            if (! await this.confirm("Create new Identity Keys?")) {
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

    rtcStateChange = () => {
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
    connect = async (userName: string | null, keyPair: KeyPairHex | null, roomName: string) => {
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
        await this.storage?.setItem(DBKeys.connected, true);

        setTimeout(() => {
            this.reSendFailedMessages();
        }, 500);

        console.log("Connected to room: " + roomName);
    }

    reSendFailedMessages = () => {
        if (!this.rtc || !this.gs || !this.gs.messages) {
            console.warn('Cannot resend messages: RTC not initialized or no messages available');
            return;
        }
        const unsentMessages = this.gs.messages.filter(msg => msg.state !== 's' && msg.publicKey === this.gs!.keyPair?.publicKey);
        
        if (unsentMessages.length > 0) {
            console.log(`Attempting to resend ${unsentMessages.length} unsent messages`);
            
            for (const msg of unsentMessages) {
                console.log(`Resending message: ${msg.id}`);
                const sentOk = this.rtc._sendMessage(msg);
                // we really need a more robust way to verify the server did indeed get saved on the server
                // because we can't do it thru WebRTC
                msg.state = sentOk ? 's' : 'f';
            }
            
            // Update the global state and save messages after resending
            this.gd!({ type: 'resendMessages', payload: this.gs });
            this.saveMessages();
        } else {
            console.log('No unsent messages to resend');
        }
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

    blockUser = async (publicKey: string) => {
        if (!await this.confirm("Are you sure? This will delete all messages from this user and block them.")) {
            return;
        }
        
        try {
            // Make the secure POST request with body
            const response = await httpClientUtil.secureHttpPost('/api/admin/block-user', this.gs!.keyPair!, {
                pub_key: publicKey.trim()
            });
            app.alert(`Success: ${response.message}`);
        } catch (error) {
            console.error('Error blocking user:', error);
            app.alert(`Failed to block user: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } 
    }

    setContacts = (contacts: any) => {
        // Save into global state
        this.gd!({ type: 'setContacts', payload: { contacts }});

        // Save to IndexedDB
        this.storage?.setItem(DBKeys.contacts, contacts);
    }

    setMessages = (messages: ChatMessageIntf[]) => {
        // Save into global state
        this.gd!({ type: 'setMessages', payload: { messages }});

        // Save to IndexedDB
        this.storage?.setItem(DBKeys.roomPrefix+this.gs?.roomName, messages);
    }

    disconnect = async () => {
        this.rtc?._disconnect();
        this.gd!({ type: 'disconnect', payload: { 
            messages: [], 
            participants: new Map<string, User>(), 
            connected: false, 
        }});
        await this.storage?.setItem(DBKeys.connected, false);
    }

    forgetRoom = async (roomName: string) => {
        if (!await this.confirm("Clear all chat history for room?")) return;
        
        if (!this.gs || !this.gs!.connected) {
            console.log("Not connected, cannot clear messages.");
            return;
        }

        // if deleting current room disconnect
        if (roomName===this.gs!.roomName) {
            await this.disconnect();
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

        this.gd!({ type: 'forgetRoom', payload: this.gs });
    }

    sendMessage = async (message: string, selectedFiles: any) => {
        if (!this.rtc) {
            console.warn('RTC instance not available for sending message');
            return;
        }
        if (message || selectedFiles.length > 0) {
            const msg: ChatMessage = this.createMessage(message, this.gs!.userName!, selectedFiles);
            
            if (this.gs!.keyPair && this.gs!.keyPair.publicKey && this.gs!.keyPair.privateKey) {   
                try {
                    await crypt.signObject(msg, canon.canonical_ChatMessage, this.gs!.keyPair);
                    msg.sigOk = true;
                } catch (error) {
                    console.error('Error signing message:', error);
                }
            }
            
            const sentOk = this.rtc._sendMessage(msg);
            msg.state = sentOk ? 's' : 'f';

            // persist in global state
            this.gs!.messages!.push(msg);
            this.gd!({ type: 'persistMessage', payload: this.gs});

            // persist in IndexedDB
            await this.saveMessages();

            setTimeout(() => {
                // after a few seconds check if the message was acknowledged by the server
                // todo-0: we could add a resend button for these kinds of messages, which would
                // come in handy for P2P mode also, which also needs to have some kind of ACK 
                // mechanism, which we don't have yet.
                if (this.gs!.messages && this.gs?.saveToServer) {
                    // lookup the message by 'id' and verify it has the dbId on it now.
                    const message = this.gs!.messages!.find((m: ChatMessage) => m.id === msg.id);
                    if (message && !message.dbId) {
                        this.alert('There was a problem sending that last message. The server did not acknowledge acceptance of the message');
                    }
                }

                try {
                    this.pruneDB(msg);
                } catch (error) {
                    util.log('Error checking storage or saving message: ' + error);
                }
            }, 3000);
        }
    }

    acknowledgeMessage = async (id: string, dbId: number): Promise<void> => {
        if (!this.gs || !this.gs!.messages) {
            console.warn('No messages available to acknowledge');
            return;
        }

        const message = this.gs!.messages.find((msg: ChatMessage) => msg.id === id);
        if (message) {
            message.state = 'a';
            message.dbId = dbId;
            this.gd!({ type: 'acknowledgeMessage', payload: this.gs});
            await this.saveMessages();
            console.warn(`Message ID ${id} acknowledged as dbId ${dbId}`); 
        } else {
            console.warn(`Message with ID ${id} not found`);
        }
    }

    persistInboundMessage = async (msg: ChatMessage) => {
        console.log("App Persisting message: ", msg);

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

        this.gs!.messages!.push(msg);
        try {
            await this.pruneDB(msg);
        } catch (error) {
            util.log('Error checking storage or saving message: ' + error);
        }

        this.gd!({ type: 'persistMessage', payload: this.gs});
        this.saveMessages();
    }

    addContact = async (user: User) => {
        if (!this.gs || !this.gs!.contacts) {
            console.warn('No contacts available to add a new contact');
            return;
        }

        // Check if the user is already in the contacts
        const existingContact = this.gs!.contacts.find((contact: Contact) => contact.publicKey === user.publicKey);
        if (existingContact) {
            console.warn('User is already in contacts');
            return;
        }

        // Add the new contact
        this.gs!.contacts.push({
            publicKey: user.publicKey,
            alias: user.name,
        });

        await this.storage?.setItem(DBKeys.contacts, this.gs!.contacts);
        this.gd!({ type: 'addContact', payload: this.gs});
    }

    existsInContacts(msg: ChatMessage) {
        if (!this.gs || !this.gs!.contacts) {
            return false;
        }
        return this.gs!.contacts.some((contact: any) => contact.publicKey === msg.publicKey);
    }

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

                if (await this.confirm(warningMsg)) {
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

    /* Saves the current Global State messages to IndexedDB */
    saveMessages = async () => {
        if (!this.storage || !this.rtc) { 
            console.warn('No storage or rct instance available for saving messages');
            return;
        }

        try {
            const roomData = {
                messages: this.gs!.messages,
                lastUpdated: new Date().toISOString()
            };

            await this.storage.setItem(DBKeys.roomPrefix + this.gs!.roomName, roomData);
            util.log('Saved ' + this.gs!.messages!.length + ' messages for room: ' + this.gs!.roomName);
        } catch (error) {
            util.log('Error saving messages: ' + error);
        }
    }

    messageExists(msg: ChatMessage) {
        return this.gs!.messages!.some((message: any) =>
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

    loadRoomMessages = async (roomId: string): Promise<ChatMessage[]> => {
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

        // Next get room messages from server
        if (this.gs!.saveToServer) {
            try {
                // Get all message IDs from the server for this room
                const idsData: any = await httpClientUtil.httpGet(`/api/rooms/${encodeURIComponent(roomId)}/message-ids?daysOfHistory=${this.gs?.daysOfHistory || 30}`);
               
                const serverMessageIds: string[] = idsData.messageIds || [];
                if (serverMessageIds.length === 0) {
                    util.log(`No messages found on server for room: ${roomId}`);
                    return messages;
                }
            
                // Create a map of existing message IDs for quick lookup
                const existingMessageIds = new Set(messages.map(msg => msg.id));
            
                // Determine which message IDs we're missing locally
                const missingIds = serverMessageIds.filter(id => !existingMessageIds.has(id));
                if (missingIds.length === 0) {
                    util.log(`Local message store is up to date for room: ${roomId}`);
                    return messages;
                }
            
                util.log(`Found ${missingIds.length} missing messages to fetch for room: ${roomId}`);
            
                // Fetch only the missing messages from the server
                const messagesData = await httpClientUtil.httpPost(`/api/rooms/${encodeURIComponent(roomId)}/get-messages-by-id`, { ids: missingIds });
            
                if (messagesData.messages && messagesData.messages.length > 0) {
                    // log all the messages content we got back along with number of attachments for each message
                    messagesData.messages.forEach((msg: ChatMessage) => {
                        console.log(`Fetched message: ${msg.content} with ${msg.attachments ? msg.attachments.length : 0} attachments`);
                    });

                    // Add the fetched messages to our local array
                    messages = [...messages, ...messagesData.messages];
                
                    // Sort messages by timestamp to ensure chronological order
                    messages.sort((a, b) => a.timestamp - b.timestamp);
                
                    // Save the merged messages to local storage
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

