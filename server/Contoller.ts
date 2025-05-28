import { FileBlob, UserProfile, TreeNode } from "../common/types/CommonTypes.js";
import { dbRoom } from "./db/DBRoom.js";
import { dbMessages } from "./db/DBMessages.js";
import { dbAttachments } from "./db/DBAttachments.js";
import { dbUsers } from "./db/DBUsers.js";
import { rtc } from './WebRTCServer.js';
import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { BlockUser_Request, DeleteMessage_Request, DeleteRoom_Response, DeleteRoom_Request, GetMessageHistory_Response, GetMessageIdsForRoom_Response, GetMessagesByIds_Response, GetMessagesByIds_Request, GetRecentAttachments_Response, GetRoomInfo_Response, SendMessages_Request, TreeRender_Response } from "../common/types/EndpointTypes.js";

const ADMIN_PUBLIC_KEY = process.env.QUANTA_CHAT_ADMIN_PUBLIC_KEY;

/**
 * Main controller class that handles all HTTP API endpoints for the QuantaChat application.
 * Provides methods for managing rooms, messages, attachments, users, and administrative functions.
 */
class Controller {
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
            this.handleError(error, res, 'Failed to retrieve message IDs');
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
            this.handleError(error, res, 'Failed to retrieve attachment'); 
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
            this.handleError(error, res, 'Failed to retrieve message history');
        }
    } 

    /**
     * Retrieves user profile information by public key
     * @param req - Express request object containing pubKey in params
     * @param res - Express response object
     */
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

    /**
     * Serves user avatar images by public key, returning the binary image data
     * @param req - Express request object containing pubKey in params
     * @param res - Express response object
     */
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
            this.handleError(error, res, 'Failed to retrieve room information');
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
                res.status(404).json({ success: false, error: `Room "${roomName}" not found or could not be deleted` });
            }
        } catch (error) {
            this.handleError(error, res, 'Server error while attempting to delete room');
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
            this.handleError(error, res, 'Failed to retrieve recent attachments');
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
            res.json({ success: true, message: 'Test data created successfully' });
        } catch (error) {
            this.handleError(error, res, 'Failed to create test data');
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
            this.handleError(error, res, 'Failed to retrieve messages by IDs');
        }
    }

    /**
     * Saves or updates user profile information in the database
     * @param req - Express request object containing UserProfile in body
     * @param res - Express response object
     */
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
            this.handleError(error, res, 'Failed to save messages');
        }
    }

    /**
     * Tree render method that returns an array of TreeNode objects representing files and folders
     * @param req - Express request object containing treeFolder in the URL path
     * @param res - Express response object
     */
    treeRender = async (req: Request, res: Response): Promise<void> => {
        console.log("Tree Render Request:", req.path);
        try {
            // Extract the path after /api/docs/render/
            const treeFolder = req.path.replace('/api/docs/render/', '');
            const quantaTreeRoot = process.env.QUANTA_TREE_ROOT;
            
            if (!quantaTreeRoot) {
                res.status(500).json({ error: 'QUANTA_TREE_ROOT environment variable not set' });
                return;
            }

            if (!treeFolder) {
                res.status(400).json({ error: 'Tree folder parameter is required' });
                return;
            }

            // Construct the absolute path
            const absolutePath = path.join(quantaTreeRoot, treeFolder);

            // Check if the directory exists
            if (!fs.existsSync(absolutePath)) {
                res.status(404).json({ error: 'Directory not found' });
                return;
            }

            // Check if it's actually a directory
            const stat = fs.statSync(absolutePath);
            if (!stat.isDirectory()) {
                res.status(400).json({ error: 'Path is not a directory' });
                return;
            }

            // Read directory contents
            const files = fs.readdirSync(absolutePath);
            const treeNodes: TreeNode[] = [];

            for (const file of files) {
                // We only consider files that are named like "NNNNN_" where N is a digit. We allow any number of digits followed by the underscore.
                if (!/^\d+_/.test(file)) {
                    continue; // Skip files that do not match the naming convention
                }
                
                const filePath = path.join(absolutePath, file);
                const fileStat = fs.statSync(filePath);
                
                let content = '';
                let mimeType = '';

                if (fileStat.isDirectory()) {
                    mimeType = 'folder';
                } else {
                    const ext = path.extname(file).toLowerCase();
                    
                    // Detect image files
                    if (['.png', '.jpeg', '.jpg'].includes(ext)) {
                        mimeType = 'image';
                        // For images, we don't read content, just provide the path reference
                        content = filePath;
                    } else {
                        // Assume it's a text file and read its content
                        try {
                            content = fs.readFileSync(filePath, 'utf8');
                            mimeType = 'text';
                        } catch (error) {
                            console.warn(`Could not read file ${filePath} as text:`, error);
                            content = '';
                            mimeType = 'unknown';
                        }
                    }
                }

                const treeNode: TreeNode = {
                    name: file,
                    createTime: fileStat.birthtime.getTime(),
                    modifyTime: fileStat.mtime.getTime(),
                    content: content,
                    mimeType: mimeType,
                };

                treeNodes.push(treeNode);
            }

            // Sort alphabetically by filename
            treeNodes.sort((a, b) => a.name.localeCompare(b.name));

            const response: TreeRender_Response = { treeNodes };
            res.json(response);
        } catch (error) {
            this.handleError(error, res, 'Failed to render tree');
        }
    }

    /**
     * Saves file content to the server for the tree viewer feature
     * @param req - Express request object containing filename, content, and optional newFileName in body
     * @param res - Express response object
     */
    saveFile = async (req: Request<any, any, { filename: string; content: string; treeFolder: string; newFileName?: string }>, res: Response): Promise<void> => {
        console.log("Save File Request");
        try {
            const { filename, content, treeFolder, newFileName } = req.body;
            const quantaTreeRoot = process.env.QUANTA_TREE_ROOT;
            
            if (!quantaTreeRoot) {
                res.status(500).json({ error: 'QUANTA_TREE_ROOT environment variable not set' });
                return;
            }

            if (!filename || content === undefined || !treeFolder) {
                res.status(400).json({ error: 'Filename, content, and treeFolder are required' });
                return;
            }

            // Construct the absolute path
            const absoluteFolderPath = path.join(quantaTreeRoot, treeFolder);
            const absoluteFilePath = path.join(absoluteFolderPath, filename);

            // Check if the directory exists
            if (!fs.existsSync(absoluteFolderPath)) {
                res.status(404).json({ error: 'Directory not found' });
                return;
            }

            // Check if it's actually a directory
            const stat = fs.statSync(absoluteFolderPath);
            if (!stat.isDirectory()) {
                res.status(400).json({ error: 'Path is not a directory' });
                return;
            }

            let finalFilePath = absoluteFilePath;

            // If newFileName is provided and different from filename, rename the file first
            if (newFileName && newFileName !== filename) {
                const newAbsoluteFilePath = path.join(absoluteFolderPath, newFileName);
                
                // Check if the file to be renamed exists
                if (fs.existsSync(absoluteFilePath)) {
                    // Check if the new name already exists
                    if (fs.existsSync(newAbsoluteFilePath)) {
                        res.status(409).json({ error: 'A file with the new name already exists' });
                        return;
                    }
                    
                    // Rename the file
                    fs.renameSync(absoluteFilePath, newAbsoluteFilePath);
                    console.log(`File renamed successfully: ${absoluteFilePath} -> ${newAbsoluteFilePath}`);
                }
                
                finalFilePath = newAbsoluteFilePath;
            }

            // Write the content to the file (renamed or original)
            fs.writeFileSync(finalFilePath, content, 'utf8');
            
            console.log(`File saved successfully: ${finalFilePath}`);
            res.json({ success: true, message: 'File saved successfully' });
        } catch (error) {
            this.handleError(error, res, 'Failed to save file');
        }
    }

    /**
     * Renames a folder on the server for the tree viewer feature
     * @param req - Express request object containing oldFolderName and newFolderName in body
     * @param res - Express response object
     */
    renameFolder = async (req: Request<any, any, { oldFolderName: string; newFolderName: string; treeFolder: string }>, res: Response): Promise<void> => {
        console.log("Rename Folder Request");
        try {
            const { oldFolderName, newFolderName, treeFolder } = req.body;
            const quantaTreeRoot = process.env.QUANTA_TREE_ROOT;
            
            if (!quantaTreeRoot) {
                res.status(500).json({ error: 'QUANTA_TREE_ROOT environment variable not set' });
                return;
            }

            if (!oldFolderName || !newFolderName || !treeFolder) {
                res.status(400).json({ error: 'Old folder name, new folder name, and treeFolder are required' });
                return;
            }

            // Construct the absolute paths
            const absoluteParentPath = path.join(quantaTreeRoot, treeFolder);
            const oldAbsolutePath = path.join(absoluteParentPath, oldFolderName);
            const newAbsolutePath = path.join(absoluteParentPath, newFolderName);

            // Check if the parent directory exists
            if (!fs.existsSync(absoluteParentPath)) {
                res.status(404).json({ error: 'Parent directory not found' });
                return;
            }

            // Check if the old folder exists
            if (!fs.existsSync(oldAbsolutePath)) {
                res.status(404).json({ error: 'Old folder not found' });
                return;
            }

            // Check if it's actually a directory
            const stat = fs.statSync(oldAbsolutePath);
            if (!stat.isDirectory()) {
                res.status(400).json({ error: 'Path is not a directory' });
                return;
            }

            // Check if the new name already exists
            if (fs.existsSync(newAbsolutePath)) {
                res.status(409).json({ error: 'A folder with the new name already exists' });
                return;
            }

            // Rename the folder
            fs.renameSync(oldAbsolutePath, newAbsolutePath);
            
            console.log(`Folder renamed successfully: ${oldAbsolutePath} -> ${newAbsolutePath}`);
            res.json({ success: true, message: 'Folder renamed successfully' });
        } catch (error) {
            this.handleError(error, res, 'Failed to rename folder');
        }
    }

    /**
     * Deletes a file or folder from the server for the tree viewer feature
     * @param req - Express request object containing fileOrFolderName and treeFolder in body
     * @param res - Express response object
     */
    deleteFileOrFolder = async (req: Request<any, any, { fileOrFolderName: string; treeFolder: string }>, res: Response): Promise<void> => {
        console.log("Delete File or Folder Request");
        try {
            const { fileOrFolderName, treeFolder } = req.body;
            const quantaTreeRoot = process.env.QUANTA_TREE_ROOT;
            
            if (!quantaTreeRoot) {
                res.status(500).json({ error: 'QUANTA_TREE_ROOT environment variable not set' });
                return;
            }

            if (!fileOrFolderName || !treeFolder) {
                res.status(400).json({ error: 'File or folder name and treeFolder are required' });
                return;
            }

            // Construct the absolute paths
            const absoluteParentPath = path.join(quantaTreeRoot, treeFolder);
            const absoluteTargetPath = path.join(absoluteParentPath, fileOrFolderName);

            // Check if the parent directory exists
            if (!fs.existsSync(absoluteParentPath)) {
                res.status(404).json({ error: 'Parent directory not found' });
                return;
            }

            // Check if the target exists
            if (!fs.existsSync(absoluteTargetPath)) {
                res.status(404).json({ error: 'File or folder not found' });
                return;
            }

            // Get stats to determine if it's a file or directory
            const stat = fs.statSync(absoluteTargetPath);
            
            if (stat.isDirectory()) {
                // Remove directory recursively
                fs.rmSync(absoluteTargetPath, { recursive: true, force: true });
                console.log(`Folder deleted successfully: ${absoluteTargetPath}`);
                res.json({ success: true, message: 'Folder deleted successfully' });
            } else {
                // Remove file
                fs.unlinkSync(absoluteTargetPath);
                console.log(`File deleted successfully: ${absoluteTargetPath}`);
                res.json({ success: true, message: 'File deleted successfully' });
            }
        } catch (error) {
            this.handleError(error, res, 'Failed to delete file or folder');
        }
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

export const controller = new Controller();
