import {util} from './Util.js';
import {DBKeys, PageNames, RoomHistoryItem} from './AppServiceTypes.ts';
import {gd, GlobalState, gs, setApplyStateRules} from './GlobalState.tsx';
import {crypt} from '../common/Crypto.ts';  
import { ChatMessage, Contact, FileBase64Intf, KeyPairHex, User, UserProfile } from '../common/types/CommonTypes.ts';
import { httpClientUtil } from './HttpClientUtil.ts';
import {idb} from './IndexedDB.ts';
import {rtc} from './WebRTC.ts';
import { BlockUser_Request } from '../common/types/EndpointTypes.ts';
import { confirmModal } from './components/ConfirmModalComp.tsx';
import { promptModal } from './components/PromptModalComp.tsx';
import { alertModal } from './components/AlertModalComp.tsx';
import appMessages from './AppMessages.ts';
import appRooms from './AppRooms.ts';

// Vars are injected diretly into HTML by server
declare const HOST: string;
declare const PORT: string;
declare const SECURE: string;

export class AppService {
    // number of times the user has pressed 'd' key, while on settings page, without a rerender. Three presses triggers dev mode,
    // which essentially just give the settings page a link to show logs.
    dCount = 0;

    // Initializes the AppService, setting up the IndexedDB and WebRTC connection.
    async init() {
        console.log("Quanta Chat AppService init");
        setApplyStateRules(this.applyStateRules);
        await idb.init("quantaChatDB", "quantaChatStore", 1);
        const saveToServer = await idb.getItem(DBKeys.saveToServer, true);
        rtc.init(HOST, PORT, SECURE==='y', saveToServer);
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
            appRooms.runRoomCleanup();
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

    showUserProfile = async (publicKey: string) => {
        // set page to userprofile 
        const _gs = gs();
        this.setTopPage(_gs, PageNames.userProfile);
        _gs.userProfile = {name: '', publicKey, description: '', avatar: null};
        gd({ type: 'setUserProfile', payload: _gs});
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
            const userProfile: UserProfile = {
                publicKey: _gs.keyPair!.publicKey,
                name: userName,
                description: userDescription,
                avatar: userAvatar
            };
            await httpClientUtil.secureHttpPost<UserProfile, any>('/api/users/info', userProfile);
        }
    }

    setSaveToServer  = async (saveToServer: boolean) => {
        this.persistGlobalValue(DBKeys.saveToServer, saveToServer);
        rtc.setSaveToServer(saveToServer);
    }

    setDaysOfHistory  = async (days: number) => {
        this.persistGlobalValue(DBKeys.daysOfHistory, days);
        appRooms.runRoomCleanup();
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
            if (!await confirmModal("Are you sure? This will overwrite your existing key pair.")) {
                return;
            }
        }
        const privateKey = await promptModal("Enter Private Key");
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
            if (! await confirmModal("Create new Identity Keys?\n\nWARNING: This will overwrite your existing keys.")) {
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

        let messages = await appMessages.loadRoomMessages(roomName);
        messages = await appMessages.resendFailedMessages(roomName, messages);
        const success = await rtc._connect(userName!, keyPair, roomName);
        if (!success) {
            gd({ type: 'connectTooSoon', payload: { 
                connected: false,
                connecting: false
            }});
            return;
        }
        await this.setRoomAndUserName(roomName, userName!);
        
        const roomHistory: RoomHistoryItem[] = await appRooms.updateRoomHistory(roomName);
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

    blockUser = async (publicKey: string) => {
        if (!await confirmModal("Are you sure? This will delete all messages from this user and block them.")) {
            return;
        }
        
        // Make the secure POST request with body
        const response = await httpClientUtil.secureHttpPost<BlockUser_Request, any>('/api/admin/block-user', {
            publicKey: publicKey.trim()
        });
        if (response) {
            await alertModal(`Success: ${response.message}`);
        }
    }

    setContacts = (contacts: any) => {
        // Save into global state
        gd({ type: 'setContacts', payload: { contacts }});

        // Save to IndexedDB
        idb.setItem(DBKeys.contacts, contacts);
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

                if (await confirmModal(warningMsg)) {
                    const _gs = gs();
                    // Sort messages by timestamp and remove oldest 20%
                    _gs.messages!.sort((a: any, b: any) => a.timestamp - b.timestamp);
                    const countToRemove = Math.ceil(_gs.messages!.length * 0.20);
                    _gs.messages = _gs.messages!.slice(countToRemove);

                    // Save the pruned messages
                    appMessages.saveMessages(_gs.roomName!, _gs.messages!);
                    console.log(`Removed ${countToRemove} old messages due to storage constraints`);
                }
            }
        }
    }

    clear = async () => {
        await idb.clear();
        console.log("Cleared IndexedDB");
        // refresh browser page
        window.location.reload();
    }
}

export const app = new AppService();

