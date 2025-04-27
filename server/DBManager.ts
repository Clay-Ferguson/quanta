import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';

// NOTE: In Node.js (non-bundled ESM) we use ".js" extension for imports. 
// This is correct. The "@common" folder is an alias so we can get access to 
// the common folder one level above the server folder (see tsconfig.json).
import {ChatMessageIntf, FileBase64Intf} from '@common/CommonTypes.js';

export class DBManager {
    private db: Database | null = null;
    private static instance: DBManager | null = null;
    private dbPath: string;

    private constructor(dbPath: string) {
        this.dbPath = dbPath;
    }

    public static async getInstance(dbPath: string): Promise<DBManager> {
        console.log('DBManager.getInstance', dbPath);
        if (!DBManager.instance) {
            DBManager.instance = new DBManager(dbPath);
            await DBManager.instance.initialize();
        }
        return DBManager.instance;
    }

    private async initialize(): Promise<void> {
        // Ensure data directory exists
        const dbDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        // Open and initialize the database
        console.log('Opening database:', this.dbPath);
        this.db = await open({
            filename: this.dbPath,
            driver: sqlite3.Database
        });

        // Create tables if they don't exist
        console.log('Initializing database schema');
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS rooms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL
            );

            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                room_id INTEGER NOT NULL,
                timestamp INTEGER NOT NULL,
                sender TEXT NOT NULL,
                content TEXT,
                public_key TEXT,
                signature TEXT,
                FOREIGN KEY (room_id) REFERENCES rooms (id)
            );

            CREATE TABLE IF NOT EXISTS attachments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_id TEXT NOT NULL,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                size INTEGER NOT NULL,
                data BLOB,
                FOREIGN KEY (message_id) REFERENCES messages (id)
            );

            CREATE TABLE IF NOT EXISTS blocked_keys (
                pub_key TEXT PRIMARY KEY
            );
            
            CREATE TABLE IF NOT EXISTS user_info (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pub_key TEXT UNIQUE NOT NULL,
                user_name TEXT,
                user_desc TEXT,
                avatar_name TEXT,
                avatar_type TEXT,
                avatar_size INTEGER,
                avatar_data BLOB
            );
            
            CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages (room_id);
            CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages (timestamp);
            CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON attachments (message_id);
            CREATE INDEX IF NOT EXISTS idx_user_info_pub_key ON user_info (pub_key);
        `);

        // I'm not skilled with SQLite, but followed the advice of Claude to add these two PRAGMAs.
        await this.db!.exec('PRAGMA journal_mode = WAL;');
        await this.db!.exec('PRAGMA busy_timeout = 5000;'); // 5 second timeout
    }

    private checkDb = (): void => {
        if (!this.db) {
            throw new Error('Database not initialized. Call getInstance() first.');   
        }
    }

    private runTrans = async (fn: () => Promise<any>): Promise<any> => {
        this.checkDb();
        let ret = null;
        try {
            await this.db!.run('BEGIN TRANSACTION');
            ret = await fn();
            await this.db!.run('COMMIT');
        } catch (error) {
            console.error('Transaction error:', error);
            try {
                await this.db!.run('ROLLBACK');
            } catch (rollbackError) {
                console.error('Rollback failed:', rollbackError);
            }
        }
        return ret;
    }

    /**
    * Removes all messages from a specified room
    */
    public async wipeRoom(roomName: string): Promise<void> {
        console.log(`Wiping all messages from room: ${roomName}`);
        
        this.runTrans(async () => {
            // Get the room ID
            const room = await this.db!.get('SELECT id FROM rooms WHERE name = ?', roomName);
            if (!room) {
                console.log(`Room '${roomName}' not found, nothing to wipe`);
                return;
            }
        
            // Get all message IDs in this room to delete their attachments
            const messages = await this.db!.all('SELECT id FROM messages WHERE room_id = ?', room.id);
            const messageIds = messages.map(msg => msg.id);
        
            // If there are messages, delete their attachments first
            if (messageIds.length > 0) {
            // Create placeholders for the query
                const placeholders = messageIds.map(() => '?').join(',');
            
                // Delete all attachments associated with these messages
                await this.db!.run(`DELETE FROM attachments WHERE message_id IN (${placeholders})`, messageIds);
            }
        
            // Delete all messages in the room
            const result = await this.db!.run('DELETE FROM messages WHERE room_id = ?', room.id);
            console.log(`Successfully wiped ${result.changes} messages from room '${roomName}'`);
        });
    }

    public async createTestData(): Promise<void> {
        const roomName = 'test';
        console.log('Creating test data...');
        
        this.runTrans(async () => {
            // First, wipe the test room to ensure we start fresh
            await this.wipeRoom(roomName);
            
            // Get or create the 'test' room
            const roomId = await this.getOrCreateRoom(roomName);
            console.log('Test room ID:', roomId);
            
            // Generate test messages - 10 messages per day for a week (70 total)
            const oneDay = 24 * 60 * 60 * 1000; // milliseconds in a day
            const now = Date.now();
            
            for (let day = 0; day < 7; day++) {
                // Base timestamp for this day (going back 'day' days from now)
                const dayTimestamp = now - (day * oneDay);
                
                for (let msg = 0; msg < 10; msg++) {
                    // Generate a random time within this day
                    const randomHourOffset = Math.floor(Math.random() * 24 * 60 * 60 * 1000);
                    const timestamp = dayTimestamp - randomHourOffset;
                    
                    // Message number from 1-70 (newest to oldest)
                    const messageNumber = day * 10 + msg + 1;
                    
                    // Create a unique ID for the message
                    const messageId = `test-msg-${messageNumber}-${timestamp}`;
                    
                    // Insert the message
                    await this.db!.run(
                        `INSERT OR IGNORE INTO messages (id, room_id, timestamp, sender, content, public_key, signature)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [
                            messageId,
                            roomId,
                            timestamp,
                            'clay',
                            `Chat message number ${messageNumber}`,
                            null,
                            null
                        ]
                    );
                }
            }
            console.log('Successfully created 70 test messages in the "test" room');
        });
    }

    public async persistMessage(roomName: string, message: ChatMessageIntf): Promise<boolean> {
        console.log('Persisting message:', message);

        return this.runTrans(async () => {
            // Ensure room exists
            const roomId = await this.getOrCreateRoom(roomName);
            console.log('    Room ID:', roomId);

            // Store the message
            await this.db!.run(
                `INSERT OR IGNORE INTO messages (id, room_id, timestamp, sender, content, public_key, signature)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    message.id, 
                    roomId, 
                    message.timestamp, 
                    message.sender, 
                    message.content,
                    message.publicKey || null,
                    message.signature || null
                ]
            );
            console.log('Message Record stored: ', message.id);

            // Store attachments if any
            if (message.attachments && Array.isArray(message.attachments) && message.attachments.length > 0) {
                console.log('Storing attachments:', message.attachments.length);
                // Store each attachment
                for (const attachment of message.attachments) {
                    // Extract the binary data from the data URL
                    let binaryData = null;
                    if (attachment.data) {
                        const matches = attachment.data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
                        if (matches && matches.length === 3) {
                            binaryData = Buffer.from(matches[2], 'base64');
                        }
                    }

                    await this.db!.run(
                        `INSERT INTO attachments (message_id, name, type, size, data)
                         VALUES (?, ?, ?, ?, ?)`,
                        [
                            message.id,
                            attachment.name,
                            attachment.type,
                            attachment.size,
                            binaryData
                        ]
                    );
                }
            }

            console.log('Message persisted successfully');
            return true;
        });
    }

    private async getOrCreateRoom(roomName: string): Promise<number> {
        // Check if room exists
        let result = await this.db!.get('SELECT id FROM rooms WHERE name = ?', roomName);
        
        if (result) {
            return result.id;
        }
        
        // Create new room if it doesn't exist
        result = await this.db!.run('INSERT INTO rooms (name) VALUES (?)', roomName);
        return result.lastID;
    }

    public async getMessagesForRoom(roomName: string, limit = 100, offset = 0): Promise<ChatMessageIntf[]> {
        try {
            // Get the room ID
            const room = await this.db!.get('SELECT id FROM rooms WHERE name = ?', roomName);
            if (!room) {
                return [];
            }

            // Get messages
            const messages = await this.db!.all(`
                SELECT m.id, m.timestamp, m.sender, m.content, m.public_key as publicKey, m.signature
                FROM messages m
                WHERE m.room_id = ?
                ORDER BY m.timestamp DESC
                LIMIT ? OFFSET ?
            `, [room.id, limit, offset]);

            // For each message, get its attachments
            for (const message of messages) {
                const attachments = await this.db!.all(`
                    SELECT name, type, size, data
                    FROM attachments
                    WHERE message_id = ?
                `, [message.id]);
                
                // Convert binary data back to data URLs
                message.attachments = attachments.map(att => {
                    let dataUrl = '';
                    if (att.data) {
                        dataUrl = `data:${att.type};base64,${Buffer.from(att.data).toString('base64')}`;
                    }
                    
                    return {
                        name: att.name,
                        type: att.type,
                        size: att.size,
                        data: dataUrl
                    };
                });
            }

            return messages;
        } catch (error) {
            console.error('Error retrieving messages:', error);
            return [];
        }
    }

    // Add a new method to retrieve message history
    async getMessageHistory(req: any, res: any) {
        const { roomName, limit, offset } = req.query;
            
        if (!roomName) {
            return res.status(400).json({ error: 'Room name is required' });
        }
            
        try {
            const messages = await this.getMessagesForRoom(
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

    /**
     * Get all message IDs for a specific room
     */
    async getMessageIdsForRoom(roomId: string): Promise<string[]> {
        try {
            // First, get the room_id from the name or id
            const room = await this.db!.get('SELECT id FROM rooms WHERE name = ? OR id = ?', [roomId, roomId]);
            if (!room) {
                return [];
            }
            
            const messages = await this.db!.all('SELECT id FROM messages WHERE room_id = ?', [room.id]);
            return messages.map(msg => msg.id);
        } catch (error) {
            console.error('Error retrieving message IDs for room:', error);
            throw error;
        }
    }

    /**
     * Get multiple messages by their IDs (filtering by room for security)
     */
    async getMessagesByIds(messageIds: string[], roomId: string): Promise<FileBase64Intf[]> {
        if (!messageIds || messageIds.length === 0) {
            return [];
        }

        try {
            // First, get the room_id from the name or id
            const room = await this.db!.get('SELECT id FROM rooms WHERE name = ? OR id = ?', [roomId, roomId]);
            if (!room) {
                return [];
            }
            
            // Using parameterized query with placeholders for security
            const placeholders = messageIds.map(() => '?').join(',');
            // Add room_id filter for security (ensures users can only fetch messages from rooms they have access to)
            const query = `SELECT * FROM messages WHERE id IN (${placeholders}) AND room_id = ?`;
            
            // Add room_id as the last parameter
            const params = [...messageIds, room.id];
            const messages = await this.db!.all(query, params);
            
            // For each message, fetch its attachments
            for (const message of messages) {
                const attachments: FileBase64Intf[] = await this.db!.all(`
                    SELECT name, type, size, data
                    FROM attachments
                    WHERE message_id = ?
                `, [message.id]);
                
                // Convert binary data back to data URLs
                message.attachments = attachments.map(att => {
                    let dataUrl = '';
                    if (att.data) {
                        dataUrl = `data:${att.type};base64,${Buffer.from(att.data).toString('base64')}`;
                    }
                    
                    return {
                        name: att.name,
                        type: att.type,
                        size: att.size,
                        data: dataUrl
                    };
                });
            }
            return messages;
        } catch (error) {
            console.error('Error retrieving messages by IDs:', error);
            throw error;
        }
    }

    /**
     * API handler for getting all message IDs for a specific room
     */
    async getMessageIdsForRoomHandler(req: any, res: any): Promise<void> {
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
            
            const messageIds = await this.getMessageIdsForRoomWithDateFilter(roomId, cutoffTimestamp);
            res.json({ messageIds });
        } catch (error) {
            console.error('Error in getMessageIdsForRoom handler:', error);
            res.status(500).json({ error: 'Failed to retrieve message IDs' });
        }
    }

    /**
     * Get message IDs for a specific room, filtered by timestamp
     */
    async getMessageIdsForRoomWithDateFilter(roomId: string, cutoffTimestamp: number): Promise<string[]> {
        try {
            // First, get the room_id from the room name
            const room = await this.db!.get('SELECT id FROM rooms WHERE name = ?', [roomId]);
            if (!room) {
                return [];
            }
            
            // Add timestamp filter to only get messages after the cutoff date
            const messages = await this.db!.all(
                'SELECT id FROM messages WHERE room_id = ? AND timestamp >= ?', 
                [room.id, cutoffTimestamp]
            );
            
            return messages.map(msg => msg.id);
        } catch (error) {
            console.error('Error retrieving filtered message IDs for room:', error);
            throw error;
        }
    }

    /**
     * API handler for getting messages by IDs for a specific room
     */
    async getMessagesByIdsHandler(req: any, res: any): Promise<void> {
        try {
            const { ids } = req.body || {};
            const roomId = req.params?.roomId;
            
            if (!roomId) {
                return res.status(400).json({ error: 'Room ID is required' });
            }
            
            if (!ids || !Array.isArray(ids)) {
                return res.status(400).json({ error: 'Invalid request. Expected array of message IDs' });
            }
            
            const messages = await this.getMessagesByIds(ids, roomId);
            res.json({ messages });
        } catch (error) {
            console.error('Error in getMessagesByIds handler:', error);
            res.status(500).json({ error: 'Failed to retrieve messages' });
        }
    }

    /**
     * Gets information about all rooms including their message counts
     * @returns An array of room information objects
     */
    async getAllRoomsInfo() {
        try {
        // Query to get all rooms and join with messages to count messages per room
            const query = `
        SELECT 
            r.id as id,
            r.name as name,
            COUNT(m.id) as messageCount
        FROM rooms r
        LEFT JOIN messages m ON r.id = m.room_id
        GROUP BY r.id
        ORDER BY r.name ASC
    `;
    
            const rooms = await this.db!.all(query);
            return rooms.map(room => ({
                id: room.id,
                name: room.name,
                messageCount: room.messageCount
            }));
        } catch (error) {
            console.error('Error getting all rooms info:', error);
            throw error;
        }
    }

    /**
     * Retrieves an attachment by its ID
     * @param id The ID of the attachment
     * @returns The attachment data with type information
     */
    async getAttachmentById(id: number): Promise<{data: Buffer, type: string, name: string} | null> {
        try {
            const attachment = await this.db!.get(
                'SELECT data, type, name FROM attachments WHERE id = ?',
                [id]
            );
                
            if (!attachment) {
                return null;
            }
                
            return {
                data: attachment.data,
                type: attachment.type,
                name: attachment.name
            };
        } catch (error) {
            console.error('Error retrieving attachment:', error);
            return null;
        }
    }
    
    /**
     * Express handler for serving attachment files
     * @param req Express request object
     * @param res Express response object
     */
    async serveAttachment(req: any, res: any): Promise<void> {
        try {
            const attachmentId = parseInt(req.params.attachmentId);
            if (isNaN(attachmentId)) {
                return res.status(400).send('Invalid attachment ID');
            }
                
            const attachment = await this.getAttachmentById(attachmentId);
                
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

    /**
     * Gets the most recent attachments
     * @param limit Maximum number of attachments to return
     * @returns Array of recent attachments with their details
     */
    async getRecentAttachments(limit = 100): Promise<any[]> {
        try {
            const query = `
                    SELECT 
                        a.id, 
                        a.name, 
                        a.type, 
                        a.size, 
                        a.message_id,
                        m.sender,
                        m.public_key,
                        m.timestamp,
                        r.name as room_name
                    FROM attachments a
                    JOIN messages m ON a.message_id = m.id
                    JOIN rooms r ON m.room_id = r.id
                    ORDER BY m.timestamp DESC
                    LIMIT ?
                `;
                
            const attachments = await this.db!.all(query, [limit]);
            return attachments;
        } catch (error) {
            console.error('Error getting recent attachments:', error);
            return [];
        }
    }

    public async isUserBlocked(pub_key: string): Promise<boolean> {
        try {
            if (!pub_key) {
                return false; // Can't check an empty key
            }
        
            const result = await this.db!.get(
                'SELECT pub_key FROM blocked_keys WHERE pub_key = ?',
                [pub_key]
            );
        
            return !!result; // Convert to boolean - true if found, false if not found
        } catch (error) {
            console.error('Error checking if user is blocked:', error);
            return false; // Default to not blocked on error
        }
    }

    public async deleteUserContent(pub_key: string): Promise<boolean> {
        try {
            if (!pub_key) {
                console.error('Cannot delete content for an empty public key');
                return false;
            }

            await this.db!.run(
                'DELETE FROM attachments WHERE message_id IN (SELECT id FROM messages WHERE public_key = ?)',
                [pub_key]
            );

            // Delete messages and attachments associated with the public key
            await this.db!.run(
                'DELETE FROM messages WHERE public_key = ?',
                [pub_key]
            );
        
            console.log(`Deleted content for public key: ${pub_key}`);
            return true;
        } catch (error) {
            console.error('Error deleting user content:', error);
            return false;
        }
    }

    public async blockUser(pub_key: string) {
        try {
            if (!pub_key) {
                console.error('Cannot block an empty public key');
            }
        
            // Use INSERT OR IGNORE to avoid errors if the key is already blocked
            await this.db!.run(
                'INSERT OR IGNORE INTO blocked_keys (pub_key) VALUES (?)',
                [pub_key]
            );
            console.log(`Public key blocked: ${pub_key}`);
        } catch (error) {
            console.error('Error blocking user:', error);
        }
    }

    /**
     * Saves or updates user information in the database
     * @param pubKey The user's public key
     * @param userName The user's display name
     * @param userDesc The user's description/bio
     * @param avatar User's avatar information (optional)
     * @returns Whether the operation was successful
     */
    public async saveUserInfo(
        pubKey: string, 
        userName: string, 
        userDesc: string, 
        avatar: FileBase64Intf | null): Promise<boolean> {
        try {
            if (!pubKey) {
                console.error('Cannot save user info without a public key');
                return false;
            }
            let avatarBinaryData: Buffer | null = null;
        
            // Extract binary data from data URL if avatar exists
            if (avatar && avatar.data) {
                const matches = avatar.data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
                if (matches && matches.length === 3) {
                    avatarBinaryData = Buffer.from(matches[2], 'base64');
                }
            }

            // Use INSERT OR REPLACE to handle both insert and update cases
            await this.db!.run(
                `INSERT OR REPLACE INTO user_info 
            (pub_key, user_name, user_desc, avatar_name, avatar_type, avatar_size, avatar_data)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    pubKey,
                    userName,
                    userDesc,
                    avatar?.name || null,
                    avatar?.type || null,
                    avatar?.size || null,
                    avatarBinaryData
                ]
            );
            console.log(`User info saved for public key: ${pubKey}`);
            return true;
        } catch (error) {
            console.error('Error saving user info:', error);
            return false;
        }
    }

    /**
     * Retrieves user information from the database
     * @param pubKey The user's public key
     * @returns The user information or null if not found
     */
    public async getUserInfo(pubKey: string): Promise<{
            userName: string;
            userDesc: string;
            avatar: FileBase64Intf | null;
        } | null> {
        try {
            if (!pubKey) {
                console.error('Cannot get user info without a public key');
                return null;
            }

            const userInfo = await this.db!.get(
                `SELECT user_name, user_desc, avatar_name, avatar_type, avatar_size, avatar_data 
             FROM user_info 
             WHERE pub_key = ?`,
                [pubKey]
            );

            if (!userInfo) {
                return null;
            }

            // Convert binary avatar data back to data URL if it exists
            let avatar = null;
            if (userInfo.avatar_data) {
                avatar = {
                    name: userInfo.avatar_name,
                    type: userInfo.avatar_type,
                    size: userInfo.avatar_size,
                    data: `data:${userInfo.avatar_type};base64,${Buffer.from(userInfo.avatar_data).toString('base64')}`
                };
            }

            return {
                userName: userInfo.user_name,
                userDesc: userInfo.user_desc,
                avatar
            };
        } catch (error) {
            console.error('Error retrieving user info:', error);
            return null;
        }
    }

    /**
     * API handler for saving user information
     * @param req Express request object
     * @param res Express response object
     */
    public async saveUserInfoHandler(req: any, res: any): Promise<void> {
        try {
            const { pubKey, userName, userDesc, avatar } = req.body;
            if (!pubKey) {
                return res.status(400).json({ error: 'Public key is required' });
            }
            const success = await this.saveUserInfo(pubKey, userName, userDesc, avatar);
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

    /**
     * API handler for retrieving user information
     * @param req Express request object
     * @param res Express response object
     */
    public async getUserInfoHandler(req: any, res: any): Promise<void> {
        try {
            const pubKey = req.params.pubKey;
        
            if (!pubKey) {
                return res.status(400).json({ error: 'Public key is required' });
            }
            const userInfo = await this.getUserInfo(pubKey);
            if (userInfo) {
                res.json(userInfo);
            } else {
                res.status(404).json({ error: 'User information not found' });
            }
        } catch (error) {
            console.error('Error in getUserInfo handler:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }

    public async serveAvatar(req: any, res: any): Promise<void> {
        try {
            const pubKey = req.params.pubKey;
            if (!pubKey) {
                return res.status(400).json({ error: 'Public key is required' });
            }
                
            // Get user info from the database
            const userInfo = await this.getUserInfo(pubKey);
            if (!userInfo || !userInfo.avatar || !userInfo.avatar.data) {
                // Return a 404 for missing avatars
                return res.status(404).send('Avatar not found');
            }
                
            // Extract content type and base64 data
            const matches = userInfo.avatar.data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
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
}

