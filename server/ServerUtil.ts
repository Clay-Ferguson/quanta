import { Response, Request } from 'express';
import { spawn } from 'child_process';
import open from 'open';
import path from 'path';
import { Application } from "express";
import { UserProfileCompact } from '../common/types/CommonTypes.js';

export interface IAppContext {
    app: Application; // Express application instance
    serveIndexHtml: (page: string) => (req: Request, res: Response) => void;
}

export interface AuthenticatedRequest extends Request { 
    userProfile?: UserProfileCompact;
    validSignature?: boolean; // Indicates if the request has a valid signature
}

/**
 * Interface for server plugins that can be loaded and managed by ServerUtil
 */
export interface IServerPlugin {
    /**
     * Initialize the plugin with the given context
     * @param context - Contains app (Express app instance) and serveIndexHtml function
     */
    init(context: IAppContext): void;

    /**
     * Set up fallback routes after all plugins have been initialized
     * @param context - Contains app (Express app instance) and serveIndexHtml function
     */
    finishRoute(context: IAppContext): void;

    /**
     * Notify the plugin that server startup is complete
     * @param server - The server instance (for WebRTC or other server-level operations)
     */
    notify(server: any): Promise<void>;

    // rename to onUserProfileChange
    onCreateNewUser(userProfile: UserProfileCompact): Promise<UserProfileCompact>;
}

/**
 * Utility class for server-side operations including plugin management and error handling
 */
class ServerUtil {
    /** Array of initialized plugin instances implementing IServerPlugin interface */
    pluginsArray: IServerPlugin[] = [];

    /* Gets the appropriate owner_id to use for processing a request and null if we should not process the request */
    public getOwnerId = (req: Request, res: Response): number | null => {
        let owner_id: number | undefined = -1;
        if (process.env.POSTGRES_HOST) {
            owner_id = (req as AuthenticatedRequest).userProfile?.id;
            if (!owner_id) {
                res.status(401).json({ error: 'Unauthorized: User profile not found' });
                return null;
            }
        }
        return owner_id;
    }

    // Split 'fullPath' by '/' and then run 'validName' on each part or if there's no '/' just run 'validName' on the fullPath
    public validPath(fullPath: string): boolean {
        // Normalize the path to ensure consistent formatting
        fullPath = this.normalizePath(fullPath);

        // Split the path by '/' and check each part
        const parts = fullPath.split('/');
        for (const part of parts) {
            if (!this.validName(part)) {
                return false; // If any part is invalid, return false
            }
        }
        return true; // All parts are valid
    }

    // todo-0: need to be calling this to check all IFS/VFS 'file/folder' creates and renames
    public validName(name: string): boolean {
        return /^[a-zA-Z0-9_. -]+$/.test(name);
    }

    public pathJoin(...parts: string[]): string {
        return this.normalizePath(parts.join('/'));
    }
    
    public getFilenameExtension(fullPath: string): string {
        // All we do is find the last dot and return the subtring including the dot.
        const lastDotIndex = fullPath.lastIndexOf('.');
        if (lastDotIndex === -1 || lastDotIndex === fullPath.length - 1) {
            // No extension found or dot is the last character
            return '';
        }
        return fullPath.substring(lastDotIndex);
    }

    /* Removes leading slashes and dots and replaces multiple slashes with a single slash */
    public normalizePath(fullPath: string): string {
        // use regex to strip any leading slashes or dots
        const normalizedPath = 
            // strip any leading slashes or dots
            fullPath.replace(/^[/.]+/, '')
                // replace multiple slashes with a single slash
                .replace(/\/+/g, '/')
                // final replacement to ensure no trailing slash
                .replace(/\/+$/, '');

        return normalizedPath;
    }

    /**
     * Retrieves and validates an environment variable
     * @param name - The name of the environment variable to retrieve
     * @returns The value of the environment variable
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
    initPlugins = async (plugins: any, context: IAppContext) => {
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
                    await pluginInst.init(context); // Initialize the plugin
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
     * @param context - Context object passed to each plugin's finishRoute method
     */
    finishRoutes = async (context: IAppContext) => {
        console.log('Finishing plugin routes...');
        for (const plugin of this.pluginsArray) {
            plugin.finishRoute(context);
        }
    }

    onCreateNewUser = async (userProfile: UserProfileCompact) => {
        console.log('Notify plugins of onCreateNewUser...');
        for (const plugin of this.pluginsArray) {
            userProfile = await plugin.onCreateNewUser(userProfile);
        }
        return userProfile; // Return the [potentially] modified user profile after all plugins have processed it
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
                    await pluginInstance.notify(context);
                } else {
                    console.warn(`Plugin instance does not have a notify method.`);
                }
            } catch (error) {
                console.error(`Error notifying plugin:`, error);
            }
        }
    }

    runAdminCommand = async (req: Request, res: Response): Promise<void> => {
        try {
            const item = req.body;
            console.log('Received command from client:');
            console.log(JSON.stringify(item, null, 2));

            if (item.cmd && item.args) {     
                const env = { ...process.env, DISPLAY: ":0" }; // Ensure the correct display is set (Linux-specific)          
                // Check if the _args contains spaces
                if (item.args.includes(" ")) {
                // Split the _args into a list
                    item.args = item.args.split(" ");
                    // Run the command with the arguments as a list
                    spawn(item.cmd, item.args, { detached: true, stdio: 'ignore', env: env });
                } else {
                    spawn(item.cmd, [item.args], { detached: true, stdio: 'ignore', env: env });
                }
            }
            else if (item.bash) {
                this.run_bash(item.bash, "", !!item.background);
            }
            else if (item.link) {
                if (item.link.startsWith("http:") || item.link.startsWith("https:") || item.link.startsWith("file:")) {
                    open(item.link);
                }
            }
            
            // For now, just pretty print the item object and return success
            res.json({ 
                success: true, 
                message: `Command received: ${item.cmd}`,
                item: item
            });
        } catch (error) {
            this.handleError(error, res, 'Error processing admin command');
        }
    }

    run_bash = (file_name: string, args: any, background: boolean) => {
        const folder = path.dirname(file_name);
        if (background) {
            spawn(file_name, args ? args.split(" ") : [], {
                cwd: folder,
                detached: true,
                stdio: 'ignore',
                shell: true
            });
        } else {
            spawn('gnome-terminal', ['--', 'bash', '-c', `${file_name} ${args} || bash`], {
                cwd: folder,
                detached: true,
                stdio: 'ignore',
                shell: true
            });
        }
    }
}

/** Singleton instance of ServerUtil for use throughout the application */
export const svrUtil = new ServerUtil();