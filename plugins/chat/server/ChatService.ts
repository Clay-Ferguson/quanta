import { FileBlob } from "../../../common/types/CommonTypes.js";
import { dbRoom } from "./db/DBRoom.js";
import { dbMessages } from "./db/DBMessages.js";
import { dbAttachments } from "./db/DBAttachments.js";
import { dbUsers } from "../../../server/DBUsers.js";
import { rtc } from './WebRTCServer.js';
import { Request, Response } from 'express';
import { BlockUser_Request, DeleteMessage_Request, DeleteRoom_Response, DeleteRoom_Request, GetMessageHistory_Response, GetMessageIdsForRoom_Response, GetMessagesByIds_Response, GetMessagesByIds_Request, GetRecentAttachments_Response, GetRoomInfo_Response, SendMessages_Request } from "../../../common/types/EndpointTypes.js";
import { handleError } from "../../../server/ServerUtil.js";
import { config } from "../../../server/Config.js";

const ADMIN_PUBLIC_KEY = config.get("adminPublicKey");

/**
 * Main service class that handles all HTTP API endpoints for the QuantaChat application.
 * Provides methods for managing rooms, messages, attachments, users, and administrative functions.
 */
class ChatService {
    /**
     * API handler for getting all message IDs for a specific room with optional date filtering
     * @param req - Express request object containing roomId in params and optional daysOfHistory query parameter
     * @param res - Express response object
     */
    getMessageIdsForRoom = async (req: Request<{ roomId: string }, any, any, { daysOfHistory?: string }>, res: Response): Promise<void> => {
        console.log('Received request to get message IDs for room:', req.params?.roomId);
        try {
            const roomId = req.params?.roomId;
            if (!roomId) {
                res.status(400).json({ error: 'Room ID is required' });
                return;
            }
                
            // Parse daysOfHistory parameter
            let historyDays = parseInt(req.query.daysOfHistory as string) || Number.MAX_SAFE_INTEGER;
            if (historyDays < 2) {
                historyDays = 2; // Ensure at least 2 days of history
            }
                
            // Calculate cutoff timestamp in milliseconds
            const millisecondsPerDay = 24 * 60 * 60 * 1000;
            const currentTime = Date.now();
            const cutoffTimestamp = currentTime - (historyDays * millisecondsPerDay);
                
            const messageIds = await dbMessages.getMessageIdsForRoomWithDateFilter(roomId, cutoffTimestamp);
            const ret: GetMessageIdsForRoom_Response = {messageIds}
            res.json(ret);
        } catch (error) {
            handleError(error, res, 'Failed to retrieve message IDs');
        }
    }

    /**
     * Serves attachment files by their ID, returning the binary data with appropriate headers
     * @param req - Express request object containing attachmentId in params
     * @param res - Express response object
     */
    serveAttachment = async (req: Request<{ attachmentId: string }>, res: Response): Promise<void> => {
        try {
            const attachmentId = parseInt(req.params.attachmentId);
            if (isNaN(attachmentId)) {
                res.status(400).send('Invalid attachment ID');
                return;
            }
                    
            const attachment: FileBlob | null = await dbAttachments.getAttachmentById(attachmentId); 
                    
            if (!attachment) {
                res.status(404).send('Attachment not found');
                return;
            }
                    
            // Set the appropriate content type
            res.set('Content-Type', attachment.type);

            // Set the Content-Length header using the size property
            res.set('Content-Length', attachment.size.toString());
                    
            // Set content disposition for downloads (optional)
            res.set('Content-Disposition', `inline; filename="${attachment.name}"`);
                    
            // Send the binary data
            res.send(attachment.data);
        } catch (error) {
            handleError(error, res, 'Failed to retrieve attachment'); 
        }
    }
    
    /**
     * Retrieves message history for a specific room with pagination support
     * @param req - Express request object with query parameters: roomName (required), limit (optional), offset (optional)
     * @param res - Express response object
     */
    getMessageHistory = async (req: Request<any, any, any, { roomName?: string, limit?: string, offset?: string }>, res: Response): Promise<void> => {
        const { roomName, limit, offset } = req.query;
            
        if (!roomName) {
            res.status(400).json({ error: 'Room name is required' });
            return;
        }
            
        try {
            const messages = await dbMessages.getMessagesForRoom(
                roomName,
                limit ? parseInt(limit) : 100,
                offset ? parseInt(offset) : 0
            );
             
            const response: GetMessageHistory_Response = {messages};
            res.json(response);
        } catch (error) {
            handleError(error, res, 'Failed to retrieve message history');
        }
    } 

    /**
     * Administrative endpoint to retrieve information about all rooms in the system
     * @param req - Express request object
     * @param res - Express response object
     */
    getRoomInfo = async (req: Request, res: Response): Promise<void> => {
        try {
            console.log('Admin request: Getting room information');
            const rooms = await dbRoom.getAllRoomsInfo();
            const response: GetRoomInfo_Response = { rooms };
            res.json(response);
        } catch (error) {
            handleError(error, res, 'Failed to retrieve room information');
        }
    }

    /**
     * Administrative endpoint to delete a room by name
     * @param req - Express request object containing DeleteRoom_Request in body
     * @param res - Express response object
     */
    deleteRoom = async (req: Request<any, any, DeleteRoom_Request>, res: Response): Promise<void> => {
        try {
            const { roomName } = req.body;
            
            if (!roomName) {
                res.status(400).json({ 
                    error: 'Room name is required' 
                });
                return;
            }
            
            console.log('Admin request: Deleting room:', roomName);
            const success = await dbRoom.deleteRoom(roomName);
            
            if (success) {
                const response: DeleteRoom_Response = { message: `Room "${roomName}" deleted successfully` };
                res.json(response);
            } else {
                res.status(404).json({ error: `Room "${roomName}" not found or could not be deleted` });
            }
        } catch (error) {
            handleError(error, res, 'Server error while attempting to delete room');
        }
    }

    /**
     * Administrative endpoint to retrieve recently uploaded attachments
     * @param req - Express request object
     * @param res - Express response object
     */
    getRecentAttachments = async (req: Request, res: Response): Promise<void> => {
        try {
            console.log('Admin request: Getting recent attachments');
            const attachments = await dbAttachments.getRecentAttachments();
            const response: GetRecentAttachments_Response = { attachments };
            res.json(response);
        } catch (error) {
            handleError(error, res, 'Failed to retrieve recent attachments');
        }
    }

    /**
     * Administrative endpoint to create test data for development and testing purposes
     * @param req - Express request object
     * @param res - Express response object
     */
    createTestData = async (req: Request, res: Response): Promise<void> => {
        try {
            console.log('Admin request: Creating test data');
            await dbRoom.createTestData();
            res.json({ message: 'Test data created successfully' });
        } catch (error) {
            handleError(error, res, 'Failed to create test data');
        }
    }

    /**
     * Administrative endpoint to delete a specific message from a room
     * Sends real-time updates to all connected clients via WebRTC
     * @param req - Express request object containing DeleteMessage_Request in body
     * @param res - Express response object
     */
    deleteMessage = async (req: Request<any, any, DeleteMessage_Request>, res: Response): Promise<void> => {
        try {
            const { messageId, roomName } = req.body;
        
            if (!messageId) {
                res.status(400).json({ 
                    error: 'Message ID is required' 
                });
                return;
            }

            const publicKey = req.headers['public-key'] as string;
        
            console.log('Admin request: Deleting message:', messageId);
            const success = await dbMessages.deleteMessage(messageId, publicKey, ADMIN_PUBLIC_KEY!);

            // to cause the message to vanish from the room in realtime on all the clients we call the rtc method.
            rtc.sendDeleteMessage(roomName, messageId, publicKey);
        
            if (success) {
                res.json({ message: `Message "${messageId}" deleted successfully` });
            } else {
                res.status(404).json({ error: `Message "${messageId}" not found or could not be deleted` });
            }
        } catch (error) {
            handleError(error, res, 'Server error while attempting to delete message');
        }
    }

    /**
     * Administrative endpoint to block a user and delete all their content
     * @param req - Express request object containing BlockUser_Request in body
     * @param res - Express response object
     */
    blockUser = async (req: Request<any, any, BlockUser_Request>, res: Response): Promise<void> => {
        try {
            const { publicKey } = req.body;
            
            if (!publicKey) {
                res.status(400).json({ 
                    error: 'Missing pub_key parameter' 
                });
                return;
            }
            
            console.log('Admin request: Blocking user with public key:', publicKey);
            await dbUsers.deleteUserContent(publicKey);
            await dbUsers.blockUser(publicKey);
                    
            res.json({ 
                message: `User was blocked successfully.` 
            });
    
        } catch (error) {
            handleError(error, res, 'Server error while attempting to block user');
        }
    }

    /**
     * Administrative endpoint to delete an attachment by its ID
     * @param req - Express request object containing attachmentId in params
     * @param res - Express response object
     */
    deleteAttachment = async (req: Request<{ attachmentId: string }>, res: Response): Promise<void> => {
        try {
            const attachmentId = parseInt(req.params.attachmentId);
            if (isNaN(attachmentId)) {
                res.status(400).json({ error: 'Invalid attachment ID' });
                return;
            }
            const success = await dbAttachments.deleteAttachmentById(attachmentId);
                
            if (!success) {
                res.status(404).json({ error: 'Attachment not found or could not be deleted' });
            }
        } catch (error) {
            handleError(error, res, 'Failed to delete attachment');
        }
    }

    /**
     * API handler for getting specific messages by their IDs within a room
     * @param req - Express request object containing roomId in params and GetMessagesByIds_Request in body
     * @param res - Express response object
     */
    getMessagesByIds = async (req: Request<{ roomId: string }, any, GetMessagesByIds_Request>, res: Response): Promise<void> => {
        try {
            const { ids } = req.body || { ids: [] };
            const roomId = req.params.roomId;
            
            if (!roomId) {
                res.status(400).json({ error: 'Room ID is required' });
                return;
            }
            
            if (!ids || !Array.isArray(ids)) {
                res.status(400).json({ error: 'Invalid request. Expected array of message IDs' });
                return;
            }
            
            const messages = await dbMessages.getMessagesByIds(ids, roomId);
            const response: GetMessagesByIds_Response = { messages };
            res.json(response);
        } catch (error) {
            handleError(error, res, 'Failed to retrieve messages by IDs');
        }
    }

    /**
     * Saves multiple messages to the database for a specific room
     * @param req - Express request object containing roomId in params and SendMessages_Request in body
     * @param res - Express response object
     */
    sendMessages = async (req: Request<{ roomId: string }, any, SendMessages_Request>, res: Response): Promise<void> => {
        try {
            const roomId = req.params.roomId;
            if (!req.body.messages || req.body.messages.length === 0) {
                res.status(400).json({ error: 'Invalid or empty messages array' });
                return;
            }
        
            // Send messages to controller and get back database IDs
            const numSaved = await dbMessages.saveMessages(roomId, req.body.messages);
        
            // Return the database IDs to the client
            res.json({ allOk: req.body.messages.length === numSaved});
        }
        catch (error) {
            handleError(error, res, 'Failed to save messages');
        }
    }
}

export const chatSvc = new ChatService();
