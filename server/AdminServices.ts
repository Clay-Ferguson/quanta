
import { DBManager } from './DBManager.js';

class AdminServices {
    getRecentAttachments = async (db: DBManager, req: any, res: any) => {
        try {
            const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
            const attachments = await db.getRecentAttachments(limit);
            
            // Build HTML response
            let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Recent Attachments</title>
                <style>
                    table { border-collapse: collapse; width: 100%; }
                    th, td { padding: 8px; text-align: left; border: 1px solid #ddd; }
                    th { background-color: #f2f2f2; }
                    img { max-width: 200px; height: auto; }
                    .timestamp { font-size: 0.8em; color: #666; }
                </style>
            </head>
            <body>
                <h1>Recent Attachments (${attachments.length})</h1>
                <table>
                    <tr>
                        <th>ID</th>
                        <th>Preview</th>
                        <th>Details</th>
                        <th>Sender</th>
                        <th>Room</th>
                    </tr>
            `;
            
            // Format date function
            const formatDate = (timestamp: any) => {
                return new Date(timestamp).toLocaleString();
            };
            
            // Add rows for each attachment
            attachments.forEach(attachment => {
                const isImage = attachment.type.startsWith('image/');
                
                html += `
                    <tr>
                        <td>${attachment.id}</td>
                        <td>
                            ${isImage 
        ? `<img src="/api/attachments/${attachment.id}" alt="${attachment.name}">` 
        : `<span>${attachment.name}</span>`
}
                        </td>
                        <td>
                            <div>Name: ${attachment.name}</div>
                            <div>Type: ${attachment.type}</div>
                            <div>Size: ${(attachment.size / 1024).toFixed(2)} KB</div>
                            <div class="timestamp">Uploaded: ${formatDate(attachment.timestamp)}</div>
                        </td>
                        <td>${attachment.sender}<br>${attachment.public_key}</td>
                        <td>${attachment.room_name}</td>
                    </tr>
                `;
            });
            
            html += `
                </table>
            </body>
            </html>
            `;
            
            res.setHeader('Content-Type', 'text/html');
            res.send(html);
        } catch (error) {
            console.error('Error serving recent attachments page:', error);
            res.status(500).send('Error retrieving attachments');
        }
    }
}

export const adminServices = new AdminServices();
