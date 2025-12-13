import { Request, Response } from 'express';
import { svrUtil } from "../../../server/ServerUtil.js";
import * as tar from 'tar';
import * as zlib from 'zlib';
import AdmZip from 'adm-zip';
import vfs from './VFS.js';
import { docUtil } from './DocUtil.js';
import path from 'path';

class ImportArchive {
    doImport = async (req: Request, res: Response): Promise<void> => {
        const owner_id = svrUtil.getOwnerId(req, res);
        if (owner_id == null) {
            return;
        }

        const contentType = req.headers['content-type'];
        if (!contentType || !contentType.includes('multipart/form-data')) {
            res.status(400).json({ error: 'Content-Type must be multipart/form-data' });
            return;
        }

        const boundary = contentType.split('boundary=')[1];
        if (!boundary) {
            res.status(400).json({ error: 'No boundary found in multipart data' });
            return;
        }

        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
        });

        req.on('end', async () => {
            const buffer = Buffer.concat(chunks);
            const boundaryBuffer = Buffer.from(`--${boundary}`);
            const parts = this.parseMultipartData(buffer, boundaryBuffer);

            let nodeId = '';
            let file: { name: string; data: Buffer; size: number } | null = null;

            for (const part of parts) {
                const headerEnd = part.indexOf('\r\n\r\n');
                if (headerEnd === -1) continue;

                const headers = part.subarray(0, headerEnd).toString();
                const body = part.subarray(headerEnd + 4);

                const dispositionMatch = headers.match(/Content-Disposition: form-data; name="([^"]+)"(?:; filename="([^"]+)")?/);
                if (!dispositionMatch) continue;

                const fieldName = dispositionMatch[1];
                const filename = dispositionMatch[2];

                if (filename) {
                    file = {
                        name: filename,
                        data: body.subarray(0, body.length - 2),
                        size: body.length - 2
                    };
                } else {
                    const value = body.toString().replace(/\r\n$/, '');
                    if (fieldName === 'nodeId') {
                        nodeId = value;
                    }
                }
            }

            if (nodeId && file) {
                console.log(`Importing archive. Node ID: ${nodeId}, File: ${file.name}, Size: ${file.size} bytes`);

                try {
                    const targetPath = await docUtil.getPathByUUID(nodeId);
                    if (!targetPath) {
                        res.status(404).json({ error: 'Target folder not found' });
                        return;
                    }

                    const dirsToReorder = new Set<string>();
                    dirsToReorder.add(targetPath);

                    // Handle ZIP files
                    if (file.name.endsWith('.zip')) {
                        try {
                            const zip = new AdmZip(file.data);
                            const zipEntries = zip.getEntries();

                            for (const entry of zipEntries) {
                                await this.processEntry(owner_id!, targetPath, entry.entryName, entry.isDirectory, entry.isDirectory ? null : entry.getData(), dirsToReorder);
                            }
                        } catch (e) {
                            console.error("ZIP processing failed", e);
                            res.status(400).json({ error: 'Failed to process ZIP file' });
                            return;
                        }
                    }
                    // Handle Gzip Tar files
                    else if (file.name.endsWith('.tar.gz') || file.name.endsWith('.tgz')) {
                        let tarData: Buffer;
                        try {
                            tarData = zlib.gunzipSync(file.data);
                        } catch (e) {
                            console.error("Gzip decompression failed", e);
                            res.status(400).json({ error: 'Failed to decompress gzip file' });
                            return;
                        }

                        const parser = new tar.Parser();
                        const processingPromises: Promise<void>[] = [];

                        parser.on('entry', (entry) => {
                            const p = (async () => {
                                const type = entry.type;
                                let content: Buffer | null = null;
                                if (type === 'File' || type === 'OldFile' || type === 'ContiguousFile') {
                                    content = await entry.concat();
                                }
                                
                                if (type === 'Directory' || content !== null) {
                                    await this.processEntry(owner_id!, targetPath, entry.path, type === 'Directory', content, dirsToReorder);
                                }
                                entry.resume();
                            })();
                            processingPromises.push(p);
                        });

                        parser.end(tarData);

                        await new Promise<void>((resolve, reject) => { 
                            parser.on('end', () => resolve());
                            parser.on('error', reject);
                        });

                        await Promise.all(processingPromises);
                    }
                    else {
                        res.status(400).json({ error: 'Unsupported file format. Please use .zip, .tar.gz, or .tgz' });
                        return;
                    }

                    // Final pass: reorder ordinals
                    for (const dirPath of dirsToReorder) {
                        await this.reorderDirectory(owner_id!, dirPath);
                    }

                    res.json({ success: true });
                } catch (ex) {
                    console.error("Import failed", ex);
                    res.status(500).json({ error: 'Import failed' });
                }
            } else {
                res.status(400).json({ error: 'Missing nodeId or file' });
            }
        });
    }

    private async processEntry(owner_id: number, targetPath: string, entryPath: string, isDirectory: boolean, content: Buffer | null, dirsToReorder: Set<string>) {
        // Simple sanitization to prevent directory traversal
        if (entryPath.includes('..')) {
            console.warn(`Skipping suspicious path: ${entryPath}`);
            return;
        }

        const fullPath = path.join(targetPath, entryPath);
        const parentPath = path.dirname(fullPath);
        dirsToReorder.add(parentPath);

        try {
            if (isDirectory) {
                await vfs.mkdirEx(owner_id, fullPath, { recursive: true });
                dirsToReorder.add(fullPath);
            } else if (content) {
                // Ensure parent directory exists (zip entries might not be ordered)
                await vfs.mkdirEx(owner_id, parentPath, { recursive: true });

                const ext = path.extname(fullPath);
                const isBinary = docUtil.isBinaryFile(ext);

                if (!isBinary) {
                    await vfs.writeFileEx(owner_id, fullPath, content.toString('utf8'), 'utf8', false);
                } else {
                    await vfs.writeFileEx(owner_id, fullPath, content, 'utf8', false);
                }
            }
        } catch (e) {
            console.error(`Failed to process entry ${entryPath}`, e);
        }
    }

    private async reorderDirectory(owner_id: number, dirPath: string) {
        try {
            const children = await vfs.readdirEx(owner_id, dirPath, false);
            children.sort((a, b) => a.name.localeCompare(b.name));
            
            // First pass: set to temporary negative ordinals to avoid collisions
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                if (child.uuid) {
                    await vfs.setOrdinal(child.uuid, -(i + 1));
                }
            }

            // Second pass: set to correct positive ordinals
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                if (child.uuid) {
                    await vfs.setOrdinal(child.uuid, i);
                }
            }
        } catch (e) {
            console.error("reorderDirectory failed", e);
        }
    }

    private parseMultipartData(buffer: Buffer, boundary: Buffer): Buffer[] {
        const parts: Buffer[] = [];
        let start = 0;
        while (true) {
            const boundaryIndex = buffer.indexOf(boundary, start);
            if (boundaryIndex === -1) break;
            if (start > 0) {
                const part = buffer.subarray(start, boundaryIndex);
                if (part.length > 0) parts.push(part);
            }
            start = boundaryIndex + boundary.length;
            if (buffer[start] === 0x2D && buffer[start + 1] === 0x2D) break;
            if (buffer[start] === 0x0D && buffer[start + 1] === 0x0A) start += 2;
        }
        return parts;
    }
}

export const importArchive = new ImportArchive();