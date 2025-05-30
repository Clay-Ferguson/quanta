import { Response } from 'express';

class ServerUtil {
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
}

export const svrUtil = new ServerUtil();