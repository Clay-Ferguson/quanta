import {DBKeys, PageNames, RoomHistoryItem} from './AppServiceTypes.ts';
import {gd, GlobalState, gs, setApplyStateRules} from './GlobalState.tsx';
import { Contact, FileBase64Intf, KeyPairHex } from '../common/types/CommonTypes.ts';
import {idb} from './IndexedDB.ts';
import appUsers from './AppUsers.ts';

// Vars are injected directly into HTML by server
declare const PLUGINS: string;
export const pluginsArray: any[] = [];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare let DOC_ROOT_KEY: string;

/**
 * Main application service that manages the lifecycle and state of the Quanta Chat application.
 * Handles initialization, connection management, page navigation, and state persistence.
 */
export class AppService {
    /**
     * Number of times the user has pressed 'd' key while on settings page, without a rerender. 
     * Three presses triggers dev mode, which gives the settings page a link to show logs.
     */
    dCount = 0;

    /**
     * Initializes the AppService, setting up IndexedDB, WebRTC connection, and application state.
     * Restores saved values, loads user identity, and sets up event listeners.
     * Runs room cleanup after initialization.
     */
    async init() {
        console.log("Quanta Chat AppService init");
        setApplyStateRules(this.applyStateRules);
        await idb.init("quantaChatDB", "quantaChatStore", 1);
        await this.initPlugins();
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
        window.addEventListener('keydown', this.handleKeyDown);
        this.notifyPlugins();
    }

    initPlugins = async () => {
        const initGs: GlobalState = {};
        // parse PLUGINS into string array
        const plugins: string[] = PLUGINS ? PLUGINS.split(',') : [];
        console.log('Initializing plugins...');
        for (const plugin of plugins) {
            try {
                console.log(`plugin: ${plugin}`);
                const pluginModule = await import(`./plugins/${plugin}/init.ts`);
                pluginsArray.push(pluginModule);
                if (pluginModule.init) {
                    pluginModule.init({idb, initGs});
                } else {
                    console.warn(`Plugin ${plugin} does not have an init function.`);
                }
            } catch (error) {
                console.error(`Error initializing plugin ${plugin}:`, error);
            }
        }
        gd({ type: 'PluginStatesInitialized', payload: initGs});
    }

    notifyPlugins = async () => {
        // parse PLUGINS into string array
        const plugins: string[] = PLUGINS ? PLUGINS.split(',') : [];
        console.log('Notifying plugins...');
        for (const plugin of plugins) {
            try {
                console.log(`notify plugin: ${plugin}`);
                const pluginModule = await import(`./plugins/${plugin}/init.ts`);
                if (pluginModule.notify) {
                    pluginModule.notify();
                } else {
                    console.warn(`Plugin ${plugin} does not have a notify function.`);
                }
            } catch (error) {
                console.error(`Error initializing plugin ${plugin}:`, error);
            }
        }
    }

    /**
     * Handles keyboard events, specifically the 'd' key press on the settings page.
     * Three consecutive 'd' presses enable developer mode.
     * @param event - The keyboard event containing the key information
     */
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

    /**
     * Global hook that applies final state alterations across all state updates.
     * Resets the 'd' key counter and ensures header is expanded when not connected.
     * @param gs - The global state object to modify
     */
    applyStateRules = (gs: GlobalState) => {
        this.dCount = 0;
        // If not connected show the header to user cannot get confused/lost
        if (!gs.chatConnected) {
            gs.headerExpanded = true;
        }
    }

    /**
     * Restores all saved user preferences and application state from IndexedDB.
     * Loads user profile, contacts, room history, and settings.
     * Redirects to settings page if no username is found.
     */
    restoreSavedValues = async () => {
        // console.log("Restoring saved values from IndexedDB");
        const userName: string= await idb.getItem(DBKeys.userName);
        const chatContacts: Contact[] = await idb.getItem(DBKeys.chatContacts);
        const chatRoom: string = await idb.getItem(DBKeys.chatRoom);
        const saveToServer: boolean = await idb.getItem(DBKeys.saveToServer, true) === true;
        const daysOfHistory: number = await idb.getItem(DBKeys.daysOfHistory) || 30;
        const roomHistory: RoomHistoryItem[] = await idb.getItem(DBKeys.roomHistory) || [];
        const userDescription: string = await idb.getItem(DBKeys.userDescription);
        const userAvatar: FileBase64Intf = await idb.getItem(DBKeys.userAvatar);
        const headerExpanded: boolean = await idb.getItem(DBKeys.headerExpanded, true) === true;
        const docsViewWidth: 'narrow' | 'medium' | 'wide' = await idb.getItem(DBKeys.docsViewWidth, 'medium');
        const docsEditMode: boolean = await idb.getItem(DBKeys.docsEditMode, false) === true;
        const docsMetaMode: boolean = await idb.getItem(DBKeys.docsMetaMode, false) === true;
        const docsNamesMode: boolean = await idb.getItem(DBKeys.docsNamesMode, false) === true;

        const state: GlobalState = {
            userName,
            chatContacts,
            chatRoom,
            saveToServer,
            daysOfHistory,
            roomHistory,
            userDescription,
            userAvatar,
            headerExpanded,
            docsViewWidth,
            docsEditMode,
            docsMetaMode,
            docsNamesMode,
        };

        // if no username we send to settings page.
        if (!userName) {
            state.pages?.push(PageNames.settings);
        }
        gd({ type: 'restoreSavedValues', payload: state});
    }

    /**
     * Gets the name of the currently active page from the page stack.
     * Returns the default QuantaChat page if no pages are in the stack.
     * @returns The name of the current page
     */
    getPageName = (): string => {
        const _gs = gs();
        if (!_gs || !_gs.pages || _gs.pages.length === 0) {
            return PageNames.quantaChat;
        }
        return _gs.pages[_gs.pages.length - 1];
    }

    /**
     * Sets the specified page as the top page in the navigation stack.
     * Only pushes the page if it's not already at the top of the stack.
     * @param gs - The global state object containing the page stack
     * @param page - The name of the page to set as the top page
     * @returns The updated pages array
     */
    setTopPage = (gs: GlobalState | null, page: string): Array<string> | undefined => {
        // if the page is NOT already on top of the stack, then push it
        if (this.getPageName() !== page) {
            gs!.pages?.push(page);
        } 
        return gs!.pages;
    }

    /**
     * Navigates to the specified page by updating the global state.
     * @param page - The name of the page to navigate to
     */
    goToPage = (page: string) => {
        const _gs = gs();
        this.setTopPage(_gs, page);
        gd({ type: 'setPage', payload: _gs });
    }

    showHelp = () => {
        const _gs = gs();
        this.setTopPage(_gs, PageNames.treeViewer);
        _gs.docsFolder = "/";
        DOC_ROOT_KEY = "user-guide"; // Ensure DOC_ROOT_KEY is set for user guide
        gd({ type: 'setPage', payload: _gs });
    }
}

export const app = new AppService();

