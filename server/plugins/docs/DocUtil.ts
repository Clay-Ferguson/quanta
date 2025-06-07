import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { svrUtil } from "../../ServerUtil.js";
import { config } from "../../Config.js";
const { exec } = await import('child_process');

class DocUtil {
    /**
     * Extracts the numeric ordinal from a filename with format "NNNN_filename"
     * @param file - The filename to extract ordinal from
     * @returns The numeric ordinal value
     * @throws Error if filename doesn't match expected format
     */
    getOrdinalFromName = (file: string): number => {
        // use regex go make sure the ordinal is a number followed by an underscore
        if (!/^\d+_/.test(file)) {
            throw new Error(`Invalid file name format: ${file}. Expected format is "NNNN_" where N is a digit.`);
        }
        const prefix = file.substring(0, file.indexOf('_'));
        const ordinal = parseInt(prefix);
        return ordinal;
    }
    
    /**
     * Security check to ensure file access is within allowed root directory
     * Prevents directory traversal attacks by validating canonical paths
     * @param filename - The filename/path to check
     * @param root - The allowed root directory
     * @throws Error if access is outside allowed root directory
     */
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
     * Shifts ordinals down for all files/folders at or below a given ordinal position
     * This creates space for new files to be inserted at specific positions
     * @param slotsToAdd - Number of ordinal slots to add (shift amount)
     * @param absoluteParentPath - The absolute path to the directory
     * @param insertOrdinal - The ordinal position where we're inserting (files at this position and below get shifted)
     * @param root - The root directory for security validation
     * @param itemsToIgnore - Array of filenames to skip during shifting (optional)
     */
    shiftOrdinalsDown = (slotsToAdd: number, absoluteParentPath: string, insertOrdinal: number, root: string, 
        itemsToIgnore: string[] | null): void => {
        console.log(`Shifting ordinals down by ${slotsToAdd} slots at ${absoluteParentPath} for insert ordinal ${insertOrdinal}`);
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
     * Handles both padding short ordinals and truncating long ones from legacy systems
     * @param absolutePath - The absolute path to the directory containing the file
     * @param fileName - The original filename
     * @param root - The root directory for security validation
     * @returns The filename (either original or renamed) to use for further processing
     */
    ensureFourDigitOrdinal = (absolutePath: string, fileName: string, root: string): string => {
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
     * Gets the maximum ordinal value from all numbered files/folders in a directory
     * @param absolutePath - The absolute path to the directory
     * @param root - The root directory for security validation
     * @returns The maximum ordinal value found, or 0 if no numbered files exist
     */
    // todo-1: this method is not used any longer, so we can remove it some day.
    getMaxOrdinal = (absolutePath: string, root: string): number => {
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
     * @param root - The root directory for security validation
     * @returns The filename (either original if rename failed, or the new renamed filename)
     */
    ensureOrdinalPrefix = (absolutePath: string, fileName: string, ordinal: number, root: string): string => {
    
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
     * Requires desktop mode to be enabled for security reasons
     * @param req - Express request object containing treeItem, docRootKey, and action
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
}

export const docUtil = new DocUtil();