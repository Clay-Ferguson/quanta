import WebRTC from './WebRTC';
import IndexedDB from './IndexedDB.ts';

import Utils from './Util.js';
const util = Utils.getInst();

declare const RTC_HOST: string;
declare const RTC_PORT: string;

class AppService {
    private static inst: AppService | null = null;
    public storage: any; // IndexedDB instance
    public rtc: any; // WebRTC instance

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

    _connect = async (dispatch: any, userName: string, roomName: string) => {
        // if user or room is empty, return
        // if (!user || !room) {
        //     alert('Please enter both username and room name');
        //     return;
        // }

        const messages = await this.loadRoomMessages(roomName);

        // todo-0: theoretically we could call this in async thread
        await this.rtc._connect(userName, roomName);

        dispatch({ type: 'connect', payload: { 
            userName,
            roomName,
            messages,
            connected: true  
        }});
        this.scrollToBottom();
    }

    _disconnect = (dispatch: any) => {
        dispatch({ type: 'disconnect', payload: { 
            roomName: '', 
            userName: '',
            messages: [], 
            participants: new Set<string>(), 
            connected: false, 
        }});
    }

    // todo-0: add type safety to 'gs'
    send = (dispatch: any, message: string, selectedFiles: any, gs: any) => {
        if (message || selectedFiles.length > 0) {
            const msg: any = this.createMessage(message, this.rtc.userName, selectedFiles);
            this._persistMessage(msg, gs);
            this.rtc._sendMessage(msg);

            // NOTE: displatch adds to 'gs.messages' array in the reducer
            dispatch({ type: 'send', payload: gs});
            this.scrollToBottom();
        
            // this.clearAttachments();
            // input.value = '';
            //  mr.refreshAll();
        }
    }

    scrollToBottom = () => {
        setTimeout(() => {
            const chatLog = document.getElementById('chatLog');
            if (chatLog) {
                chatLog.scrollTop = chatLog.scrollHeight;
            }}, 200);
    }

    _persistMessage = async (msg: any, gs: any) => {
        if (this.messageExists(msg, gs)) {
            return false; // Message already exists, do not save again
        }

        gs.messages.push(msg); // Update local state immediately

        try {
            // todo-0: add this back in
            // await this.autoPruneDatabase(msg);
        } catch (error) {
            util.log('Error checking storage or saving message: ' + error);
        }

        // todo-0: we could put a timer here to batch save messages instead of saving every time
        // and also make sure the GUI never waits for the DB.
        this.saveMessages(gs);
        // this.asyncScrollToBottom(); // todo-0: need to bring this back.
    }

    // Message storage and persistence functions
    saveMessages(gs: any) {
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

    messageExists(msg: any, gs: any) {
        return gs.messages.some((message: any) =>
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
        console.log("Loading messages for room: " + roomId);
        try {
            const roomData = await this.storage.getItem('room_' + roomId);
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
