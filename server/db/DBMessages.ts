import { ChatMessageIntf, DBManagerIntf } from "@common/CommonTypes.js";
import { dbRoom } from "./DBRoom.js";

class DBMessages {
    dbm: DBManagerIntf | null = null;

    persistMessageToRoomName = async (roomName: string, message: ChatMessageIntf): Promise<boolean> => {
        return await this.dbm!.runTrans(async () => {
            const existingMessage = await this.dbm!.get(
                'SELECT rowid FROM messages WHERE id = ?',
                [message.id]
            );
            if (existingMessage) {
                console.log('Message already exists, skipping insert');
                return true;
            }
            else {
                console.log('Message does not exist, inserting new message');
            }

            // Ensure room exists
            const roomId = await dbRoom.getOrCreateRoom(roomName);
            console.log('Got Room ID:', roomId);

            this.persistMessageToRoomId(roomId, message)
            return true;
        });
    }

    persistMessageToRoomId = async (roomId: number, message: ChatMessageIntf): Promise<boolean> =>{            
        const result: any = await this.dbm!.run(
            `INSERT OR IGNORE INTO messages (id, state, room_id, timestamp, sender, content, public_key, signature)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                message.id, 
                'a',
                roomId, 
                message.timestamp, 
                message.sender, 
                message.content,
                message.publicKey || null,
                message.signature || null
            ]
        );
        
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

                await this.dbm!.run(
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
                attachment.id = result.lastID;
            }
        }
        console.log(`Message persisted successfully: id=${message.id}`);
        return true;
    }

    /**
     * Saves multiple messages to the database and returns their database IDs
     */
    async saveMessages(roomName: string, messages: ChatMessageIntf[]): Promise<number> {
        // Use a transaction to ensure all messages are saved or none
        return await this.dbm!.runTrans(async () => {
            // Ensure room exists
            const roomId = await dbRoom.getOrCreateRoom(roomName);
            console.log('Got Room ID:', roomId);

            let numSaved = 0;
            for (const message of messages) {
                const save = await this.persistMessageToRoomId(roomId, message);
                if (!save) {
                    console.error('Failed to save message:', message);
                    continue; // Skip this message if saving failed
                }
                numSaved++;
                console.log(`Message Record stored: ${message.id}`);
            }
            return numSaved;
        });
    }

    getMessagesForRoom = async (roomName: string, limit = 100, offset = 0): Promise<ChatMessageIntf[]> => {
        try {
            // Get the room ID
            const room = await this.dbm!.get('SELECT id FROM rooms WHERE name = ?', roomName);
            if (!room) {
                return [];
            }
    
            // Get messages
            const messages = await this.dbm!.all(`
                    SELECT m.id, m.timestamp, m.sender, m.content, m.public_key as publicKey, m.signature
                    FROM messages m
                    WHERE m.room_id = ?
                    ORDER BY m.timestamp DESC
                    LIMIT ? OFFSET ?
                `, [room.id, limit, offset]);
    
            // For each message, get its attachments
            for (const message of messages) {
                // This came from DB so no matter what states is consider id 'ack'
                message.state = 'a';

                const attachments = await this.dbm!.all(`
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
            const room = await this.dbm!.get('SELECT id FROM rooms WHERE name = ? OR id = ?', [roomId, roomId]);
            if (!room) {
                return [];
            }
                
            const messages = await this.dbm!.all('SELECT id FROM messages WHERE room_id = ?', [room.id]);
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
            const room = await this.dbm!.get('SELECT id FROM rooms WHERE name = ? OR id = ?', [roomId, roomId]);
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
            const rows = await this.dbm!.all(query, params);
            
            // Process the result into proper structure
            const messageMap = new Map<string, ChatMessageIntf>();
            
            for (const row of rows) {
                // If this is a new message id we haven't processed yet
                if (!messageMap.has(row.id)) {
                    // Create a new message object
                    const message: ChatMessageIntf = {
                        id: row.id,
                        state: 'a', // anything from the DB is an 'a' state by definition
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
         * Get message IDs for a specific room, filtered by timestamp
         */
    getMessageIdsForRoomWithDateFilter = async (roomId: string, cutoffTimestamp: number): Promise<string[]> => {
        try {
            // First, get the room_id from the room name
            const room = await this.dbm!.get('SELECT id FROM rooms WHERE name = ?', [roomId]);
            if (!room) {
                return [];
            }
                
            // Add timestamp filter to only get messages after the cutoff date
            const messages = await this.dbm!.all(
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
     * Deletes a message and all associated attachments by message ID
     * @param messageId The ID of the message to delete
     * @returns Whether the operation was successful
     */
    deleteMessage = async (messageId: string): Promise<boolean> => {
        console.log(`Deleting message: ${messageId} and all associated attachments`);
    
        return this.dbm!.runTrans(async () => {
            try {
                // First, check if the message exists
                const message = await this.dbm!.get('SELECT id FROM messages WHERE id = ?', messageId);
                if (!message) {
                    console.log(`Message '${messageId}' not found, nothing to delete`);
                    return false;
                }
                
                // Delete all attachments associated with this message
                const attachmentResult = await this.dbm!.run(
                    'DELETE FROM attachments WHERE message_id = ?', 
                    messageId
                );
                console.log(`Deleted ${attachmentResult.changes} attachments for message ${messageId}`);
                
                // Delete the message itself
                const messageResult: any = await this.dbm!.run(
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
}

export const dbMessages = new DBMessages();