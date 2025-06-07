import { Response } from 'express';

/**
 * Interface for server plugins that can be loaded and managed by ServerUtil
 */
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

/**
 * Utility class for server-side operations including plugin management and error handling
 */
class ServerUtil {
    /** Array of initialized plugin instances implementing IServerPlugin interface */
    pluginsArray: IServerPlugin[] = [];

    /**
     * Retrieves and validates an environment variable
     * @param name - The name of the environment variable to retrieve
     * @returns The value of the environment variable
     * @throws Error if the environment variable is not set
     */
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

    /**
     * Initialize all plugins by loading them from their respective directories
     * Skips initialization if plugins have already been loaded to prevent duplicate initialization
     * @param plugins - Array of plugin configurations containing plugin keys
     * @param context - Context object passed to each plugin's init method (typically contains Express app instance)
     */
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

    /**
     * Finish route setup for all initialized plugins
     * This method is called after all plugins have been initialized to allow them to set up fallback routes
     * @param plugins - Array of plugin configurations (unused, method uses cached pluginsArray)
     * @param context - Context object passed to each plugin's finishRoute method
     */
    finishRoutes = async (plugins: any, context: any) => {
        console.log('Finishing plugin routes...');
        for (const plugin of this.pluginsArray) {
            plugin.finishRoute(context);
        }
    }

    /**
     * Notify all initialized plugins that server startup is complete
     * This method is typically called by the server after full initialization
     * @param plugins - Array of plugin configurations (unused, method uses cached pluginsArray)
     * @param context - Server instance or context object passed to each plugin's notify method
     */
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

/** Singleton instance of ServerUtil for use throughout the application */
export const svrUtil = new ServerUtil();