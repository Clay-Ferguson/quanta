import { Request, Response } from 'express';
import { svrUtil } from "../../../server/ServerUtil.js";
import AdmZip from 'adm-zip';
import { docUtil } from './DocUtil.js';
import pgdb from '../../../server/db/PGDB.js';
import vfs from './VFS.js';
import path from 'path';
import fs from 'fs';

// Directory for temporary files (mounted as a volume in Docker)
const TMP_DIR = '/app/dist/server/tmp';

class ExportArchive {
    export = async (req: Request, res: Response): Promise<void> => {
        const owner_id = svrUtil.getOwnerId(req, res);
        if (owner_id == null) {
            return;
        }

        const nodeId = req.body.nodeId as string;
        if (!nodeId) {
            res.status(400).json({ error: 'nodeId is required' });
            return;
        }

        try {
            const rootPath = await docUtil.getPathByUUID(nodeId);
            if (!rootPath) {
                res.status(404).json({ error: 'Node not found' });
                return;
            }

            // Get the root node to determine if it's a file or folder and get its name
            const rootNodeRes = await pgdb.query('SELECT * FROM vfs_nodes WHERE uuid = $1', nodeId);
            if (rootNodeRes.rows.length === 0) {
                res.status(404).json({ error: 'Node not found' });
                return;
            }
            const rootNode = rootNodeRes.rows[0];
            
            // Calculate the base path length to trim for zip entries
            // We want the zip to contain the root node itself.
            // So if rootPath is /usr/clay/docs/MyFolder, we want entries like MyFolder/...
            // The parent path is /usr/clay/docs.
            const parentPath = rootNode.parent_path;
            const basePathLen = parentPath.length === 0 ? 0 : parentPath.length + 1; // +1 for the slash

            const zip = new AdmZip();

            // Fetch all descendants (and the node itself)
            const rows = await vfs.getNodeWithDescendants(nodeId, rootPath);
            
            for (const row of rows) {
                // Construct full path for this node
                const fullPath = row.parent_path ? `${row.parent_path}/${row.filename}` : row.filename;
                
                // Calculate relative path for zip
                const relativePath = fullPath.substring(basePathLen);
                
                if (row.is_directory) {
                    zip.addFile(relativePath + '/', Buffer.alloc(0));
                } else {
                    let content: Buffer;
                    if (row.is_binary && row.content_binary) {
                        content = row.content_binary;
                    } else if (row.content_text) {
                        content = Buffer.from(row.content_text, 'utf-8');
                    } else {
                        content = Buffer.alloc(0);
                    }
                    zip.addFile(relativePath, content);
                }
            }

            const timestamp = Date.now();
            const fileName = `${rootNode.filename}-${timestamp}.zip`;
            const filePath = path.join(TMP_DIR, fileName);

            zip.writeZip(filePath);

            const downloadLink = `/api/docs/archive/download/${fileName}`;
            res.json({ downloadLink });

        } catch (error) {
            console.error('Export failed', error);
            res.status(500).json({ error: 'Export failed' });
        }
    }

    download = async (req: Request, res: Response): Promise<void> => {
        const fileName = req.params.fileName;
        if (!fileName || !fileName.endsWith('.zip')) {
            res.status(400).send('Invalid filename');
            return;
        }
        
        // Basic sanitization to prevent directory traversal
        if (fileName.includes('..') || fileName.includes('/')) {
            res.status(400).send('Invalid filename');
            return;
        }

        const filePath = path.join(TMP_DIR, fileName);

        if (!fs.existsSync(filePath)) {
            res.status(404).send('File not found');
            return;
        }

        res.download(filePath, fileName, (err) => {
            if (err) {
                console.error('Download error', err);
            }
        });
    }
}

export const exportArchive = new ExportArchive();
