import { FileBlob, UserProfile } from "../common/types/CommonTypes.js";
import { dbRoom } from "./db/DBRoom.js";
import { dbMessages } from "./db/DBMessages.js";
import { dbAttachments } from "./db/DBAttachments.js";
import { dbUsers } from "./db/DBUsers.js";
import { rtc } from './WebRTCServer.js';
import { Request, Response } from 'express';
import { BlockUser_Request, DeleteMessage_Request, DeleteRoom_Response, DeleteRoom_Request, GetMessageHistory_Response, GetMessageIdsForRoom_Response, GetMessagesByIds_Response, GetMessagesByIds_Request, GetRecentAttachments_Response, GetRoomInfo_Response, SendMessages_Request } from "../common/types/EndpointTypes.js";

const ADMIN_PUBLIC_KEY = process.env.QUANTA_CHAT_ADMIN_PUBLIC_KEY;

class Controller {
    /**
     * API handler for getting all message IDs for a specific room
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
            this.handleError(error, res, 'Failed to retrieve message IDs');
        }
    }

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
            this.handleError(error, res, 'Failed to retrieve attachment'); 
        }
    }
    
    // Add a new method to retrieve message history
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
            this.handleError(error, res, 'Failed to retrieve message history');
        }
    } 

    getUserProfile = async (req: Request<{ pubKey: string }>, res: Response): Promise<void> => {
        try {
            const publicKey = req.params.pubKey;
            if (!publicKey) {
                res.status(400).json({ error: 'Public key is required' });
                return;
            }
            const userProfile: UserProfile | null = await dbUsers.getUserInfo(publicKey);
            if (userProfile) {
                res.json(userProfile);
            } else {
                res.status(404).json({ error: 'User information not found' });
            }
        } catch (error) {
            this.handleError(error, res, 'Failed to retrieve user profile');
        }
    }

    serveAvatar = async (req: Request<{ pubKey: string }>, res: Response): Promise<void> => {
        try {
            const publicKey = req.params.pubKey;
            if (!publicKey) {
                res.status(400).json({ error: 'Public key is required' });
                return;
            }
                
            // Get user info from the database
            const userProfile: UserProfile | null = await dbUsers.getUserInfo(publicKey);
            if (!userProfile || !userProfile.avatar || !userProfile.avatar.data) {
                // Return a 404 for missing avatars
                res.status(404).send('Avatar not found');
                return;
            }
                
            // Extract content type and base64 data
            const matches = userProfile.avatar.data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
            if (!matches || matches.length !== 3) {
                res.status(400).send('Invalid avatar data format');
                return;
            }
                
            const contentType = matches[1];
            const base64Data = matches[2];
            const binaryData = Buffer.from(base64Data, 'base64');
                
            // Set appropriate headers
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Length', binaryData.length);
            res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
                
            // Send the binary image data
            res.send(binaryData);
        } catch (error) {
            this.handleError(error, res, 'Failed to retrieve avatar');
        }
    }    

    getRoomInfo = async (req: Request, res: Response): Promise<void> => {
        try {
            console.log('Admin request: Getting room information');
            const rooms = await dbRoom.getAllRoomsInfo();
            const response: GetRoomInfo_Response = { rooms };
            res.json(response);
        } catch (error) {
            this.handleError(error, res, 'Failed to retrieve room information');
        }
    }

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
                res.status(404).json({ success: false, error: `Room "${roomName}" not found or could not be deleted` });
            }
        } catch (error) {
            this.handleError(error, res, 'Server error while attempting to delete room');
        }
    }

    getRecentAttachments = async (req: Request, res: Response): Promise<void> => {
        try {
            console.log('Admin request: Getting recent attachments');
            const attachments = await dbAttachments.getRecentAttachments();
            const response: GetRecentAttachments_Response = { attachments };
            res.json(response);
        } catch (error) {
            this.handleError(error, res, 'Failed to retrieve recent attachments');
        }
    }

    createTestData = async (req: Request, res: Response): Promise<void> => {
        try {
            console.log('Admin request: Creating test data');
            await dbRoom.createTestData();
            res.json({ success: true, message: 'Test data created successfully' });
        } catch (error) {
            this.handleError(error, res, 'Failed to create test data');
        }
    }

    deleteMessage = async (req: Request<any, any, DeleteMessage_Request>, res: Response): Promise<void> => {
        try {
            const { messageId, roomName, publicKey } = req.body;
        
            if (!messageId) {
                res.status(400).json({ 
                    success: false, 
                    error: 'Message ID is required' 
                });
                return;
            }
        
            console.log('Admin request: Deleting message:', messageId);
            const success = await dbMessages.deleteMessage(messageId, publicKey, ADMIN_PUBLIC_KEY!);

            // to cause the message to vanish from the room in realtime on all the clients we call the rtc method.
            rtc.sendDeleteMessage(roomName, messageId, publicKey);
        
            if (success) {
                res.json({ success: true, message: `Message "${messageId}" deleted successfully` });
            } else {
                res.status(404).json({ success: false, error: `Message "${messageId}" not found or could not be deleted` });
            }
        } catch (error) {
            this.handleError(error, res, 'Server error while attempting to delete message');
        }
    }

    blockUser = async (req: Request<any, any, BlockUser_Request>, res: Response): Promise<void> => {
        try {
            const { publicKey } = req.body;
            
            if (!publicKey) {
                res.status(400).json({ 
                    success: false, 
                    error: 'Missing pub_key parameter' 
                });
                return;
            }
            
            console.log('Admin request: Blocking user with public key:', publicKey);
            await dbUsers.deleteUserContent(publicKey);
            await dbUsers.blockUser(publicKey);
                    
            res.json({ 
                success: true, 
                message: `User was blocked successfully.` 
            });
    
        } catch (error) {
            this.handleError(error, res, 'Server error while attempting to block user');
        }
    }

    deleteAttachment = async (req: Request<{ attachmentId: string }>, res: Response): Promise<void> => {
        try {
            const attachmentId = parseInt(req.params.attachmentId);
            if (isNaN(attachmentId)) {
                res.status(400).json({ error: 'Invalid attachment ID' });
                return;
            }
            const success = await dbAttachments.deleteAttachmentById(attachmentId);
                
            if (success) {
                res.json({ success: true });
            } else {
                res.status(404).json({ error: 'Attachment not found or could not be deleted' });
            }
        } catch (error) {
            this.handleError(error, res, 'Failed to delete attachment');
        }
    }

    /**
     * API handler for getting messages by IDs for a specific room
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
            this.handleError(error, res, 'Failed to retrieve messages by IDs');
        }
    }

    saveUserProfile = async (req: Request<any, any, UserProfile>, res: Response): Promise<void> => {
        try {
            const userProfile: UserProfile = req.body;
            if (!userProfile.publicKey) {
                res.status(400).json({ error: 'Public key is required' });
                return;
            }
            const success = await dbUsers.saveUserInfo(userProfile); 
            if (success) {
                res.json({ success: true });
            } else {
                res.status(500).json({ error: 'Failed to save user information' });
            }
        } catch (error) {
            this.handleError(error, res, 'Failed to save user profile');
        }
    }

    /**
     * Saves multiple messages to the database and returns an array of database IDs
     * @param roomId The ID of the room
     * @param messages Array of messages to save
     * @returns Array of database IDs in the same order as the input messages
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
            this.handleError(error, res, 'Failed to save messages');
        }
    }

    // using 'unknown' is a little better than 'any' here.
    handleError = (error: unknown, res: Response, message: string): void => {
        console.error(`ERROR: ${message}`, error);
        res.status(500).json({ error: message });
    }
}

export const controller = new Controller();
