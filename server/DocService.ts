import { TreeNode } from "../common/types/CommonTypes.js";
import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import {  TreeRender_Response } from "../common/types/EndpointTypes.js";
import { svrUtil } from "./ServerUtil.js";
import { config } from "../common/Config.js";

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
        console.log("Tree Render Request:", req.path);
        try {
            // Extract the path after /api/docs/render/ and decode URL encoding
            const rawTreeFolder = req.path.replace(`/api/docs/render/${req.params.docRootKey}`, '') || "/"
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
            let mimeType = '';

            // if pullup is true, it means any folder that ends in an underscore should be considered a pullup folder,
            // which means we recursively read its contents and return them as children. So a pullup folder means 
            // we're inserting it's contents inline.
            let children: TreeNode[] | null = null;
            if (fileStat.isDirectory()) {
                mimeType = 'folder';

                // if folder name ends in underscore, treat it as a pullup folder
                if (pullup && currentFileName.endsWith('_')) {
                    // Recursively get tree nodes for this folder
                    children = this.getTreeNodes(filePath, true, root);
                    if (children.length === 0) {
                        children = null;
                    }
                }
            } else {
                const ext = path.extname(currentFileName).toLowerCase();
                    
                // Detect image files
                if (['.png', '.jpeg', '.jpg'].includes(ext)) {
                    // Set proper MIME type based on extension
                    switch (ext) {
                    case '.png':
                        mimeType = 'image/png';
                        break;
                    case '.jpg':
                    case '.jpeg':
                        mimeType = 'image/jpeg';
                        break;
                    default:
                        mimeType = 'image/jpeg';
                    }
                    // For images, store the relative path from root for proper URL construction
                    const relativePath = path.relative(root, filePath);
                    content = relativePath;
                } else {
                    // Assume it's a text file and read its content
                    try {
                        content = fs.readFileSync(filePath, 'utf8');
                        mimeType = 'text';
                    } catch (error) {
                        console.warn(`Could not read file ${filePath} as text:`, error);
                        content = '';
                        mimeType = 'unknown';
                    }
                }
            }

            const treeNode: TreeNode = {
                name: currentFileName,
                createTime: fileStat.birthtime.getTime(),
                modifyTime: fileStat.mtime.getTime(),
                content,
                mimeType,
                children
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
    saveFile = async (req: Request<any, any, { filename: string; content: string; treeFolder: string; newFileName?: string, docRootKey?: string }>, res: Response): Promise<void> => {
        console.log("Save File Request");
        try {
            const { filename, content, treeFolder, newFileName, docRootKey } = req.body;
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

            // Write the content to the file (renamed or original)
            this.checkFileAccess(finalFilePath, root);
            fs.writeFileSync(finalFilePath, content, 'utf8');
            
            console.log(`File saved successfully: ${finalFilePath}`);
            res.json({ success: true, message: 'File saved successfully' });
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
     * Opens a folder in the file system using the OS default file manager
     * @param req - Express request object containing treeFolder and docRootKey in body
     * @param res - Express response object
     */
    openFileSystemFolder = async (req: Request<any, any, { treeFolder: string; docRootKey: string }>, res: Response): Promise<void> => {
        console.log("Open File System Folder Request");
        try {
            const { treeFolder, docRootKey } = req.body;
            const root = config.getPublicFolderByKey(docRootKey).path;
            
            if (!root) {
                res.status(500).json({ error: 'Invalid root key' });
                return;
            }

            if (!treeFolder) {
                res.status(400).json({ error: 'Tree folder is required' });
                return;
            }

            // Construct the absolute path to the folder
            const absoluteFolderPath = path.join(root, treeFolder);

            // Security check - ensure the path is within the allowed root
            this.checkFileAccess(absoluteFolderPath, root);

            // Check if the folder exists
            if (!fs.existsSync(absoluteFolderPath)) {
                res.status(404).json({ error: 'Folder not found' });
                return;
            }

            // Check if it's actually a directory
            const stat = fs.statSync(absoluteFolderPath);
            if (!stat.isDirectory()) {
                res.status(400).json({ error: 'Path is not a directory' });
                return;
            }

            // Open the folder using the appropriate command for the OS
            const { exec } = await import('child_process');
            const platform = process.platform;
            let command: string;

            switch (platform) {
            case 'win32':
                command = `explorer "${absoluteFolderPath}"`;
                break;
            case 'darwin': // macOS
                command = `open "${absoluteFolderPath}"`;
                break;
            case 'linux':
            default:
                command = `xdg-open "${absoluteFolderPath}"`;
                break;
            }

            exec(command, (error) => {
                if (error) {
                    console.error('Error opening folder:', error);
                    res.status(500).json({ error: 'Failed to open folder in file system' });
                } else {
                    console.log(`Successfully opened folder: ${absoluteFolderPath}`);
                    res.json({ success: true, message: 'Folder opened in file system' });
                }
            });

        } catch (error) {
            svrUtil.handleError(error, res, 'Failed to open folder in file system');
        }
    }
}

export const docSvc = new DocService();