import WebRTC from './WebRTC';
import IndexedDB from './IndexedDB.ts';

import Utils from './Util.js';
const util = Utils.getInst();

// Vars are injected diretly into HTML by server
declare const RTC_HOST: string;
declare const RTC_PORT: string;

class AppService {
    private static inst: AppService | null = null;
    public storage: IndexedDB | null = null;
    public rtc: WebRTC | null = null;
    private gd: any = null; // Global Dispatch Function
    private gs: any = null; // Global State Object

    constructor() {
        console.log('Util singleton created');
    }

    static getInst() {
        // Create instance if it doesn't exist
        if (!AppService.inst) {
            AppService.inst = new AppService();
            AppService.inst.init();
        }
        return AppService.inst;
    }

    async init() {
        this.storage = await IndexedDB.getInst("quantaChatDB", "quantaChatStore", 1);
        this.rtc = await WebRTC.getInst(this.storage, this, RTC_HOST, RTC_PORT);
    }

    setGlobals = (dispatch: any, state: any) => {
        this.gd = dispatch;
        this.gs = state;
    }

    _rtcStateChange = () => {
        if (!this.gd || !this.rtc) {
            console.warn('Global dispatch not yet available for RTC state change');
            return;
        }
        
        // Get current RTC state
        const participants = this.rtc.participants || new Set<string>();
        const connected = this.rtc.connected || false;
        
        // Dispatch to update global state
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
        // if user or room is empty, return
        // if (!user || !room) {
        //     alert('Please enter both username and room name');
        //     return;
        // }

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
            this.saveMessages(this.gs); 
            this.gd({ type: 'clearMessages', payload: this.gs });}
    }

    _send = (message: string, selectedFiles: any) => {
        if (!this.rtc) {
            console.warn('RTC instance not available for sending message');
            return;
        }
        if (message || selectedFiles.length > 0) {
            const msg: any = this.createMessage(message, this.rtc.userName, selectedFiles);
            this._persistMessage(msg);
            this.rtc._sendMessage(msg);

            // NOTE: displatch adds to 'gs.messages' array in the reducer
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
            return false; // Message already exists, do not save again
        }

        this.gs.messages.push(msg); // Update local state immediately

        try {
            // todo-0: add this back in
            // await this.autoPruneDatabase(msg);
        } catch (error) {
            util.log('Error checking storage or saving message: ' + error);
        }

        this.saveMessages(this.gs);
        this.scrollToBottom();
    }

    // Message storage and persistence functions. 
    // todo-0: Note we could probably use 'this.gs' from this class, instead of arg here.
    saveMessages(gs: any) {
        if (!this.storage || !this.rtc) { 
            console.warn('No storage or rct instance available for saving messages');
            return;
        }
        gs = gs || this.gs;
        try {
            // Get existing room data or create a new room object
            const roomData = {
                messages: gs.messages,
                lastUpdated: new Date().toISOString()
            };

            this.storage.setItem('room_' + this.rtc.roomId, roomData);
            util.log('Saved ' + gs.messages.length + ' messages for room: ' + gs.roomName);
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

    createMessage(content: string, sender: string, attachments = []) {
        console.log("Creating message from sender: " + sender);
        const msg = {
            timestamp: new Date().toISOString(),
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
