import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { svrUtil } from "../../ServerUtil.js";
import { config } from "../../Config.js";
import { docUtil } from "./DocUtil.js";

class DocBinary {
    /**
     * Serves image files from the document tree with appropriate content types and caching headers
     * @param req - Express request object with image path and docRootKey parameter
     * @param res - Express response object
     */
    serveDocImage = async (req: Request, res: Response): Promise<void> => {
        // console.log("Serve Doc Image Request:", req.path);
        try {
            // Extract the path after /api/docs/images/ and decode URL encoding
            const rawImagePath = req.path.replace(`/api/docs/images/${req.params.docRootKey}`, '');
            const imagePath = decodeURIComponent(rawImagePath);
            const root = config.getPublicFolderByKey(req.params.docRootKey).path;
            if (!root) {
                res.status(500).json({ error: `bad root key: ` });
                return;
            }

            if (!imagePath) {
                res.status(400).json({ error: 'Image path parameter is required' });
                return;
            }

            // Construct the absolute path to the image file
            const absoluteImagePath = path.join(root, imagePath);

            // Check if the file exists
            docUtil.checkFileAccess(absoluteImagePath, root);
            if (!fs.existsSync(absoluteImagePath)) {
                res.status(404).json({ error: 'Image file not found' });
                return;
            }

            // Check if it's actually a file (not a directory)
            const stat = fs.statSync(absoluteImagePath);
            if (!stat.isFile()) {
                res.status(400).json({ error: 'Path is not a file' });
                return;
            }

            // Validate that it's an image file by extension
            const ext = path.extname(absoluteImagePath).toLowerCase();
            if (!['.png', '.jpeg', '.jpg', '.gif', '.bmp', '.webp'].includes(ext)) {
                res.status(400).json({ error: 'File is not a supported image format' });
                return;
            }

            // Set appropriate content type based on file extension
            let contentType = 'image/jpeg'; // default
            switch (ext) {
            case '.png':
                contentType = 'image/png';
                break;
            case '.gif':
                contentType = 'image/gif';
                break;
            case '.bmp':
                contentType = 'image/bmp';
                break;
            case '.webp':
                contentType = 'image/webp';
                break;
            case '.jpg':
            case '.jpeg':
            default:
                contentType = 'image/jpeg';
                break;
            }

            // Set headers for image serving
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
            
            // Read and send the image file
            const imageBuffer = fs.readFileSync(absoluteImagePath);
            res.send(imageBuffer);
            
        } catch (error) {
            svrUtil.handleError(error, res, 'Failed to serve image');
        }
    }

    /**
     * Handles file uploads for the docs plugin with multipart form data parsing
     * Supports uploading multiple files with proper ordinal positioning
     * @param req - Express request object containing multipart form data with files, docRootKey, treeFolder, and insertAfterNode
     * @param res - Express response object
     */
    uploadFiles = async (req: Request, res: Response): Promise<void> => {
        try {
            // Parse the multipart form data manually
            const contentType = req.headers['content-type'];
            if (!contentType || !contentType.includes('multipart/form-data')) {
                res.status(400).json({ error: 'Content-Type must be multipart/form-data' });
                return;
            }
    
            // Extract boundary from content-type header
            const boundary = contentType.split('boundary=')[1];
            if (!boundary) {
                res.status(400).json({ error: 'No boundary found in multipart data' });
                return;
            }
    
            // Get raw body data
            const chunks: Buffer[] = [];
            req.on('data', (chunk: Buffer) => {
                chunks.push(chunk);
            });
    
            req.on('end', async () => {
                try {
                    const buffer = Buffer.concat(chunks);
                    const boundaryBuffer = Buffer.from(`--${boundary}`);
                        
                    // Parse multipart data
                    const parts = this.parseMultipartData(buffer, boundaryBuffer);
                        
                    // Extract form fields and files
                    let docRootKey = '';
                    let treeFolder = '';
                    let insertAfterNode = '';
                    const files: { name: string; data: Buffer; type: string }[] = [];
    
                    for (const part of parts) {
                        const headerEnd = part.indexOf('\r\n\r\n');
                        if (headerEnd === -1) continue;
    
                        const headers = part.slice(0, headerEnd).toString();
                        const body = part.slice(headerEnd + 4);
    
                        // Parse Content-Disposition header
                        const dispositionMatch = headers.match(/Content-Disposition: form-data; name="([^"]+)"(?:; filename="([^"]+)")?/);
                        if (!dispositionMatch) continue;
    
                        const fieldName = dispositionMatch[1];
                        const filename = dispositionMatch[2];
    
                        if (filename) {
                            // This is a file
                            const typeMatch = headers.match(/Content-Type: ([^\r\n]+)/);
                            const contentType = typeMatch ? typeMatch[1] : 'application/octet-stream';
                                
                            files.push({
                                name: filename,
                                data: body.slice(0, body.length - 2), // Remove trailing \r\n
                                type: contentType
                            });
                        } else {
                            // This is a form field
                            const value = body.toString().replace(/\r\n$/, ''); // Remove trailing \r\n
                                
                            switch (fieldName) {
                            case 'docRootKey':
                                docRootKey = value;
                                break;
                            case 'treeFolder':
                                treeFolder = value;
                                break;
                            case 'insertAfterNode':
                                insertAfterNode = value;
                                break;
                            }
                        }
                    }
    
                    if (!docRootKey || !treeFolder || files.length === 0) {
                        res.status(400).json({ error: 'Missing required fields: docRootKey, treeFolder, or files' });
                        return;
                    }
    
                    const root = config.getPublicFolderByKey(docRootKey).path;
                    if (!root) {
                        res.status(500).json({ error: 'Invalid docRootKey' });
                        return;
                    }
    
                    const absoluteFolderPath = path.join(root, treeFolder);
                    docUtil.checkFileAccess(absoluteFolderPath, root);
    
                    // Determine insert ordinal
                    let insertOrdinal = 1;
                    if (insertAfterNode) {
                        try {
                            insertOrdinal = docUtil.getOrdinalFromName(insertAfterNode) + 1;
                        } catch (error) {
                            console.warn(`Could not parse ordinal from insertAfterNode: ${insertAfterNode}, using default ordinal 1`, error);
                        }
                    }
    
                    // Shift existing files down to make room
                    docUtil.shiftOrdinalsDown(files.length, absoluteFolderPath, insertOrdinal, root, null);
    
                    // Save uploaded files with proper ordinal prefixes
                    let savedCount = 0;
                    for (let i = 0; i < files.length; i++) {
                        const file = files[i];
                        const ordinal = insertOrdinal + i;
                        const ordinalPrefix = ordinal.toString().padStart(4, '0');
                        const finalFileName = `${ordinalPrefix}_${file.name}`;
                        const finalFilePath = path.join(absoluteFolderPath, finalFileName);
    
                        try {
                            docUtil.checkFileAccess(finalFilePath, root);
                            
                            // Safety check: ensure target doesn't already exist to prevent overwriting
                            if (fs.existsSync(finalFilePath)) {
                                console.error(`Target file already exists, skipping upload: ${finalFilePath}`);
                                continue;
                            }
                            
                            fs.writeFileSync(finalFilePath, file.data);
                            savedCount++;
                            console.log(`Uploaded file saved: ${finalFilePath}`);
                        } catch {
                            console.error(`Error saving uploaded file ${file.name}:`);
                        }
                    }
    
                    res.json({ 
                        success: true, 
                        message: `Successfully uploaded ${savedCount} file(s)`,
                        uploadedCount: savedCount
                    });
    
                } catch {
                    console.error('Error processing upload:');
                    res.status(500).json({ error: 'Failed to process upload' });
                }
            });
    
        } catch (error) {
            svrUtil.handleError(error, res, 'Failed to upload files');
        }
    }
    
    /**
     * Helper method to parse multipart form data from a buffer
     * Splits the buffer into individual parts based on boundary markers
     * @param buffer - The raw buffer containing multipart data
     * @param boundary - The boundary buffer used to separate parts
     * @returns Array of Buffer objects representing individual parts
     */
    private parseMultipartData(buffer: Buffer, boundary: Buffer): Buffer[] {
        const parts: Buffer[] = [];
        let start = 0;
    
        while (true) {
            const boundaryIndex = buffer.indexOf(boundary, start);
            if (boundaryIndex === -1) break;
    
            if (start > 0) {
                // Extract the part between boundaries
                const part = buffer.slice(start, boundaryIndex);
                if (part.length > 0) {
                    parts.push(part);
                }
            }
    
            // Move past the boundary and the following \r\n
            start = boundaryIndex + boundary.length;
            if (buffer[start] === 0x2D && buffer[start + 1] === 0x2D) {
                // This is the final boundary (ends with --)
                break;
            }
            if (buffer[start] === 0x0D && buffer[start + 1] === 0x0A) {
                start += 2; // Skip \r\n
            }
        }
        return parts;
    }
}

export const docBinary = new DocBinary();
