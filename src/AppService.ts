import IndexedDB from './IndexedDB.ts';

import {util} from './Util.js';
import {AppServiceTypes, ChatMessage, DBKeys, MessageAttachment, PageNames} from './AppServiceTypes.ts';

import {crypto} from './Crypto.ts';  
import { KeyPairHex } from './CryptoIntf.ts';
import { WebRTCIntf } from './WebRTCIntf.ts';
import WebRTC from './WebRTC.ts';
import WebRTC_Legacy from './WebRTC_Legacy.ts';

// Vars are injected diretly into HTML by server
declare const HOST: string;
declare const PORT: string;

// WARNING: This same variable exists on Client and Server and must match, to determine which WebRTC implementation to use, and these
// need to both match. That is, if you change to Legacy version you need to change on both server code and client code.
// todo-0: After enabling https/wss we need to retest and update the legacy code because it's not not trusted and may not work.
const useLegacyWebRTC = false;

export class AppService implements AppServiceTypes  {
    public storage: IndexedDB | null = null;
    public rtc: WebRTCIntf | null = null;
    private gd: any = null; // Global Dispatch Function
    private gs: any = null; // Global State Object

    async init() {
        this.storage = await IndexedDB.getInst("quantaChatDB", "quantaChatStore", 1);
        this.rtc = useLegacyWebRTC ? //
            new WebRTC_Legacy(this.storage, this, HOST, PORT) :
            new WebRTC(this.storage, this, HOST, PORT);

        await this.restoreSavedValues();

        // Load the keyPair from IndexedDB
        const keyPair: KeyPairHex = await this.storage?.getItem('keyPair');
        if (!keyPair) {
            await this._createIdentity(false);
        }
        else {
            this.gd({ type: 'setIdentity', payload: { 
                keyPair
            }});
        }

        this.gd({ type: 'setAppInitialized', payload: { 
            appInitialized: true
        }});

        this.restoreConnection();
    }

    restoreConnection = async () => {
        const userName = await this.storage?.getItem(DBKeys.userName);
        const roomName = await this.storage?.getItem(DBKeys.roomName);
        const connected = await this.storage?.getItem(DBKeys.connected);


        if (userName && roomName && connected) {
            // in this branch of code after the connect we put the 'appInitialized' setter into the place AFTER we've scrolled to bottom 
            await this._connect(userName, roomName);
        }
    }

    restoreSavedValues = async () => {
        // console.log("Restoring saved values from IndexedDB");
        const userName = await this.restoreSavedValue(DBKeys.userName);
        await this.restoreSavedValue('contacts');
        await this.restoreSavedValue('roomName');

        // if no username we send to settings page.
        if (!userName) {
            this.gd({ type: 'setPage', payload: { page: PageNames.settings }});
        }
    }

    restoreSavedValue = async (key: string): Promise<any> => {
        const val: any = await this.storage?.getItem(key);
        if (val) {
            this.gd({ type: `restoreVal-${val}`, payload: { [key]: val }});
            // console.log("Restored value: " + key + " = " + val);
        }
        return val;
    }

    setFullSizeImage = (att: MessageAttachment | null) => {
        this.gs.fullSizeImage = att ? {src: att.data, name: att.name} : null;
        this.gd({ type: 'setFullSizeImage', payload: this.gs});
    }

    goToPage = (page: string) => {
        this.gs.page = page; 
        this.gd({ type: 'setPage', payload: this.gs });
    }

    setGlobals = (gd: any, gs: any) => {
        this.gd = gd;
        this.gs = gs;
    }

    setUserName  = async (userName: string) => {
        this.persistGlobalValue(DBKeys.userName, userName);
    }

    // we have this method only for effeciency to do a single state update.
    setRoomAndUserName = async (roomName: string, userName: string, ) => {
        this.gd({ type: `setRoomAndUser}`, payload: { 
            roomName, userName
        }});
        // Save the keyPair to IndexedDB
        await this.storage?.setItem(DBKeys.roomName, roomName);
        await this.storage?.setItem(DBKeys.userName, userName);
    }        

    persistGlobalValue = async (key: string, value: any) => {
        // save to global state
        this.gd({ type: `persistGlobalValue-${key}`, payload: { 
            [key]: value
        }});
        // Save the keyPair to IndexedDB
        await this.storage?.setItem(key, value);
    }

    _createIdentity = async (askFirst: boolean = true) => {
        // if they already have a keyPair, ask if they want to create a new one
        if (askFirst && this.gs && this.gs.keyPair && this.gs.keyPair.publicKey && this.gs.keyPair.privateKey) {
            if (!confirm("Create new Identity Keys?")) {
                return;
            }
        }

        const keyPair: KeyPairHex= crypto.generateKeypair();
        this.gd({ type: 'creatIdentity', payload: { 
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
        
        const participants = this.rtc.participants || new Set<string>();
        const connected = this.rtc.connected || false;
        this.gd({ 
            type: 'updateRtcState', 
            payload: { 
                participants,
                connected
            }
        });
    }

    // userName is optional and will default to global state if not provided
    _connect = async (userName: string | null, roomName: string) => {
        userName = userName || this.gs.userName;
        if (!this.rtc) {
            console.warn('Global dispatch not yet available for RTC state change');
            return;
        }
        this.gd({ type: 'connect', payload: { 
            connecting: true
        }});

        const messages = await this.loadRoomMessages(roomName);
        await this.rtc._connect(userName!, roomName);
        await this.setRoomAndUserName(roomName, userName!);

        this.gd({ type: 'connect', payload: { 
            userName,
            roomName,
            messages,
            connected: true,
            connecting: false
        }});

        // set connected DB key
        await this.storage?.setItem(DBKeys.connected, true);
    }

    _setContacts = (contacts: any) => {
        // Save into global state
        this.gd({ type: 'setContacts', payload: { contacts }});

        // Save to IndexedDB
        this.storage?.setItem('contacts', contacts);
    }

    _disconnect = async () => {
        this.rtc?._disconnect();
        this.gd({ type: 'disconnect', payload: { 
            messages: [], 
            participants: new Set<string>(), 
            connected: false, 
        }});
        await this.storage?.setItem(DBKeys.connected, false);
    }

    _clearMessages = () => {
        if (confirm("Clear all chat history for room?")) {
            if (!this.gs || !this.gs.connected) {
                console.log("Not connected, cannot clear messages.");
                return;
            }
            this.gs.messages = []; 
            this.saveMessages(); 
            this.gd({ type: 'clearMessages', payload: this.gs });}
    }

    _send = async (message: string, selectedFiles: any) => {
        if (!this.rtc) {
            console.warn('RTC instance not available for sending message');
            return;
        }
        if (message || selectedFiles.length > 0) {
            const msg: ChatMessage = this.createMessage(message, this.gs.userName, selectedFiles);
            
            if (this.gs.keyPair && this.gs.keyPair.publicKey && this.gs.keyPair.privateKey) {   
                try {
                    await crypto.signMessage(msg, this.gs.keyPair);
                } catch (error) {
                    console.error('Error signing message:', error);
                }
            }
            this._persistMessage(msg);
            this.rtc._sendMessage(msg);
            this.gd({ type: 'send', payload: this.gs});
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
            msg.sigOk = await crypto.verifySignature(msg);
            if (msg.sigOk) {
                if (msg.publicKey === this.gs.keyPair.publicKey) {
                    msg.trusted = true;
                }
                else {
                    msg.trusted = this.existsInContacts(msg);
                }
            }
            else {
                // console.log("Invalid Signature on: "+ msg.content);
            }
        }
        else {
            // console.log("No signature found on message: "+ msg.content);
            msg.sigOk = false;
            msg.trusted = false;
        }

        this.gs.messages.push(msg);
        try {
            await this.pruneDB(msg);
        } catch (error) {
            util.log('Error checking storage or saving message: ' + error);
        }

        this.saveMessages();
    }

    existsInContacts(msg: ChatMessage) {
        if (!this.gs || !this.gs.contacts) {
            return false;
        }
        return this.gs.contacts.some((contact: any) => contact.publicKey === msg.publicKey);
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
                    `Would you like to remove the oldest 20% of messages to free up space?`;

                if (confirm(warningMsg)) {
                    // Sort messages by timestamp and remove oldest 20%
                    this.gs.messages.sort((a: any, b: any) => a.timestamp - b.timestamp);
                    const countToRemove = Math.ceil(this.gs.messages.length * 0.20);
                    this.gs.messages = this.gs.messages.slice(countToRemove);

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
                messages: this.gs.messages,
                lastUpdated: new Date().toISOString()
            };

            this.storage.setItem(DBKeys.roomPrefix + this.gs.roomName, roomData);
            util.log('Saved ' + this.gs.messages.length + ' messages for room: ' + this.gs.roomName);
        } catch (error) {
            util.log('Error saving messages: ' + error);
        }
    }

    messageExists(msg: ChatMessage) {
        return this.gs.messages.some((message: any) =>
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
            const roomData: any = await this.storage.getItem('room_' + roomId);
            if (roomData) {
                util.log('Loaded ' + roomData.messages.length + ' messages from local storage for room: ' + roomId);
                messages = roomData.messages;
            }
        } catch (error) {
            util.log('Error loading messages from storage: ' + error);
        }

        // Next get room messages from server, to update local storage with any we may not have yet.
        // todo-0: we will be implementing an `/api/messageIds` endpoint to get just the message ids, and then we can
        // get the messages we don't have, by submitting them all to the server to get the full messages, but for now
        // we use this simplistic un-optimized method.
        try {
            const response = await fetch(`/api/messages?roomName=${encodeURIComponent(roomId)}`);
            if (response.ok) {
                const data = await response.json();
                if (data.messages && data.messages.length > 0) {
                    util.log(`Loaded ${data.messages.length} messages from server for room: ${roomId}`);
            
                    // Create a map of existing message IDs for quick lookup
                    const existingMessageIds = new Set(messages.map(msg => msg.id));
                    
                    // Add only new messages from the server
                    for (const serverMsg of data.messages) {
                        if (!existingMessageIds.has(serverMsg.id)) {
                            messages.push(serverMsg);
                        }
                    }
                    
                    // Sort messages by timestamp to ensure chronological order
                    messages.sort((a, b) => a.timestamp - b.timestamp);
                    
                    // Save the merged messages to local storage
                    await this.storage.setItem('room_' + roomId, {
                        messages: messages,
                        lastUpdated: new Date().toISOString()
                    });
                    
                    util.log(`Merged local and server messages. Total unique messages: ${messages.length}`);
                }
            }
        } catch (error) {
            util.log('Error loading messages from server, falling back to local storage: ' + error);
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
app.init();
