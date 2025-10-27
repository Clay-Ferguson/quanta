import { AttachmentInfo, FileBlob } from "../../../../common/types/CommonTypes.js";
import pgdb from "../../../../server/db/PGDB.js";

/**
 * Database operations for handling file attachments.
 * Provides methods to retrieve, delete, and query attachment records.
 */
class DBAttachments {

    /**
     * Retrieves an attachment by its ID.
     * 
     * @param id - The numeric ID of the attachment to retrieve
     * @returns A Promise resolving to the attachment data with type information, or null if not found
     */
    getAttachmentById = async (id: number): Promise<FileBlob | null> => {
        try {
            const attachment = await pgdb.get(
                'SELECT data, type, name, size FROM attachments WHERE id = $1',
                id
            );
                
            if (!attachment) {
                return null;
            }
                
            const ret: FileBlob = {
                data: attachment.data,
                type: attachment.type,
                name: attachment.name,
                size: attachment.size,
            };
            return ret;
        } catch (error) {
            console.error('Error retrieving attachment:', error);
            return null;
        }
    }
    
    /**
     * Deletes an attachment from the database by its ID.
     * 
     * @param id - The numeric ID of the attachment to delete
     * @returns A Promise resolving to true if deletion was successful, false otherwise
     */
    deleteAttachmentById = async (id: number): Promise<boolean> => {
        try {
            if (isNaN(id) || id <= 0) {
                console.error('Invalid attachment ID:', id);
                return false;
            }

            // First verify the attachment exists
            const attachment = await pgdb.get('SELECT id FROM attachments WHERE id = $1', id);
            if (!attachment) {
                console.log(`Attachment with ID ${id} not found`);
                return false;
            }

            // Delete the attachment
            const result: any = await pgdb.query('DELETE FROM attachments WHERE id = $1', id);
            
            // Check if a row was affected
            const success = result.rowCount > 0;
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
     * Retrieves the most recent attachments with additional metadata.
     * 
     * Returns attachment information along with associated message and room details.
     * Results are ordered by message timestamp, most recent first.
     * 
     * @param limit - Maximum number of attachments to return (defaults to 100)
     * @returns A Promise resolving to an array of attachment information objects
     */
    getRecentAttachments = async (limit = 100): Promise<AttachmentInfo[]> => {
        try {
            const query = `
                    SELECT 
                        a.id, 
                        a.name, 
                        a.type, 
                        a.size, 
                        a.message_id as messageId,
                        m.sender,
                        m.public_key as publicKey,
                        m.timestamp,
                        r.name as roomName
                    FROM attachments a
                    JOIN messages m ON a.message_id = m.id
                    JOIN rooms r ON m.room_id = r.id
                    ORDER BY m.timestamp DESC
                    LIMIT $1
                `;
                
            const rows = await pgdb.all(query, limit);
            
            // Convert the rows to ensure proper data types and handle PostgreSQL case sensitivity
            const attachments: AttachmentInfo[] = rows.map((row: any) => ({
                id: parseInt(row.id),
                name: row.name || '',
                type: row.type || '',
                size: parseInt(row.size) || 0,
                messageId: row.messageid || row.messageId || '',
                sender: row.sender || '',
                publicKey: row.publickey || row.publicKey || '',
                timestamp: parseInt(row.timestamp) || 0,
                roomName: row.roomname || row.roomName || ''
            }));
            
            return attachments;
        } catch (error) {
            console.error('Error getting recent attachments:', error);
            return [];
        }
    }
}

/**
 * Singleton instance of the DBAttachments class for managing attachment operations.
 */
export const dbAttachments = new DBAttachments();