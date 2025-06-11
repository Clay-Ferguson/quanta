import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { svrUtil } from "../../ServerUtil.js";
import { config } from "../../Config.js";
import { docUtil } from "./DocUtil.js";

class DocMod {
    /**
     * Saves file content to the server for the tree viewer feature
     * Supports file renaming and content splitting on delimiter '\n~\n'
     * @param req - Express request object containing filename, content, treeFolder, newFileName, docRootKey, and split options
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
            docUtil.checkFileAccess(absoluteFolderPath, root); 
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
                    docUtil.checkFileAccess(absoluteFilePath, root);
                    fs.renameSync(absoluteFilePath, newAbsoluteFilePath);
                    console.log(`File renamed successfully: ${absoluteFilePath} -> ${newAbsoluteFilePath}`);
                }
                    
                finalFilePath = newAbsoluteFilePath;
            }
    
            // Write the content to the file (renamed or original) or split into multiple files
            docUtil.checkFileAccess(finalFilePath, root);
                
            if (split) {
                // Split the content on '\n~\n' delimiter and create multiple files
                const parts = content.split('\n~\n');
                    
                if (parts.length > 1) {
                    // Get the original file's ordinal and use it for the first part
                    const originalOrdinal = docUtil.getOrdinalFromName(path.basename(finalFilePath));
                        
                    // Shift down existing files to make room for the new split files
                    const numberOfNewFiles = parts.length - 1; // -1 because original file stays in place
                    docUtil.shiftOrdinalsDown(numberOfNewFiles, path.dirname(finalFilePath), originalOrdinal + 1, root, null);
                        
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
                            
                        docUtil.checkFileAccess(partFilePath, root);
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
     * @param req - Express request object containing oldFolderName, newFolderName, treeFolder, and docRootKey
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

            // If folder is not renamed, return success
            if (oldFolderName === newFolderName) {
                res.json({ success: true, message: 'Folder name is unchanged' });
                return;
            }

            // Check if the new name already exists
            if (fs.existsSync(newAbsolutePath)) {
                res.status(409).json({ error: 'A folder with the new name already exists' });
                return;
            }

            // Rename the folder
            docUtil.checkFileAccess(oldAbsolutePath, root);
            docUtil.checkFileAccess(newAbsolutePath, root);
            fs.renameSync(oldAbsolutePath, newAbsolutePath);
            
            console.log(`Folder renamed successfully: ${oldAbsolutePath} -> ${newAbsolutePath}`);
            res.json({ success: true, message: 'Folder renamed successfully' });
        } catch (error) {
            svrUtil.handleError(error, res, 'Failed to rename folder');
        }
    }

    /**
     * Deletes one or more files or folders from the server
     * Supports both single item and batch deletion operations
     * @param req - Express request object containing fileOrFolderName (single) or fileNames (array), treeFolder, and docRootKey
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
                    
                    docUtil.checkFileAccess(absoluteTargetPath, root);
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
     * @param req - Express request object containing direction ('up' or 'down'), filename, treeFolder, and docRootKey
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
            docUtil.checkFileAccess(absoluteParentPath, root);
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

            docUtil.checkFileAccess(currentPath, root);
            docUtil.checkFileAccess(targetPath, root);
            docUtil.checkFileAccess(tempPath, root);

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
     * Pastes items from the cut list to the target folder by moving them with proper ordinal positioning
     * Supports both positional pasting (at specific ordinal) and appending to end of folder
     * @param req - Express request object containing targetFolder, pasteItems array, docRootKey, and optional targetOrdinal
     * @param res - Express response object 
     */ 
    pasteItems = async (req: Request<any, any, { targetFolder: string; pasteItems: string[], docRootKey: string, targetOrdinal?: string }>, res: Response): Promise<void> => {    
        try {
            const { targetFolder, pasteItems, docRootKey, targetOrdinal } = req.body;
    
            // sort the pasteItems string[] to ensure they are in the correct order
            pasteItems.sort((a, b) => a.localeCompare(b));
    
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
            docUtil.checkFileAccess(absoluteTargetPath, root);
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
            // For same-folder reordering, we need to handle conflicts by temporarily moving files
            // For cross-folder moves, we don't ignore any items since they're coming from different directories
            let itemsToIgnore: string[] | null = null;
            const tempMoves: { tempPath: string; originalPath: string; finalName: string }[] = [];
            
            // Check if any of the items being pasted are from the same target directory
            const targetFolderNormalized = targetFolder === '/' ? '' : targetFolder;
            const isSameFolderOperation = pasteItems.some(fullPath => {
                const itemDir = path.dirname(fullPath);
                const itemDirNormalized = itemDir === '.' ? '' : itemDir;
                return itemDirNormalized === targetFolderNormalized;
            });
            
            if (isSameFolderOperation) {
                // For same-folder operations, temporarily move files out of the way first
                // This prevents conflicts during ordinal shifting
                for (let i = 0; i < pasteItems.length; i++) {
                    const itemFullPath = pasteItems[i];
                    const itemDir = path.dirname(itemFullPath);
                    const itemDirNormalized = itemDir === '.' ? '' : itemDir;
                    
                    // Only handle items from the same directory
                    if (itemDirNormalized === targetFolderNormalized) {
                        const itemName = path.basename(itemFullPath);
                        const sourceFilePath = path.join(root, itemFullPath);
                        
                        if (fs.existsSync(sourceFilePath)) {
                            // Create temporary filename
                            const tempName = `temp_paste_${Date.now()}_${i}_${itemName}`;
                            const tempPath = path.join(absoluteTargetPath, tempName);
                            
                            // Move to temporary location
                            fs.renameSync(sourceFilePath, tempPath);
                            
                            // Calculate final name with new ordinal
                            const currentOrdinal = insertOrdinal + i;
                            const nameWithoutPrefix = itemName.includes('_') ? 
                                itemName.substring(itemName.indexOf('_') + 1) : itemName;
                            const newOrdinalPrefix = currentOrdinal.toString().padStart(4, '0');
                            const finalName = `${newOrdinalPrefix}_${nameWithoutPrefix}`;
                            
                            tempMoves.push({
                                tempPath,
                                originalPath: sourceFilePath,
                                finalName
                            });
                        }
                    }
                }
                
                // Now all same-folder items are out of the way, so don't ignore anything during shifting
                itemsToIgnore = null;
            }
            
            const pathMapping = docUtil.shiftOrdinalsDown(pasteItems.length, absoluteTargetPath, insertOrdinal, root, itemsToIgnore);
            
            // Update pasteItems with new paths after ordinal shifting
            for (let i = 0; i < pasteItems.length; i++) {
                const originalPath = pasteItems[i];
                // console.log('  Checking if mapped to new name:', originalPath);
                
                // Normalize the path by removing leading slash for comparison
                const normalizedOriginalPath = originalPath.startsWith('/') ? originalPath.substring(1) : originalPath;
                
                // Check if any folder in the path hierarchy was renamed
                let updatedPath = originalPath;
                let pathChanged = false;
                
                // Check each mapping to see if it affects this file's path
                for (const [oldFolderPath, newFolderPath] of pathMapping) {
                    // Check if the file path starts with the old folder path
                    if (normalizedOriginalPath.startsWith(oldFolderPath + '/') || normalizedOriginalPath === oldFolderPath) {
                        // Replace the old folder path with the new one
                        const relativePart = normalizedOriginalPath.substring(oldFolderPath.length);
                        const newNormalizedPath = newFolderPath + relativePart;
                        updatedPath = originalPath.startsWith('/') ? '/' + newNormalizedPath : newNormalizedPath;
                        pathChanged = true;
                        // console.log(`    Updated paste item path: ${originalPath} -> ${updatedPath}`);
                        break;
                    }
                }
                
                if (pathChanged) {
                    pasteItems[i] = updatedPath;
                } else {
                    // console.log(`    No mapping needed for: ${originalPath}`);
                }
            }
                
            // Move each file/folder
            for (let i = 0; i < pasteItems.length; i++) {
                const itemFullPath = pasteItems[i];
                try {
                    const itemDir = path.dirname(itemFullPath);
                    const itemDirNormalized = itemDir === '.' ? '' : itemDir;
                    const isFromSameFolder = itemDirNormalized === targetFolderNormalized;
                    
                    if (isFromSameFolder && tempMoves.length > 0) {
                        // Handle same-folder moves using temporary files
                        const tempMove = tempMoves.find(tm => path.basename(tm.originalPath) === path.basename(itemFullPath));
                        if (tempMove) {
                            const finalFilePath = path.join(absoluteTargetPath, tempMove.finalName);
                            // Move from temp location to final location
                            fs.renameSync(tempMove.tempPath, finalFilePath);
                            pastedCount++;
                        } else {
                            errors.push(`Temporary file not found for ${itemFullPath}`);
                        }
                    } else {
                        // Handle cross-folder moves (regular logic)
                        const itemName = path.basename(itemFullPath);
                        const sourceFilePath = path.join(root, itemFullPath);
                        
                        // Check if source file exists
                        if (!fs.existsSync(sourceFilePath)) {
                            console.error(`Source file not found: ${itemFullPath}`);
                            errors.push(`Source file not found: ${itemFullPath}`);
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

                        // Safety check: ensure target doesn't already exist to prevent overwriting
                        if (fs.existsSync(targetFilePath)) {
                            console.error(`Target file already exists, skipping: ${targetFilePath}`);
                            errors.push(`Target file already exists: ${targetFileName}`);
                            continue;
                        }

                        // Move the file/folder
                        fs.renameSync(sourceFilePath, targetFilePath);                    
                        pastedCount++;
                    }
                } catch (error) {
                    console.error(`Error moving ${itemFullPath}:`, error);
                    errors.push(`Failed to move ${itemFullPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
     * Joins multiple selected files by concatenating their content and saving to the first file
     * Files are sorted by ordinal before joining, and all but the first file are deleted
     * @param req - Express request object containing filenames array, treeFolder, and docRootKey
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
            docUtil.checkFileAccess(absoluteFolderPath, root);
        
            // Check if all files exist and read their content
            const fileData: { filename: string; ordinal: number; content: string }[] = [];
                    
            for (const filename of filenames) {
                const absoluteFilePath = path.join(absoluteFolderPath, filename);
                docUtil.checkFileAccess(absoluteFilePath, root);
                        
                if (!fs.existsSync(absoluteFilePath)) {
                    res.status(404).json({ error: `File not found: ${filename}` });
                    return;
                }
        
                // Get ordinal for sorting
                const ordinal = docUtil.getOrdinalFromName(filename);
                        
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
                    
            docUtil.checkFileAccess(firstFilePath, root);
            fs.writeFileSync(firstFilePath, joinedContent, 'utf8');
            console.log(`Joined content saved to: ${firstFile.filename}`);
        
            // Delete the remaining files
            const deletedFiles: string[] = [];
            for (let i = 1; i < fileData.length; i++) {
                const fileToDelete = fileData[i];
                const deleteFilePath = path.join(absoluteFolderPath, fileToDelete.filename);
                        
                try {
                    docUtil.checkFileAccess(deleteFilePath, root);
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

    /**
     * Converts a file into a folder by using the first line of the file's content as the folder name
     * Deletes the original file and creates a folder with the specified name, then creates a new file
     * with the remaining content inside the folder
     * @param req - Express request object containing filename, folderName, remainingContent, treeFolder, and docRootKey
     * @param res - Express response object
     */
    makeFolder = async (req: Request<any, any, { filename: string; folderName: string; remainingContent: string; treeFolder: string; docRootKey: string }>, res: Response): Promise<void> => {
        console.log("Make Folder Request");
        try {
            const { filename, folderName, remainingContent, treeFolder, docRootKey } = req.body;
            const root = config.getPublicFolderByKey(docRootKey).path;
            if (!root) {
                res.status(500).json({ error: 'bad root' });
                return;
            }

            if (!filename || !folderName || !treeFolder) {
                res.status(400).json({ error: 'Filename, folder name, and treeFolder are required' });
                return;
            }

            // Check if folder name is too long
            if (folderName.length > 140) {
                res.status(400).json({ error: 'Folder name is too long. Maximum 140 characters allowed.' });
                return;
            }

            // Construct the absolute paths
            const absoluteFolderPath = path.join(root, treeFolder);
            const absoluteFilePath = path.join(absoluteFolderPath, filename);

            // Check if the parent directory exists
            docUtil.checkFileAccess(absoluteFolderPath, root);
            if (!fs.existsSync(absoluteFolderPath)) {
                res.status(404).json({ error: 'Parent directory not found' });
                return;
            }

            // Check if the file exists
            if (!fs.existsSync(absoluteFilePath)) {
                res.status(404).json({ error: 'File not found' });
                return;
            }

            // Check if it's actually a file
            const fileStat = fs.statSync(absoluteFilePath);
            if (!fileStat.isFile()) {
                res.status(400).json({ error: 'Path is not a file' });
                return;
            }

            // Extract the numeric prefix from the original file name
            const underscoreIndex = filename.indexOf('_');
            const numericPrefix = underscoreIndex !== -1 ? filename.substring(0, underscoreIndex + 1) : '';
            
            // Create the new folder name with the numeric prefix
            const newFolderName = numericPrefix + folderName;
            const absoluteNewFolderPath = path.join(absoluteFolderPath, newFolderName);

            // Check if a folder with this name already exists
            if (fs.existsSync(absoluteNewFolderPath)) {
                res.status(409).json({ error: 'A folder with this name already exists' });
                return;
            }

            // Delete the original file
            docUtil.checkFileAccess(absoluteFilePath, root);
            fs.unlinkSync(absoluteFilePath);
            console.log(`File deleted: ${absoluteFilePath}`);

            // Create the new folder
            docUtil.checkFileAccess(absoluteNewFolderPath, root);
            fs.mkdirSync(absoluteNewFolderPath, { recursive: true });
            console.log(`Folder created: ${absoluteNewFolderPath}`);

            // If there's remaining content, create a new file inside the folder
            if (remainingContent && remainingContent.trim().length > 0) {
                const newFileName = '0001_file.md';
                const newFilePath = path.join(absoluteNewFolderPath, newFileName);
                
                docUtil.checkFileAccess(newFilePath, root);
                fs.writeFileSync(newFilePath, remainingContent, 'utf8');
                console.log(`New file created with remaining content: ${newFilePath}`);
            }

            res.json({ 
                success: true, 
                message: `File "${filename}" converted to folder "${newFolderName}" successfully${remainingContent && remainingContent.trim().length > 0 ? ' with remaining content saved as 0001_file.md' : ''}`,
                folderName: newFolderName
            });
        } catch (error) {
            svrUtil.handleError(error, res, 'Failed to convert file to folder');
        }
    }        
}
export const docMod = new DocMod();
