import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';

// NOTE: In Node.js (non-bundled ESM) we use ".js" extension for imports. 
// This is correct. The "@common" folder is an alias so we can get access to 
// the common folder one level above the server folder (see tsconfig.json).
import {ChatMessageIntf} from '@common/CommonTypes.js';

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
            
            CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages (room_id);
            CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages (timestamp);
            CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON attachments (message_id);
        `);
    }

    /**
    * Removes all messages from a specified room
    */
    public async wipeRoom(roomName: string): Promise<void> {
        console.log(`Wiping all messages from room: ${roomName}`);
    
        try {
        // Begin transaction
            await this.db!.run('BEGIN TRANSACTION');
        
            // Get the room ID
            const room = await this.db!.get('SELECT id FROM rooms WHERE name = ?', roomName);
            if (!room) {
                console.log(`Room '${roomName}' not found, nothing to wipe`);
                await this.db!.run('COMMIT');
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
        
            // Commit transaction
            await this.db!.run('COMMIT');
            console.log(`Successfully wiped ${result.changes} messages from room '${roomName}'`);
        } catch (error) {
            console.error(`Error wiping room '${roomName}':`, error);
            // Rollback if error
            try {
                if (this.db) {
                    await this.db.run('ROLLBACK');
                }
            } catch (rollbackError) {
                console.error('Rollback failed:', rollbackError);
            }
        }
    }

    public async createTestData(): Promise<void> {
        const roomName = 'test';
        console.log('Creating test data...');
        
        try {
            // First, wipe the test room to ensure we start fresh
            await this.wipeRoom(roomName);

            // Begin transaction
            await this.db!.run('BEGIN TRANSACTION');
            
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
            
            // Commit transaction
            await this.db!.run('COMMIT');
            console.log('Successfully created 70 test messages in the "test" room');
            
        } catch (error) {
            console.error('Error creating test data:', error);
            // Rollback if error
            try {
                if (this.db) {
                    await this.db.run('ROLLBACK');
                }
            } catch (rollbackError) {
                console.error('Rollback failed:', rollbackError);
            }
        }
    }

    public async persistMessage(roomName: string, message: ChatMessageIntf): Promise<boolean> {
        console.log('Persisting message:', message);

        try {
            // Begin transaction
            await this.db!.run('BEGIN TRANSACTION');

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

            // Commit transaction
            await this.db!.run('COMMIT');
            console.log('    Message persisted successfully');
            return true;

        } catch (error) {
            console.error('Error persisting message:', error);
            // Only try to rollback if we have a database connection
            try {
                if (this.db) {
                    await this.db.run('ROLLBACK');
                }
            } catch (rollbackError) {
                // If rollback fails (e.g., no transaction active), just log it
                console.error('Rollback failed:', rollbackError);
            }
            return false;
        }
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
    async getMessagesByIds(messageIds: string[], roomId: string): Promise<any[]> {
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
            // First, get the room_id from the name or id
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
}