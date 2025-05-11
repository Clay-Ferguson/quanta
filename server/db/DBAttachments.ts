import { AttachmentInfo, DBManagerIntf, FileBlob } from "@common/CommonTypes.js";

class DBAttachments {
    dbm: DBManagerIntf | null = null;

    /**
     * Retrieves an attachment by its ID
     * @param id The ID of the attachment
     * @returns The attachment data with type information
     */
    getAttachmentById = async (id: number): Promise<FileBlob | null> => {
        try {
            const attachment = await this.dbm!.get(
                'SELECT data, type, name, size FROM attachments WHERE id = ?',
                [id]
            );
                
            if (!attachment) {
                return null;
            }
                
            return {
                data: attachment.data,
                type: attachment.type,
                name: attachment.name,
                size: attachment.size,
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
            const attachment = await this.dbm!.get('SELECT id FROM attachments WHERE id = ?', [id]);
            if (!attachment) {
                console.log(`Attachment with ID ${id} not found`);
                return false;
            }

            // Delete the attachment
            const result: any = await this.dbm!.run('DELETE FROM attachments WHERE id = ?', [id]);
            
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
    getRecentAttachments = async (limit = 100): Promise<AttachmentInfo[]> => {
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
                
            const attachments = await this.dbm!.all(query, [limit]);
            return attachments;
        } catch (error) {
            console.error('Error getting recent attachments:', error);
            return [];
        }
    }
}

export const dbAttachments = new DBAttachments();