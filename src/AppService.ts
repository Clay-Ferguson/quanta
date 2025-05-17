import {util} from './Util.js';
import {AppServiceIntf, DBKeys, PageNames, RoomHistoryItem} from './AppServiceTypes.ts';
import {gd, GlobalState, gs, setApplyStateRules} from './GlobalState.tsx';
import {crypt} from '../common/Crypto.ts';  
import { KeyPairHex } from '../common/CryptoIntf.ts';
import { ChatMessage, ChatMessageIntf, Contact, FileBase64Intf, GetMessageIdsForRoom_Response, GetMessagesByIds_Response, MessageStates, User, UserProfile } from '../common/CommonTypes.ts';
import { setConfirmHandler } from './components/ConfirmModalComp';
import { setPromptHandlers } from './components/PromptModalComp';
import { httpClientUtil } from './HttpClientUtil.ts';
import { canon } from '../common/Canonicalizer.ts';
import { setAlertHandler } from './components/AlertModalComp.tsx';
import {idb} from './IndexedDB.ts';
import {rtc} from './WebRTC.ts';

// Vars are injected diretly into HTML by server
declare const HOST: string;
declare const PORT: string;
declare const SECURE: string;

export class AppService implements AppServiceIntf  {
    // number of times the user has pressed 'd' key, while on settings page, without a rerender. Three presses triggers dev mode,
    // which essentially just give the settings page a link to show logs.
    dCount = 0;

    // Initializes the AppService, setting up the IndexedDB and WebRTC connection.
    async init() {
        console.log("Quanta Chat AppService init");
        setApplyStateRules(this.applyStateRules);
        await idb.init("quantaChatDB", "quantaChatStore", 1);
        const saveToServer = await idb.getItem(DBKeys.saveToServer, true);
        rtc.init(this, HOST, PORT, SECURE==='y', saveToServer);
        await this.restoreSavedValues();

        // Load the keyPair from IndexedDB
        const keyPair: KeyPairHex = await idb.getItem(DBKeys.keyPair);
        if (!keyPair) {
            await this.createIdentity(false);
        }
        else {
            gd({ type: 'setIdentity', payload: { 
                keyPair
            }});
        }

        gd({ type: 'setAppInitialized', payload: { 
            appInitialized: true
        }});

        this.restoreConnection();
        window.addEventListener('keydown', this.handleKeyDown);

        setTimeout(() => {
            this.runRoomCleanup();
        }, 10000);
    }

    handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'd' && this.getPageName() === PageNames.settings) {
            if (++this.dCount >= 3) {
                this.dCount = 0;
                gd({ type: 'devModeOn', payload: { 
                    devMode: true
                }});
            }
        }
    }

    /* This is just a global hook where we can make a final alteration of the state if needed, that
    will apply across all state updates. */
    applyStateRules = (gs: GlobalState) => {
        this.dCount = 0;
        // If not connected show the header to user cannot get confused/lost
        if (!gs.connected) {
            gs.headerExpanded = true;
        }
    }

    toggleHeaderExpand = () => {
        let _gs = gs();
        _gs.headerExpanded = !_gs.headerExpanded;
        _gs = gd({ type: 'toggleHeaderExpand', payload: _gs});
        idb.setItem(DBKeys.headerExpanded, _gs.headerExpanded);
    }

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
        const confirmed = await this.confirm(`Delete message?`);
        if (!confirmed) return;
        let _gs = gs();
        const messageIndex = _gs.messages?.findIndex((msg: ChatMessage) => msg.id === messageId);
        if (messageIndex !== undefined && messageIndex >= 0) {
            _gs.messages!.splice(messageIndex, 1);
            _gs = gd({ type: 'deleteMessage', payload: _gs});
            this.saveMessages(_gs.roomName!, _gs.messages!);

            try {
                // Make the secure POST request with body
                await httpClientUtil.secureHttpPost('/api/delete-message', _gs.keyPair!, {
                    messageId,
                    roomName: _gs.roomName
                });
            } catch (error) {
                console.error('Error deleting message from server:', error);
            }
        }
    }

    /**
     * Cleans up messages older than the specified number of days in the room data.
     * @param roomData The room data containing messages to clean.
     * @returns A promise that resolves to true if any messages were removed, false otherwise.
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

    showUserProfile = async (publicKey: string) => {
        // set page to userprofile 
        const _gs = gs();
        this.setTopPage(_gs, PageNames.userProfile);
        _gs.userProfile = {name: '', publicKey, description: '', avatar: null};
        gd({ type: 'setUserProfile', payload: _gs});
    }
    
    prompt = (message: string, defaultValue: string = ''): Promise<string | null> => {
        return new Promise((resolve) => {
            // Set the handlers for this prompt dialog
            setPromptHandlers({ resolve });
            
            // Display the prompt dialog
            gd({ type: 'openPrompt', payload: { 
                promptMessage: message,
                promptDefaultValue: defaultValue
            }});
        });
    }

    closePrompt = () => {
        gd({ type: 'closePrompt', payload: { 
            promptMessage: null,
            promptDefaultValue: null
        }});
    }

    confirm = (message: string): Promise<boolean> => {
        return new Promise((resolve) => {
            // Set the handlers for this confirmation dialog
            setConfirmHandler({ resolve });
            
            // Display the confirmation dialog
            gd({ type: 'openConfirm', payload: { 
                confirmMessage: message
            }});
        });
    }

    closeConfirm = () => {
        gd({ type: 'closeConfirm', payload: { 
            confirmMessage: null,
        }});
    }

    alert = (message: string): Promise<void> => {
        return new Promise((resolve) => {
            // Set the handlers for this confirmation dialog
            setAlertHandler({ resolve });
            
            console.log("Alert: " + message);
            gd({ type: 'openAlert', payload: { 
                modalMessage: message,
            }});
        });
    }

    closeAlert = () => {
        gd({ type: 'closeAlert', payload: { 
            modalMessage: null,
        }});
    }

    saveLinkPreviewInfo = async (url: string, data: any) => {
        // Save the link preview data to IndexedDB
        await idb.setItem(DBKeys.linkPreview + url, data);
    }

    getLinkPreviewInfo = async (url: string): Promise<any> => {
        // Retrieve the link preview data from IndexedDB
        const data = await idb.getItem(DBKeys.linkPreview + url);
        return data;
    }

    restoreConnection = async () => {
        const userName = await idb.getItem(DBKeys.userName);
        const keyPair = await idb.getItem(DBKeys.keyPair);
        const roomName = await idb.getItem(DBKeys.roomName);
        const connected = await idb.getItem(DBKeys.connected);

        if (userName && roomName && connected) {
            // in this branch of code after the connect we put the 'appInitialized' setter into the place AFTER we've scrolled to bottom 
            await this.connect(userName, keyPair, roomName);
        }
    }

    restoreSavedValues = async () => {
        // console.log("Restoring saved values from IndexedDB");
        const userName: string= await idb.getItem(DBKeys.userName);
        const contacts: Contact[] = await idb.getItem(DBKeys.contacts);
        const roomName: string = await idb.getItem(DBKeys.roomName);
        const saveToServer: boolean = await idb.getItem(DBKeys.saveToServer, true) === true;
        const daysOfHistory: number = await idb.getItem(DBKeys.daysOfHistory) || 30;
        const roomHistory: RoomHistoryItem[] = await idb.getItem(DBKeys.roomHistory) || [];
        const userDescription: string = await idb.getItem(DBKeys.userDescription);
        const userAvatar: FileBase64Intf = await idb.getItem(DBKeys.userAvatar);
        const headerExpanded: boolean = await idb.getItem(DBKeys.headerExpanded, true) === true;

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

        gd({ type: 'restoreSavedValues', payload: state});
    }
    
    setFullSizeImage = (att: FileBase64Intf | null) => {
        const _gs = gs();
        _gs.fullSizeImage = att ? {src: att.data, name: att.name} : null;
        gd({ type: 'setFullSizeImage', payload: _gs});
    }

    getPageName = (): string => {
        const _gs = gs();
        if (!_gs || !_gs.pages || _gs.pages.length === 0) {
            return PageNames.quantaChat;
        }
        return _gs.pages[_gs.pages.length - 1];
    }

    setTopPage = (gs: GlobalState | null, page: string): Array<string> | undefined => {
        // if the page is NOT already on top of the stack, then push it
        if (this.getPageName() !== page) {
            gs!.pages?.push(page);
        } 
        return gs!.pages;
    }

    goToPage = (page: string) => {
        const _gs = gs();
        this.setTopPage(_gs, page);
        gd({ type: 'setPage', payload: _gs });
    }

    goBack = () => {
        const _gs = gs();
        if (_gs.pages && _gs.pages.length > 1) {
            // Remove the last page from the stack
            _gs.pages.pop();
        }
        gd({ type: 'setPage', payload: _gs });
    }

    saveUserInfo = async (userName: string, userDescription: string, userAvatar: FileBase64Intf | null) => {
        const _gs = gd({ type: `setUserInfo`, payload: { 
            userName, userDescription, userAvatar
        }});
        await idb.setItem(DBKeys.userName, userName);
        await idb.setItem(DBKeys.userDescription, userDescription);
        await idb.setItem(DBKeys.userAvatar, userAvatar);

        // Save user info to server if saving to server is enabled
        if (_gs.saveToServer && _gs.keyPair?.publicKey) {
            try {
                const userProfile: UserProfile = {
                    publicKey: _gs.keyPair!.publicKey,
                    name: userName,
                    description: userDescription,
                    avatar: userAvatar
                };
                await httpClientUtil.secureHttpPost('/api/users/info', _gs.keyPair!, userProfile);
            } catch (error) {
                console.error('Error saving user info to server:', error);
            }
        }
    }

    setSaveToServer  = async (saveToServer: boolean) => {
        this.persistGlobalValue(DBKeys.saveToServer, saveToServer);
        rtc.setSaveToServer(saveToServer);
    }

    setDaysOfHistory  = async (days: number) => {
        this.persistGlobalValue(DBKeys.daysOfHistory, days);
        this.runRoomCleanup();
    }

    // we have this method only for effeciency to do a single state update.
    setRoomAndUserName = async (roomName: string, userName: string, ) => {
        gd({ type: `setRoomAndUser`, payload: { 
            roomName, userName
        }});
        // Save the keyPair to IndexedDB
        await idb.setItem(DBKeys.roomName, roomName);
        await idb.setItem(DBKeys.userName, userName);
    }        

    persistGlobalValue = async (key: string, value: any) => {
        // save to global state
        gd({ type: `persistGlobal-${key}`, payload: { 
            [key]: value
        }});
        // Save the keyPair to IndexedDB
        await idb.setItem(key, value);
    }

    importKeyPair = async () => {
        const _gs = gs();
        if (_gs.keyPair && _gs.keyPair!.publicKey && _gs.keyPair!.privateKey) {
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
        gd({ type: 'importIdentity', payload: { 
            keyPair
        }});
        // Save the keyPair to IndexedDB
        await idb.setItem(DBKeys.keyPair, keyPair);
    }

    createIdentity = async (askFirst: boolean = true) => {
        const _gs = gs();
        // if they already have a keyPair, ask if they want to create a new one
        if (askFirst && _gs.keyPair && _gs.keyPair!.publicKey && _gs.keyPair!.privateKey) {
            if (! await this.confirm("Create new Identity Keys?\n\nWARNING: This will overwrite your existing keys.")) {
                return;
            }
        }

        const keyPair: KeyPairHex= crypt.generateKeypair();
        gd({ type: 'creatIdentity', payload: { 
            keyPair
        }});
        // Save the keyPair to IndexedDB
        await idb.setItem(DBKeys.keyPair, keyPair);
    }

    rtcStateChange = () => {
        const participants = rtc.participants || new Map<string, User>();
        const connected = rtc.connected || false;
        gd({type: 'updateRtcState', 
            payload: { 
                participants,
                connected
            }
        });
    }

    // userName is optional and will default to global state if not provided
    connect = async (userName: string | null, keyPair: KeyPairHex | null, roomName: string) => {
        let _gs = gs();
        userName = userName || _gs.userName!;
        keyPair = keyPair || _gs.keyPair!;

        _gs = gd({ type: 'connect', payload: { 
            connecting: true
        }});

        let messages = await this.loadRoomMessages(roomName);
        messages = await this.resendFailedMessages(roomName, messages);
        const success = await rtc._connect(userName!, keyPair, roomName);
        if (!success) {
            gd({ type: 'connectTooSoon', payload: { 
                connected: false,
                connecting: false
            }});
            return;
        }
        await this.setRoomAndUserName(roomName, userName!);
        
        const roomHistory: RoomHistoryItem[] = await this.updateRoomHistory(roomName);
        gd({ type: 'connect', payload: { 
            userName,
            roomName,
            messages,
            connected: true,
            connecting: false,
            roomHistory,
            pages: this.setTopPage(gs(), PageNames.quantaChat)
        }});
        await idb.setItem(DBKeys.connected, true);

        // DO NOT DELETE
        // Not currently used. We send all directly to server now, in one single call, BUT we may need to do something similar to this for pure P2P in the future.
        // setTimeout(() => {
        //     this.reSendFailedMessages();
        // }, 500);

        console.log("Connected to room: " + roomName);
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
     * Updates just our list of known room names what we maintain a history of 
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

    blockUser = async (publicKey: string) => {
        if (!await this.confirm("Are you sure? This will delete all messages from this user and block them.")) {
            return;
        }
        
        try {
            // Make the secure POST request with body
            const response = await httpClientUtil.secureHttpPost('/api/admin/block-user', gs().keyPair!, {
                pub_key: publicKey.trim()
            });
            await app.alert(`Success: ${response.message}`);
        } catch (error) {
            console.error('Error blocking user:', error);
            await app.alert(`Failed to block user: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } 
    }

    setContacts = (contacts: any) => {
        // Save into global state
        gd({ type: 'setContacts', payload: { contacts }});

        // Save to IndexedDB
        idb.setItem(DBKeys.contacts, contacts);
    }

    setMessages = (messages: ChatMessageIntf[]) => {
        // Save into global state
        gd({ type: 'setMessages', payload: { messages }});

        // Save to IndexedDB
        this.saveMessages(gs().roomName!, messages);
    }

    disconnect = async () => {
        rtc._disconnect();
        gd({ type: 'disconnect', payload: { 
            messages: [], 
            participants: new Map<string, User>(), 
            connected: false, 
        }});
        await idb.setItem(DBKeys.connected, false);
    }

    forgetRoom = async (roomName: string) => {
        if (!await this.confirm("Clear all chat history for room?")) return;
        
        let _gs = gs();
        if (!_gs.connected) {
            console.log("Not connected, cannot clear messages.");
            return;
        }

        // if deleting current room disconnect
        if (roomName===_gs.roomName) {
            await this.disconnect();
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
                        await this.alert('There was a problem sending that last message. The server did not acknowledge acceptance of the message');
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
            await this.pruneDB(msg);
            _gs = gs();
        } catch (error) {
            console.log('Error checking storage or saving message: ' + error);
        }

        _gs = gd({ type: 'persistMessage', payload: _gs});
        this.saveMessages(_gs.roomName!, _gs.messages!);
    }

    setPanelCollapsed = (collapsibleKey: string, isCollapsed: boolean) => {
        // Clone the current set of collapsed panels (or create a new one if it doesn't exist)
        const collapsedPanels = new Set(gs().collapsedPanels || new Set<string>());
    
        if (isCollapsed) {
        // If collapsing, add the key to the set
            collapsedPanels.add(collapsibleKey);
        } else {
        // If expanding, remove the key from the set
            collapsedPanels.delete(collapsibleKey);
        }
        
        // Update the global state with the new set
        gd({ type: 'setPanelCollapsed', payload: { collapsedPanels }});
    }

    addContact = async (user: User) => {
        const _gs = gs();
        if (!_gs.contacts) {
            console.warn('No contacts available to add a new contact');
            return;
        }

        // Check if the user is already in the contacts
        const existingContact = _gs.contacts!.find((contact: Contact) => contact.publicKey === user.publicKey);
        if (existingContact) {
            console.warn('User is already in contacts');
            return;
        }

        // Add the new contact
        _gs.contacts!.push({
            publicKey: user.publicKey,
            alias: user.name,
        });

        await idb.setItem(DBKeys.contacts, _gs.contacts);
        gd({ type: 'addContact', payload: _gs});
    }

    existsInContacts(msg: ChatMessage) {
        if (!gs().contacts) {
            return false;
        }
        return gs().contacts!.some((contact: any) => contact.publicKey === msg.publicKey);
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
                    const _gs = gs();
                    // Sort messages by timestamp and remove oldest 20%
                    _gs.messages!.sort((a: any, b: any) => a.timestamp - b.timestamp);
                    const countToRemove = Math.ceil(_gs.messages!.length * 0.20);
                    _gs.messages = _gs.messages!.slice(countToRemove);

                    // Save the pruned messages
                    this.saveMessages(_gs.roomName!, _gs.messages!);
                    console.log(`Removed ${countToRemove} old messages due to storage constraints`);
                }
            }
        }
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
            const response = await httpClientUtil.secureHttpPost(
                `/api/rooms/${encodeURIComponent(roomName!)}/send-messages`, 
                    gs().keyPair!, 
                    { messages: messagesToSend }
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
                const cleanedSome: boolean = await this.cleanRoomMessages(roomData);
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

    clear = async () => {
        await idb.clear();
        console.log("Cleared IndexedDB");
        // refresh browser page
        window.location.reload();
    }
}

export const app = new AppService();

