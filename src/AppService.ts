import WebRTC from './WebRTC';
import IndexedDB from './IndexedDB.ts';

import Utils from './Util.js';
import {AppServiceIntf, ChatMessage} from './AppServiceIntf.ts';
const util = Utils.getInst();

import Crypto from './Crypto.ts';  
import { KeyPairHex } from './CryptoIntf.ts';
const crypto = Crypto.getInst();

// Vars are injected diretly into HTML by server
declare const RTC_HOST: string;
declare const RTC_PORT: string;

class AppService implements AppServiceIntf  {
    private static inst: AppService | null = null;
    public storage: IndexedDB | null = null;
    public rtc: WebRTC | null = null;
    private gd: any = null; // Global Dispatch Function
    private gs: any = null; // Global State Object

    constructor() {
        console.log('Util singleton created');
    }

    static getInst() {
        if (!AppService.inst) {
            AppService.inst = new AppService();
            AppService.inst.init();
        }
        return AppService.inst;
    }

    async init() {
        this.storage = await IndexedDB.getInst("quantaChatDB", "quantaChatStore", 1);
        this.rtc = await WebRTC.getInst(this.storage, this, RTC_HOST, RTC_PORT);

        // Load the keyPair from IndexedDB
        const keyPair: KeyPairHex = await this.storage?.getItem('keyPair');
        if (keyPair) {
            this.gd({ type: 'setIdentity', payload: { 
                keyPair
            }});
        }
    }

    setGlobals = (dispatch: any, state: any) => {
        this.gd = dispatch;
        this.gs = state;
    }

    _createIdentity = async () => {
        // if they already have a keyPair, ask if they want to create a new one
        if (this.gs && this.gs.keyPair && this.gs.keyPair.publicKey && this.gs.keyPair.privateKey) {
            if (!confirm("Create new Identity Keys?")) {
                return;
            }
        }

        const keyPair: KeyPairHex= crypto.generateKeypair();
        this.gd({ type: 'creatIdentity', payload: { 
            keyPair
        }});
        // Save the keyPair to IndexedDB
        await this.storage?.setItem('keyPair', keyPair);
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

    _connect = async (userName: string, roomName: string) => {
        if (!this.rtc) {
            console.warn('Global dispatch not yet available for RTC state change');
            return;
        }

        const messages = await this.loadRoomMessages(roomName);
        await this.rtc._connect(userName, roomName);

        this.gd({ type: 'connect', payload: { 
            userName,
            roomName,
            messages,
            connected: true  
        }});
        this.scrollToBottom();
    }

    _disconnect = () => {
        this.rtc?._disconnect();
        this.gd({ type: 'disconnect', payload: { 
            roomName: '', 
            userName: '',
            messages: [], 
            participants: new Set<string>(), 
            connected: false, 
        }});
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
            const msg: any = this.createMessage(message, this.rtc.userName, selectedFiles);
            
            // this is failing (see note in method)
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

    scrollToBottom = () => {
        setTimeout(() => {
            const chatLog = document.getElementById('chatLog');
            if (chatLog) {
                chatLog.scrollTop = chatLog.scrollHeight;
            }}, 200);
    }

    _persistMessage = async (msg: any) => {
        console.log("Persisting message: ", msg);
        if (this.messageExists(msg)) {
            return; // Message already exists, do not save again
        }

        this.gs.messages.push(msg);
        try {
            await this.pruneDB(msg);
        } catch (error) {
            util.log('Error checking storage or saving message: ' + error);
        }

        this.saveMessages();
        this.scrollToBottom();
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

            this.storage.setItem('room_' + this.rtc.roomId, roomData);
            util.log('Saved ' + this.gs.messages.length + ' messages for room: ' + this.gs.roomName);
        } catch (error) {
            util.log('Error saving messages: ' + error);
        }
    }

    messageExists(msg: any) {
        return this.gs.messages.some((message: any) =>
            message.timestamp === msg.timestamp &&
            message.sender === msg.sender &&
            message.content === msg.content
        );
    }

    createMessage(content: string, sender: string, attachments = []): ChatMessage {
        console.log("Creating message from sender: " + sender);
        const msg = {
            timestamp: new Date().getTime(),
            sender,
            content,
            attachments
        };
        return msg;
    }

    async loadRoomMessages(roomId: string) {
        if (!this.storage) {
            console.warn('No storage instance available for loading messages');
            return [];
        }
        console.log("Loading messages for room: " + roomId);
        try {
            const roomData: any = await this.storage.getItem('room_' + roomId);
            if (roomData) {
                util.log('Loaded ' + roomData.messages.length + ' messages for room: ' + roomId);
                return roomData.messages || [];
            }
        } catch (error) {
            util.log('Error loading messages from storage: ' + error);
        }
        return [];
    }
}

export default AppService;
