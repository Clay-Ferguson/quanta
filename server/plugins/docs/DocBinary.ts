import { Request, Response } from 'express';
import path from 'path';
import { svrUtil } from "../../ServerUtil.js";
import { config } from "../../Config.js";
import { docUtil } from "./DocUtil.js";

/**
 * DocBinary class handles binary file operations for the docs plugin
 * 
 * This class provides functionality for:
 * - Serving image files from the document tree with proper content types and caching
 * - Handling file uploads with multipart form data parsing
 * - Managing ordinal-based file positioning in the document tree structure
 * 
 * The class ensures proper security checks, validates file types, and maintains
 * the hierarchical structure of documents with ordinal prefixes for ordering.
 */
class DocBinary {
    /**
     * Serves image files from the document tree with appropriate content types and caching headers
     * 
     * This method handles HTTP requests for image files stored in the document tree structure.
     * It validates the request, checks file permissions, determines the correct MIME type,
     * and serves the image with appropriate caching headers for optimal performance.
     * 
     * Security features:
     * - Validates docRootKey against configured public folders
     * - Checks file access permissions using ifs.checkFileAccess
     * - Validates file extensions to ensure only supported image formats are served
     * - Prevents directory traversal attacks through path validation
     * 
     * Supported image formats: PNG, JPEG, JPG, GIF, BMP, WEBP
     * 
     * @param req - Express request object containing:
     *              - req.path: The request path containing the image path
     *              - req.params.docRootKey: Key identifying the document root folder
     * @param res - Express response object for sending the image data
     * @returns Promise<void> - Resolves when the image is served or an error response is sent
     */
    serveDocImage = async (req: Request, res: Response): Promise<void> => {
        // console.log("Serve Doc Image Request:", req.path);
        try {
            // Extract the relative image path from the request URL
            // Remove the API prefix and docRootKey to get the actual file path
            const rawImagePath = req.path.replace(`/api/docs/images/${req.params.docRootKey}`, '');
            const imagePath = decodeURIComponent(rawImagePath);
            
            // Get the appropriate file system implementation
            const ifs = docUtil.getFileSystem(req.params.docRootKey);
            
            // Resolve the document root path using the provided key
            const root = config.getPublicFolderByKey(req.params.docRootKey).path;
            if (!root) {
                res.status(500).json({ error: `bad root key: ` });
                return;
            }

            // Validate that an image path was provided
            if (!imagePath) {
                res.status(400).json({ error: 'Image path parameter is required' });
                return;
            }

            // Construct the absolute path to the image file
            const absoluteImagePath = path.join(root, imagePath);

            // Perform security check to ensure file is within allowed directory
            // and verify file exists
            ifs.checkFileAccess(absoluteImagePath, root);
            if (!await ifs.exists(absoluteImagePath)) {
                res.status(404).json({ error: 'Image file not found' });
                return;
            }

            // Verify the path points to a file, not a directory
            const stat = await ifs.stat(absoluteImagePath);
            if (!stat.isFile()) {
                res.status(400).json({ error: 'Path is not a file' });
                return;
            }

            // Validate file extension against supported image formats
            const ext = path.extname(absoluteImagePath).toLowerCase();
            if (!['.png', '.jpeg', '.jpg', '.gif', '.bmp', '.webp'].includes(ext)) {
                res.status(400).json({ error: 'File is not a supported image format' });
                return;
            }

            // Determine the appropriate MIME type based on file extension
            let contentType = 'image/jpeg'; // Default fallback
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

            // Set HTTP headers for optimal image delivery
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
            
            // Read the image file and send it as the response
            const imageBuffer = await ifs.readFile(absoluteImagePath);
            res.send(imageBuffer);
            
        } catch (error) {
            // Handle any errors that occur during image serving
            svrUtil.handleError(error, res, 'Failed to serve image');
        }
    }

    /**
     * Handles file uploads for the docs plugin with multipart form data parsing
     * 
     * This method processes multipart form data uploads containing multiple files and metadata.
     * It manually parses the multipart data to extract files and form fields, then saves the
     * files to the document tree with proper ordinal-based naming for hierarchical organization.
     * 
     * Key features:
     * - Manual multipart form data parsing (no external dependencies)
     * - Support for multiple file uploads in a single request
     * - Ordinal-based file naming for maintaining document order
     * - Automatic ordinal shifting to insert files at specific positions
     * - Security validation of file paths and access permissions
     * 
     * Form data fields expected:
     * - docRootKey: Key identifying the target document root folder
     * - treeFolder: Relative path to the target folder within the document tree
     * - insertAfterNode: Optional node name to determine insertion position
     * - files: One or more file uploads
     * 
     * File naming convention:
     * Files are saved with ordinal prefixes (e.g., "0001_filename.txt") to maintain
     * order within the document tree structure.
     * 
     * @param req - Express request object containing multipart form data with:
     *              - Content-Type: multipart/form-data with boundary
     *              - Body: Raw multipart data containing files and form fields
     * @param res - Express response object for sending upload results
     * @returns Promise<void> - Resolves when upload processing is complete
     */
    uploadFiles = async (req: Request, res: Response): Promise<void> => {
        try {
            // Validate that the request contains multipart form data
            const contentType = req.headers['content-type'];
            if (!contentType || !contentType.includes('multipart/form-data')) {
                res.status(400).json({ error: 'Content-Type must be multipart/form-data' });
                return;
            }
    
            // Extract the boundary string used to separate multipart sections
            const boundary = contentType.split('boundary=')[1];
            if (!boundary) {
                res.status(400).json({ error: 'No boundary found in multipart data' });
                return;
            }
    
            // Collect raw request body data as it streams in
            const chunks: Buffer[] = [];
            req.on('data', (chunk: Buffer) => {
                chunks.push(chunk);
            });
    
            // Process the complete request body when all data has been received
            req.on('end', async () => {
                try {
                    // Combine all chunks into a single buffer for parsing
                    const buffer = Buffer.concat(chunks);
                    const boundaryBuffer = Buffer.from(`--${boundary}`);
                        
                    // Parse the multipart data into individual sections
                    const parts = this.parseMultipartData(buffer, boundaryBuffer);
                        
                    // Initialize variables to store extracted form data
                    let docRootKey = '';
                    let treeFolder = '';
                    let insertAfterNode = '';
                    const files: { name: string; data: Buffer; type: string }[] = [];
    
                    // Process each multipart section to extract form fields and files
                    for (const part of parts) {
                        // Find the end of headers (marked by double CRLF)
                        const headerEnd = part.indexOf('\r\n\r\n');
                        if (headerEnd === -1) continue;
    
                        // Split headers and body content
                        const headers = part.slice(0, headerEnd).toString();
                        const body = part.slice(headerEnd + 4);
    
                        // Parse the Content-Disposition header to determine field type
                        const dispositionMatch = headers.match(/Content-Disposition: form-data; name="([^"]+)"(?:; filename="([^"]+)")?/);
                        if (!dispositionMatch) continue;
    
                        const fieldName = dispositionMatch[1];
                        const filename = dispositionMatch[2];
    
                        if (filename) {
                            // This section contains a file upload
                            const typeMatch = headers.match(/Content-Type: ([^\r\n]+)/);
                            const contentType = typeMatch ? typeMatch[1] : 'application/octet-stream';
                                
                            files.push({
                                name: filename,
                                data: body.slice(0, body.length - 2), // Remove trailing \r\n
                                type: contentType
                            });
                        } else {
                            // This section contains a form field
                            const value = body.toString().replace(/\r\n$/, ''); // Remove trailing \r\n
                                
                            // Store form field values based on field name
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
    
                    // Validate that all required fields are present
                    if (!docRootKey || !treeFolder || files.length === 0) {
                        res.status(400).json({ error: 'Missing required fields: docRootKey, treeFolder, or files' });
                        return;
                    }
    
                    // Resolve the document root path and validate access
                    const root = config.getPublicFolderByKey(docRootKey).path;
                    if (!root) {
                        res.status(500).json({ error: 'Invalid docRootKey' });
                        return;
                    }

                    // Get the appropriate file system implementation
                    const ifs = docUtil.getFileSystem(docRootKey);
    
                    // Construct target folder path and validate permissions
                    const absoluteFolderPath = path.join(root, treeFolder);
                    ifs.checkFileAccess(absoluteFolderPath, root);
    
                    // Determine the ordinal position for inserting new files
                    let insertOrdinal = 1; // Default to beginning if no position specified
                    if (insertAfterNode) {
                        try {
                            // Extract ordinal from the specified node and insert after it
                            insertOrdinal = docUtil.getOrdinalFromName(insertAfterNode) + 1;
                        } catch (error) {
                            console.warn(`Could not parse ordinal from insertAfterNode: ${insertAfterNode}, using default ordinal 1`, error);
                        }
                    }
    
                    // Shift existing files down to make room for new uploads
                    // This maintains the ordinal sequence without gaps
                    await docUtil.shiftOrdinalsDown(files.length, absoluteFolderPath, insertOrdinal, root, null, ifs);
    
                    // Save each uploaded file with proper ordinal prefix
                    let savedCount = 0;
                    for (let i = 0; i < files.length; i++) {
                        const file = files[i];
                        const ordinal = insertOrdinal + i;
                        
                        // Create zero-padded ordinal prefix (e.g., "0001", "0002")
                        const ordinalPrefix = ordinal.toString().padStart(4, '0');
                        const finalFileName = `${ordinalPrefix}_${file.name}`;
                        const finalFilePath = path.join(absoluteFolderPath, finalFileName);
    
                        try {
                            // Validate file access permissions
                            ifs.checkFileAccess(finalFilePath, root);
                            
                            // Prevent overwriting existing files
                            if (await ifs.exists(finalFilePath)) {
                                console.error(`Target file already exists, skipping upload: ${finalFilePath}`);
                                continue;
                            }
                            
                            // Write the file data to disk
                            await ifs.writeFile(finalFilePath, file.data);
                            savedCount++;
                            console.log(`Uploaded file saved: ${finalFilePath}`);
                        } catch {
                            console.error(`Error saving uploaded file ${file.name}:`);
                        }
                    }
    
                    // Send success response with upload statistics
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
            // Handle any top-level errors in the upload process
            svrUtil.handleError(error, res, 'Failed to upload files');
        }
    }
    
    /**
     * Helper method to parse multipart form data from a buffer
     * 
     * This method manually parses multipart/form-data content by locating boundary markers
     * and extracting individual parts. It handles the RFC 7578 multipart format without
     * relying on external parsing libraries.
     * 
     * The parsing process:
     * 1. Locates boundary markers in the buffer
     * 2. Extracts content between boundaries as individual parts
     * 3. Handles both intermediate boundaries and final boundary (ending with --)
     * 4. Skips CRLF characters following boundaries
     * 
     * Boundary format in multipart data:
     * - Intermediate: --{boundary}\r\n
     * - Final: --{boundary}--\r\n
     * 
     * @param buffer - The raw buffer containing the complete multipart form data
     * @param boundary - The boundary buffer used to separate individual parts
     * @returns Array of Buffer objects, each representing one multipart section
     *          (including headers and body content)
     */
    private parseMultipartData(buffer: Buffer, boundary: Buffer): Buffer[] {
        const parts: Buffer[] = [];
        let start = 0;
    
        // Search for boundary markers throughout the buffer
        while (true) {
            const boundaryIndex = buffer.indexOf(boundary, start);
            if (boundaryIndex === -1) break; // No more boundaries found
    
            if (start > 0) {
                // Extract the content between the previous boundary and current boundary
                const part = buffer.slice(start, boundaryIndex);
                if (part.length > 0) {
                    parts.push(part);
                }
            }
    
            // Move past the current boundary
            start = boundaryIndex + boundary.length;
            
            // Check if this is the final boundary (ends with --)
            if (buffer[start] === 0x2D && buffer[start + 1] === 0x2D) {
                // Final boundary found (--boundary--), stop parsing
                break;
            }
            
            // Skip CRLF characters that follow the boundary
            if (buffer[start] === 0x0D && buffer[start + 1] === 0x0A) {
                start += 2; // Skip \r\n
            }
        }
        return parts;
    }
}

export const docBinary = new DocBinary();
