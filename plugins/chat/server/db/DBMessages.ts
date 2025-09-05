import { ChatMessageIntf, MessageStates } from "../../../../common/types/CommonTypes.js";
import { dbRoom } from "./DBRoom.js";
import { getTransactionClient, runTrans } from '../../../../server/Transactional.js';
import pgdb from '../../../../server/PGDB.js';

/**
 * Database operations for handling chat messages.
 * Provides methods to persist, retrieve, and delete messages and their attachments.
 */
class DBMessages {

    /**
     * Execute a database query that returns a single row
     */
    private async get<T = any>(sql: string, ...params: any[]): Promise<T | undefined> {
        const transactionClient = getTransactionClient();
        if (transactionClient) {
            const result = await transactionClient.query(sql, params);
            return result.rows[0] as T;
        }
        
        const client = await pgdb.getClient();
        try {
            const result = await client.query(sql, params);
            return result.rows[0] as T;
        } finally {
            client.release();
        }
    }

    /**
     * Execute a database query that returns multiple rows
     */
    private async all<T = any[]>(sql: string, ...params: any[]): Promise<T> {
        const transactionClient = getTransactionClient();
        if (transactionClient) {
            const result = await transactionClient.query(sql, params);
            return result.rows as T;
        }
        
        const client = await pgdb.getClient();
        try {
            const result = await client.query(sql, params);
            return result.rows as T;
        } finally {
            client.release();
        }
    }

    /**
     * Execute a database query that modifies data
     */
    private async run(sql: string, ...params: any[]): Promise<any> {
        const transactionClient = getTransactionClient();
        if (transactionClient) {
            const result = await transactionClient.query(sql, params);
            return result;
        }
        
        const client = await pgdb.getClient();
        try {
            const result = await client.query(sql, params);
            return result;
        } finally {
            client.release();
        }
    }

    /**
     * Persists a message to a room identified by name.
     * Uses a transaction to ensure database consistency.
     * 
     * @param roomName - Name of the room where the message belongs
     * @param message - The chat message to persist
     * @returns A Promise resolving to true if the message was saved successfully
     */
    persistMessageToRoomName = async (roomName: string, message: ChatMessageIntf): Promise<boolean> => {
        return await runTrans(async () => {
            const existingMessage = await this.get(
                'SELECT id FROM messages WHERE id = $1',
                message.id
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
            this.persistMessageToRoomId(roomId, message)
            return true;
        })
    }

    /**
     * Persists a message to a room identified by ID.
     * Also stores any attachments associated with the message.
     * 
     * @param roomId - ID of the room where the message belongs
     * @param message - The chat message to persist
     * @returns A Promise resolving to true if the message was saved successfully
     */
    persistMessageToRoomId = async (roomId: number, message: ChatMessageIntf): Promise<boolean> => {        
        // This is important to set because for example during a broadcast the message needs to arrive to the clients
        // with the state SAVED (acknowledged) so they're up to date immediately with correct state on the object.
        message.state = MessageStates.SAVED; 

        const result: any = await this.run(
            `INSERT INTO messages (id, state, room_id, timestamp, sender, content, public_key, signature)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT (id) DO NOTHING`,
            message.id, 
            message.state,
            roomId, 
            message.timestamp, 
            message.sender, 
            message.content,
            message.publicKey || null,
            message.signature || null
        );

        if (result.rowCount === 0) {
            console.log('Message already exists, skipping insert');
            return true;
        }
        
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

                await this.run(
                    `INSERT INTO attachments (message_id, name, type, size, data)
                         VALUES ($1, $2, $3, $4, $5)`,
                    message.id,
                    attachment.name,
                    attachment.type,
                    attachment.size,
                    binaryData
                );
            }
        }
        // console.log(`Message persisted successfully: id=${message.id}`);
        return true;
    }

    /**
     * Saves multiple messages to the database in a single transaction.
     * Creates the room if it doesn't exist.
     * 
     * @param roomName - Name of the room where the messages belong
     * @param messages - Array of chat messages to save
     * @returns A Promise resolving to the number of successfully saved messages
     */
    saveMessages = async (roomName: string, messages: ChatMessageIntf[]): Promise<number> => {
        return await runTrans(async () => {
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
            // console.log(`Message Record stored: ${message.id}`);
            }
            return numSaved;
        });
    }

    /**
     * Retrieves messages for a specific room with pagination support.
     * Includes all message data and associated attachments.
     * 
     * @param roomName - Name of the room to get messages from
     * @param limit - Maximum number of messages to retrieve (defaults to 100)
     * @param offset - Number of messages to skip for pagination (defaults to 0)
     * @returns A Promise resolving to an array of chat messages with attachments
     */
    getMessagesForRoom = async (roomName: string, limit = 100, offset = 0): Promise<ChatMessageIntf[]> => {
        try {
            // Get the room ID
            const room = await this.get('SELECT id FROM rooms WHERE name = $1', roomName);
            if (!room) {
                return [];
            }
    
            // Get messages
            const messages = await this.all(`
                    SELECT m.id, m.timestamp, m.sender, m.content, m.public_key, m.signature, m.state
                    FROM messages m
                    WHERE m.room_id = $1
                    ORDER BY m.timestamp DESC
                    LIMIT $2 OFFSET $3
                `, room.id, limit, offset);
    
            // For each message, get its attachments
            for (const message of messages) {
                // Ensure all properties use correct mapping from PostgreSQL columns
                // PostgreSQL uses lowercase column names by default
                message.state = MessageStates.SAVED;
                message.timestamp = Number(message.timestamp);
                message.publicKey = message.public_key; // Map from column name
                
                const attachments = await this.all(`
                        SELECT name, type, size, data
                        FROM attachments
                        WHERE message_id = $1
                    `, message.id);
                    
                // Convert binary data back to data URLs
                message.attachments = attachments.map((att: any) => {
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
     * Gets all message IDs for a specific room.
     * 
     * @param roomId - ID or name of the room
     * @returns A Promise resolving to an array of message IDs
     */
    async getMessageIdsForRoom(roomId: string): Promise<string[]> {
        try {
            // First, check if roomId is numeric (an actual ID) or a string (room name)
            const isNumeric = /^\d+$/.test(roomId);
            
            // Use appropriate query based on whether roomId is a numeric ID or string name
            const room = isNumeric 
                ? await this.get('SELECT id FROM rooms WHERE id = $1', parseInt(roomId, 10))
                : await this.get('SELECT id FROM rooms WHERE name = $1', roomId);
                
            if (!room) {
                return [];
            }
                
            const messages = await this.all('SELECT id FROM messages WHERE room_id = $1', room.id);
            return messages.map((msg: any) => msg.id);
        } catch (error) {
            console.error('Error retrieving message IDs for room:', error);
            throw error;
        }
    }
    
    /**
     * Retrieves multiple messages by their IDs, filtered by room for security.
     * Efficiently retrieves messages with their attachments in a single query.
     * 
     * @param messageIds - Array of message IDs to retrieve
     * @param roomId - ID or name of the room for security filtering
     * @returns A Promise resolving to an array of chat messages with attachments
     */
    getMessagesByIds = async (messageIds: string[], roomId: string): Promise<ChatMessageIntf[]> => {
        if (!messageIds || messageIds.length === 0) {
            return [];
        }
    
        try {
            // First, check if roomId is numeric (an actual ID) or a string (room name)
            const isNumeric = /^\d+$/.test(roomId);
            
            // Use appropriate query based on whether roomId is a numeric ID or string name
            const room = isNumeric 
                ? await this.get('SELECT id FROM rooms WHERE id = $1', parseInt(roomId, 10))
                : await this.get('SELECT id FROM rooms WHERE name = $1', roomId);
                
            if (!room) {
                return [];
            }
            
            // Using parameterized query with placeholders for security
            const placeholders = messageIds.map((_, index) => `$${index + 2}`).join(',');
            
            // Join messages and attachments in a single query
            // Use consistent naming to avoid case confusion in PostgreSQL results
            const query = `
                SELECT 
                    m.id, 
                    m.timestamp, 
                    m.sender, 
                    m.content, 
                    m.public_key, 
                    m.signature,
                    m.state,
                    a.id as attachment_id, 
                    a.name, 
                    a.type, 
                    a.size, 
                    a.data
                FROM messages m
                LEFT JOIN attachments a ON m.id = a.message_id
                WHERE m.id IN (${placeholders}) AND m.room_id = $1
                ORDER BY m.timestamp, a.id
            `;
            
            // Add room_id as the first parameter, then messageIds
            const params = [room.id, ...messageIds];
            const rows = await this.all(query, ...params);            
            const messageMap = new Map<string, ChatMessageIntf>();
            
            for (const row of rows) {
                // If this is a new message id we haven't processed yet
                if (!messageMap.has(row.id)) {
                    // Using explicit type conversion to ensure correct property mapping from PostgreSQL result
                    // PostgreSQL returns lowercase column names by default
                    const message: ChatMessageIntf = {
                        id: row.id,
                        state: MessageStates.SAVED, // anything from the DB is a SAVED state by definition
                        timestamp: Number(row.timestamp), // Ensure it's a number type
                        sender: row.sender,
                        content: row.content,
                        publicKey: row.public_key || null, // Using the actual column name from DB
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
     * Gets message IDs for a specific room, filtered by timestamp.
     * Useful for synchronization and retrieving only new messages.
     * 
     * @param roomId - ID or name of the room
     * @param cutoffTimestamp - Minimum timestamp for messages to include
     * @returns A Promise resolving to an array of message IDs
     */
    getMessageIdsForRoomWithDateFilter = async (roomId: string, cutoffTimestamp: number): Promise<string[]> => {
        try {
            // First, check if roomId is numeric (an actual ID) or a string (room name)
            const isNumeric = /^\d+$/.test(roomId);
            
            // Use appropriate query based on whether roomId is a numeric ID or string name
            const room = isNumeric 
                ? await this.get('SELECT id FROM rooms WHERE id = $1', parseInt(roomId, 10))
                : await this.get('SELECT id FROM rooms WHERE name = $1', roomId);
                
            if (!room) {
                return [];
            }
                
            // Add timestamp filter to only get messages after the cutoff date
            const messages = await this.all(
                'SELECT id FROM messages WHERE room_id = $1 AND timestamp >= $2', 
                room.id, cutoffTimestamp
            );
                
            return messages.map((msg: any) => msg.id);
        } catch (error) {
            console.error('Error retrieving filtered message IDs for room:', error);
            throw error;
        }
    }

    /**
     * Deletes a message and all associated attachments by message ID.
     * Verifies ownership using the provided public key for security.
     * Runs in a transaction to ensure consistency.
     * 
     * @param messageId - The ID of the message to delete
     * @param publicKey - The public key of the user requesting the deletion
     * @param adminPubKey - Optional admin public key that can delete any message
     * @returns A Promise resolving to true if deletion was successful, false otherwise
     */
    deleteMessage = async (messageId: string, publicKey: string, adminPubKey: string | null): Promise<boolean> => {
        return await runTrans(async () => {
            console.log(`Deleting message: ${messageId} and all associated attachments`);
    
            try {
            // Select the public key of the message to verify ownership, we already trust the publicKey argument because 
            // the HTTP request was verified by the server
                const results = await this.all('SELECT public_key FROM messages WHERE id = $1', messageId);

                // Check if the message exists and the public key matches
                if (results.length === 0) {
                    console.log(`Message '${messageId}' not found, nothing to delete`);
                    return false;
                }

                // Verify the public key matches (user owns the message) or publicKey is admin user
                if (results[0].public_key !== publicKey && publicKey !== adminPubKey) {
                    console.log(`Unauthorized deletion attempt for message '${messageId}'`);
                    return false;
                }
                
                // Delete all attachments associated with this message
                const attachmentResult = await this.run(
                    'DELETE FROM attachments WHERE message_id = $1', 
                    messageId
                );
                console.log(`Deleted ${attachmentResult.rowCount} attachments for message ${messageId}`);
                
                // Delete the message itself
                const messageResult: any = await this.run(
                    'DELETE FROM messages WHERE id = $1',
                    messageId
                );
                
                const success = messageResult.rowCount > 0;
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

/**
 * Singleton instance of the DBMessages class for managing chat message operations.
 */
export const dbMessages = new DBMessages();