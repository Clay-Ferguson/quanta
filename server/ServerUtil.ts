import { Response } from 'express';

class ServerUtil {
    pluginsArray: any[] = [];

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
                if (pluginModule.init) {
                    pluginModule.init(context); // Initialize the plugin
                } else {
                    console.warn(`Plugin ${plugin} does not have an init function.`);
                }
                this.pluginsArray.push(pluginModule);
            } catch (error) {
                console.error(`Error initializing plugin ${plugin}:`, error);
            }
        }
    }

    // todo-0: this needs to use the cached pluginsArray rather than re-importing the modules.
    finishRoutes = async (plugins: any, context: any) => {
        console.log('Finishing plugin routes...');
        for (const plugin of plugins) {
            try {
                console.log(`plugin: ${plugin.key}`);
                const pluginModule = await import(`../server/plugins/${plugin.key}/init.js`);
                if (pluginModule.finishRoute) {
                    pluginModule.finishRoute(context); // Initialize the plugin
                } else {
                    console.warn(`Plugin ${plugin} does not have an init function.`);
                }
            } catch (error) {
                console.error(`Error initializing plugin ${plugin}:`, error);
            }
        }
    }

    // todo-0: this needs to use the cached pluginsArray rather than re-importing the modules.
    // Currently this is only called by server and 'context' is the server instance.
    notifyPlugins = async (plugins: any, context: any) => {
        console.log('Notify plugins startup is complete...');
        for (const plugin of plugins) {
            try {
                console.log(`notify plugin: ${plugin.key}`);
                const pluginModule = await import(`../server/plugins/${plugin.key}/init.js`);
                if (pluginModule.notify) {
                    pluginModule.notify(context); // Initialize the plugin
                } else {
                    console.warn(`Plugin ${plugin} does not have an init function.`);
                }
            } catch (error) {
                console.error(`Error initializing plugin ${plugin}:`, error);
            }
        }
    }
}

export const svrUtil = new ServerUtil();