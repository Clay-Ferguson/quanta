import { Response, Request, NextFunction } from 'express';
import { Application } from "express";
import { ANON_USER_ID, UserProfileCompact } from '../common/types/CommonTypes.js';
import { AuthenticatedRequest } from './HttpTypes.js';

export interface IAppContext {
    app: Application; // Express application instance
    serveIndexHtml: (page: string) => (req: Request, res: Response) => void;
}

export function throwError(message: string, response: Response | null = null): never {
    console.error(`${message}`);
    const error = new Error(message);
    (error as any).errorMessage = message; // Custom property to store user-friendly message
    (error as any).logged = true; // Custom property to indicate this error has been logged
    if (response && !response.headersSent && !response.writableEnded) {
        response.status(500);
        response.json({ errorMessage: message });
    }
    throw error;
}

/**
 * Centralized error handling method for all controller endpoints
 * @param error - The error object or message
 * @param res - Express response object
 * @param message - Custom error message to include in the response, that must be appropriate for user to see
 */
export function handleError(error: unknown, res: Response, message: string): any {
    if (error instanceof Error) {
        if (!(error as any).logged) {
            console.error(message, error);
            (error as any).logged = true; // Custom property to indicate this error has been logged
        }
        console.error(message);
    }
        
    // Only set status and send response if it hasn't been sent already and no response is in progress
    if (res && !res.headersSent && !res.writableEnded) {
        res.status(500);
        res.json({ errorMessage: message, error: (error as any).message });
    } else if (res) {
        // Response already sent - this is a critical error that indicates a logic problem
        let errorMessage = 'CRITICAL ERROR: Exception occurred after response was sent to client!\n';
        errorMessage += 'This indicates a logic error in the route handler - all business logic must complete before sending response\n';
        errorMessage += `Response headers sent: ${res.headersSent}\n`;
        errorMessage += `Response finished: ${res.writableEnded}`;
        
        // For development, we might want to crash the process to make this error obvious
        if (process.env.NODE_ENV === 'development') {
            errorMessage += '\nDevelopment mode: This error should be fixed - exceptions must not occur after response is sent';
        }
        
        console.error(errorMessage);
    }

    // return the error in case we want to rethrow.
    return error;
}

/**
 * Async wrapper for Express route handlers to ensure all errors are caught and handled properly
 * This prevents unhandled promise rejections from crashing the server
 * @param fn - The async route handler function
 * @returns Express route handler with error handling
 */
export function asyncHandler(fn: (req: any, res: Response, next?: NextFunction) => Promise<any>) {  
    return (req: any, res: Response, next: NextFunction) => {
        // Log request details only for API endpoints
        if (req.url.startsWith('/api/')) {
            console.log('Request URL:', req.url);
            console.log('Request method:', req.method);
            if (req.body && Object.keys(req.body).length > 0) {
                console.log('Request body:', JSON.stringify(req.body, null, 2));
            }
        }
        
        Promise.resolve(fn(req, res, next)).catch((error) => {
            console.error('ASYNC HANDLER ERROR:', error);
            console.error('Request URL:', req.url);
            console.error('Request method:', req.method);
            
            // Always attempt to send error response - handleError will check if response is already sent
            handleError(error, res, 'An unexpected error occurred');
        });
    };
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

    preProcessHtml(html: string, req: Request): Promise<string>; // Optional method to pre-process HTML content
    runAllTests(): Promise<void>; // Optional method to run plugin-specific tests

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
        let owner_id: number | undefined = ANON_USER_ID;
        if (process.env.POSTGRES_HOST) {
            owner_id = (req as AuthenticatedRequest).userProfile?.id;
            if (!owner_id) {
                res.status(401).json({ error: 'Unauthorized: User profile not found' });
                return null;
            }
        }
        return owner_id;
    }

    public validName(name: string): boolean {
        return /^[a-zA-Z0-9_. \-&]+$/.test(name);
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
        console.log('Initializing plugins (new)...');
        for (const plugin of plugins) {
            try {
                console.log(`plugin: ${plugin.key}`);
                const pluginModule = await import(`../plugins/${plugin.key}/server/plugin.js`);
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
}

/** Singleton instance of ServerUtil for use throughout the application */
export const svrUtil = new ServerUtil();