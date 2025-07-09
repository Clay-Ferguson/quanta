import {DBKeys, IClientPlugin, PageNames} from './AppServiceTypes.ts';
import {gd, GlobalState, gs, setApplyStateRules} from './GlobalState.tsx';
import {FileBase64Intf, KeyPairHex } from '../common/types/CommonTypes.ts';
import {idb} from './IndexedDB.ts';
import appUsers from './AppUsers.ts';
import { httpClientUtil } from './HttpClientUtil.ts';

// Vars are injected directly into HTML by server
declare const PLUGINS: string;
declare const DEFAULT_PLUGIN: string;

/**
 * Global array containing all loaded plugin instances.
 * Populated during the loadPlugins() phase of application initialization.
 */
export const pluginsArray: IClientPlugin[] = [];
export let signedArgs = {args: null}; 

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
            console.warn('No keyPair found in IndexedDB, creating a new identity.');
            await appUsers.createIdentity(false);
        }
        else {
            console.log('KeyPair loaded from IndexedDB:', keyPair);
            gd({ type: 'setIdentity', payload: { 
                keyPair
            }});
        }

        // Create signedArgs which allows secure 'gets' and then use 'setInterval' to update it every 4 minutes
        signedArgs = await httpClientUtil.makeSignedArgs();
        setInterval(() => {
            httpClientUtil.makeSignedArgs().then(args => {
                signedArgs = args;
            }).catch(error => {
                console.error('Error updating signedArgs:', error);
            });
        }, 4 * 60 * 1000); // Update every 4 minutes

        gd({ type: 'setAppInitialized', payload: { 
            appInitialized: true
        }});
        window.addEventListener('keydown', this.handleKeyDown);
        this.callPlugins('notify');
    }

    /**
     * Dynamically loads all plugins specified in the PLUGINS environment variable.
     * Prevents duplicate loading by checking if plugins are already initialized.
     * Each plugin is imported from its respective directory and added to the global pluginsArray.
     * @returns Promise that resolves when all plugins have been loaded
     */
    loadPlugins = async () => {
        if (pluginsArray.length > 0) {
            console.warn('Plugins have already been initialized. Skipping initialization.');
            return;
        }
        const plugins: string[] = PLUGINS ? PLUGINS.split(',') : [];
        console.log('Loading plugins...');
        for (const plugin of plugins) {
            try {
                console.log(`load plugin: ${plugin}`);
                const pluginModule = await import(`./plugins/${plugin}/init.ts`);
                pluginsArray.push(pluginModule.plugin);
            } catch (error) {
                console.error(`Error loading plugin ${plugin}:`, error);
            }
        }
    }

    /**
     * Retrieves the default plugin as specified in the DEFAULT_PLUGIN environment variable.
     * The default plugin is typically used as the primary interface when the application starts.
     * @returns The default plugin instance, or null if not found or not configured
     */
    getDefaultPlugin = () => {
        const defaultPlutin = this.getPluginByName(DEFAULT_PLUGIN) || null;
        if (!defaultPlutin) {
            console.error(`Default plugin "${DEFAULT_PLUGIN}" not found.`);
            return null;
        }
        return defaultPlutin;
    }

    /**
     * Finds and returns a plugin by its unique key/name.
     * Each plugin implements a getKey() method that returns its identifier.
     * @param name - The unique key/name of the plugin to retrieve
     * @returns The plugin instance with the specified name, or null if not found
     */
    getPluginByName = (name: string) => {
        const plugin = pluginsArray.find(p => p.getKey() === name);
        if (!plugin) {
            console.warn(`Plugin ${name} not found.`);
            return null;
        }
        return plugin;
    }

    /**
     * Invokes a specific method on all loaded plugins with an optional payload.
     * This is the primary mechanism for plugin communication and lifecycle management.
     * Safely handles plugins that don't implement the requested method.
     * @param callback - The name of the method to call on each plugin
     * @param payload - Optional data to pass to each plugin method (defaults to null)
     * @returns Promise that resolves when all plugin methods have been called
     */
    callPlugins = async (callback: string, payload: any = null) => {
        for (const plugin of pluginsArray) {
            const func = (plugin as any)[callback];
            try {
                if (!func || typeof func !== 'function') {
                    console.warn(`Plugin ${plugin.getKey()} does not have a method ${callback}.`);
                    continue;
                }
                // console.log(`Calling plugin method: ${callback}`);
                await func(payload);
            } catch (error) {
                console.error(`Error calling plugin method ${callback} on plugin ${plugin.getKey()}:`, error);
            }
        }
    }

    /**
     * Initializes all loaded plugins by calling their init method.
     * Provides each plugin with access to IndexedDB and a shared initial GlobalState object.
     * The collected plugin states are then merged into the global application state.
     * @returns Promise that resolves when all plugins have been initialized
     */
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
        const name: string= await idb.getItem(DBKeys.userName);
        const description: string = await idb.getItem(DBKeys.userDescription);
        const avatar: FileBase64Intf = await idb.getItem(DBKeys.userAvatar);
        const keyPair: KeyPairHex = await idb.getItem(DBKeys.keyPair);
        const headerExpanded: boolean = await idb.getItem(DBKeys.headerExpanded, true) === true;

        const state: GlobalState = {
            userProfile: {
                name: name || '',
                publicKey: keyPair?.publicKey || '',
                description: description || '',
                avatar,
            },
            headerExpanded
        };

        await this.callPlugins('restoreSavedValues', state);
        gd({ type: 'restoreSavedValues', payload: state});
    }

    /**
     * Gets the name of the currently active page from the page stack.
     * Returns null if no pages are in the stack or if the global state is not available.
     * @returns The name of the current page, or null if no active page
     */
    getPageName = (): string | null => {
        const _gs = gs();
        if (!_gs || !_gs.pages || _gs.pages.length === 0) {
            return null;
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
}

/**
 * Singleton instance of the AppService that manages the entire application lifecycle.
 * This is the main entry point for all application operations and state management.
 */
export const app = new AppService();

