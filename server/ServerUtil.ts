import { Response } from 'express';

export interface IServerPlugin {
    /**
     * Initialize the plugin with the given context
     * @param context - Contains app (Express app instance) and serveIndexHtml function
     */
    init(context: any): void;

    /**
     * Set up fallback routes after all plugins have been initialized
     * @param context - Contains app (Express app instance) and serveIndexHtml function
     */
    finishRoute(context: any): void;

    /**
     * Notify the plugin that server startup is complete
     * @param server - The server instance (for WebRTC or other server-level operations)
     */
    notify(server: any): void;
}

class ServerUtil {
    pluginsArray: IServerPlugin[] = [];

    getEnvVar = (name: string): string => {
        const value = process.env[name];
        if (!value) {
            throw new Error(`Environment variable ${name} is not set`);
        }
        else {
            console.log(`ENV VAR: ${name}==[${value}]`);
        }
        return value;
    }
    /**
     * Centralized error handling method for all controller endpoints
     * @param error - The error object or message
     * @param res - Express response object
     * @param message - Custom error message to include in the response
     */
    handleError = (error: unknown, res: Response, message: string): void => {
        console.error(`ERROR: ${message}`, error);
        res.status(500).json({ error: message });
    }

    initPlugins = async (plugins: any, context: any) => {
        if (this.pluginsArray.length > 0) {
            console.warn('Plugins have already been initialized. Skipping initialization.');
            return;
        }
        console.log('Initializing plugins...');
        for (const plugin of plugins) {
            try {
                console.log(`plugin: ${plugin.key}`);
                const pluginModule = await import(`../server/plugins/${plugin.key}/init.js`);
                const pluginInst = pluginModule.plugin;
                if (pluginInst) {
                    pluginInst.init(context); // Initialize the plugin
                    this.pluginsArray.push(pluginInst); // Cache the plugin instance
                } else {
                    console.warn(`Plugin ${plugin.key} does not have a plugin instance with init method.`);
                }
            } catch (error) {
                console.error(`Error initializing plugin ${plugin.key}:`, error);
            }
        }
    }

    // Now uses the cached pluginsArray with proper plugin instances
    finishRoutes = async (plugins: any, context: any) => {
        console.log('Finishing plugin routes...');
        for (const plugin of this.pluginsArray) {
            plugin.finishRoute(context);
        }
    }

    // Now uses the cached pluginsArray with proper plugin instances
    // Currently this is only called by server and 'context' is the server instance.
    notifyPlugins = async (plugins: any, context: any) => {
        console.log('Notify plugins startup is complete...');
        for (const pluginInstance of this.pluginsArray) {
            try {
                if (pluginInstance.notify) {
                    pluginInstance.notify(context);
                } else {
                    console.warn(`Plugin instance does not have a notify method.`);
                }
            } catch (error) {
                console.error(`Error notifying plugin:`, error);
            }
        }
    }
}

export const svrUtil = new ServerUtil();