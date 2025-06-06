import {DBKeys, PageNames} from './AppServiceTypes.ts';
import {gd, GlobalState, gs, setApplyStateRules} from './GlobalState.tsx';
import {FileBase64Intf, KeyPairHex } from '../common/types/CommonTypes.ts';
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
        await this.loadPlugins();
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
        this.callPlugins('notify');
    }

    loadPlugins = async () => {
        const plugins: string[] = PLUGINS ? PLUGINS.split(',') : [];
        console.log('Loading plugins...');
        for (const plugin of plugins) {
            try {
                console.log(`load plugin: ${plugin}`);
                const pluginModule = await import(`./plugins/${plugin}/init.ts`);
                pluginsArray.push(pluginModule);
            } catch (error) {
                console.error(`Error loading plugin ${plugin}:`, error);
            }
        }
    }

    callPlugins = async (callback: string, payload: any = null) => {
        for (const plugin of pluginsArray) {
            try {
                if (!plugin[callback]) {
                    console.warn(`Plugin ${plugin.name} does not have a method ${callback}.`);
                    continue;
                }
                console.log(`Calling plugin method: ${callback}`);
                await plugin[callback](payload);
            } catch (error) {
                console.error(`Error calling plugin method ${callback}:`, error);
            }
        }
    }

    initPlugins = async () => {
        const initGs: GlobalState = {};
        await this.callPlugins('init', {idb, initGs});
        gd({ type: 'PluginStatesInitialized', payload: initGs});
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
    applyStateRules = async (gs: GlobalState) => {
        this.dCount = 0;
        // If not connected show the header to user cannot get confused/lost
        await app.callPlugins('applyStateRules', gs);
    }

    /**
     * Restores all saved user preferences and application state from IndexedDB.
     * Loads user profile, contacts, room history, and settings.
     * Redirects to settings page if no username is found.
     */
    restoreSavedValues = async () => {
        // console.log("Restoring saved values from IndexedDB");
        const userName: string= await idb.getItem(DBKeys.userName);
        const userDescription: string = await idb.getItem(DBKeys.userDescription);
        const userAvatar: FileBase64Intf = await idb.getItem(DBKeys.userAvatar);
        const headerExpanded: boolean = await idb.getItem(DBKeys.headerExpanded, true) === true;

        const state: GlobalState = {
            userName,
            userDescription,
            userAvatar,
            headerExpanded
        };

        // if no username we send to settings page.
        if (!userName) {
            state.pages?.push(PageNames.settings);
        }
        await this.callPlugins('restoreSavedValues', state);
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
        
        // todo-0: this is a hack because we need a better plugin-speific typed way to do this.
        (_gs as any).docsFolder = "/";

        DOC_ROOT_KEY = "user-guide"; // Ensure DOC_ROOT_KEY is set for user guide
        gd({ type: 'setPage', payload: _gs });
    }
}

export const app = new AppService();

