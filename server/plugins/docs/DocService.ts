import { ANON_USER_ID, TreeNode } from "../../../common/types/CommonTypes.js";
import { Request, Response } from 'express';
import {  TreeRender_Response } from "../../../common/types/EndpointTypes.js";
import { AuthenticatedRequest, handleError, svrUtil, throwError } from "../../ServerUtil.js";
import { config } from "../../Config.js";
import { docUtil } from "./DocUtil.js";
import { IFS } from "./IFS/IFS.js";
import { runTrans } from "../../Transactional.js";
import fs from 'fs';
import path from 'path';
import pgdb from "../../PGDB.js";
const { exec } = await import('child_process');
import { fixName, getFilenameExtension } from '../../../common/CommonUtils.js';

/**
 * Service class for handling document management operations in the docs plugin.
 * 
 * This service provides comprehensive document management functionality including:
 * - Hierarchical folder/file navigation with ordinal-based naming
 * - File and folder creation with automatic ordinal positioning
 * - Advanced search capabilities across text files and PDFs
 * - Tree structure rendering with pullup folder support
 * - Path resolution for non-ordinal paths to ordinal-based paths
 * 
 * Key Features:
 * - All folders use 4-digit ordinal prefixes (e.g., "0001_FolderName")
 * - Supports ordinal-based insertion and automatic renumbering
 * - Multi-mode search (REGEX, MATCH_ANY, MATCH_ALL) with timestamp filtering
 * - Security validation for all file operations within allowed roots
 * - Support for various file types (text, images, PDFs, binary)
 * 
 * Public Methods:
 * 
 * Path Resolution:
 * - resolveNonOrdinalPath(): Converts user-friendly paths to ordinal-based paths
 * 
 * Tree Operations:
 * - treeRender(): HTTP endpoint for rendering directory tree structures
 * - getTreeNodes(): Core recursive tree building logic with pullup support
 * 
 * File Management:
 * - createFile(): HTTP endpoint for creating new files with ordinal positioning
 * - createFolder(): HTTP endpoint for creating new folders with ordinal positioning
 * 
 * Search Operations:
 * - searchTextFiles(): Advanced grep-based search with line-level results
 * - searchBinaries(): Comprehensive search including PDFs with file-level results
 * 
 * Security Model:
 * All operations are constrained by document root keys and undergo security validation
 * to prevent directory traversal attacks and unauthorized file access.
 * 
 * Ordinal System:
 * The service maintains a strict 4-digit ordinal prefix system (0000-9999) for all
 * files and folders, enabling precise ordering and insertion capabilities.
 */
class DocService {
    /**
     * Resolves a non-ordinal path to its corresponding ordinal-based path in the file system.
     * 
     * The file system uses folders with 4-digit ordinal prefixes (e.g., "1234_FolderName/5678_SubFolderName").
     * This method allows resolution of user-friendly paths like "FolderName/SubFolderName" to their
     * actual ordinal-based paths by performing directory lookups and name matching.
     * 
     * Algorithm:
     * 1. Decode and validate the input path
     * 2. Split path into individual folder components
     * 3. For each component, scan the current directory for matching ordinal folders
     * 4. Match folder names case-insensitively (ignoring ordinal prefix)
     * 5. Build the resolved ordinal path incrementally
     * 
     * Security: All paths are validated against the document root to prevent directory traversal
     *
     * @param docRootKey - Key identifier for the document root (resolved via config.getPublicFolderByKey)
     * @param treeFolder - Non-ordinal path to resolve (e.g., "FolderName/SubFolderName")
     * @returns The resolved path with ordinals (e.g., "/1234_FolderName/5678_SubFolderName"), or null if no path found
     */
    resolveNonOrdinalPath = async (owner_id: number, docRootKey: string, treeFolder: string, ifs: IFS): Promise<string | null> => {       
        treeFolder = ifs.normalizePath(treeFolder);
        // Resolve the document root path using the provided key
        const root = config.getPublicFolderByKey(docRootKey).path;
        if (!root) {
            throw new Error('Invalid document root key');
        }

        // Decode URL encoding and sanitize the tree folder path
        const decodedTreeFolder = decodeURIComponent(treeFolder);
        
        // Handle root directory case - return immediately
        if (decodedTreeFolder === '') {
            return '';
        }
        
        // Split the path into individual folder components, filtering out empty strings
        const folderComponents = decodedTreeFolder.split('/').filter(component => component.length > 0);
        
        // Initialize path resolution variables
        let currentPath = root;  // Current absolute path being examined
        let resolvedPath = '';   // Accumulated resolved path with ordinals
        
        // Process each folder component in the path
        for (let i = 0; i < folderComponents.length; i++) {
            const folderName = folderComponents[i];
            // console.log(`Resolving folder component: [${folderName}] at index ${i}`);
            
            // Verify current directory exists before attempting to read it
            if (!await ifs.exists(currentPath)) {
                // console.error(`Directory does not exist: ${currentPath}`);
                return null;
            }
            
            // Security check: ensure we're still within the allowed root
            ifs.checkFileAccess(currentPath, root);
            
            // Read directory contents to find matching folders
            const entries = await ifs.readdir(owner_id, currentPath);
            
            // Search for folder that matches the non-ordinal name
            let matchedFolder: string | null = null;
            
            for (const entry of entries) {
                // Skip hidden files (starting with .) and system files (starting with _)
                if (entry.startsWith('.') || entry.startsWith('_')) {
                    continue;
                }
                
                // Check if entry is a directory and follows ordinal naming convention
                const entryPath = ifs.pathJoin(currentPath, entry);
                const stat = await ifs.stat(entryPath);
                
                if (stat.is_directory && /^\d+_/.test(entry)) {
                    // Extract the folder name without the ordinal prefix
                    const nameWithoutOrdinal = entry.substring(entry.indexOf('_') + 1);
                    
                    // Perform case-insensitive comparison with target folder name
                    if (nameWithoutOrdinal.toLowerCase() === folderName.toLowerCase()) {
                        //console.log(`    Matched folder: "${entry}" -> "${nameWithoutOrdinal}"`);
                        matchedFolder = entry;
                        break;
                    }
                } else {
                    // Log non-matching entries for debugging purposes
                    console.log(`    Entry "${entry}" is ${!stat.is_directory ? 'not a directory' : 'directory without ordinal prefix'}`);
                }
            }
            
            // Handle case where no matching folder was found
            if (!matchedFolder) {
                // Log available options for debugging
                for (const entry of entries) {
                    const entryPath = ifs.pathJoin(currentPath, entry);
                    const stat = await ifs.stat(entryPath);
                    if (stat.is_directory && /^\d+_/.test(entry)) {
                        const nameWithoutOrdinal = entry.substring(entry.indexOf('_') + 1);
                        console.log(`  - "${entry}" -> "${nameWithoutOrdinal}"`);
                    }
                }
                return null;
            }
            
            // Update paths for next iteration
            currentPath = ifs.pathJoin(currentPath, matchedFolder);
            resolvedPath += '/' + matchedFolder;
        }
        // console.log(`Resolved final path: [${resolvedPath}]`);
        return resolvedPath;
    }

    /**
     * HTTP endpoint handler for rendering directory tree structure as TreeNode objects.
     * 
     * This method processes requests to render a hierarchical tree view of files and folders
     * in a specified directory. It supports an optional "pullup" mode where folders ending
     * with underscores have their contents included inline in the parent tree structure.
     * 
     * Request Processing:
     * 1. Extract and decode the tree folder path from the URL
     * 2. Validate the document root key and construct absolute paths
     * 3. Perform security checks to ensure path is within allowed bounds
     * 4. Generate TreeNode array representing the directory structure
     * 5. Return JSON response with tree data
     * 
     * Pullup Feature:
     * When pullup=true in query params, folders ending with '_' are treated as "pullup folders",
     * meaning their contents are included inline rather than as separate expandable nodes.
     * This provides a flattened view for organizational folders.
     * 
     * @param req - Express request object with params: {docRootKey}, query: {pullup?}
     * @param res - Express response object for JSON tree data
     * @returns Promise<void> - Sends TreeRender_Response as JSON or error response
     */
    treeRender = async (req: Request<{ docRootKey: string; 0: string }, any, any, { pullup?: string }>, res: Response): Promise<void> => {
        let user_id = (req as any).userProfile ? (req as AuthenticatedRequest).userProfile?.id : 0; 
        if (!user_id) {
            user_id = ANON_USER_ID;
        }                   
       
        try {
            // Extract the folder path from the wildcard part of the URL
            // The wildcard (*) in the route captures everything after docRootKey and stores it in req.params[0]
            const rawTreeFolder = req.params[0] || "/";
            let treeFolder = decodeURIComponent(rawTreeFolder);
            
            // Extract the pullup parameter from query string
            const pullup = req.query.pullup as string; 
            
            // Get the appropriate file system implementation
            const ifs = docUtil.getFileSystem(req.params.docRootKey);
            treeFolder = ifs.normalizePath(treeFolder); // Normalize the path to ensure consistent formatting
            // console.log(`Normalized treeFolder: [${treeFolder}]`);

            if (process.env.POSTGRES_HOST) {
                if (treeFolder.trim()=== '' || treeFolder === '/') {
                    if (user_id!=pgdb.adminProfile!.id) {
                        // If treeFolder is empty or root, we return the admin profile's root node
                        // This is a security measure to prevent unauthorized access to the admin's root
                        throwError(`Unauthorized access attempt by user ${user_id} to root node.`);
                    }
                }
            }
            
            // Resolve the document root path from the provided key
            const root = config.getPublicFolderByKey(req.params.docRootKey).path;
            if (!root) {
                res.status(500).json({ error: 'bad root' });
                return;
            }

            const slashFreeTreeFolder = treeFolder.replace(/^\//, ''); // Remove leading slashes
            // Use regex to check if treeFolder starts with pattern "NNNN_" where 4 is a numeric digit
            const ordinalPattern = /^\d{4}_/;
            // If treeFolder does not start with an ordinal, we call "resolveNonOrdinalPath" to convert it to a real path.
            if (!ordinalPattern.test(slashFreeTreeFolder)) {
                treeFolder = await docSvc.resolveNonOrdinalPath(0, req.params.docRootKey, slashFreeTreeFolder, ifs) || "";
                treeFolder = ifs.normalizePath(treeFolder); // Normalize the path after resolution
            }
        
            // Construct the absolute path to the target directory
            const absolutePath = ifs.pathJoin(root, treeFolder);

            const info: any = {};
            // Verify the target directory exists
            if (!await ifs.exists(absolutePath, info)) { 
                console.warn(`Directory does not exist: ${absolutePath}`);
                res.status(404).json({ error: `Directory not found: ${absolutePath}` });
                return;
            }

            // NOTE: Checks for root node will end up here with 'info.node' being empty object
            if (!info.node) {
                // If info.node is not available, we can assume it's a root node with no owner_id
                throw new Error(`Failed to create TreeNode ${absolutePath}`);
            }

            // Security validation: ensure path is within allowed root
            ifs.checkFileAccess(absolutePath, root);
            
            // Verify the target is actually a directory (not a file)
            if (!info.node.is_directory) {
                console.warn(`Path is not a directory: ${absolutePath}`);
                res.status(400).json({ error: 'Path is not a directory' });
                return;
            }

            // Generate the tree structure
            const treeNodes: TreeNode[] = await this.getTreeNodes(user_id, absolutePath, pullup==="true", root, ifs);
            // Send the tree data as JSON response
            const response: TreeRender_Response = { 
                user_id: user_id == ANON_USER_ID ? null : user_id,
                rootNode: info.node,
                treeNodes,
                treeFolder
            };
            res.json(response);

            // JSON pretty print the response
            // console.log(`Tree response for [${absolutePath}]\n`, JSON.stringify(response, null, 2));
        } catch (error) {
            // Handle any errors that occurred during tree rendering
            handleError(error, res, 'Failed to render tree');
        }
    }
 
    /**
     * Recursively builds an array of TreeNode objects representing the contents of a directory.
     * 
     * This method is the core tree-building engine that processes directory contents and creates
     * hierarchical tree structures. It handles ordinal-based file naming, file type detection,
     * content reading, and optional pullup folder expansion.
     * 
     * Processing Flow:
     * 1. Read directory contents and filter out hidden/system files
     * 2. Ensure all files have proper 4-digit ordinal prefixes
     * 3. Process each file/folder:
     *    - Determine type (folder, text, image, binary)
     *    - Read content for supported file types
     *    - Handle pullup folders by recursively including their contents
     * 4. Sort results alphabetically and return
     * 
     * File Type Detection:
     * - Folders: type='folder', may have children if pullup enabled
     * - Images (.png, .jpeg, .jpg): type='image', content=relative path
     * - Text files (.md, .txt): type='text', content=file contents
     * - Other files: type='binary', no content loaded
     * 
     * Ordinal Management:
     * All files/folders are ensured to have 4-digit ordinal prefixes (e.g., "0001_filename").
     * Files without ordinals are automatically assigned the next available number.
     * 
     * @param absolutePath - The absolute filesystem path to scan
     * @param pullup - If true, folders ending with '_' will have their contents included inline
     * @param root - The document root path for security validation
     * @returns Array of TreeNode objects representing directory contents, sorted alphabetically
     */
    getTreeNodes = async (owner_id: number, absolutePath: string, pullup: boolean, root: string, ifs: IFS): Promise<TreeNode[]> => {
        // Security check: ensure the path is within the allowed root directory
        ifs.checkFileAccess(absolutePath, root); 
        
        // Read the directory contents
        let fileNodes = await ifs.readdirEx(owner_id, absolutePath, true);

        // This filters out hidden files and system files
        fileNodes = fileNodes.filter(file => !file.name.startsWith('.') && !file.name.startsWith('_'));

        // Process each file/folder in the directory
        for (const file of fileNodes) {    
            // Get file information
            const filePath = ifs.pathJoin(absolutePath, file.name);
            ifs.checkFileAccess(filePath, root); 

            // DIRECTORY
            if (file.is_directory) {
                file.type = 'folder'; // Set type to folder
                // Handle pullup folders: folders ending with '_' get their contents inlined
                if (pullup && file.name.endsWith('_')) {
                    // Recursively get tree nodes for this pullup folder
                    file.children = await this.getTreeNodes(owner_id, filePath, true, root, ifs);
                    
                    // Set children to null if empty (cleaner JSON output)
                    if (file.children.length === 0) {
                        file.children = null;
                    }
                }
                
                // Check if folder has any children in the filesystem
                file.fsChildren = await ifs.childrenExist(owner_id, filePath);
            } 
            // FILE
            else {
                file.fsChildren = false; // Files do not have children
                // Process files based on their extension
                const ext = getFilenameExtension(file.name).toLowerCase();
                    
                // IMAGE FILE
                if (['.png', '.jpeg', '.jpg'].includes(ext)) {
                    // Image files: store relative path for URL construction
                    file.type = 'image';
                    // If filePath starts with root, strip the root part to get relative path
                    // console.log(`Processing image file: [${filePath}] under root [${root}]`);
                    const relativePath = filePath.startsWith(root) ? filePath.substring(root.length) : filePath;
                    file.url = relativePath; // Use absolute path for image display 
                } 
                // TEXT FILE
                else if (['.md', '.txt'].includes(ext)) {
                    // Text files: read and store content
                    file.type = 'text';
                } 
                // BINAY FILE
                else {
                    // Binary/other files: don't load content
                    file.type = 'binary';
                    // file.content = '';
                }
            }
        }
        return fileNodes;
    }

    /**
     * HTTP endpoint handler for creating new files in the document tree with proper ordinal positioning.
     * 
     * This method creates new files within the ordinal-based file system, automatically handling
     * ordinal assignment and ensuring proper positioning relative to existing files. It supports
     * insertion at specific positions or at the top of the directory.
     * 
     * Creation Process:
     * 1. Validate input parameters and document root access
     * 2. Determine insertion position based on insertAfterNode parameter
     * 3. Shift existing files down to make room for the new file
     * 4. Create new file with calculated ordinal prefix
     * 5. Auto-add .md extension if no extension provided
     * 
     * Ordinal Management:
     * - If insertAfterNode specified: new file gets (afterNode ordinal + 1)
     * - If no insertAfterNode: new file gets ordinal 0 (top position)
     * - All affected files are automatically renumbered to maintain sequence
     * 
     * File Naming Convention:
     * - Format: "NNNN_filename.ext" where NNNN is 4-digit zero-padded ordinal
     * - Default extension: .md (added if no extension provided)
     * 
     * @param req - Express request with body: {fileName, treeFolder, insertAfterNode, docRootKey}
     * @param res - Express response object
     * @returns Promise<void> - Sends success response with created filename or error
     */
    createFile = async (req: Request<any, any, { fileName: string; treeFolder: string; insertAfterNode: string, docRootKey: string }>, res: Response): Promise<void> => {
        const owner_id = svrUtil.getOwnerId(req, res);
        if (owner_id==null) {
            return;
        }
        return runTrans(async () => {
            console.log(`Create File Request: ${JSON.stringify(req.body, null, 2)}`);
            try {
                // Extract parameters from request body
                const { insertAfterNode, docRootKey } = req.body;
                let {treeFolder} = req.body;
                let {fileName} = req.body;
                fileName = fixName(fileName); // Ensure valid file name
            
                // Get the appropriate file system implementation
                const ifs = docUtil.getFileSystem(docRootKey);
                treeFolder = ifs.normalizePath(treeFolder); // Normalize the path to ensure consistent formatting
            
                // Resolve and validate document root
                const root = config.getPublicFolderByKey(docRootKey).path;
                if (!root) {
                    res.status(500).json({ error: 'bad root' });
                    return;
                }

                // Validate required parameters
                if (!fileName || !treeFolder) {
                    res.status(400).json({ error: 'File name and treeFolder are required' });
                    return;
                }

                // Construct absolute path to parent directory
                const absoluteParentPath = ifs.pathJoin(root, treeFolder);

                // Verify parent directory exists and is accessible
                const info: any = {};
                ifs.checkFileAccess(absoluteParentPath, root); 
                if (!await ifs.exists(absoluteParentPath, info)) {
                    res.status(404).json({ error: `Parent directory not found [${absoluteParentPath}]` });
                    return;
                }

                // Calculate insertion ordinal based on insertAfterNode
                let insertOrdinal = 0; // Default: insert at top (ordinal 0)
                if (insertAfterNode && insertAfterNode.trim() !== '') {
                    console.log(`Create file "${fileName}" below node: ${insertAfterNode}`);
                
                    // Extract ordinal from the reference node name
                    const underscoreIndex = insertAfterNode.indexOf('_');
                    if (underscoreIndex !== -1) {
                        const afterNodeOrdinal = parseInt(insertAfterNode.substring(0, underscoreIndex));
                        insertOrdinal = afterNodeOrdinal + 1; // Insert after the reference node
                    }
                } else {
                    console.log(`Create new top file "${fileName}"`);
                }

                // Shift existing files down to make room for the new file
                // This ensures proper ordinal sequence is maintained
                await docUtil.shiftOrdinalsDown(owner_id, 1, absoluteParentPath, insertOrdinal, root, null, ifs);
                
                // Create filename with ordinal prefix
                const ordinalPrefix = insertOrdinal.toString().padStart(4, '0'); // 4-digit zero-padded
                const newFileName = `${ordinalPrefix}_${fileName}`;
            
                // Auto-add .md extension if no extension is provided
                let finalFileName = newFileName;
                if (!getFilenameExtension(fileName)) {
                    finalFileName = `${newFileName}.md`;
                }
            
                const newFilePath = ifs.pathJoin(absoluteParentPath, finalFileName);

                // Safety check: prevent overwriting existing files
                if (await ifs.exists(newFilePath)) {
                    res.status(409).json({ error: 'A file with this name already exists at the target location' });
                    return;
                }

                // Create the new file with empty content
                await ifs.writeFileEx(owner_id, newFilePath, '', 'utf8', info.node.is_public);
                //console.log(`File created successfully: ${newFilePath}`);
            
                // Send success response with the created filename
                res.json({ 
                    success: true, 
                    message: 'File created successfully',
                    fileName: finalFileName 
                });
            } catch (error) {
                // Handle any errors during file creation
                handleError(error, res, 'Failed to create file');
                throw error;
            }
        });
    }

    /**
     * HTTP endpoint handler for creating new folders in the document tree with proper ordinal positioning.
     * 
     * This method creates new folders within the ordinal-based file system, automatically handling
     * ordinal assignment and ensuring proper positioning relative to existing folders and files.
     * Similar to file creation but specifically for directory structures.
     * 
     * Creation Process:
     * 1. Validate input parameters and document root access
     * 2. Determine insertion position based on insertAfterNode parameter
     * 3. Shift existing items down to make room for the new folder
     * 4. Create new folder with calculated ordinal prefix
     * 5. Use recursive directory creation for safety
     * 
     * Ordinal Management:
     * - If insertAfterNode specified: new folder gets (afterNode ordinal + 1)
     * - If no insertAfterNode: new folder gets ordinal 0 (top position)
     * - All affected files/folders are automatically renumbered to maintain sequence
     * 
     * Folder Naming Convention:
     * - Format: "NNNN_foldername" where NNNN is 4-digit zero-padded ordinal
     * - No file extension (folders don't have extensions)
     * 
     * @param req - Express request with body: {folderName, treeFolder, insertAfterNode, docRootKey}
     * @param res - Express response object
     * @returns Promise<void> - Sends success response with created folder name or error
     */
    createFolder = async (req: Request<any, any, { folderName: string; treeFolder: string; insertAfterNode: string, docRootKey: string }>, res: Response): Promise<void> => {
        const owner_id = svrUtil.getOwnerId(req, res);
        if (owner_id==null) {
            return;
        }

        return runTrans(async () => {
            console.log("Create Folder Request");
            try {
                // Extract parameters from request body
                const { treeFolder, insertAfterNode, docRootKey } = req.body;
                let {folderName} = req.body;
                folderName = fixName(folderName); // Ensure valid folder name
            
                // Get the appropriate file system implementation
                const ifs = docUtil.getFileSystem(docRootKey);
            
                // Resolve and validate document root
                const root = config.getPublicFolderByKey(docRootKey).path;
                if (!root) {
                    res.status(500).json({ error: 'bad key' });
                    return;
                }

                // Validate required parameters
                if (!folderName || !treeFolder) {
                    res.status(400).json({ error: 'Folder name and treeFolder are required' });
                    return;
                }

                // Construct absolute path to parent directory
                const absoluteParentPath = ifs.pathJoin(root, treeFolder);

                // Verify parent directory exists and is accessible
                const info: any = {};
                ifs.checkFileAccess(absoluteParentPath, root);
                if (!await ifs.exists(absoluteParentPath, info)) {
                    res.status(404).json({ error: 'Parent directory not found' });
                    return;
                }

                // Calculate insertion ordinal based on insertAfterNode
                let insertOrdinal = 0; // Default: insert at top (ordinal 0)

                if (insertAfterNode && insertAfterNode.trim() !== '') {
                    console.log(`Create folder "${folderName}" below node: ${insertAfterNode}`);
                
                    // Extract ordinal from the reference node name
                    const underscoreIndex = insertAfterNode.indexOf('_');
                    if (underscoreIndex !== -1) {
                        const afterNodeOrdinal = parseInt(insertAfterNode.substring(0, underscoreIndex));
                        insertOrdinal = afterNodeOrdinal + 1; // Insert after the reference node
                    }
                } else {
                    console.log(`Create new top folder "${folderName}"`);
                }

                // Shift existing files/folders down to make room for the new folder
                // This ensures proper ordinal sequence is maintained
                await docUtil.shiftOrdinalsDown(owner_id, 1, absoluteParentPath, insertOrdinal, root, null, ifs);

                // Create folder name with ordinal prefix
                const ordinalPrefix = insertOrdinal.toString().padStart(4, '0'); // 4-digit zero-padded
                const newFolderName = `${ordinalPrefix}_${folderName}`;
            
                const newFolderPath = ifs.pathJoin(absoluteParentPath, newFolderName);

                // Create the directory (recursive option ensures parent directories exist)
                await ifs.mkdirEx(owner_id, newFolderPath, { recursive: true }, info.node.is_public);

                console.log(`Folder created successfully: ${newFolderPath}`);
            
                // Send success response with the created folder name
                res.json({ 
                    success: true, 
                    message: 'Folder created successfully',
                    folderName: newFolderName 
                });
            } catch (error) {
            // Handle any errors during folder creation
                handleError(error, res, 'Failed to create folder');
                throw error;
            }
        });
    }

    /**
     * HTTP endpoint handler for searching through text files using advanced grep-based search.
     * 
     * This method provides comprehensive text search capabilities across markdown and text files
     * within the document tree. It supports multiple search modes, timestamp filtering, and
     * various result ordering options. Uses Unix grep commands for high-performance searching.
     * 
     * Search Modes:
     * - REGEX: Treats query as a regular expression pattern
     * - MATCH_ANY: Finds files containing any of the search terms (OR logic)
     * - MATCH_ALL: Finds files containing all search terms (AND logic)
     * 
     * Empty Query Handling:
     * - Empty, null, or undefined queries are treated as "match everything"
     * - Automatically converts to REGEX mode with pattern ".*" to match all lines
     * - Returns file-level results only (no line-by-line content) to prevent massive data transfer
     * - Result format: {file, line: -1, content: ''} where line: -1 indicates file-level match
     * - Useful for browsing all content in a directory structure
     * 
     * Features:
     * - Quote support: "exact phrase" searches within MATCH_ANY/MATCH_ALL modes
     * - Timestamp filtering: Optional filtering for files containing date stamps
     * - Multiple ordering: by modification time, embedded dates, or default
     * - Line-by-line results: Returns specific line numbers and content
     * - Recursive search: Searches all subdirectories
     * 
     * File Type Support:
     * - Includes: *.md, *.txt files
     * - Excludes: hidden files (.*), system files (_*), binary files
     * 
     * Result Format:
     * Each result contains: {file, line, content} where:
     * - file: relative path from search root
     * - line: line number where match found
     * - content: the matching line content
     * 
     * @param req - Express request with body: {query?, treeFolder, docRootKey, searchMode?, requireDate?, searchOrder?}
     * @param res - Express response object
     * @returns Promise<void> - Sends JSON with search results or error
     */
    searchTextFiles = async (req: Request<any, any, {  
        query: string; 
        treeFolder: string; 
        docRootKey: string; 
        searchMode?: string,
        requireDate?: boolean,
        searchOrder?: string }>, res: Response): Promise<void> => {
        console.log("Document Search Request");
        try {
            // Extract and validate parameters
            const { treeFolder, docRootKey, requireDate, searchOrder = 'MOD_TIME' } = req.body;
            let { query, searchMode = 'MATCH_ANY' } = req.body;
            const orderByModTime = searchOrder === 'MOD_TIME';
            const orderByDate = searchOrder === 'DATE';
            
            // Handle empty, null, or undefined query as "match everything"
            const isEmptyQuery = !query || query.trim() === '';
            if (isEmptyQuery) {
                query = '.*'; // Regex pattern that matches any line
                searchMode = 'REGEX'; // Force REGEX mode for match-all behavior
                console.log('Empty query detected, using match-all pattern for file-level results');
            }
            
            if (!treeFolder || typeof treeFolder !== 'string') {
                res.status(400).json({ error: 'Tree folder is required' });
                return;
            }
            
            if (!docRootKey || typeof docRootKey !== 'string') {
                res.status(400).json({ error: 'Document root key is required' });
                return;
            }
            
            // Resolve and validate document root
            const root = config.getPublicFolderByKey(docRootKey).path;
            if (!root) {
                res.status(500).json({ error: 'Invalid document root key' });
                return;
            }
            
            const ifs = docUtil.getFileSystem(docRootKey);
            // Construct and validate search path
            const absoluteSearchPath = ifs.pathJoin(root, treeFolder);
            // ifs.checkFileAccess(absoluteSearchPath, root);
            
            if (!fs.existsSync(absoluteSearchPath)) {
                res.status(404).json({ error: 'Search directory not found' });
                return;
            }

            console.log(`Search query: "${query}" with mode: "${searchMode}" in folder: "${absoluteSearchPath}"`);
            
            // Build grep command based on search mode and options
            let cmd: string; 

            // Define timestamp regex for date filtering (optional)
            // Format: [YYYY/MM/DD HH:MM:SS AM/PM]
            const dateRegex: string | null = requireDate ? 
                "^\\[20[0-9][0-9]/[0-9][0-9]/[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9] (AM|PM)\\]" : null;

            // Define file inclusion/exclusion patterns
            const include = '--include="*.md" --include="*.txt" --exclude="_*" --exclude=".*"';
            const chain = 'xargs -0 --no-run-if-empty';
            
            if (searchMode === 'REGEX') {
                // REGEX MODE: Use query as-is as regex pattern
                const escapedQuery = query.replace(/\\/g, '\\\\');
                
                if (isEmptyQuery) {
                    // For empty queries, return file-level results only (no line numbers)
                    if (dateRegex) {
                        cmd = `grep -rlZ ${include} -E "${dateRegex}" "${absoluteSearchPath}" | ${chain} grep -l -E "${escapedQuery}"`;
                    } else {
                        cmd = `grep -rl ${include} -E "${escapedQuery}" "${absoluteSearchPath}"`;
                    }
                } else {
                    // For non-empty queries, return line-by-line results
                    if (dateRegex) {
                        // Filter to files with timestamps, then search
                        cmd = `grep -rlZ ${include} -E "${dateRegex}" "${absoluteSearchPath}" | ${chain} grep -niH -E "${escapedQuery}"`;
                    } else {
                        // Search all matching files
                        cmd = `grep -rniH ${include} -E "${escapedQuery}" "${absoluteSearchPath}"`;
                    }
                }
            } else {
                // MATCH_ANY / MATCH_ALL MODES: Parse search terms
                const searchTerms = docUtil.parseSearchTerms(query);
                
                if (searchTerms.length === 0) {
                    res.status(400).json({ error: 'No valid search terms found' });
                    return;
                }
                
                if (searchMode === 'MATCH_ANY') {
                    // MATCH_ANY: Search for any of the terms (OR logic)
                    const escapedTerms = searchTerms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                    const regexPattern = escapedTerms.join('|');
                    
                    if (dateRegex) {
                        cmd = `grep -rlZ ${include} -E "${dateRegex}" "${absoluteSearchPath}" | ${chain} grep -niH -E "${regexPattern}"`;
                    } else {
                        cmd = `grep -rniH ${include} -E "${regexPattern}" "${absoluteSearchPath}"`;
                    }
                } else {
                    // MATCH_ALL: Search for all terms (AND logic)
                    const escapedTerms = searchTerms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                    
                    if (dateRegex) {
                        // Chain greps: files with timestamps → files with term1 → ... → files with termN → extract matches
                        let baseCommand = `grep -rlZ ${include} -E "${dateRegex}" "${absoluteSearchPath}"`;
                        for (let i = 0; i < escapedTerms.length; i++) {
                            baseCommand += ` | ${chain} grep -lZ -i "${escapedTerms[i]}"`;
                        }
                        cmd = `${baseCommand} | ${chain} grep -niH -E "${escapedTerms.join('|')}"`;
                    } else {
                        // Chain greps: files with term1 → files with term2 → ... → extract matches
                        let baseCommand = `grep -rlZ ${include} "${escapedTerms[0]}" "${absoluteSearchPath}"`;
                        for (let i = 1; i < escapedTerms.length; i++) {
                            baseCommand += ` | ${chain} grep -lZ -i "${escapedTerms[i]}"`;
                        }
                        cmd = `${baseCommand} | ${chain} grep -niH -E "${escapedTerms.join('|')}"`;
                    }
                }
            }
            
            console.log(`Executing grep command: ${cmd}`);
            
            // Execute the grep command
            exec(cmd, (error, stdout, stderr) => {
                if (error) {
                    // Exit code 1 means no matches (not an error)
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
                
                // Parse grep output and build results
                const results = [];
                const fileTimes = (orderByModTime || orderByDate) ? new Map<string, number>() : null;
                
                if (stdout.trim()) {
                    const lines = stdout.trim().split('\n');
                    
                    if (isEmptyQuery) {
                        // For empty queries, stdout contains file paths only (one per line)
                        for (const line of lines) {
                            const filePath = line.trim();
                            if (filePath) {
                                const relativePath = path.relative(absoluteSearchPath, filePath);
                                let timeVal: number | undefined;

                                // Get file time for sorting if needed
                                if (orderByModTime || orderByDate) {
                                    if (fileTimes && !fileTimes.has(relativePath)) {
                                        try {
                                            let fileTime = null;
                                            if (orderByModTime) {
                                                // Use filesystem modification time
                                                const stat = fs.statSync(filePath);
                                                fileTime = stat.mtime.getTime();
                                            } else {
                                                // Extract embedded date from file content
                                                const fileContent = fs.readFileSync(filePath, 'utf8');
                                                const fileLines = fileContent.split('\n');
                                                
                                                // Find first line matching date pattern
                                                let dateMatch = null;
                                                for (const fileLine of fileLines) {
                                                    const trimmedLine = fileLine.trim();
                                                    const match = trimmedLine.match(/^\[(20[0-9]{2}\/[0-9]{2}\/[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2} (AM|PM))\]/);
                                                    if (match) {
                                                        dateMatch = match;
                                                        break;
                                                    }
                                                }
                                                
                                                // Parse the embedded date
                                                if (dateMatch) {
                                                    const dateStr = dateMatch[1];
                                                    const dateParts = dateStr.split(/\/|:|\s/);
                                                    if (dateParts.length === 7) {
                                                        const year = parseInt(dateParts[0], 10);
                                                        const month = parseInt(dateParts[1], 10) - 1; // Zero-based months
                                                        const day = parseInt(dateParts[2], 10);
                                                        let hours = parseInt(dateParts[3], 10);
                                                        const minutes = parseInt(dateParts[4], 10);
                                                        const seconds = parseInt(dateParts[5], 10);
                                                        const ampm = dateParts[6];
                                                        
                                                        // Convert to 24-hour format
                                                        if (ampm === 'PM' && hours !== 12) {
                                                            hours += 12;
                                                        } else if (ampm === 'AM' && hours === 12) {
                                                            hours = 0;
                                                        }
                                                        
                                                        fileTime = new Date(year, month, day, hours, minutes, seconds).getTime();
                                                    }
                                                }
                                            }

                                            if (fileTime != null) {
                                                fileTimes.set(relativePath, fileTime);
                                                timeVal = fileTime;
                                            }
                                        } catch (error) {
                                            console.warn(`Failed to get time for ${relativePath}:`, error);
                                            // Fallback to current time
                                            const fallbackTime = Date.now();
                                            fileTimes.set(relativePath, fallbackTime);
                                            timeVal = fallbackTime;
                                        }
                                    } else if (fileTimes) {
                                        timeVal = fileTimes.get(relativePath);
                                    }
                                }
                                
                                // Build file-level result object (no line number or content)
                                const result: any = {
                                    file: relativePath,
                                    line: -1, // Indicates file-level match
                                    content: '' // Empty content for file-level matches
                                };
                                
                                // Add time value for sorting (internal use)
                                if ((orderByModTime || orderByDate) && timeVal !== undefined) {
                                    result.timeVal = timeVal;
                                }
                                
                                results.push(result);
                            }
                        }
                    } else {
                        // For non-empty queries, process line-by-line results as before
                        for (const line of lines) {
                            // Parse grep format: filename:line_number:content
                            const match = line.match(/^([^:]+):(\d+):(.*)$/);
                            if (match) {
                                const [, filePath, lineNumber, content] = match;
                                const relativePath = path.relative(absoluteSearchPath, filePath);
                                let timeVal: number | undefined;

                                // Get file time for sorting if needed
                                if (orderByModTime || orderByDate) {
                                    if (fileTimes && !fileTimes.has(relativePath)) {
                                        try {
                                            let fileTime = null;
                                            if (orderByModTime) {
                                                // Use filesystem modification time
                                                const stat = fs.statSync(filePath);
                                                fileTime = stat.mtime.getTime();
                                            } else {
                                                // Extract embedded date from file content
                                                const fileContent = fs.readFileSync(filePath, 'utf8');
                                                const fileLines = fileContent.split('\n');
                                                
                                                // Find first line matching date pattern
                                                let dateMatch = null;
                                                for (const fileLine of fileLines) {
                                                    const trimmedLine = fileLine.trim();
                                                    const match = trimmedLine.match(/^\[(20[0-9]{2}\/[0-9]{2}\/[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2} (AM|PM))\]/);
                                                    if (match) {
                                                        dateMatch = match;
                                                        break;
                                                    }
                                                }
                                                
                                                // Parse the embedded date
                                                if (dateMatch) {
                                                    const dateStr = dateMatch[1];
                                                    const dateParts = dateStr.split(/\/|:|\s/);
                                                    if (dateParts.length === 7) {
                                                        const year = parseInt(dateParts[0], 10);
                                                        const month = parseInt(dateParts[1], 10) - 1; // Zero-based months
                                                        const day = parseInt(dateParts[2], 10);
                                                        let hours = parseInt(dateParts[3], 10);
                                                        const minutes = parseInt(dateParts[4], 10);
                                                        const seconds = parseInt(dateParts[5], 10);
                                                        const ampm = dateParts[6];
                                                        
                                                        // Convert to 24-hour format
                                                        if (ampm === 'PM' && hours !== 12) {
                                                            hours += 12;
                                                        } else if (ampm === 'AM' && hours === 12) {
                                                            hours = 0;
                                                        }
                                                        
                                                        fileTime = new Date(year, month, day, hours, minutes, seconds).getTime();
                                                    }
                                                }
                                            }

                                            if (fileTime != null) {
                                                fileTimes.set(relativePath, fileTime);
                                                timeVal = fileTime;
                                            }
                                        } catch (error) {
                                            console.warn(`Failed to get time for ${relativePath}:`, error);
                                            // Fallback to current time
                                            const fallbackTime = Date.now();
                                            fileTimes.set(relativePath, fallbackTime);
                                            timeVal = fallbackTime;
                                        }
                                    } else if (fileTimes) {
                                        timeVal = fileTimes.get(relativePath);
                                    }
                                }
                                
                                // Build line-level result object
                                const result: any = {
                                    file: relativePath,
                                    line: parseInt(lineNumber),
                                    content: content.trim()
                                };
                                
                                // Add time value for sorting (internal use)
                                if ((orderByModTime || orderByDate) && timeVal !== undefined) {
                                    result.timeVal = timeVal;
                                }
                                
                                results.push(result);
                            }
                        }
                    }
                }
                
                // Sort results if time-based ordering is requested
                if (orderByModTime || orderByDate) {
                    results.sort((a, b) => {
                        // Primary: time (newest first)
                        if (a.timeVal !== b.timeVal) {
                            return b.timeVal - a.timeVal;
                        }
                        // Secondary: filename (alphabetical)
                        if (a.file !== b.file) {
                            return a.file.localeCompare(b.file);
                        }
                        // Tertiary: line number (ascending) - only for line-level results
                        if (!isEmptyQuery && a.line !== b.line) {
                            return a.line - b.line;
                        }
                        return 0;
                    });
                }
                
                // Clean results (remove internal timeVal property)
                const cleanResults = (orderByModTime || orderByDate) ? 
                    results.map(result => ({
                        file: result.file,
                        line: result.line,
                        content: result.content
                    })) : 
                    results;
                
                // Send successful response
                res.json({ 
                    success: true, 
                    message: `Search completed for query: "${query}". Found ${cleanResults.length} matches.`,
                    query: query,
                    searchPath: treeFolder,
                    results: cleanResults
                });
            });
            
        } catch (error) {
            handleError(error, res, 'Failed to perform search');
        }
    }

    /**
     * HTTP endpoint handler for comprehensive binary and text file search including PDF support.
     * 
     * This method provides advanced search capabilities across all file types including PDFs.
     * It combines traditional grep for text files with pdfgrep for PDF files, providing
     * unified search results across the entire document collection. Returns file-level
     * matches rather than line-by-line results (hence "binary" search).
     * 
     * Search Strategy:
     * - Text files (*.md, *.txt): Uses grep for fast text searching
     * - PDF files (*.pdf): Uses pdfgrep for PDF content extraction and search
     * - Parallel execution: Both searches run simultaneously for performance
     * - Combined results: Merges results from both search methods
     * 
     * Search Modes:
     * - REGEX: Treats query as regular expression (supports complex patterns)
     * - MATCH_ANY: Finds files containing any search terms (OR logic)
     * - MATCH_ALL: Finds files containing all search terms (AND logic)
     * 
     * Empty Query Handling:
     * - Empty, null, or undefined queries are treated as "match everything"
     * - Automatically converts to REGEX mode with pattern ".*" to match all content
     * - Returns file-level results only (no line-by-line content) 
     * - Result format: {file, line: -1, content: ''} where line: -1 indicates file-level match
     * - Useful for browsing all content (including PDFs) in a directory structure
     * 
     * Features:
     * - Quote support: "exact phrase" searches within MATCH_ANY/MATCH_ALL
     * - Timestamp filtering: Optional filtering for timestamped content
     * - PDF text extraction: Searches within PDF document content
     * - File-level results: Returns matching files (not specific lines)
     * - Modification time ordering: Results sorted by file modification date
     * 
     * Performance Considerations:
     * - Slower than searchTextFiles due to PDF processing
     * - Parallel execution minimizes total search time
     * - Graceful PDF error handling (continues if PDFs fail)
     * 
     * Result Format:
     * Each result contains: {file, line, content} where:
     * - file: relative path from search root
     * - line: -1 (indicates file-level match, not line-specific)
     * - content: empty string (file-level match only)
     * 
     * @param req - Express request with body: {query?, treeFolder, docRootKey, searchMode?, requireDate?, searchOrder?}
     * @param res - Express response object  
     * @returns Promise<void> - Sends JSON with combined search results or error
     */
    searchBinaries = async (req: Request<any, any, { 
        query: string; 
        treeFolder: string; 
        docRootKey: string; 
        searchMode?: string,
        requireDate?: boolean,
        searchOrder?: string }>, res: Response): Promise<void> => {
        try {
            // Extract and validate parameters
            const { treeFolder, docRootKey, requireDate, searchOrder = 'MOD_TIME' } = req.body;
            let { query, searchMode = 'MATCH_ANY' } = req.body;
            const orderByModTime = searchOrder === 'MOD_TIME';
            
            // Handle empty, null, or undefined query as "match everything"
            const isEmptyQuery = !query || query.trim() === '';
            if (isEmptyQuery) {
                query = '.*'; // Regex pattern that matches any line
                searchMode = 'REGEX'; // Force REGEX mode for match-all behavior
                console.log('Empty query detected in searchBinaries, using match-all pattern for file-level results');
            }
            
            // Validate required parameters
            if (!treeFolder || typeof treeFolder !== 'string') {
                res.status(400).json({ error: 'Tree folder is required' });
                return;
            }
            
            if (!docRootKey || typeof docRootKey !== 'string') {
                res.status(400).json({ error: 'Document root key is required' });
                return;
            }
            
            // Resolve and validate document root
            const root = config.getPublicFolderByKey(docRootKey).path;
            if (!root) {
                res.status(500).json({ error: 'Invalid document root key' });
                return;
            }
            
            // Construct and validate search path
            const absoluteSearchPath = path.join(root, treeFolder);
            // ifs.checkFileAccess(absoluteSearchPath, root);
            
            if (!fs.existsSync(absoluteSearchPath)) {
                res.status(404).json({ error: 'Search directory not found' });
                return;
            }

            console.log(`Simple search query: "${query}" with mode: "${searchMode}" in folder: "${absoluteSearchPath}"`);
            
            // Initialize command variables for parallel execution
            let grepCmd: string = '';    // Command for text file search
            let pdfgrepCmd: string = ''; // Command for PDF file search

            // Define timestamp regex for date filtering (optional)
            // Format: [YYYY/MM/DD HH:MM:SS AM/PM]
            const dateRegex: string | null = requireDate ? 
                "^\\[20[0-9][0-9]/[0-9][0-9]/[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9] (AM|PM)\\]" : null;

            // Define file patterns for text files (excludes PDFs)
            const include = '--include="*.md" --include="*.txt" --exclude="*.pdf" --exclude="_*" --exclude=".*"';
            const chain = 'xargs -0 --no-run-if-empty';
            
            // Parse search terms for non-REGEX modes
            let searchTerms: string[] = [];
            if (searchMode !== 'REGEX') {
                // Parse search terms using utility function
                searchTerms = docUtil.parseSearchTerms(query);
                
                // Allow empty search terms only if this is an empty query (which was converted to REGEX mode)
                if (searchTerms.length === 0 && !isEmptyQuery) {
                    res.status(400).json({ error: 'No valid search terms found' });
                    return;
                }
            }
            
            // Build search commands based on search mode
            if (searchMode === 'REGEX') {
                // REGEX MODE: Use query as regex pattern
                const escapedQuery = query.replace(/\\/g, '\\\\');
                
                if (dateRegex) {
                    // Search only timestamped files
                    grepCmd = `grep -rlZ ${include} -E "${dateRegex}" "${absoluteSearchPath}" | ${chain} grep -l -E "${escapedQuery}"`;
                    pdfgrepCmd = `find "${absoluteSearchPath}" -name "*.pdf" -print0 | ${chain} sh -c 'for f; do if pdfgrep -q -e "${dateRegex}" "$f" 2>/dev/null; then echo "$f"; fi; done' sh | ${chain} sh -c 'for f; do if pdfgrep -q -e "${escapedQuery}" "$f" 2>/dev/null; then echo "$f"; fi; done' sh`;
                } else {
                    // Search all files
                    grepCmd = `grep -rl ${include} -E "${escapedQuery}" "${absoluteSearchPath}"`;
                    pdfgrepCmd = `find "${absoluteSearchPath}" -name "*.pdf" -exec sh -c 'if pdfgrep -q -e "${escapedQuery}" "$1" 2>/dev/null; then echo "$1"; fi' sh {} \\;`;
                }
            } else if (searchMode === 'MATCH_ANY') {
                // MATCH_ANY MODE: Find files with any search term
                const escapedTerms = searchTerms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                
                if (searchTerms.length === 1) {
                    // Single term: use simple string search for better compatibility
                    if (dateRegex) {
                        grepCmd = `grep -rlZ ${include} -E "${dateRegex}" "${absoluteSearchPath}" | ${chain} grep -l "${escapedTerms[0]}"`;
                        pdfgrepCmd = `find "${absoluteSearchPath}" -name "*.pdf" -print0 | ${chain} sh -c 'for f; do if pdfgrep -q -e "${dateRegex}" "$f" 2>/dev/null; then echo "$f"; fi; done' sh | ${chain} sh -c 'for f; do if pdfgrep -q "${escapedTerms[0]}" "$f" 2>/dev/null; then echo "$f"; fi; done' sh`;
                    } else {
                        grepCmd = `grep -rl ${include} "${escapedTerms[0]}" "${absoluteSearchPath}"`;
                        pdfgrepCmd = `find "${absoluteSearchPath}" -name "*.pdf" -exec sh -c 'if pdfgrep -q "${escapedTerms[0]}" "$1" 2>/dev/null; then echo "$1"; fi' sh {} \\;`;
                    }
                } else {
                    // Multiple terms: use regex OR pattern
                    const regexPattern = escapedTerms.join('|');
                    if (dateRegex) {
                        grepCmd = `grep -rlZ ${include} -E "${dateRegex}" "${absoluteSearchPath}" | ${chain} grep -l -E "${regexPattern}"`;
                        pdfgrepCmd = `find "${absoluteSearchPath}" -name "*.pdf" -print0 | ${chain} sh -c 'for f; do if pdfgrep -q -e "${dateRegex}" "$f" 2>/dev/null; then echo "$f"; fi; done' sh | ${chain} sh -c 'for f; do if pdfgrep -q -e "${regexPattern}" "$f" 2>/dev/null; then echo "$f"; fi; done' sh`;
                    } else {
                        grepCmd = `grep -rl ${include} -E "${regexPattern}" "${absoluteSearchPath}"`;
                        pdfgrepCmd = `find "${absoluteSearchPath}" -name "*.pdf" -exec sh -c 'if pdfgrep -q -e "${regexPattern}" "$1" 2>/dev/null; then echo "$1"; fi' sh {} \\;`;
                    }
                }
            } else {
                // MATCH_ALL MODE: Find files containing all search terms
                const escapedTerms = searchTerms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                
                if (dateRegex) {
                    // Chain searches for timestamped files with all terms
                    let baseCommand = `grep -rlZ ${include} -E "${dateRegex}" "${absoluteSearchPath}"`;
                    for (let i = 0; i < escapedTerms.length; i++) {
                        baseCommand += ` | ${chain} grep -lZ -i "${escapedTerms[i]}"`;
                    }
                    grepCmd = baseCommand;
                    
                    // PDF chain for timestamped files with all terms
                    let pdfBaseCommand = `find "${absoluteSearchPath}" -name "*.pdf" -print0 | ${chain} sh -c 'for f; do if pdfgrep -q -e "${dateRegex}" "$f" 2>/dev/null; then echo "$f"; fi; done' sh`;
                    for (let i = 0; i < escapedTerms.length; i++) {
                        pdfBaseCommand += ` | ${chain} sh -c 'for f; do if pdfgrep -q "${escapedTerms[i]}" "$f" 2>/dev/null; then echo "$f"; fi; done' sh`;
                    }
                    pdfgrepCmd = pdfBaseCommand;
                } else {
                    // Chain searches for files with all terms
                    let baseCommand = `grep -rlZ ${include} "${escapedTerms[0]}" "${absoluteSearchPath}"`;
                    for (let i = 1; i < escapedTerms.length; i++) {
                        baseCommand += ` | ${chain} grep -lZ -i "${escapedTerms[i]}"`;
                    }
                    grepCmd = baseCommand;
                    
                    // PDF chain for files with all terms
                    let pdfBaseCommand = `find "${absoluteSearchPath}" -name "*.pdf" -print0 | ${chain} sh -c 'for f; do if pdfgrep -q "${escapedTerms[0]}" "$f" 2>/dev/null; then echo "$f"; fi; done' sh`;
                    for (let i = 1; i < escapedTerms.length; i++) {
                        pdfBaseCommand += ` | ${chain} sh -c 'for f; do if pdfgrep -q "${escapedTerms[i]}" "$f" 2>/dev/null; then echo "$f"; fi; done' sh`;
                    }
                    pdfgrepCmd = pdfBaseCommand;
                }
            }

            console.log(`Executing grep command: ${grepCmd}`);
            console.log(`Executing pdfgrep command: ${pdfgrepCmd}`);
            
            // Execute both commands in parallel and combine results
            const allResults: any[] = [];
            const fileModTimes = orderByModTime ? new Map<string, number>() : null;
            let completedCommands = 0;
            const totalCommands = 2;
            
            /**
             * Process results when both search commands complete
             * Sorts and formats results for client response
             */
            const processResults = () => {
                completedCommands++;
                if (completedCommands === totalCommands) {
                    // Sort results by modification time if requested
                    if (orderByModTime) {
                        allResults.sort((a, b) => {
                            // Primary: modification time (newest first)
                            if (a.modTime !== b.modTime) {
                                return b.modTime - a.modTime;
                            }
                            // Secondary: filename (alphabetical)
                            return a.file.localeCompare(b.file);
                        });
                    }
                    
                    // Clean results (remove internal modTime property)
                    const cleanResults = orderByModTime ? 
                        allResults.map(result => ({
                            file: result.file,
                            line: result.line,
                            content: result.content
                        })) : 
                        allResults;
                    
                    // Send successful response
                    res.json({ 
                        success: true, 
                        message: `Simple search completed for query: "${query}". Found ${cleanResults.length} matches.`,
                        query: query,
                        searchPath: treeFolder,
                        results: cleanResults
                    });
                }
            };
            
            /**
             * Helper function to process search output and add results
             * @param stdout - Raw output from grep or pdfgrep command
             * @param _isFromPdf - Whether results came from PDF search (currently unused but kept for future enhancements)
             */
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const addResultsFromOutput = (stdout: string, _isFromPdf: boolean = false) => {
                if (stdout.trim()) {
                    const filePaths = stdout.trim().split('\n');
                    
                    for (const filePath of filePaths) {
                        if (filePath.trim()) {
                            // Convert to relative path from search root
                            const relativePath = path.relative(absoluteSearchPath, filePath.trim());
                            
                            let modTime: number | undefined;
                            
                            // Get modification time for sorting if needed
                            if (orderByModTime && fileModTimes && !fileModTimes.has(relativePath)) {
                                try {
                                    const stat = fs.statSync(filePath.trim());
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
                            
                            // Create result object (file-level match)
                            const result: any = {
                                file: relativePath,
                                line: -1,        // -1 indicates file-level match
                                content: ''      // No specific content for file-level matches
                            };
                            
                            // Add modification time for sorting (internal use)
                            if (orderByModTime && modTime !== undefined) {
                                result.modTime = modTime;
                            }
                            
                            allResults.push(result);
                        }
                    }
                }
            };
            
            // Execute grep command for text files
            exec(grepCmd, (error, stdout, stderr) => {
                if (error && error.code !== 1) {
                    console.error('Grep command error:', error);
                    // Continue processing; don't fail entire search for grep errors
                    if (completedCommands === 0) {
                        // Only fail if this is the first command and it fails badly
                        res.status(500).json({ error: 'Search command failed' });
                        return;
                    }
                }
                
                if (stderr) {
                    console.warn('Grep stderr:', stderr);
                }
                
                addResultsFromOutput(stdout, false);
                processResults();
            });
            
            // Execute pdfgrep command for PDF files
            exec(pdfgrepCmd, (error, stdout, stderr) => {
                if (error && error.code !== 1) {
                    // PDF search failures are more common (missing pdfgrep, corrupt PDFs)
                    // Log as warning but continue
                    console.warn('Pdfgrep command error (this is normal if no PDFs found):', error);
                }
                
                if (stderr) {
                    console.warn('Pdfgrep stderr:', stderr);
                }
                
                addResultsFromOutput(stdout, true);
                processResults();
            });
            
        } catch (error) {
            handleError(error, res, 'Failed to perform simple search');
        }
    }
}

export const docSvc = new DocService();
