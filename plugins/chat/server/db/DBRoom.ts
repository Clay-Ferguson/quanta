import { RoomInfo } from "../../../../common/types/CommonTypes.js";
import pgdb from "../../../../server/PGDB.js";
import { runTrans } from "../../../../server/Transactional.js";

/**
 * Database operations for managing chat rooms.
 * Provides methods to create, delete, and manipulate rooms and their contents.
 */
class DBRoom {
    /**
     * Deletes a room and all associated data (messages and attachments).
     * Uses a transaction to ensure database consistency.
     * 
     * @param roomName - The name of the room to delete
     * @returns A Promise resolving to true if deletion was successful, false otherwise
     */
    deleteRoom = async (roomName: string): Promise<boolean> => {
        return await runTrans(async () => {
            console.log(`Deleting room: ${roomName} and all associated data`);
        
            try {
            // First, get the room ID
                const room = await pgdb.get('SELECT id FROM rooms WHERE name = $1', roomName);
                if (!room) {
                    console.log(`Room '${roomName}' not found, nothing to delete`);
                    return false;
                }
                
                const roomId = room.id;
                console.log(`Found room ID ${roomId} for room '${roomName}'`);
                
                // Get all message IDs in this room to delete their attachments
                const messages = await pgdb.all('SELECT id FROM messages WHERE room_id = $1', roomId);
                const messageIds = messages.map(msg => msg.id);
                
                // If there are messages, delete their attachments first
                if (messageIds.length > 0) {
                    console.log(`Deleting attachments for ${messageIds.length} messages in room '${roomName}'`);
                    // Create placeholders for the query
                    const placeholders = messageIds.map((_, index) => `$${index + 1}`).join(',');
                    
                    // Delete all attachments associated with these messages
                    const attachmentResult = await pgdb.query(
                        `DELETE FROM attachments WHERE message_id IN (${placeholders})`, 
                        ...messageIds
                    );
                    console.log(`Deleted ${attachmentResult.rowCount} attachments`);
                }
                
                // Delete all messages in the room
                console.log(`Deleting messages in room '${roomName}'`);
                const messageResult = await pgdb.query('DELETE FROM messages WHERE room_id = $1', roomId);
                console.log(`Deleted ${messageResult.rowCount} messages`);
                
                // Finally, delete the room itself
                console.log(`Deleting room '${roomName}'`);
                const roomResult: any = await pgdb.query('DELETE FROM rooms WHERE id = $1', roomId);
                
                const success = roomResult.rowCount > 0;
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
     * Removes all messages and attachments from a specified room while keeping the room itself.
     * Uses a transaction to ensure database consistency.
     * 
     * @param roomName - The name of the room to clear of messages
     * @returns A Promise that resolves when the operation is complete
     */
    wipeRoom = async (roomName: string): Promise<void> => {
        await runTrans(async () => {
            console.log(`Wiping all messages from room: ${roomName}`);
            
            // Get the room ID
            const room = await pgdb.get('SELECT id FROM rooms WHERE name = $1', roomName);
            if (!room) {
                console.log(`Room '${roomName}' not found, nothing to wipe`);
                return;
            }
            
            // Get all message IDs in this room to delete their attachments
            const messages = await pgdb.all('SELECT id FROM messages WHERE room_id = $1', room.id);
            const messageIds = messages.map((msg: any) => msg.id);
            
            // If there are messages, delete their attachments first
            if (messageIds.length > 0) {
            // Create placeholders for the query
                const placeholders = messageIds.map((_, index) => `$${index + 1}`).join(',');
                
                // Delete all attachments associated with these messages
                await pgdb.query(`DELETE FROM attachments WHERE message_id IN (${placeholders})`, ...messageIds);
            }
            
            // Delete all messages in the room
            const result = await pgdb.query('DELETE FROM messages WHERE room_id = $1', room.id);
            console.log(`Successfully wiped ${result.rowCount} messages from room '${roomName}'`);
        })
    }
    
    /**
     * Creates test data in a dedicated 'test' room.
     * Generates 70 test messages (10 per day for a week) with timestamps.
     * First wipes the existing 'test' room to ensure clean data.
     * 
     * @returns A Promise that resolves when test data creation is complete
     */
    createTestData = async (): Promise<void> => {
        await runTrans(async () => {
            const roomName = 'test';
            console.log('Creating test data...');
            
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
                    await pgdb.query(
                        `INSERT INTO messages (id, room_id, timestamp, sender, content, public_key, signature)
                             VALUES ($1, $2, $3, $4, $5, $6, $7)
                             ON CONFLICT (id) DO NOTHING`,
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

    /**
     * Gets an existing room by name or creates it if it doesn't exist.
     * 
     * @param roomName - The name of the room to find or create
     * @returns A Promise resolving to the numeric ID of the room
     */
    async getOrCreateRoom(roomName: string): Promise<number> {
        // Check if room exists
        let result = await pgdb.get('SELECT id FROM rooms WHERE name = $1', roomName);
        if (result) {
            return result.id;
        }
        else {
            console.log(`Room '${roomName}' not found, creating new room`);
            // dump rooms
            const rooms = await pgdb.all('SELECT * FROM rooms');
            console.log('    Current rooms:', rooms);
        }
        
        // Create new room if it doesn't exist
        result = await pgdb.query('INSERT INTO rooms (name) VALUES ($1) RETURNING id', roomName);
        return result.rows[0].id;
    }

    /**
     * Gets information about all rooms including their message counts.
     * Results are ordered alphabetically by room name.
     * 
     * @returns A Promise resolving to an array of room information objects
     */
    getAllRoomsInfo = async (): Promise<RoomInfo[]> => {
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
        
            const rooms = await pgdb.all(query);
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
}

/**
 * Singleton instance of the DBRoom class for managing chat room operations.
 */
export const dbRoom = new DBRoom();