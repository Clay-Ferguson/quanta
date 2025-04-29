import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';

// NOTE: In Node.js (non-bundled ESM) we use ".js" extension for imports. 
// This is correct. The "@common" folder is an alias so we can get access to 
// the common folder one level above the server folder (see tsconfig.json).
import {ChatMessageIntf, FileBase64Intf, UserProfile} from '@common/CommonTypes.js';

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
     * Deletes a room and all associated data (messages and attachments)
     * @param roomName The name of the room to delete
     * @returns Whether the operation was successful
     */
    deleteRoom = async (roomName: string): Promise<boolean> => {
        console.log(`Deleting room: ${roomName} and all associated data`);
    
        return this.runTrans(async () => {
            try {
            // First, get the room ID
                const room = await this.db!.get('SELECT id FROM rooms WHERE name = ?', roomName);
                if (!room) {
                    console.log(`Room '${roomName}' not found, nothing to delete`);
                    return false;
                }
            
                const roomId = room.id;
                console.log(`Found room ID ${roomId} for room '${roomName}'`);
            
                // Get all message IDs in this room to delete their attachments
                const messages = await this.db!.all('SELECT id FROM messages WHERE room_id = ?', roomId);
                const messageIds = messages.map(msg => msg.id);
            
                // If there are messages, delete their attachments first
                if (messageIds.length > 0) {
                    console.log(`Deleting attachments for ${messageIds.length} messages in room '${roomName}'`);
                    // Create placeholders for the query
                    const placeholders = messageIds.map(() => '?').join(',');
                
                    // Delete all attachments associated with these messages
                    const attachmentResult = await this.db!.run(
                        `DELETE FROM attachments WHERE message_id IN (${placeholders})`, 
                        messageIds
                    );
                    console.log(`Deleted ${attachmentResult.changes} attachments`);
                }
            
                // Delete all messages in the room
                console.log(`Deleting messages in room '${roomName}'`);
                const messageResult = await this.db!.run('DELETE FROM messages WHERE room_id = ?', roomId);
                console.log(`Deleted ${messageResult.changes} messages`);
            
                // Finally, delete the room itself
                console.log(`Deleting room '${roomName}'`);
                const roomResult: any = await this.db!.run('DELETE FROM rooms WHERE id = ?', roomId);
            
                const success = roomResult.changes > 0;
                if (success) {
                    console.log(`Successfully deleted room '${roomName}' and all its data`);
                } else {
                    console.log(`Failed to delete room '${roomName}'`);
                }
            
                return success;
            } catch (error) {
                console.error('Error in deleteRoom transaction:', error);
                return false;
            }
        });
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

    createTestData = async (): Promise<void> => {
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

    getMessagesForRoom = async (roomName: string, limit = 100, offset = 0): Promise<ChatMessageIntf[]> => {
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
    getMessagesByIds = async (messageIds: string[], roomId: string): Promise<ChatMessageIntf[]> => {
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
        
            // Join messages and attachments in a single query
            const query = `
            SELECT 
                m.id, m.timestamp, m.sender, m.content, m.public_key as publicKey, m.signature,
                a.id as attachment_id, a.name, a.type, a.size, a.data
            FROM messages m
            LEFT JOIN attachments a ON m.id = a.message_id
            WHERE m.id IN (${placeholders}) AND m.room_id = ?
            ORDER BY m.timestamp, a.id
        `;
        
            // Add room_id as the last parameter
            const params = [...messageIds, room.id];
            const rows = await this.db!.all(query, params);
        
            // Process the result into proper structure
            const messageMap = new Map<string, ChatMessageIntf>();
        
            for (const row of rows) {
            // If this is a new message id we haven't processed yet
                if (!messageMap.has(row.id)) {
                    // Create a new message object
                    const message: ChatMessageIntf = {
                        id: row.id,
                        timestamp: row.timestamp,
                        sender: row.sender,
                        content: row.content,
                        publicKey: row.publicKey,
                        signature: row.signature,
                        attachments: []
                    };
                    messageMap.set(row.id, message);
                }
            
                // If this row has attachment data, add it to the message
                if (row.attachment_id) {
                    const message = messageMap.get(row.id)!;
                    let dataUrl = '';
                    if (row.data) {
                        dataUrl = `data:${row.type};base64,${Buffer.from(row.data).toString('base64')}`;
                    }
                
                    message.attachments!.push({
                        name: row.name,
                        type: row.type,
                        size: row.size,
                        data: dataUrl
                    });
                }
            }
        
            // Convert the map to an array and return
            return Array.from(messageMap.values());
        } catch (error) {
            console.error('Error retrieving messages by IDs:', error);
            throw error;
        }
    }

    /**
     * Get multiple messages by their IDs (filtering by room for security)
     * 
     * DO NOT DELETE (yet). This is the original AI-generated method which was a very inefficient way to load Messages
     * but I will keep it here for now as a backup in case the new method has issues.
     */
    async getMessagesByIds_old(messageIds: string[], roomId: string): Promise<ChatMessageIntf[]> {
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
     * Get message IDs for a specific room, filtered by timestamp
     */
    getMessageIdsForRoomWithDateFilter = async (roomId: string, cutoffTimestamp: number): Promise<string[]> => {
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
     * Gets information about all rooms including their message counts
     * @returns An array of room information objects
     */
    getAllRoomsInfo = async () => {
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
    getAttachmentById = async (id: number): Promise<{data: Buffer, type: string, name: string} | null> => {
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
    
    deleteAttachmentById = async (id: number): Promise<boolean> => {
        try {
            if (isNaN(id) || id <= 0) {
                console.error('Invalid attachment ID:', id);
                return false;
            }

            // First verify the attachment exists
            const attachment = await this.db!.get('SELECT id FROM attachments WHERE id = ?', [id]);
            if (!attachment) {
                console.log(`Attachment with ID ${id} not found`);
                return false;
            }

            // Delete the attachment
            const result: any = await this.db!.run('DELETE FROM attachments WHERE id = ?', [id]);
            
            // Check if a row was affected
            const success = result.changes > 0;
            if (success) {
                console.log(`Successfully deleted attachment ID: ${id}`);
            } else {
                console.log(`No attachment deleted with ID: ${id}`);
            }
            
            return success;
        } catch (error) {
            console.error('Error deleting attachment:', error);
            return false;
        }
    }

    /**
     * Gets the most recent attachments
     * @param limit Maximum number of attachments to return
     * @returns Array of recent attachments with their details
     */
    getRecentAttachments = async (limit = 100): Promise<any[]> => {
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

    /**
     * Deletes a message and all associated attachments by message ID
     * @param messageId The ID of the message to delete
     * @returns Whether the operation was successful
     */
    deleteMessage = async (messageId: string): Promise<boolean> => {
        console.log(`Deleting message: ${messageId} and all associated attachments`);

        return this.runTrans(async () => {
            try {
            // First, check if the message exists
                const message = await this.db!.get('SELECT id FROM messages WHERE id = ?', messageId);
                if (!message) {
                    console.log(`Message '${messageId}' not found, nothing to delete`);
                    return false;
                }
            
                // Delete all attachments associated with this message
                const attachmentResult = await this.db!.run(
                    'DELETE FROM attachments WHERE message_id = ?', 
                    messageId
                );
                console.log(`Deleted ${attachmentResult.changes} attachments for message ${messageId}`);
            
                // Delete the message itself
                const messageResult: any = await this.db!.run(
                    'DELETE FROM messages WHERE id = ?',
                    messageId
                );
            
                const success = messageResult.changes > 0;
                if (success) {
                    console.log(`Successfully deleted message '${messageId}' and all its attachments`);
                } else {
                    console.log(`Failed to delete message '${messageId}'`);
                }
            
                return success;
            } catch (error) {
                console.error('Error in deleteMessage transaction:', error);
                return false;
            }
        });
    }

    deleteUserContent = async (pub_key: string): Promise<boolean> => {
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

    blockUser = async (pub_key: string) => {
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

    saveUserInfo = async (userProfile: UserProfile): Promise<boolean> => {
        try {
            if (!userProfile.publicKey) {
                console.error('Cannot save user info without a public key');
                return false;
            }
            let avatarBinaryData: Buffer | null = null;
        
            // Extract binary data from data URL if avatar exists
            if (userProfile.avatar && userProfile.avatar.data) {
                const matches = userProfile.avatar.data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
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
                    userProfile.publicKey,
                    userProfile.name,
                    userProfile.description,
                    userProfile.avatar?.name || null,
                    userProfile.avatar?.type || null,
                    userProfile.avatar?.size || null,
                    avatarBinaryData
                ]
            );
            console.log(`User info saved for public key: ${userProfile.publicKey}`);
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
    // todo-0: need some kind of user info type here.
    getUserInfo = async (pubKey: string): Promise<{
            userName: string;
            userDesc: string;
            avatar: FileBase64Intf | null;
        } | null> => {
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
}

