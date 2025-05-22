import {DBKeys, PageNames, RoomHistoryItem} from './AppServiceTypes.ts';
import {gd, GlobalState, gs, setApplyStateRules} from './GlobalState.tsx';
import { Contact, FileBase64Intf, KeyPairHex, User } from '../common/types/CommonTypes.ts';
import {idb} from './IndexedDB.ts';
import {rtc} from './WebRTC.ts';
import appMessages from './AppMessages.ts';
import appRooms from './AppRooms.ts';
import appUsers from './AppUsers.ts';

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
            await appUsers.createIdentity(false);
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

    // we have this method only for effeciency to do a single state update.
    setRoomAndUserName = async (roomName: string, userName: string, ) => {
        gd({ type: `setRoomAndUser`, payload: { 
            roomName, userName
        }});
        // Save the keyPair to IndexedDB
        await idb.setItem(DBKeys.roomName, roomName);
        await idb.setItem(DBKeys.userName, userName);
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

    disconnect = async () => {
        rtc._disconnect();
        gd({ type: 'disconnect', payload: { 
            messages: [], 
            participants: new Map<string, User>(), 
            connected: false, 
        }});
        await idb.setItem(DBKeys.connected, false);
    }
}

export const app = new AppService();

