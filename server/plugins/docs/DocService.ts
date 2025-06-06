import { TreeNode } from "../../../common/types/CommonTypes.js";
import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import {  TreeRender_Response } from "../../../common/types/EndpointTypes.js";
import { svrUtil } from "../../ServerUtil.js";
import { config } from "../../Config.js";
const { exec } = await import('child_process');

class DocService {
    
    getOrdinalFromName = (file: string): number => {
        // use regex go make sure the ordinal is a number followed by an underscore
        if (!/^\d+_/.test(file)) {
            throw new Error(`Invalid file name format: ${file}. Expected format is "NNNN_" where N is a digit.`);
        }
        const prefix = file.substring(0, file.indexOf('_'));
        const ordinal = parseInt(prefix);
        return ordinal;
    }

    checkFileAccess = (filename: string, root: string) => {        
        if (!filename) {
            throw new Error('Invalid file access: '+filename);
        }
        
        // Get the canonical (resolved) paths to prevent directory traversal attacks
        const canonicalFilename = path.resolve(filename);
        const canonicalRoot = path.resolve(root);
        
        // Check if the canonical path is within the allowed root directory
        if (!canonicalFilename.startsWith(canonicalRoot + path.sep) && canonicalFilename !== canonicalRoot) {
            throw new Error('Invalid file access: '+filename);
        }
    }

    /**
     * Tree render method that returns an array of TreeNode objects representing files and folders
     * @param req - Express request object containing treeFolder in the URL path and optional pullup query parameter
     * @param res - Express response object
     * 
     * NOTE: A 'pullup' means that when a folder ends with an underscore, it is treated as a pullup folder,
     * meaning its contents are included inline in the tree structure. This allows for a flat view of nested folders, for
     * folders that are meant to be used as pullups.
     */
    treeRender = async (req: Request<{ docRootKey: string }, any, any, { pullup?: string }>, res: Response): Promise<void> => {
        const pathName = req.path.replace("//", "/"); // Remove trailing slash if present
        console.log("Tree Render Request:", pathName);
        try {
            // Extract the path after /api/docs/render/ and decode URL encoding
            const rawTreeFolder = pathName.replace(`/api/docs/render/${req.params.docRootKey}`, '') || "/"
            const treeFolder = decodeURIComponent(rawTreeFolder);
            
            // Extract the optional pullup parameter from query string
            const pullup = req.query.pullup as string; 
            
            const root = config.getPublicFolderByKey(req.params.docRootKey).path;
            if (!root) {
                res.status(500).json({ error: 'bad root' });
                return;
            }

            if (!treeFolder) {
                res.status(400).json({ error: 'Tree folder parameter is required' });
                return;
            }

            // Construct the absolute path
            const absolutePath = path.join(root, treeFolder);

            // Check if the directory exists
            if (!fs.existsSync(absolutePath)) {
                res.status(404).json({ error: 'Directory not found' });
                return;
            }

            this.checkFileAccess(absolutePath, root);
            // Check if it's actually a directory
            const stat = fs.statSync(absolutePath);
            if (!stat.isDirectory()) {
                res.status(400).json({ error: 'Path is not a directory' });
                return;
            }

            const treeNodes: TreeNode[] = this.getTreeNodes(absolutePath, pullup==="true", root);
            const response: TreeRender_Response = { treeNodes };
            res.json(response);
        } catch (error) {
            svrUtil.handleError(error, res, 'Failed to render tree');
        }
    }
 
    getTreeNodes = (absolutePath: string, pullup: boolean, root: string): TreeNode[] => {
        this.checkFileAccess(absolutePath, root); 
        // Read directory contents
        const files = fs.readdirSync(absolutePath);
        const treeNodes: TreeNode[] = [];
        let nextOrdinal = this.getMaxOrdinal(absolutePath, root);

        for (let file of files) {
            // Skip files that start with a dot (hidden files), or underscores.
            if (file.startsWith('.') || file.startsWith('_')) {
                continue;
            }

            // We only consider files that are named like "NNNNN_" where N is a digit. We allow any number of digits followed by the underscore.
            if (!/^\d+_/.test(file)) {
                // We need to use nextOrdinal to ensure that files without a numeric prefix get a new ordinal
                // We will ensure that the file has a 4-digit ordinal prefix
                file = this.ensureOrdinalPrefix(absolutePath, file, ++nextOrdinal, root);
            }

            // Ensure file has 4-digit ordinal prefix
            const currentFileName = this.ensureFourDigitOrdinal(absolutePath, file, root);
                
            const filePath = path.join(absolutePath, currentFileName);
            this.checkFileAccess(filePath, root); 
            const fileStat = fs.statSync(filePath);
                
            let content = '';
            let type = '';
            let fsChildren = false; // Flag to indicate if this node has children in the file system

            // if pullup is true, it means any folder that ends in an underscore should be considered a pullup folder,
            // which means we recursively read its contents and return them as children. So a pullup folder means 
            // we're inserting it's contents inline.
            let children: TreeNode[] | null = null;
            if (fileStat.isDirectory()) {
                type = 'folder';

                // if folder name ends in underscore, treat it as a pullup folder
                if (pullup && currentFileName.endsWith('_')) {
                    // Recursively get tree nodes for this folder
                    children = this.getTreeNodes(filePath, true, root);
                    if (children.length === 0) {
                        children = null;
                    }
                }
                // Check this folder for children in the file system
                fsChildren = fs.readdirSync(filePath).length > 0;
            } else {
                const ext = path.extname(currentFileName).toLowerCase();
                    
                // Detect image files
                if (['.png', '.jpeg', '.jpg'].includes(ext)) {
                    type = 'image';
                    // For images, store the relative path from root for proper URL construction
                    const relativePath = path.relative(root, filePath);
                    content = relativePath;
                } 
                // Non-image files
                else {
                    if (!['.md', '.txt'].includes(ext)) {
                        content = '';
                        type = 'binary';
                    }
                    else {
                        // Assume it's a text file and read its content
                        try {
                            content = fs.readFileSync(filePath, 'utf8');
                            type = 'text';
                        } catch (error) {
                            console.warn(`Could not read file ${filePath} as text:`, error);
                            content = '';
                            type = 'unknown';
                        }
                    }
                }
            }

            const treeNode: TreeNode = {
                name: currentFileName,
                createTime: fileStat.birthtime.getTime(),
                modifyTime: fileStat.mtime.getTime(),
                content,
                type,
                children,
                fsChildren
            };
            treeNodes.push(treeNode);
        }

        // Sort alphabetically by filename
        treeNodes.sort((a, b) => a.name.localeCompare(b.name));
        return treeNodes;
    }

    /**
     * Saves file content to the server for the tree viewer feature
     * @param req - Express request object containing filename, content, and optional newFileName in body
     * @param res - Express response object
     */
    saveFile = async (req: Request<any, any, { filename: string; content: string; treeFolder: string; newFileName?: string, docRootKey?: string, split?: boolean }>, res: Response): Promise<void> => {
        try {
            const { filename, content, treeFolder, docRootKey, split } = req.body;
            let { newFileName } = req.body;

            // if filename has no extension, add .md extension
            if (newFileName && !path.extname(newFileName)) {
                newFileName += '.md';
            }

            const root = config.getPublicFolderByKey(docRootKey!).path;
            if (!root) {
                res.status(500).json({ error: 'bad root' });
                return;
            }

            if (!filename || content === undefined || !treeFolder) {
                res.status(400).json({ error: 'Filename, content, and treeFolder are required' });
                return;
            }

            // Construct the absolute path
            const absoluteFolderPath = path.join(root, treeFolder);
            const absoluteFilePath = path.join(absoluteFolderPath, filename);

            // Check if the directory exists
            this.checkFileAccess(absoluteFolderPath, root); 
            if (!fs.existsSync(absoluteFolderPath)) {
                res.status(404).json({ error: 'Directory not found' });
                return;
            }

            // Check if it's actually a directory
            const stat = fs.statSync(absoluteFolderPath);
            if (!stat.isDirectory()) {
                res.status(400).json({ error: 'Path is not a directory' });
                return;
            }

            let finalFilePath = absoluteFilePath;

            // If newFileName is provided and different from filename, rename the file first
            if (newFileName && newFileName !== filename) {
                const newAbsoluteFilePath = path.join(absoluteFolderPath, newFileName);
                
                // Check if the file to be renamed exists
                if (fs.existsSync(absoluteFilePath)) {
                    // Check if the new name already exists
                    if (fs.existsSync(newAbsoluteFilePath)) {
                        res.status(409).json({ error: 'A file with the new name already exists' });
                        return;
                    }
                    
                    // Rename the file
                    this.checkFileAccess(absoluteFilePath, root);
                    fs.renameSync(absoluteFilePath, newAbsoluteFilePath);
                    console.log(`File renamed successfully: ${absoluteFilePath} -> ${newAbsoluteFilePath}`);
                }
                
                finalFilePath = newAbsoluteFilePath;
            }

            // Write the content to the file (renamed or original) or split into multiple files
            this.checkFileAccess(finalFilePath, root);
            
            if (split) {
                // Split the content on '\n~\n' delimiter and create multiple files
                const parts = content.split('\n~\n');
                
                if (parts.length > 1) {
                    // Get the original file's ordinal and use it for the first part
                    const originalOrdinal = this.getOrdinalFromName(path.basename(finalFilePath));
                    
                    // Shift down existing files to make room for the new split files
                    const numberOfNewFiles = parts.length - 1; // -1 because original file stays in place
                    this.shiftOrdinalsDown(numberOfNewFiles, path.dirname(finalFilePath), originalOrdinal + 1, root, null);
                    
                    // Write each part as a separate file
                    for (let i = 0; i < parts.length; i++) {
                        const partContent = parts[i].trim(); // Remove any leading/trailing whitespace including tildes
                        let partFilePath = finalFilePath;
                        
                        if (i > 0) {
                            // For parts after the first, create new filenames with just the new ordinal
                            const originalBaseName = path.basename(finalFilePath);
                            
                            // Calculate the new ordinal for this part
                            const newOrdinal = originalOrdinal + i;
                            const ordinalPrefix = newOrdinal.toString().padStart(4, '0');
                            
                            // Replace the old ordinal with the new one
                            const underscoreIndex = originalBaseName.indexOf('_');
                            const nameAfterUnderscore = originalBaseName.substring(underscoreIndex);
                            const finalBaseName = ordinalPrefix + nameAfterUnderscore;
                            
                            partFilePath = path.join(path.dirname(finalFilePath), finalBaseName);
                        }
                        
                        this.checkFileAccess(partFilePath, root);
                        fs.writeFileSync(partFilePath, partContent, 'utf8');
                        console.log(`Split file part ${i + 1} saved successfully: ${partFilePath}`);
                    }
                    
                    console.log(`File split into ${parts.length} parts successfully`);
                    res.json({ success: true, message: `File split into ${parts.length} parts successfully` });
                } else {
                    // No split delimiter found, just save normally
                    fs.writeFileSync(finalFilePath, content, 'utf8');
                    console.log(`File saved successfully: ${finalFilePath}`);
                    res.json({ success: true, message: 'File saved successfully (no split delimiter found)' });
                }
            } else {
                // Normal save without splitting
                fs.writeFileSync(finalFilePath, content, 'utf8');
                console.log(`File saved successfully: ${finalFilePath}`);
                res.json({ success: true, message: 'File saved successfully' });
            }
        } catch (error) {
            svrUtil.handleError(error, res, 'Failed to save file');
        }
    }

    /**
     * Renames a folder on the server for the tree viewer feature
     * @param req - Express request object containing oldFolderName and newFolderName in body
     * @param res - Express response object
     */
    renameFolder = async (req: Request<any, any, { oldFolderName: string; newFolderName: string; treeFolder: string, docRootKey: string }>, res: Response): Promise<void> => {
        console.log("Rename Folder Request");
        try {
            const { oldFolderName, newFolderName, treeFolder, docRootKey } = req.body;
            const root = config.getPublicFolderByKey(docRootKey).path;
            if (!root) {
                res.status(500).json({ error: 'bad root' });
                return;
            }

            if (!oldFolderName || !newFolderName || !treeFolder) {
                res.status(400).json({ error: 'Old folder name, new folder name, and treeFolder are required' });
                return;
            }

            // Construct the absolute paths
            const absoluteParentPath = path.join(root, treeFolder);
            const oldAbsolutePath = path.join(absoluteParentPath, oldFolderName);
            const newAbsolutePath = path.join(absoluteParentPath, newFolderName);

            // Check if the parent directory exists
            if (!fs.existsSync(absoluteParentPath)) {
                res.status(404).json({ error: 'Parent directory not found' });
                return;
            }

            // Check if the old folder exists
            if (!fs.existsSync(oldAbsolutePath)) {
                res.status(404).json({ error: 'Old folder not found' });
                return;
            }

            // Check if it's actually a directory
            const stat = fs.statSync(oldAbsolutePath);
            if (!stat.isDirectory()) {
                res.status(400).json({ error: 'Path is not a directory' });
                return;
            }

            // Check if the new name already exists
            if (fs.existsSync(newAbsolutePath)) {
                res.status(409).json({ error: 'A folder with the new name already exists' });
                return;
            }

            // Rename the folder
            this.checkFileAccess(oldAbsolutePath, root);
            this.checkFileAccess(newAbsolutePath, root);
            fs.renameSync(oldAbsolutePath, newAbsolutePath);
            
            console.log(`Folder renamed successfully: ${oldAbsolutePath} -> ${newAbsolutePath}`);
            res.json({ success: true, message: 'Folder renamed successfully' });
        } catch (error) {
            svrUtil.handleError(error, res, 'Failed to rename folder');
        }
    }

    /**
     * Deletes a file or folder, or multiple files/folders from the server for the tree viewer feature
     * @param req - Express request object containing fileOrFolderName (string) or fileNames (array) and treeFolder in body
     * @param res - Express response object
     */
    deleteFileOrFolder = async (req: Request<any, any, { fileOrFolderName?: string; fileNames?: string[]; treeFolder: string, docRootKey: string }>, res: Response): Promise<void> => {
        console.log("Delete File or Folder Request");
        try {
            const { fileOrFolderName, fileNames, treeFolder, docRootKey } = req.body;
            const root = config.getPublicFolderByKey(docRootKey).path;
            if (!root) {
                res.status(500).json({ error: 'bad root' });
                return;
            }

            // Determine if we're dealing with single or multiple items
            let itemsToDelete: string[] = [];
            if (fileNames && Array.isArray(fileNames)) {
                // Multiple items mode
                itemsToDelete = fileNames;
            } else if (fileOrFolderName) {
                // Single item mode
                itemsToDelete = [fileOrFolderName];
            } else {
                res.status(400).json({ error: 'Either fileOrFolderName or fileNames array and treeFolder are required' });
                return;
            }

            if (!treeFolder || itemsToDelete.length === 0) {
                res.status(400).json({ error: 'treeFolder and at least one item to delete are required' });
                return;
            }

            // Construct the absolute parent path
            const absoluteParentPath = path.join(root, treeFolder);

            // Check if the parent directory exists
            if (!fs.existsSync(absoluteParentPath)) {
                res.status(404).json({ error: 'Parent directory not found' });
                return;
            }

            let deletedCount = 0;
            const errors: string[] = [];

            // Delete each file/folder
            for (const fileName of itemsToDelete) {
                try {
                    const absoluteTargetPath = path.join(absoluteParentPath, fileName);

                    // Check if the target exists
                    if (!fs.existsSync(absoluteTargetPath)) {
                        errors.push(`File or folder not found: ${fileName}`);
                        continue;
                    }

                    // Get stats to determine if it's a file or directory
                    const stat = fs.statSync(absoluteTargetPath);
                    
                    this.checkFileAccess(absoluteTargetPath, root);
                    if (stat.isDirectory()) {
                        // Remove directory recursively
                        fs.rmSync(absoluteTargetPath, { recursive: true, force: true });
                        console.log(`Folder deleted successfully: ${absoluteTargetPath}`);
                    } else {
                        // Remove file
                        fs.unlinkSync(absoluteTargetPath);
                        console.log(`File deleted successfully: ${absoluteTargetPath}`);
                    }
                    
                    deletedCount++;
                } catch (error) {
                    console.error(`Error deleting ${fileName}:`, error);
                    errors.push(`Failed to delete ${fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }

            // Return appropriate response based on single vs multiple items
            if (itemsToDelete.length === 1) {
                // Single item mode - return simple response for backward compatibility
                if (deletedCount === 1) {
                    const message = itemsToDelete[0].includes('.') ? 'File deleted successfully' : 'Folder deleted successfully';
                    res.json({ success: true, message });
                } else {
                    res.status(500).json({ error: errors[0] || 'Failed to delete item' });
                }
            } else {
                // Multiple items mode - return detailed response
                res.json({ 
                    success: true, 
                    deletedCount, 
                    errors: errors.length > 0 ? errors : undefined,
                    message: `Successfully deleted ${deletedCount} of ${itemsToDelete.length} items` 
                });
            }
        } catch (error) {
            svrUtil.handleError(error, res, 'Failed to delete file or folder');
        }
    }

    /**
     * Moves a file or folder up or down in the ordered list by swapping numeric prefixes
     * @param req - Express request object containing direction and filename in body
     * @param res - Express response object
     */
    moveUpOrDown = async (req: Request<any, any, { direction: string; filename: string; treeFolder: string, docRootKey: string }>, res: Response): Promise<void> => {
        console.log("Move Up/Down Request");
        try {
            const { direction, filename, treeFolder, docRootKey } = req.body;
            const root = config.getPublicFolderByKey(docRootKey).path;
            if (!root) {
                res.status(500).json({ error: 'bad root' });
                return;
            }

            if (!direction || !filename || !treeFolder || (direction !== 'up' && direction !== 'down')) {
                res.status(400).json({ error: 'Valid direction ("up" or "down"), filename, and treeFolder are required' });
                return;
            }

            // Construct the absolute path to the directory
            const absoluteParentPath = path.join(root, treeFolder);

            // Check if the parent directory exists
            if (!fs.existsSync(absoluteParentPath)) {
                res.status(404).json({ error: 'Parent directory not found' });
                return;
            }

            // Read directory contents and filter for files/folders with numeric prefixes
            this.checkFileAccess(absoluteParentPath, root);
            const allFiles = fs.readdirSync(absoluteParentPath);
            const numberedFiles = allFiles.filter(file => /^\d+_/.test(file));
            
            // Sort files by name (which will sort by numeric prefix)
            numberedFiles.sort((a, b) => a.localeCompare(b));

            // Find the index of the current file
            const currentIndex = numberedFiles.findIndex(file => file === filename);
            if (currentIndex === -1) {
                res.status(404).json({ error: 'File not found in directory' });
                return;
            }

            // Determine the target index for swapping
            let targetIndex: number;
            if (direction === 'up') {
                if (currentIndex === 0) {
                    res.status(400).json({ error: 'File is already at the top' });
                    return;
                }
                targetIndex = currentIndex - 1;
            } else { // direction === 'down'
                if (currentIndex === numberedFiles.length - 1) {
                    res.status(400).json({ error: 'File is already at the bottom' });
                    return;
                }
                targetIndex = currentIndex + 1;
            }

            const currentFile = numberedFiles[currentIndex];
            const targetFile = numberedFiles[targetIndex];

            // Extract numeric prefixes
            const currentPrefix = currentFile.substring(0, currentFile.indexOf('_') + 1);
            const targetPrefix = targetFile.substring(0, targetFile.indexOf('_') + 1);

            // Extract names without prefixes
            const currentName = currentFile.substring(currentFile.indexOf('_') + 1);
            const targetName = targetFile.substring(targetFile.indexOf('_') + 1);

            // Create new names by swapping prefixes
            const newCurrentName = targetPrefix + currentName;
            const newTargetName = currentPrefix + targetName;

            // Perform the renames
            const currentPath = path.join(absoluteParentPath, currentFile);
            const targetPath = path.join(absoluteParentPath, targetFile);
            const tempPath = path.join(absoluteParentPath, `temp_${Date.now()}_${currentFile}`);

            this.checkFileAccess(currentPath, root);
            this.checkFileAccess(targetPath, root);
            this.checkFileAccess(tempPath, root);

            // Use a temporary file to avoid conflicts during rename
            fs.renameSync(currentPath, tempPath);
            fs.renameSync(targetPath, path.join(absoluteParentPath, newTargetName));
            fs.renameSync(tempPath, path.join(absoluteParentPath, newCurrentName));

            console.log(`Files swapped successfully: ${currentFile} <-> ${targetFile}`);
            res.json({ 
                success: true, 
                message: 'Files moved successfully',
                oldName1: currentFile,
                newName1: newCurrentName,
                oldName2: targetFile,
                newName2: newTargetName
            });
        } catch (error) {
            svrUtil.handleError(error, res, 'Failed to move file or folder');
        }
    }

    /**
     * Serves image files from the document tree
     * @param req - Express request object with image path
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
            this.checkFileAccess(absoluteImagePath, root);
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
     * Shifts ordinals down for all files/folders at or below a given ordinal position
     * @param absoluteParentPath - The absolute path to the directory
     * @param insertOrdinal - The ordinal position where we're inserting (files at this position and below get shifted)
     */
    private shiftOrdinalsDown = (slotsToAdd: number, absoluteParentPath: string, insertOrdinal: number, root: string, 
        itemsToIgnore: string[] | null): void => {
        this.checkFileAccess(absoluteParentPath, root);
        // Read directory contents and filter for files/folders with numeric prefixes
        const allFiles = fs.readdirSync(absoluteParentPath);
        const numberedFiles = allFiles.filter(file => /^\d+_/.test(file));
        
        // Sort files by name (which will sort by numeric prefix)
        numberedFiles.sort((a, b) => a.localeCompare(b));

        // Find files that need to be shifted (ordinal >= insertOrdinal)
        const filesToShift = numberedFiles.filter(file => {
            const ordinal = this.getOrdinalFromName(file);
            return ordinal >= insertOrdinal;
        });

        // Sort in reverse order to avoid conflicts during renaming
        filesToShift.sort((a, b) => b.localeCompare(a));

        // Shift each file down by incrementing its ordinal prefix
        for (const file of filesToShift) {
            console.log(`Shifting file: ${file}`);
            if (itemsToIgnore && itemsToIgnore.includes(file)) {
                console.log(`    Skipping file: ${file} (in itemsToIgnore)`);
                continue;
            }
            const prefix = file.substring(0, file.indexOf('_'));
            const nameWithoutPrefix = file.substring(file.indexOf('_') + 1);
            const currentOrdinal = parseInt(prefix);
            const newOrdinal = currentOrdinal + slotsToAdd; // Increment ordinal by slotsToAdd
            
            // Create new filename with incremented ordinal (padded with leading zeros)
            const newPrefix = newOrdinal.toString().padStart(prefix.length, '0');
            const newFileName = `${newPrefix}_${nameWithoutPrefix}`;
            
            const oldPath = path.join(absoluteParentPath, file);
            const newPath = path.join(absoluteParentPath, newFileName);
            
            console.log(`Shifting file: ${file} -> ${newFileName}`);
            fs.renameSync(oldPath, newPath);
        }
    };

    /**
     * Ensures a file/folder has a 4-digit ordinal prefix (i.e. "NNNN_"), renaming it if necessary
     * @param absolutePath - The absolute path to the directory containing the file
     * @param fileName - The original filename
     * @returns The filename (either original or renamed) to use for further processing
     */
    private ensureFourDigitOrdinal = (absolutePath: string, fileName: string, root: string): string => {
        // Find the first underscore to extract the ordinal prefix
        const underscoreIndex = fileName.indexOf('_');
        const ordinalPrefix = fileName.substring(0, underscoreIndex);
        const restOfName = fileName.substring(underscoreIndex);
        
        // Check if we need to pad with leading zeroes (ensure 4-digit ordinal)
        if (ordinalPrefix.length < 4) {
            const paddedOrdinal = ordinalPrefix.padStart(4, '0');
            const newFileName = paddedOrdinal + restOfName;
            const oldFilePath = path.join(absolutePath, fileName);
            const newFilePath = path.join(absolutePath, newFileName);
            
            try {
                // Rename the file/folder to have 4-digit ordinal prefix
                this.checkFileAccess(oldFilePath, root);
                this.checkFileAccess(newFilePath, root);
                fs.renameSync(oldFilePath, newFilePath);
                console.log(`Renamed ${fileName} to ${newFileName} for 4-digit ordinal prefix(a)`);
                
                // Return the new filename for further processing
                return newFileName;
            } catch (error) {
                console.warn(`Failed to rename ${fileName} to ${newFileName}:`, error);
                // Return original name if rename fails
                return fileName;
            }
        }
        // note: todo-1: This is just a hack to be able to import files that have more than 4 digits in the ordinal prefix.
        // but with a zero prefix, because this is a common thing encountered in legacy Quanta CMS export files, which
        // used 5-digit ordinals. We can remove this 'else if' block when we no longer need to support those files.
        else if (ordinalPrefix.length > 4) {
            // remove as many leading zeroes as needed to make it 4 digits, but if it doesn't start
            // with a zero throw an error
            if (ordinalPrefix.startsWith('0')) {
                const newOrdinal = ordinalPrefix.substring(ordinalPrefix.length - 4);
                const newFileName = newOrdinal + restOfName;
                const oldFilePath = path.join(absolutePath, fileName);
                const newFilePath = path.join(absolutePath, newFileName);
                
                try {
                    // Rename the file/folder to have 4-digit ordinal prefix
                    this.checkFileAccess(oldFilePath, root);
                    this.checkFileAccess(newFilePath, root);
                    fs.renameSync(oldFilePath, newFilePath);
                    console.log(`Renamed ${fileName} to ${newFileName} for 4-digit ordinal prefix(b)`);
                    
                    // Return the new filename for further processing
                    return newFileName;
                } catch (error) {
                    console.warn(`Failed to rename ${fileName} to ${newFileName}:`, error);
                    // Return original name if rename fails
                    return fileName;
                }
            } else {
                throw new Error(`Invalid ordinal prefix in filename: ${fileName}`);
            }
        }
        
        // No rename needed, return original filename
        return fileName;
    };

    /**
     * Creates a new file in the tree viewer
     * @param req - Express request object containing fileName, treeFolder, and insertAfterNode in body
     * @param res - Express response object
     */
    createFile = async (req: Request<any, any, { fileName: string; treeFolder: string; insertAfterNode: string, docRootKey: string }>, res: Response): Promise<void> => {
        console.log("Create File Request");
        try {
            const { fileName, treeFolder, insertAfterNode, docRootKey } = req.body;
            const root = config.getPublicFolderByKey(docRootKey).path;
            if (!root) {
                res.status(500).json({ error: 'bad root' });
                return;
            }

            if (!fileName || !treeFolder) {
                res.status(400).json({ error: 'File name and treeFolder are required' });
                return;
            }

            // Construct the absolute path to the directory
            const absoluteParentPath = path.join(root, treeFolder);

            // Check if the parent directory exists
            this.checkFileAccess(absoluteParentPath, root); 
            if (!fs.existsSync(absoluteParentPath)) {
                res.status(404).json({ error: 'Parent directory not found' });
                return;
            }

            let insertOrdinal = 1; // Default to insert at top

            if (insertAfterNode && insertAfterNode.trim() !== '') {
                console.log(`Create file "${fileName}" below node: ${insertAfterNode}`);
                
                // Extract the ordinal from the insertAfterNode
                const underscoreIndex = insertAfterNode.indexOf('_');
                if (underscoreIndex !== -1) {
                    const afterNodeOrdinal = parseInt(insertAfterNode.substring(0, underscoreIndex));
                    insertOrdinal = afterNodeOrdinal + 1;
                }
            } else {
                console.log(`Create new top file "${fileName}"`);
            }

            // Shift all files at or below the insertion ordinal down by one
            this.shiftOrdinalsDown(1, absoluteParentPath, insertOrdinal, root, null);

            // Create the new file with the calculated ordinal
            const ordinalPrefix = insertOrdinal.toString().padStart(4, '0'); // Use 4-digit padding
            const newFileName = `${ordinalPrefix}_${fileName}`;
            
            // Add .md extension if the fileName doesn't already have an extension
            let finalFileName = newFileName;
            if (!path.extname(fileName)) {
                finalFileName = `${newFileName}.md`;
            }
            
            const newFilePath = path.join(absoluteParentPath, finalFileName);

            // Create the new file as an empty file
            fs.writeFileSync(newFilePath, '', 'utf8');

            console.log(`File created successfully: ${newFilePath}`);
            res.json({ 
                success: true, 
                message: 'File created successfully',
                fileName: finalFileName 
            });
        } catch (error) {
            svrUtil.handleError(error, res, 'Failed to create file');
        }
    }

    /**
     * Creates a new folder in the tree viewer
     * @param req - Express request object containing folderName, treeFolder, and insertAfterNode in body
     * @param res - Express response object
     */
    createFolder = async (req: Request<any, any, { folderName: string; treeFolder: string; insertAfterNode: string, docRootKey: string }>, res: Response): Promise<void> => {
        console.log("Create Folder Request");
        try {
            const { folderName, treeFolder, insertAfterNode, docRootKey } = req.body;
            const root = config.getPublicFolderByKey(docRootKey).path;
            if (!root) {
                res.status(500).json({ error: 'bad key' });
                return;
            }

            if (!folderName || !treeFolder) {
                res.status(400).json({ error: 'Folder name and treeFolder are required' });
                return;
            }

            // Construct the absolute path to the directory
            const absoluteParentPath = path.join(root, treeFolder);

            // Check if the parent directory exists
            this.checkFileAccess(absoluteParentPath, root);
            if (!fs.existsSync(absoluteParentPath)) {
                res.status(404).json({ error: 'Parent directory not found' });
                return;
            }

            let insertOrdinal = 1; // Default to insert at top

            if (insertAfterNode && insertAfterNode.trim() !== '') {
                console.log(`Create folder "${folderName}" below node: ${insertAfterNode}`);
                // Extract the ordinal from the insertAfterNode
                const underscoreIndex = insertAfterNode.indexOf('_');
                if (underscoreIndex !== -1) {
                    const afterNodeOrdinal = parseInt(insertAfterNode.substring(0, underscoreIndex));
                    insertOrdinal = afterNodeOrdinal + 1;
                }
            } else {
                console.log(`Create new top folder "${folderName}"`);
            }

            // Shift all files at or below the insertion ordinal down by one
            this.shiftOrdinalsDown(1, absoluteParentPath, insertOrdinal, root, null);

            // Create the new folder with the calculated ordinal
            const ordinalPrefix = insertOrdinal.toString().padStart(4, '0'); // Use 4-digit padding
            const newFolderName = `${ordinalPrefix}_${folderName}`;
            
            const newFolderPath = path.join(absoluteParentPath, newFolderName);

            // Create the directory
            fs.mkdirSync(newFolderPath, { recursive: true });

            console.log(`Folder created successfully: ${newFolderPath}`);
            res.json({ 
                success: true, 
                message: 'Folder created successfully',
                folderName: newFolderName 
            });
        } catch (error) {
            svrUtil.handleError(error, res, 'Failed to create folder');
        }
    }

    /**
     * Pastes items from the cut list to the target folder by moving them
     * @param req - Express request object containing targetFolder and pasteItems in body
     * @param res - Express response object
     */
    pasteItems = async (req: Request<any, any, { targetFolder: string; pasteItems: string[], docRootKey: string, targetOrdinal?: string }>, res: Response): Promise<void> => {    
        try {
            const { targetFolder, pasteItems, docRootKey, targetOrdinal } = req.body;
            const root = config.getPublicFolderByKey(docRootKey).path;
            if (!root) {
                res.status(500).json({ error: 'bad key' });
                return;
            }

            if (!targetFolder || !pasteItems || !Array.isArray(pasteItems) || pasteItems.length === 0) {
                res.status(400).json({ error: 'targetFolder and pasteItems array are required' });
                return;
            }

            // Construct the absolute target path
            const absoluteTargetPath = path.join(root, targetFolder);

            // Check if the target directory exists
            this.checkFileAccess(absoluteTargetPath, root);
            if (!fs.existsSync(absoluteTargetPath)) {
                res.status(404).json({ error: 'Target directory not found' });
                return;
            }

            let pastedCount = 0;
            const errors: string[] = [];

            // Determine insert ordinal for positional pasting
            let insertOrdinal: number | null = null;
            if (targetOrdinal) {
                const underscoreIndex = targetOrdinal.indexOf('_');
                if (underscoreIndex > 0) {
                    const targetOrdinalNum = parseInt(targetOrdinal.substring(0, underscoreIndex));
                    insertOrdinal = targetOrdinalNum + 1; // Insert after the target
                }
            }

            if (!insertOrdinal) {
                insertOrdinal = 0; // Default to inserting at the top if no ordinal is specified
            }

            // Shift existing items down to make room for the number of items being pasted
            this.shiftOrdinalsDown(pasteItems.length, absoluteTargetPath, insertOrdinal, root, pasteItems);
            
            // Move each file/folder
            for (let i = 0; i < pasteItems.length; i++) {
                const itemName = pasteItems[i];
                try {
                    // Find the source path by searching all directories
                    let sourceFilePath: string | null = null;
                    
                    // Helper function to recursively search for the file
                    const findFile = (searchPath: string): string | null => {
                        try {
                            const entries = fs.readdirSync(searchPath, { withFileTypes: true });
                            
                            // First check current directory
                            for (const entry of entries) {
                                if (entry.name === itemName) {
                                    return path.join(searchPath, entry.name);
                                }
                            }
                            
                            // Then search subdirectories
                            for (const entry of entries) {
                                if (entry.isDirectory()) {
                                    const found = findFile(path.join(searchPath, entry.name));
                                    if (found) return found;
                                }
                            }
                        } catch {
                            // Continue searching if we hit permission issues
                        }
                        return null;
                    };

                    sourceFilePath = findFile(root);

                    if (!sourceFilePath) {
                        console.error(`Source file not found: ${itemName}`);
                        errors.push(`Source file not found: ${itemName}`);
                        continue;
                    }

                    let targetFileName = itemName;
                    const currentOrdinal = insertOrdinal + i;
                        
                    // Extract name without ordinal prefix if it exists
                    const nameWithoutPrefix = itemName.includes('_') ? 
                        itemName.substring(itemName.indexOf('_') + 1) : itemName;
                        
                    // Create new filename with correct ordinal
                    const newOrdinalPrefix = currentOrdinal.toString().padStart(4, '0');
                    targetFileName = `${newOrdinalPrefix}_${nameWithoutPrefix}`;
                    

                    const targetFilePath = path.join(absoluteTargetPath, targetFileName);

                    // Move the file/folder
                    fs.renameSync(sourceFilePath, targetFilePath);                    
                    pastedCount++;
                } catch (error) {
                    console.error(`Error moving ${itemName}:`, error);
                    errors.push(`Failed to move ${itemName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }

            // Return response
            res.json({
                success: pastedCount > 0,
                pastedCount,
                totalItems: pasteItems.length,
                errors: errors.length > 0 ? errors : undefined,
                message: `Successfully pasted ${pastedCount} of ${pasteItems.length} items`
            });
        } catch (error) {
            svrUtil.handleError(error, res, 'Failed to paste items');
        }
    }

    /**
     * Gets the maximum ordinal value from all numbered files/folders in a directory
     * @param absolutePath - The absolute path to the directory
     * @returns The maximum ordinal value found, or 0 if no numbered files exist
     */
    // todo-1: this method is not used any longer, so we can remove it some day.
    private getMaxOrdinal = (absolutePath: string, root: string): number => {
        this.checkFileAccess(absolutePath, root);
            
        // Read directory contents and filter for files/folders with numeric prefixes
        const allFiles = fs.readdirSync(absolutePath);
        const numberedFiles = allFiles.filter(file => /^\d+_/.test(file));
            
        if (numberedFiles.length === 0) {
            return 0;
        }
            
        // Extract ordinals and find the maximum
        let maxOrdinal = 0;
        for (const file of numberedFiles) {
            const ordinal = this.getOrdinalFromName(file);
            if (ordinal > maxOrdinal) {
                maxOrdinal = ordinal;
            }
        }

        return maxOrdinal;
    };

    /**
     * Ensures a file/folder has a 4-digit ordinal prefix by renaming it
     * @param absolutePath - The absolute path to the directory containing the file
     * @param fileName - The original filename without ordinal prefix
     * @param ordinal - The ordinal number to use as prefix
     * @returns The filename (either original if rename failed, or the new renamed filename)
     */
    private ensureOrdinalPrefix = (absolutePath: string, fileName: string, ordinal: number, root: string): string => {

        // todo-1: Special case hack for injesting quanta exports better. This will be removed later.
        if (fileName === "content.md") {
            ordinal = 0;
        }

        // Create new filename with 4-digit ordinal prefix
        const ordinalPrefix = ordinal.toString().padStart(4, '0');
        const newFileName = `${ordinalPrefix}_${fileName}`;
        const oldFilePath = path.join(absolutePath, fileName);
        const newFilePath = path.join(absolutePath, newFileName);
        
        try {
            // Rename the file/folder to have 4-digit ordinal prefix
            this.checkFileAccess(oldFilePath, root);
            this.checkFileAccess(newFilePath, root);
            fs.renameSync(oldFilePath, newFilePath);
            console.log(`Renamed ${fileName} to ${newFileName} for 4-digit ordinal prefix (b)`);
            
            // Return the new filename
            return newFileName;
        } catch (error) {
            console.warn(`Failed to rename ${fileName} to ${newFileName}:`, error);
            // Return original filename if rename fails
            return fileName;
        }
    };

    /**
     * Opens an item (file or folder) in the file system using the OS default application
     * @param req - Express request object containing treeItem and docRootKey in body
     * @param res - Express response object
     */
    openFileSystemItem = async (req: Request<any, any, { treeItem: string; docRootKey: string, action: string }>, res: Response): Promise<void> => {
        console.log("Open File System Item Request");

        if (config.get("desktopMode") !== 'y') {
            console.warn("File system access is disabled in this mode");
            res.status(403).json({ error: 'File system access is disabled in this mode' });
            return;
        }

        try {
            const { treeItem, docRootKey, action } = req.body;
            const root = config.getPublicFolderByKey(docRootKey).path;
            
            if (!root) {
                res.status(500).json({ error: 'Invalid root key' });
                return;
            }

            if (!treeItem) {
                res.status(400).json({ error: 'Tree item is required' });
                return;
            }

            // Construct the absolute path to the item
            const absoluteItemPath = path.join(root, treeItem);

            // Security check - ensure the path is within the allowed root
            this.checkFileAccess(absoluteItemPath, root);

            // Check if the item exists
            if (!fs.existsSync(absoluteItemPath)) {
                res.status(404).json({ error: 'Item not found' });
                return;
            }

            // Check if it's a file or directory
            const stat = fs.statSync(absoluteItemPath);
            const isDirectory = stat.isDirectory();
            const isFile = stat.isFile();

            if (!isDirectory && !isFile) {
                res.status(400).json({ error: 'Path is neither a file nor a directory' });
                return;
            }

            // Open the item using the appropriate command for the OS
            const platform = process.platform;
            let command: string;

            switch (platform) {
            case 'win32':
                // On Windows, explorer can open both files and folders
                command = `explorer "${absoluteItemPath}"`;
                break;
            case 'darwin': // macOS
                // On macOS, open can handle both files and folders
                command = `open "${absoluteItemPath}"`;
                break;
            case 'linux':
            default:
                // On Linux, xdg-open can handle both files and folders
                if (action == "edit" || absoluteItemPath.endsWith('.md') || absoluteItemPath.endsWith('.txt')) {
                    // todo-1: for now we run VSCode, but we'll make both these commands configurable later, via yaml file
                    command = `code "${absoluteItemPath}"`;
                }
                else {
                    command = `xdg-open "${absoluteItemPath}"`;
                }
                break;
            }

            exec(command, (error) => {
                if (error) {
                    console.error(`Error opening ${isDirectory ? 'folder' : 'file'}:`, error);
                    res.status(500).json({ error: `Failed to open ${isDirectory ? 'folder' : 'file'} in file system` });
                } else {
                    console.log(`Successfully opened ${isDirectory ? 'folder' : 'file'}: ${absoluteItemPath}`);
                    res.json({ 
                        success: true, 
                        message: `${isDirectory ? 'Folder' : 'File'} opened in file system`,
                        itemType: isDirectory ? 'folder' : 'file'
                    });
                }
            });

        } catch (error) {
            svrUtil.handleError(error, res, 'Failed to open item in file system');
        }
    }

    /**
     * Searches through documents for the given query string
     * @param req - Express request object containing query, treeFolder, and docRootKey in body
     * @param res - Express response object
     */
    search = async (req: Request<any, any, { query: string; treeFolder: string; docRootKey: string; searchMode?: string }>, res: Response): Promise<void> => {
        console.log("Document Search Request");
        try {
            // todo-1: make this optional.
            const orderByModTime = true;
            const { query, treeFolder, docRootKey, searchMode = 'MATCH_ANY' } = req.body;
            
            if (!query || typeof query !== 'string') {
                res.status(400).json({ error: 'Query string is required' });
                return;
            }
            
            if (!treeFolder || typeof treeFolder !== 'string') {
                res.status(400).json({ error: 'Tree folder is required' });
                return;
            }
            
            if (!docRootKey || typeof docRootKey !== 'string') {
                res.status(400).json({ error: 'Document root key is required' });
                return;
            }
            
            const root = config.getPublicFolderByKey(docRootKey).path;
            if (!root) {
                res.status(500).json({ error: 'Invalid document root key' });
                return;
            }
            
            // Construct the absolute path to search within
            const absoluteSearchPath = path.join(root, treeFolder);
            
            // Security check - ensure the path is within the allowed root
            this.checkFileAccess(absoluteSearchPath, root);
            
            // Check if the search directory exists
            if (!fs.existsSync(absoluteSearchPath)) {
                res.status(404).json({ error: 'Search directory not found' });
                return;
            }
            
            console.log(`Search query: "${query}" with mode: "${searchMode}" in folder: "${absoluteSearchPath}"`);
            
            // Use grep to search for the query string recursively            
            let grepCommand: string;
            
            if (searchMode === 'REGEX') {
                // For REGEX mode, use the query as-is as a regex pattern
                grepCommand = `grep -rniH --include="*.md" --include="*.txt" --include="*.json" --include="*.js" --include="*.ts" --include="*.html" --include="*.css" --exclude-dir="_*" -E "${query.replace(/"/g, '\\"')}" "${absoluteSearchPath}"`;
            } else {
                // For MATCH_ANY and MATCH_ALL, parse the query into search terms
                let searchTerms: string[] = [];
                
                // Check if the query contains quotes
                if (query.includes('"')) {
                    // Extract quoted phrases and individual words
                    const regex = /"([^"]+)"|(\S+)/g;
                    let match;
                    while ((match = regex.exec(query)) !== null) {
                        if (match[1]) {
                            // Quoted phrase
                            searchTerms.push(match[1]);
                        } else if (match[2] && !match[2].startsWith('"')) {
                            // Unquoted word (not part of a quote)
                            searchTerms.push(match[2]);
                        }
                    }
                } else {
                    // No quotes, split by spaces
                    searchTerms = query.trim().split(/\s+/).filter(term => term.length > 0);
                }
                
                if (searchTerms.length === 0) {
                    res.status(400).json({ error: 'No valid search terms found' });
                    return;
                }
                
                if (searchMode === 'MATCH_ANY') {
                    // For MATCH_ANY, find files that contain any of the terms anywhere in the file
                    // Use -l flag to get just filenames, then get content with line numbers
                    const escapedTerms = searchTerms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                    const regexPattern = escapedTerms.join('|');
                    
                    // First get the list of files that contain any of the terms
                    const fileListCommand = `grep -rlZ --include="*.md" --include="*.txt" --include="*.json" --include="*.js" --include="*.ts" --include="*.html" --include="*.css" --exclude-dir="_*" -i -E "${regexPattern}" "${absoluteSearchPath}"`;
                    
                    // Then get the actual content with line numbers from those files
                    grepCommand = `${fileListCommand} | xargs -0 --no-run-if-empty grep -niH -E "${regexPattern}"`;
                } else { 
                    // MATCH_ALL
                    // For MATCH_ALL, find files that contain all terms anywhere in the file
                    // We'll do this by chaining grep commands to filter files step by step
                    const escapedTerms = searchTerms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                    
                    // Build a command that pipes through multiple greps to find files containing all terms
                    // Use -Z option with grep to output null-terminated filenames, and -0 with xargs to handle them properly
                    // This handles filenames with spaces correctly
                    let baseCommand = `grep -rlZ --include="*.md" --include="*.txt" --include="*.json" --include="*.js" --include="*.ts" --include="*.html" --include="*.css" --exclude-dir="_*" -i "${escapedTerms[0]}" "${absoluteSearchPath}"`;
                    
                    // Chain additional greps for each remaining term
                    // Use --no-run-if-empty to prevent xargs from running if there's no input
                    for (let i = 1; i < escapedTerms.length; i++) {
                        baseCommand += ` | xargs -0 --no-run-if-empty grep -lZ -i "${escapedTerms[i]}"`;
                    }
                    
                    // Now get the actual content with line numbers from the matching files
                    // Use --no-run-if-empty to prevent xargs from running if there's no input
                    grepCommand = `${baseCommand} | xargs -0 --no-run-if-empty grep -niH -E "${escapedTerms.join('|')}"`;
                }
            }
            
            exec(grepCommand, (error, stdout, stderr) => {
                if (error) {
                    // grep returns exit code 1 when no matches found, which is not an error for us
                    if (error.code === 1) {
                        console.log('No matches found for search query');
                        res.json({ 
                            success: true, 
                            message: `No matches found for query: "${query}"`,
                            query: query,
                            results: []
                        });
                        return;
                    }
                    
                    console.error('Grep command error:', error);
                    res.status(500).json({ error: 'Search command failed' });
                    return;
                }
                
                if (stderr) {
                    console.warn('Grep stderr:', stderr);
                }
                
                // Parse grep output
                const results = [];
                const fileModTimes = orderByModTime ? new Map<string, number>() : null;
                
                if (stdout.trim()) {
                    const lines = stdout.trim().split('\n');
                    
                    for (const line of lines) {
                        // Parse grep output format: filename:line_number:content
                        const match = line.match(/^([^:]+):(\d+):(.*)$/);
                        if (match) {
                            const [, filePath, lineNumber, content] = match;
                            // Make the file path relative to the search root
                            const relativePath = path.relative(absoluteSearchPath, filePath);
                            
                            let modTime: number | undefined;
                            
                            // Get modification time for this file if ordering is enabled and we haven't already
                            if (orderByModTime && fileModTimes && !fileModTimes.has(relativePath)) {
                                try {
                                    const stat = fs.statSync(filePath);
                                    const fileModTime = stat.mtime.getTime();
                                    fileModTimes.set(relativePath, fileModTime);
                                    modTime = fileModTime;
                                } catch (error) {
                                    console.warn(`Failed to get modification time for ${relativePath}:`, error);
                                    // Use current time as fallback
                                    const fallbackTime = Date.now();
                                    fileModTimes.set(relativePath, fallbackTime);
                                    modTime = fallbackTime;
                                }
                            } else if (orderByModTime && fileModTimes) {
                                modTime = fileModTimes.get(relativePath);
                            }
                            
                            const result: any = {
                                file: relativePath,
                                line: parseInt(lineNumber),
                                content: content.trim()
                            };
                            
                            // Only add modTime if ordering is enabled
                            if (orderByModTime && modTime !== undefined) {
                                result.modTime = modTime;
                            }
                            
                            results.push(result);
                            // console.log(`Match found - File: ${relativePath}, Line: ${lineNumber}, Content: ${content.trim()}`);
                        }
                    }
                }
                
                // Sort results by modification time (newest first), then by file name, then by line number
                if (orderByModTime) {
                    results.sort((a, b) => {
                        // First sort by modification time (descending - newest first)
                        if (a.modTime !== b.modTime) {
                            return b.modTime - a.modTime;
                        }
                        // If modification times are equal, sort by file name (ascending)
                        if (a.file !== b.file) {
                            return a.file.localeCompare(b.file);
                        }
                        // If same file, sort by line number (ascending)
                        return a.line - b.line;
                    });
                }
                
                // Remove the modTime property from results before sending to client (if it was added)
                const cleanResults = orderByModTime ? 
                    results.map(result => ({
                        file: result.file,
                        line: result.line,
                        content: result.content
                    })) : 
                    results;
                
                // console.log(`Search completed. Found ${cleanResults.length} matches.`);
                
                res.json({ 
                    success: true, 
                    message: `Search completed for query: "${query}". Found ${cleanResults.length} matches.`,
                    query: query,
                    searchPath: treeFolder,
                    results: cleanResults
                });
            });
            
        } catch (error) {
            svrUtil.handleError(error, res, 'Failed to perform search');
        }
    }

    /**
     * Joins multiple selected files by concatenating their content and saving to the first file
     * @param req - Express request object containing filenames array, treeFolder and docRootKey in body
     * @param res - Express response object
     */
    joinFiles = (req: Request<any, any, { filenames: string[]; treeFolder: string; docRootKey: string }>, res: Response): void => {
        try {
            const { filenames, treeFolder, docRootKey } = req.body;
            const root = config.getPublicFolderByKey(docRootKey).path;
            if (!root) {
                res.status(500).json({ error: 'bad root' });
                return;
            }

            if (!filenames || !Array.isArray(filenames) || filenames.length < 2) {
                res.status(400).json({ error: 'At least 2 filenames are required for joining' });
                return;
            }

            if (!treeFolder) {
                res.status(400).json({ error: 'Tree folder is required' });
                return;
            }

            const absoluteFolderPath = path.join(root, treeFolder);
            this.checkFileAccess(absoluteFolderPath, root);

            // Check if all files exist and read their content
            const fileData: { filename: string; ordinal: number; content: string }[] = [];
            
            for (const filename of filenames) {
                const absoluteFilePath = path.join(absoluteFolderPath, filename);
                this.checkFileAccess(absoluteFilePath, root);
                
                if (!fs.existsSync(absoluteFilePath)) {
                    res.status(404).json({ error: `File not found: ${filename}` });
                    return;
                }

                // Get ordinal for sorting
                const ordinal = this.getOrdinalFromName(filename);
                
                // Read file content
                let content = '';
                try {
                    content = fs.readFileSync(absoluteFilePath, 'utf8');
                } catch (error) {
                    console.warn(`Could not read file ${filename} as text:`, error);
                }

                fileData.push({ filename, ordinal, content });
            }

            // Sort files by ordinal
            fileData.sort((a, b) => a.ordinal - b.ordinal);

            // Concatenate content with "\n\n" separators
            const joinedContent = fileData.map(file => file.content).join('\n\n');

            // Save concatenated content to the first file (by ordinal)
            const firstFile = fileData[0];
            const firstFilePath = path.join(absoluteFolderPath, firstFile.filename);
            
            this.checkFileAccess(firstFilePath, root);
            fs.writeFileSync(firstFilePath, joinedContent, 'utf8');
            console.log(`Joined content saved to: ${firstFile.filename}`);

            // Delete the remaining files
            const deletedFiles: string[] = [];
            for (let i = 1; i < fileData.length; i++) {
                const fileToDelete = fileData[i];
                const deleteFilePath = path.join(absoluteFolderPath, fileToDelete.filename);
                
                try {
                    this.checkFileAccess(deleteFilePath, root);
                    fs.unlinkSync(deleteFilePath);
                    deletedFiles.push(fileToDelete.filename);
                    console.log(`Deleted file: ${fileToDelete.filename}`);
                } catch (error) {
                    console.error(`Error deleting file ${fileToDelete.filename}:`, error);
                }
            }

            res.json({ 
                success: true, 
                message: `Successfully joined ${fileData.length} files into ${firstFile.filename}`,
                joinedFile: firstFile.filename,
                deletedFiles: deletedFiles
            });

        } catch (error) {
            svrUtil.handleError(error, res, 'Failed to join files');
        }
    }
}

export const docSvc = new DocService();