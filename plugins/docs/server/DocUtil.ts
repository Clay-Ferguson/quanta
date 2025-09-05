import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { handleError } from "../../../server/ServerUtil.js";
import { config } from "../../../server/Config.js";
import { IFS } from './IFS.js';
import vfs from './VFS/VFS.js';
import lfs from './LFS/LFS.js';
const { exec } = await import('child_process');

/**
 * Utility class for document management operations including file/folder ordering,
 * security validation, and file system integration.
 * 
 * This class provides functionality for:
 * - Managing ordinal-based file/folder naming (NNNN_filename format)
 * - Shifting ordinals to maintain proper sequencing during insertions
 * - Security validation to prevent directory traversal attacks
 * - File system integration for opening files/folders in desktop applications
 * 
 * All methods that access the file system include security checks to ensure
 * operations are restricted to allowed root directories.
 */
class DocUtil {
    getPathByUUID = async (uuid: string, docRootKey: string): Promise<string | null> => {        
        const ifs = docUtil.getFileSystem(docRootKey!);
        const result = await ifs.getItemByID(uuid, docRootKey);
        if (result.node) {
            // console.log(`Found VFS item by UUID: ${uuid} -> docPath: ${result.docPath}`);
            return result.docPath;
                           
        } else {
            console.log(`VFS item not found for UUID: ${uuid}`);
        }
        return null;
    }
    /**
     * Factory method to create the appropriate file system implementation based on root configuration.
     * Returns either LFS (Linux File System) for "lfs" type or VFS (Virtual File System) for "vfs" type.
     * 
     * @param docRootKey - Key identifier for the document root
     * @returns IFS implementation (LFS or VFS)
     */
    getFileSystem(docRootKey: string): IFS {
        if (!docRootKey) {
            throw new Error('Document root key is required to determine file system type');
        }
        const rootConfig = config.getPublicFolderByKey(docRootKey);
        if (!rootConfig) {
            throw new Error(`Invalid document root key: ${docRootKey}`);
        }
        
        const rootType = rootConfig.type || 'lfs'; // Default to lfs if type not specified
        
        if (rootType === 'vfs') {
            return vfs;
        } else {
            return lfs; // Default to Linux File System
        }
    }

    getFileSystemType(docRootKey: string): string {
        const rootConfig = config.getPublicFolderByKey(docRootKey);
        if (!rootConfig) {
            throw new Error(`Invalid document root key: ${docRootKey}`);
        }
        
        return rootConfig.type || 'vfs'; // Default to vfs if type not specified
    }

    /**
     * Extracts the numeric ordinal from a filename with format "NNNN_filename"
     * 
     * This method validates that the filename follows the expected ordinal naming convention
     * where files are prefixed with a numeric value followed by an underscore.
     * 
     * @param file - The filename to extract ordinal from (e.g., "0001_document.md")
     * @returns The numeric ordinal value (e.g., 1 from "0001_document.md")
     */
    getOrdinalFromName = (file: string): number => {
        // Use regex to ensure the ordinal is a number followed by an underscore
        if (!/^\d+_/.test(file)) {
            throw new Error(`Invalid file name format: ${file}. Expected format is "NNNN_" where N is a digit.`);
        }
        const prefix = file.substring(0, file.indexOf('_'));
        const ordinal = parseInt(prefix);
        return ordinal;
    }
    
    /**
     * Shifts ordinals down for all files/folders at or below a given ordinal position
     * 
     * This method creates space for new files to be inserted at specific positions by
     * incrementing the ordinal prefixes of existing files. It's essential for maintaining
     * proper sequential ordering when inserting new items.
     * 
     * NOTE: todo-2: We do have a Postgres VFS function for doing this in a single call (vfs_shift_ordinals_down in 'unused.sql' file) 
     * but it's untested, and we need to verify that this way of doing it works anyway, so we don't use the more efficient VFS method
     *  yet for now. I think this method
     * is probably in the '
     * 
     * Process:
     * 1. Reads directory contents and filters for ordinal-prefixed items
     * 2. Identifies items that need shifting (ordinal >= insertOrdinal)
     * 3. Sorts in reverse order to avoid naming conflicts during renaming
     * 4. Increments each ordinal by the specified amount
     * 5. Tracks path mappings for external systems that reference these files
     * 
     * @param slotsToAdd - Number of ordinal slots to add (shift amount)
     * @param absoluteParentPath - The absolute path to the directory containing items to shift
     * @param insertOrdinal - The ordinal position where we're inserting (files at this position and below get shifted)
     * @param root - The root directory for security validation
     * @param itemsToIgnore - Array of filenames to skip during shifting (optional, useful for newly created items)
     * @returns Map of old relative paths to new relative paths for renamed items
     */
    shiftOrdinalsDown = async (owner_id: number, slotsToAdd: number, absoluteParentPath: string, insertOrdinal: number, root: string, 
        itemsToIgnore: string[] | null, ifs: IFS): Promise<Map<string, string>> => {
        // console.log(`Shifting ordinals down by ${slotsToAdd} slots at ${absoluteParentPath} for insert ordinal ${insertOrdinal}`);
        ifs.checkFileAccess(absoluteParentPath, root);
        
        // Map to track old relative paths to new relative paths for external reference updates
        const pathMapping = new Map<string, string>();
        
        // Calculate the relative folder path from root for path mapping
        const relativeFolderPath = path.relative(root, absoluteParentPath);
        
        // Read directory contents and filter for files/folders with numeric prefixes
        // console.log(`Reading directory contents to prepare for shifting down: ${absoluteParentPath}`);
        const allFiles = await ifs.readdir(owner_id, absoluteParentPath);
        const numberedFiles = allFiles.filter(file => /^\d+_/.test(file));
        
        // Sort files by name (which will sort by numeric prefix for proper ordering)
        numberedFiles.sort((a, b) => a.localeCompare(b));

        // Find files that need to be shifted (ordinal >= insertOrdinal)
        const filesToShift = numberedFiles.filter(file => {
            const ordinal = this.getOrdinalFromName(file);
            return ordinal >= insertOrdinal;
        });

        // Sort in reverse order to avoid conflicts during renaming
        // (rename highest ordinals first to prevent overwriting)
        filesToShift.sort((a, b) => b.localeCompare(a));

        // Shift each file down by incrementing its ordinal prefix
        for (const file of filesToShift) {
            // console.log(`Shifting file: ${file}`);
            
            // Skip files that should be ignored (e.g., newly created items)
            if (itemsToIgnore && itemsToIgnore.includes(file)) {
                // console.log(`    Skipping file: ${file} (in itemsToIgnore)`);
                continue;
            }
            
            // Parse current filename components
            const prefix = file.substring(0, file.indexOf('_'));
            const nameWithoutPrefix = file.substring(file.indexOf('_') + 1);
            const currentOrdinal = parseInt(prefix);
            const newOrdinal = currentOrdinal + slotsToAdd; // Increment ordinal by slotsToAdd
            
            // Create new filename with incremented ordinal (padded with leading zeros)
            const newPrefix = newOrdinal.toString().padStart(prefix.length, '0');
            const newFileName = `${newPrefix}_${nameWithoutPrefix}`;
            
            const oldPath = path.join(absoluteParentPath, file);
            const newPath = path.join(absoluteParentPath, newFileName);
            
            // Safety check: ensure target doesn't already exist to prevent overwriting
            if (await ifs.exists(newPath)) {
                console.error(`Target file already exists during ordinal shift, skipping: ${newPath}`);
                console.error(`This indicates a problem with ordinal sequencing that needs to be resolved.`);
                continue;
            }
            
            // console.log(`Shifting file: ${file} -> ${newFileName}`);            
            await ifs.rename(owner_id, oldPath, newPath);
            
            // Track the path mapping for relative paths (used by external systems)
            const oldRelativePath = relativeFolderPath ? path.join(relativeFolderPath, file) : file;
            const newRelativePath = relativeFolderPath ? path.join(relativeFolderPath, newFileName) : newFileName;
            pathMapping.set(oldRelativePath, newRelativePath);
        }
        
        return pathMapping;
    };

    /**
     * Ensures a file/folder has a 4-digit ordinal prefix (i.e. "NNNN_"), renaming it if necessary
     * 
     * This method standardizes ordinal prefixes to a consistent 4-digit format for proper
     * sorting and display. It handles both padding short ordinals with leading zeros and
     * truncating long ordinals from legacy systems.
     * 
     * The method supports:
     * - Padding short ordinals: "1_file.md" becomes "0001_file.md"
     * - Truncating legacy 5+ digit ordinals that start with zero: "00001_file.md" becomes "0001_file.md"
     * - Preserving already correctly formatted 4-digit ordinals
     * 
     * @param absolutePath - The absolute path to the directory containing the file
     * @param fileName - The original filename with existing ordinal prefix
     * @param root - The root directory for security validation
     * @returns The filename (either original or renamed) to use for further processing
     */
    ensureFourDigitOrdinal = async (owner_id: number, absolutePath: string, fileName: string, root: string, ifs: IFS): Promise<string> => {
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
                // Safety check: ensure target doesn't already exist to prevent overwriting
                if (await ifs.exists(newFilePath)) {
                    console.warn(`Target file already exists, skipping rename: ${newFileName}`);
                    return fileName; // Return original name if target exists
                }
                
                // Rename the file/folder to have 4-digit ordinal prefix
                ifs.checkFileAccess(oldFilePath, root);
                ifs.checkFileAccess(newFilePath, root);
                await ifs.rename(owner_id, oldFilePath, newFilePath);
                console.log(`Renamed ${fileName} to ${newFileName} for 4-digit ordinal prefix(a)`);
                
                // Return the new filename for further processing
                return newFileName;
            } catch (error) {
                console.warn(`Failed to rename ${fileName} to ${newFileName}:`, error);
                // Return original name if rename fails
                return fileName;
            }
        }
        // Legacy support: Handle ordinals with more than 4 digits from legacy Quanta CMS exports
        // TODO: This is a temporary hack for importing legacy files with 5+ digit ordinals
        // Remove this block when legacy file support is no longer needed
        else if (ordinalPrefix.length > 4) {
            // Only truncate if the ordinal starts with zero (safety check for legacy files)
            if (ordinalPrefix.startsWith('0')) {
                // Take the last 4 digits to create a 4-digit ordinal
                const newOrdinal = ordinalPrefix.substring(ordinalPrefix.length - 4);
                const newFileName = newOrdinal + restOfName;
                const oldFilePath = path.join(absolutePath, fileName);
                const newFilePath = path.join(absolutePath, newFileName);
                
                try {
                    // Safety check: ensure target doesn't already exist to prevent overwriting
                    if (await ifs.exists(newFilePath)) {
                        console.warn(`Target file already exists, skipping rename: ${newFileName}`);
                        return fileName; // Return original name if target exists
                    }
                    
                    // Rename the file/folder to have 4-digit ordinal prefix
                    ifs.checkFileAccess(oldFilePath, root);
                    ifs.checkFileAccess(newFilePath, root);
                    await ifs.rename(owner_id, oldFilePath, newFilePath);
                    console.log(`Renamed ${fileName} to ${newFileName} for 4-digit ordinal prefix(b)`);
                    
                    // Return the new filename for further processing
                    return newFileName;
                } catch (error) {
                    console.warn(`Failed to rename ${fileName} to ${newFileName}:`, error);
                    // Return original name if rename fails
                    return fileName;
                }
            } else {
                // Ordinal is too long and doesn't start with zero - this is an error condition
                throw new Error(`Invalid ordinal prefix in filename: ${fileName}`);
            }
        }
        
        // No rename needed, return original filename (already 4 digits)
        return fileName;
    };

    /**
     * Gets the maximum ordinal value from all numbered files/folders in a directory
     * 
     * This method scans a directory for files with ordinal prefixes and returns the
     * highest ordinal value found. It's useful for determining where to place new
     * files when appending to the end of a sequence.
     * 
     * @param absolutePath - The absolute path to the directory to scan
     * @param root - The root directory for security validation
     * @returns The maximum ordinal value found, or 0 if no numbered files exist
     */
    getMaxOrdinal = async (owner_id: number, absolutePath: string, root: string, ifs: IFS): Promise<number> => {
        ifs.checkFileAccess(absolutePath, root);
                
        // Read directory contents and filter for files/folders with numeric prefixes
        const allFiles = await ifs.readdir(owner_id, absolutePath);
        const numberedFiles = allFiles.filter(file => /^\d+_/.test(file));
                
        // Return 0 if no numbered files exist
        if (numberedFiles.length === 0) {
            return 0;
        }
                
        // Extract ordinals and find the maximum value
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
     * Adds a 4-digit ordinal prefix to a filename that doesn't already have one
     * 
     * This method takes a filename without an ordinal prefix and adds one with the
     * specified ordinal value. It's commonly used when importing files or creating
     * new files that need to be integrated into the ordinal naming system.
     * 
     * The method includes special handling for "content.md" files which are given
     * ordinal 0 as a convention in the system.
     * 
     * @param absolutePath - The absolute path to the directory containing the file
     * @param fileName - The original filename without ordinal prefix (e.g., "document.md")
     * @param ordinal - The ordinal number to use as prefix
     * @param root - The root directory for security validation
     * @returns The filename (either original if rename failed, or the new renamed filename)
     */
    ensureOrdinalPrefix = async (owner_id: number, absolutePath: string, fileName: string, ordinal: number, root: string, ifs: IFS): Promise<string> => {
    
        // Special case: content.md files are always given ordinal 0 by convention
        // TODO: This is a temporary hack for better Quanta export ingestion and will be removed later
        if (fileName === "content.md") {
            ordinal = 0;
        }
    
        // Create new filename with 4-digit ordinal prefix
        const ordinalPrefix = ordinal.toString().padStart(4, '0');
        const newFileName = `${ordinalPrefix}_${fileName}`;
        const oldFilePath = path.join(absolutePath, fileName);
        const newFilePath = path.join(absolutePath, newFileName);
            
        try {
            // Safety check: ensure target doesn't already exist to prevent overwriting
            if (await ifs.exists(newFilePath)) {
                console.warn(`Target file already exists, skipping rename: ${newFileName}`);
                return fileName; // Return original name if target exists
            }
            
            // Rename the file/folder to have 4-digit ordinal prefix
            ifs.checkFileAccess(oldFilePath, root);
            ifs.checkFileAccess(newFilePath, root);
            await ifs.rename(owner_id, oldFilePath, newFilePath);
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
     * 
     * This method provides integration between the web application and the desktop environment,
     * allowing users to open files and folders directly in their preferred applications.
     * 
     * Security requirements:
     * - Desktop mode must be enabled in configuration for security reasons
     * - All file paths are validated against the allowed document root
     * 
     * Special handling:
     * - Text files (.md, .txt) can be opened for editing in VS Code on Linux
     * - The action parameter determines whether to edit or view the item
     * 
     * @param req - Express request object containing treeItem, docRootKey, and action
     * @param res - Express response object for sending the HTTP response
     */
    openFileSystemItem = async (req: Request<any, any, { treeItem: string; docRootKey: string, action: string }>, res: Response): Promise<void> => {
        console.log("Open File System Item Request");
    
        // Security check: ensure desktop mode is enabled before allowing file system access
        if (config.get("desktopMode") !== 'y') {
            console.warn("File system access is disabled in this mode");
            res.status(403).json({ error: 'File system access is disabled in this mode' });
            return;
        }
    
        try {
            const { treeItem, docRootKey, action } = req.body;
            const root = config.getPublicFolderByKey(docRootKey).path;
                
            // Validate required parameters
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
            // Won't need this security check, because in this mode of the app, we're giving full access to the file system, and it's by an admin user
            // ifs.checkFileAccess(absoluteItemPath, root);
    
            // Verify the item exists in the file system
            if (!fs.existsSync(absoluteItemPath)) {
                res.status(404).json({ error: 'Item not found' });
                return;
            }
    
            // Determine if the item is a file or directory
            const stat = fs.statSync(absoluteItemPath);
            const isDirectory = stat.isDirectory();
            const isFile = stat.isFile();
    
            if (!isDirectory && !isFile) {
                res.status(400).json({ error: 'Path is neither a file nor a directory' });
                return;
            }
    
            // Determine the appropriate command based on the operating system
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
                // On Linux, choose application based on action and file type
                if (action == "edit" || absoluteItemPath.endsWith('.md') || absoluteItemPath.endsWith('.txt')) {
                    // Open text files in VS Code for editing
                    // TODO: Make editor command configurable via YAML configuration file
                    command = `code "${absoluteItemPath}"`;
                }
                else {
                    // Use system default application for other files/folders
                    command = `xdg-open "${absoluteItemPath}"`;
                }
                break;
            }
    
            // Execute the command to open the item
            exec(command, (error) => {
                if (error) {
                    console.error(`Error opening ${isDirectory ? 'folder' : 'file'}:`, error);
                    res.status(500).json({ error: `Failed to open ${isDirectory ? 'folder' : 'file'} in file system` });
                } else {
                    console.log(`Successfully opened ${isDirectory ? 'folder' : 'file'}: ${absoluteItemPath}`);
                    res.json({ 
                        message: `${isDirectory ? 'Folder' : 'File'} opened in file system`,
                        itemType: isDirectory ? 'folder' : 'file'
                    });
                }
            });
    
        } catch (error) {
            // Handle any errors that occur during the process
            handleError(error, res, 'Failed to open item in file system');
        }
    }

    /**
     * Parses a search query string into individual search terms, handling quoted phrases and unquoted words.
     * 
     * This utility method extracts search terms from a query string, properly handling:
     * - Quoted phrases: "exact phrase" - treated as single search terms
     * - Unquoted words: individual words separated by whitespace
     * - Mixed queries: combination of quoted phrases and unquoted words
     * 
     * The parsing preserves the integrity of quoted phrases while splitting unquoted text
     * by whitespace. This is essential for search functionality that needs to distinguish
     * between exact phrase matches and individual word matches.
     * 
     * Examples:
     * - 'hello world' → ['hello', 'world']
     * - '"hello world"' → ['hello world']
     * - 'hello "exact phrase" world' → ['hello', 'exact phrase', 'world']
     * 
     * @param query - The search query string to parse
     * @returns Array of search terms, with quoted phrases preserved as single terms
     */
    parseSearchTerms = (query: string): string[] => {
        const searchTerms: string[] = [];
        
        // Handle quoted phrases and individual words
        if (query.includes('"')) {
            // Extract quoted phrases and unquoted words using regex
            const regex = /"([^"]+)"|(\S+)/g;
            let match;
            while ((match = regex.exec(query)) !== null) {
                if (match[1]) {
                    searchTerms.push(match[1]); // Quoted phrase
                } else if (match[2] && !match[2].startsWith('"')) {
                    searchTerms.push(match[2]); // Unquoted word
                }
            }
        } else {
            // Split by whitespace for simple queries
            searchTerms.push(...query.trim().split(/\s+/).filter(term => term.length > 0));
        }
        
        return searchTerms;
    }
}

export const docUtil = new DocUtil();