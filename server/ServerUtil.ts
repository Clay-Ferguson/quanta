import { Response } from 'express';

class ServerUtil {
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