import { UserProfile } from "@common/CommonTypes.js";
import { DBManager } from "./DBManager.js";

class Controller {
    public db: DBManager | null = null;
    
    /**
     * API handler for getting all message IDs for a specific room
     */
    getMessageIdsForRoom = async (req: any, res: any): Promise<void> => {
        console.log('Received request to get message IDs for room:', req.params?.roomId);
        try {
            const roomId = req.params?.roomId;
            if (!roomId) {
                return res.status(400).json({ error: 'Room ID is required' });
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
                
            const messageIds = await this.db!.getMessageIdsForRoomWithDateFilter(roomId, cutoffTimestamp);
            console.log('Message IDs:', messageIds);
            res.json({ messageIds });
        } catch (error) {
            console.error('Error in getMessageIdsForRoom handler:', error);
            res.status(500).json({ error: 'Failed to retrieve message IDs' });
        }
    }

    serveAttachment = async (req: any, res: any): Promise<void> => {
        try {
            const attachmentId = parseInt(req.params.attachmentId);
            if (isNaN(attachmentId)) {
                return res.status(400).send('Invalid attachment ID');
            }
                    
            const attachment = await this.db!.getAttachmentById(attachmentId);
                    
            if (!attachment) {
                return res.status(404).send('Attachment not found');
            }
                    
            // Set the appropriate content type
            res.set('Content-Type', attachment.type);
                    
            // Set content disposition for downloads (optional)
            res.set('Content-Disposition', `inline; filename="${attachment.name}"`);
                    
            // Send the binary data
            res.send(attachment.data);
        } catch (error) {
            console.error('Error serving attachment:', error);
            res.status(500).send('Server error');
        }
    }
    
    // Add a new method to retrieve message history
    getMessageHistory = async (req: any, res: any) => {
        const { roomName, limit, offset } = req.query;
            
        if (!roomName) {
            return res.status(400).json({ error: 'Room name is required' });
        }
            
        try {
            const messages = await this.db!.getMessagesForRoom(
                roomName,
                limit ? parseInt(limit) : 100,
                offset ? parseInt(offset) : 0
            );
                
            res.json({ messages });
        } catch (error) {
            console.error('Error retrieving message history:', error);
            res.status(500).json({ error: 'Failed to retrieve message history' });
        }
    } 

    getUserProfile = async (req: any, res: any): Promise<void> => {
        try {
            const publicKey = req.params.pubKey;
            if (!publicKey) {
                return res.status(400).json({ error: 'Public key is required' });
            }
            const userProfile = await this.db!.getUserInfo(publicKey);
            if (userProfile) {
                res.json(userProfile);
            } else {
                res.status(404).json({ error: 'User information not found' });
            }
        } catch (error) {
            console.error('Error in getUserInfo handler:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }

    serveAvatar = async (req: any, res: any): Promise<void> => {
        try {
            const publicKey = req.params.pubKey;
            if (!publicKey) {
                return res.status(400).json({ error: 'Public key is required' });
            }
                
            // Get user info from the database
            const userProfile: UserProfile | null = await this.db!.getUserInfo(publicKey);
            if (!userProfile || !userProfile.avatar || !userProfile.avatar.data) {
                // Return a 404 for missing avatars
                return res.status(404).send('Avatar not found');
            }
                
            // Extract content type and base64 data
            const matches = userProfile.avatar.data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
            if (!matches || matches.length !== 3) {
                return res.status(400).send('Invalid avatar data format');
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
            console.error('Error serving avatar:', error);
            res.status(500).send('Server error');
        }
    }    

    getRoomInfo = async (req: any, res: any) => {
        try {
            console.log('Admin request: Getting room information');
            const roomsInfo = await this.db!.getAllRoomsInfo();
            res.json({ success: true, rooms: roomsInfo });
        } catch (error) {
            console.error('Error getting room information:', error);
            res.status(500).json({ success: false, error: 'Failed to get room information' });
        }
    }

    deleteRoom = async (req: any, res: any) => {
        try {
            const { roomName } = req.body;
            
            if (!roomName) {
                res.status(400).json({ 
                    success: false, 
                    error: 'Room name is required' 
                });
            }
            
            console.log('Admin request: Deleting room:', roomName);
            const success = await this.db!.deleteRoom(roomName);
            
            if (success) {
                res.json({ success: true, message: `Room "${roomName}" deleted successfully` });
            } else {
                res.status(404).json({ success: false, error: `Room "${roomName}" not found or could not be deleted` });
            }
        } catch (error) {
            console.error('Error deleting room:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Server error while attempting to delete room' 
            });
        }
    }

    getRecentAttachments = async (req: any, res: any) => {
        try {
            console.log('Admin request: Getting recent attachments');
            const attachments = await this.db!.getRecentAttachments();
            res.json({ success: true, attachments });
        } catch (error) {
            console.error('Error getting recent attachments:', error);
            res.status(500).json({ success: false, error: 'Failed to get recent attachments' });
        }
    }

    createTestData = async (req: any, res: any): Promise<void> => {
        try {
            console.log('Admin request: Creating test data');
            await this.db!.createTestData();
            res.json({ success: true, message: 'Test data created successfully' });
        } catch (error) {
            console.error('Error creating test data:', error);
            res.status(500).json({ error: 'Failed to create test data' });
        }
    }

    deleteMessage = async (req: any, res: any) => {
        try {
            const { messageId } = req.body;
        
            if (!messageId) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Message ID is required' 
                });
            }
        
            console.log('Admin request: Deleting message:', messageId);
            const success = await this.db!.deleteMessage(messageId);
        
            if (success) {
                res.json({ success: true, message: `Message "${messageId}" deleted successfully` });
            } else {
                res.status(404).json({ success: false, error: `Message "${messageId}" not found or could not be deleted` });
            }
        } catch (error) {
            console.error('Error deleting message:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Server error while attempting to delete message' 
            });
        }
    }

    blockUser = async (req: any, res: any) => {
        try {
            const { pub_key } = req.body;
            
            if (!pub_key) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Missing pub_key parameter' 
                });
            }
            
            console.log('Admin request: Blocking user with public key:', pub_key);
            await this.db!.deleteUserContent(pub_key);
            await this.db!.blockUser(pub_key);
                    
            res.json({ 
                success: true, 
                message: `User was blocked successfully.` 
            });
    
        } catch (error) {
            console.error('Error blocking user:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Server error while attempting to block user' 
            });
        }
    }

    deleteAttachment = async (req: any, res: any): Promise<void> => {
        try {
            const attachmentId = parseInt(req.params.attachmentId);
            if (isNaN(attachmentId)) {
                return res.status(400).json({ error: 'Invalid attachment ID' });
            }
            const success = await this.db!.deleteAttachmentById(attachmentId);
                
            if (success) {
                res.json({ success: true });
            } else {
                res.status(404).json({ error: 'Attachment not found or could not be deleted' });
            }
        } catch (error) {
            console.error('Error in deleteAttachment handler:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }

    /**
     * API handler for getting messages by IDs for a specific room
     */
    getMessagesByIds = async (req: any, res: any): Promise<void> => {
        try {
            const { ids } = req.body || {};
            const roomId = req.params?.roomId;
            
            if (!roomId) {
                return res.status(400).json({ error: 'Room ID is required' });
            }
            
            if (!ids || !Array.isArray(ids)) {
                return res.status(400).json({ error: 'Invalid request. Expected array of message IDs' });
            }
            
            const messages = await this.db!.getMessagesByIds(ids, roomId);
            res.json({ messages });
        } catch (error) {
            console.error('Error in getMessagesByIds handler:', error);
            res.status(500).json({ error: 'Failed to retrieve messages' });
        }
    }

    saveUserProfile = async (req: any, res: any): Promise<void> => {
        try {
            const userProfile: UserProfile = req.body;
            if (!userProfile.publicKey) {
                return res.status(400).json({ error: 'Public key is required' });
            }
            const success = await this.db!.saveUserInfo(userProfile); 
            if (success) {
                res.json({ success: true });
            } else {
                res.status(500).json({ error: 'Failed to save user information' });
            }
        } catch (error) {
            console.error('Error in saveUserInfo handler:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }
}

export const controller = new Controller();
        