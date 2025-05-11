import { DBManagerIntf, RoomInfo } from "@common/CommonTypes.js";

class DBRoom {
    dbm: DBManagerIntf | null = null;

    /**
     * Deletes a room and all associated data (messages and attachments)
     * @param roomName The name of the room to delete
     * @returns Whether the operation was successful
     */
    deleteRoom = async (roomName: string): Promise<boolean> => {
        console.log(`Deleting room: ${roomName} and all associated data`);
        
        return this.dbm!.runTrans(async () => {
            try {
                // First, get the room ID
                const room = await this.dbm!.get('SELECT id FROM rooms WHERE name = ?', roomName);
                if (!room) {
                    console.log(`Room '${roomName}' not found, nothing to delete`);
                    return false;
                }
                
                const roomId = room.id;
                console.log(`Found room ID ${roomId} for room '${roomName}'`);
                
                // Get all message IDs in this room to delete their attachments
                const messages = await this.dbm!.all('SELECT id FROM messages WHERE room_id = ?', roomId);
                const messageIds = messages.map(msg => msg.id);
                
                // If there are messages, delete their attachments first
                if (messageIds.length > 0) {
                    console.log(`Deleting attachments for ${messageIds.length} messages in room '${roomName}'`);
                    // Create placeholders for the query
                    const placeholders = messageIds.map(() => '?').join(',');
                    
                    // Delete all attachments associated with these messages
                    const attachmentResult = await this.dbm!.run(
                        `DELETE FROM attachments WHERE message_id IN (${placeholders})`, 
                        messageIds
                    );
                    console.log(`Deleted ${attachmentResult.changes} attachments`);
                }
                
                // Delete all messages in the room
                console.log(`Deleting messages in room '${roomName}'`);
                const messageResult = await this.dbm!.run('DELETE FROM messages WHERE room_id = ?', roomId);
                console.log(`Deleted ${messageResult.changes} messages`);
                
                // Finally, delete the room itself
                console.log(`Deleting room '${roomName}'`);
                const roomResult: any = await this.dbm!.run('DELETE FROM rooms WHERE id = ?', roomId);
                
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
            
        this.dbm!.runTrans(async () => {
            // Get the room ID
            const room = await this.dbm!.get('SELECT id FROM rooms WHERE name = ?', roomName);
            if (!room) {
                console.log(`Room '${roomName}' not found, nothing to wipe`);
                return;
            }
            
            // Get all message IDs in this room to delete their attachments
            const messages = await this.dbm!.all('SELECT id FROM messages WHERE room_id = ?', room.id);
            const messageIds = messages.map((msg: any) => msg.id);
            
            // If there are messages, delete their attachments first
            if (messageIds.length > 0) {
                // Create placeholders for the query
                const placeholders = messageIds.map(() => '?').join(',');
                
                // Delete all attachments associated with these messages
                await this.dbm!.run(`DELETE FROM attachments WHERE message_id IN (${placeholders})`, messageIds);
            }
            
            // Delete all messages in the room
            const result = await this.dbm!.run('DELETE FROM messages WHERE room_id = ?', room.id);
            console.log(`Successfully wiped ${result.changes} messages from room '${roomName}'`);
        });
    }
    
    createTestData = async (): Promise<void> => {
        const roomName = 'test';
        console.log('Creating test data...');
            
        this.dbm!.runTrans(async () => {
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
                    await this.dbm!.run(
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

    async getOrCreateRoom(roomName: string): Promise<number> {
        // Check if room exists
        let result = await this.dbm!.get('SELECT id FROM rooms WHERE name = ?', roomName);
        if (result) {
            return result.id;
        }
        
        // Create new room if it doesn't exist
        result = await this.dbm!.run('INSERT INTO rooms (name) VALUES (?)', roomName);
        return result.lastID;
    }

    /**
     * Gets information about all rooms including their message counts
     * @returns An array of room information objects
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
        
            const rooms = await this.dbm!.all(query);
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

export const dbRoom = new DBRoom();