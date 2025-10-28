import { ANON_USER_ID } from "../../../common/types/CommonTypes.js";
import { Request, Response } from 'express';
import { svrUtil, throwError } from "../../../server/ServerUtil.js";
import { AuthenticatedRequest } from "../../../server/HttpTypes.js";
import { docUtil } from "./DocUtil.js";
import { runTrans } from "../../../server/db/Transactional.js";
import pgdb from "../../../server/db/PGDB.js";
import { fixName, getFilenameExtension, isImageExt } from '../../../common/CommonUtils.js';
import vfs from "./VFS.js";
import { CreateFileRequest, CreateFileResponse, CreateFolderRequest, CreateFolderResponse } from "./HttpTypes.js";
import { TreeNode, TreeRender_ResInfo } from "../common/CommonTypes.js";

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
     * @param req - Express request object with params: query: {pullup?}
     * @param res - Express response object for JSON tree data
     * @returns Promise<void> - Sends TreeRender_Response as JSON or error response
     */
     
    treeRender = async (req: Request<{ 0: string }, any, any, { pullup?: string }>, res: Response): Promise<void> => {  
        let user_id = (req as any).userProfile ? (req as AuthenticatedRequest).userProfile?.id : 0; 
        if (!user_id) {
            user_id = ANON_USER_ID;
        }

        // Extract the folder path from the wildcard part of the URL
        const rawTreeFolder = req.params[0] || "/";
        let treeFolder = decodeURIComponent(rawTreeFolder);
        
        // Extract the pullup parameter from query string
        const pullup = req.query.pullup as string; 

        treeFolder = docUtil.normalizePath(treeFolder); // Normalize the path to ensure consistent formatting
        // console.log(`Normalized treeFolder: [${treeFolder}]`);

        if (treeFolder.trim()=== '' || treeFolder === '/') {
            if (user_id!=pgdb.adminProfile!.id) {
                // If treeFolder is empty or root, we return the admin profile's root node
                // This is a security measure to prevent unauthorized access to the admin's root
                throwError(`Unauthorized access attempt by user ${user_id} to root node.`);
            }
        }
        
        // Resolve the document root path from the provided key
        const root = "/";

        // const slashFreeTreeFolder = treeFolder.replace(/^\//, ''); // Remove leading slashes
        // Use regex to check if treeFolder starts with pattern "NNNN_" where 4 is a numeric digit
    
        // Construct the absolute path to the target directory
        const absolutePath = docUtil.pathJoin(root, treeFolder);

        const info: any = {};
        // Verify the target directory exists
        if (!await vfs.exists(absolutePath, info)) {
            console.warn(`Directory does not exist: ${absolutePath}`);
            res.status(404).json({ error: `Directory not found: ${absolutePath}` });
            return;
        }

        // NOTE: Checks for root node will end up here with 'info.node' being empty object
        if (!info.node) {
            // If info.node is not available, we can assume it's a root node with no owner_id
            throw new Error(`Failed to create TreeNode ${absolutePath}`);
        }

        // Verify the target is actually a directory (not a file)
        if (!info.node.is_directory) {
            console.warn(`Path is not a directory: ${absolutePath}`);
            res.status(400).json({ error: 'Path is not a directory' });
            return;
        }

        // Generate the tree structure
        const treeNodes: TreeNode[] = await this.getTreeNodes(user_id, absolutePath, pullup==="true", root);
        // Send the tree data as JSON response
        const response: TreeRender_ResInfo = { 
            user_id: user_id == ANON_USER_ID ? null : user_id,
            rootNode: info.node,
            treeNodes,
            treeFolder
        };
        res.json(response);

        // JSON pretty print the response
        // console.log(`Tree response for [${absolutePath}]\n`, JSON.stringify(response, null, 2));
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
    getTreeNodes = async (owner_id: number, absolutePath: string, pullup: boolean, root: string): Promise<TreeNode[]> => { 
        // Read the directory contents
        let fileNodes = await vfs.readdirEx(owner_id, absolutePath, true);

        // This filters out hidden files and system files
        fileNodes = fileNodes.filter(file => !file.name.startsWith('.'));

        // Process each file/folder in the directory
        for (const file of fileNodes) {    
            // Get file information
            const filePath = docUtil.pathJoin(absolutePath, file.name);

            // DIRECTORY
            if (file.is_directory) {
                // Handle pullup folders: folders ending with '_' get their contents inlined
                if (pullup && file.name.endsWith('_')) {
                    // Recursively get tree nodes for this pullup folder
                    file.children = await this.getTreeNodes(owner_id, filePath, true, root);
                    
                    // Set children to null if empty (cleaner JSON output)
                    if (file.children.length === 0) {
                        file.children = null;
                    }
                }
                
                // Check if folder has any children in the filesystem
                file.fsChildren = await vfs.childrenExist(owner_id, filePath);
            } 
            // FILE
            else {
                file.fsChildren = false; // Files do not have children
                // Process files based on their extension
                const ext = getFilenameExtension(file.name).toLowerCase();
                    
                // IMAGE FILE
                if (isImageExt(ext)) {
                    // Image files: store relative path for URL construction
                    // If filePath starts with root, strip the root part to get relative path
                    // console.log(`Processing image file: [${filePath}] under root [${root}]`);
                    const relativePath = filePath.startsWith(root) ? filePath.substring(root.length) : filePath;
                    file.url = relativePath; // Use absolute path for image display 
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
     * @param req - Express request with body: {fileName, treeFolder, insertAfterNode}
     * @param res - Express response object
     * @returns Promise<void> - Sends success response with created filename or error
     */
    createFile = async (req: CreateFileRequest, res: CreateFileResponse): Promise<void> => {
        const owner_id = svrUtil.getOwnerId(req, res);
        if (owner_id==null) {
            return;
        }
        await runTrans(async () => {
            // console.log(`Create File Request: ${JSON.stringify(req.body, null, 2)}`);
            
            // Extract parameters from request body
            const { insertAfterNode } = req.body;
            let {treeFolder} = req.body;
            let {fileName} = req.body;
            fileName = fixName(fileName); // Ensure valid file name
            treeFolder = docUtil.normalizePath(treeFolder); // Normalize the path to ensure consistent formatting
            
            // Resolve and validate document root
            const root = "/";

            // Validate required parameters
            if (!fileName) {
                res.status(400).json({ error: 'File name and treeFolder are required' });
                return;
            }

            // Construct absolute path to parent directory
            const absoluteParentPath = docUtil.pathJoin(root, treeFolder);

            // Verify parent directory exists and is accessible
            const info: any = {};
            if (!await vfs.exists(absoluteParentPath, info)) {
                res.status(404).json({ error: `Parent directory not found [${absoluteParentPath}]` });
                return;
            }

            // Calculate insertion ordinal based on insertAfterNode
            let insertOrdinal = 0; // Default: insert at top (ordinal 0)
            if (insertAfterNode && insertAfterNode.trim() !== '') {
                
                // For VFS: insertAfterNode is just the filename, we need to get its ordinal from the database
                // For legacy VFS: insertAfterNode has ordinal prefix, extract it
                // VFS: Get ordinal from database
                const afterNodePath = docUtil.pathJoin(absoluteParentPath, insertAfterNode);
                const afterNodeInfo: any = {};
                if (await vfs.exists(afterNodePath, afterNodeInfo) && afterNodeInfo.node) {
                    insertOrdinal = afterNodeInfo.node.ordinal + 1;
                } 
            } else {
                console.log(`[CREATE_FILE] Creating new top file "${fileName}"`);
            }
                
            // Shift existing files/folders down to make room for the new file
            // This ensures proper ordinal sequence is maintained
            await docUtil.shiftOrdinalsDown(owner_id, 1, absoluteParentPath, insertOrdinal, root);
                            
            // Auto-add .md extension if no extension is provided
            let finalFileName = fileName;
            if (!getFilenameExtension(fileName)) {
                finalFileName = `${fileName}.md`;
            }

            // Determine the file system type to handle filename creation differently
            let newFilePath: string;
            let fileNameToReturn: string;
                
            // VFS: No ordinal prefix in filename, ordinal is stored in database
            newFilePath = docUtil.pathJoin(absoluteParentPath, finalFileName);
            fileNameToReturn = finalFileName;
            
            // Safety check: prevent overwriting existing files
            // If file already exists, try different random suffixes until we find a unique name
            let existsCheck = await vfs.exists(newFilePath);
            while (existsCheck) {
                const randomSuffix = Math.floor(Math.random() * 100000);
                const baseFileName = finalFileName.includes('.') 
                    ? finalFileName.substring(0, finalFileName.lastIndexOf('.'))
                    : finalFileName;
                const extension = finalFileName.includes('.') 
                    ? finalFileName.substring(finalFileName.lastIndexOf('.'))
                    : '';
                    
                const uniqueFileName = `${baseFileName}_${randomSuffix}${extension}`;
                                        
                // VFS: No ordinal prefix in filename
                newFilePath = docUtil.pathJoin(absoluteParentPath, uniqueFileName);
                fileNameToReturn = uniqueFileName;
                existsCheck = await vfs.exists(newFilePath);
            }
                
            await vfs.writeFileEx(owner_id, newFilePath, '', 'utf8', info.node.is_public, insertOrdinal);                
            //console.log(`File created successfully: ${newFilePath}`);
            
            // Send success response with the created filename
            res.json({ 
                message: 'File created successfully',
                fileName: fileNameToReturn 
            });
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
     * @param req - Express request with body: {folderName, treeFolder, insertAfterNode}
     * @param res - Express response object
     * @returns Promise<void> - Sends success response with created folder name or error
     */
    createFolder = async (req: CreateFolderRequest, res: CreateFolderResponse): Promise<void> => {
        const owner_id = svrUtil.getOwnerId(req, res);
        if (!owner_id) {
            throw new Error('Invalid owner_id: ' + owner_id);
        }

        await runTrans(async () => {
            console.log("Create Folder Request");
            
            // Extract parameters from request body
            const { treeFolder, insertAfterNode } = req.body;
            let {folderName} = req.body;
            folderName = fixName(folderName); // Ensure valid folder name
            
            // Resolve and validate document root
            const root = "/";

            // Validate required parameters
            if (!folderName || !treeFolder) {
                res.status(400).json({ error: 'Folder name and treeFolder are required' });
                return;
            }

            // Construct absolute path to parent directory
            const absoluteParentPath = docUtil.pathJoin(root, treeFolder);

            // Verify parent directory exists and is accessible
            const parentInfo: any = {};
            if (!await vfs.exists(absoluteParentPath, parentInfo)) {
                res.status(404).json({ error: 'Parent directory not found' });
                return;
            }

            // Calculate insertion ordinal based on insertAfterNode
            let insertOrdinal = 0; // Default: insert at top (ordinal 0)

            if (insertAfterNode && insertAfterNode.trim() !== '') {
                console.log(`Create folder "${folderName}" below node: ${insertAfterNode}`);
                
                // VFS: Get ordinal from database
                const afterNodePath = docUtil.pathJoin(absoluteParentPath, insertAfterNode);
                const afterNodeInfo: any = {};
                if (await vfs.exists(afterNodePath, afterNodeInfo) && afterNodeInfo.node) {
                    insertOrdinal = afterNodeInfo.node.ordinal + 1;
                }
                   
            } else {
                console.log(`Create new top folder "${folderName}"`);
            }

            // Shift existing files/folders down to make room for the new folder
            // This ensures proper ordinal sequence is maintained
            await docUtil.shiftOrdinalsDown(owner_id, 1, absoluteParentPath, insertOrdinal, root);
                 
            // VFS: No ordinal prefix in folder name, ordinal is stored in database
            const newFolderPath = docUtil.pathJoin(absoluteParentPath, folderName);
            const folderNameToReturn = folderName;
               

            // Create the directory (recursive option ensures parent directories exist, and we inherit `is_public` from parent.
            // VFS: Pass ordinal as parameter to mkdirEx
            await vfs.mkdirEx(owner_id, newFolderPath, { recursive: true }, parentInfo.node.is_public, insertOrdinal);
            console.log(`Folder created successfully: ${newFolderPath}`);
            
            // Send success response with the created folder name
            res.json({ 
                message: 'Folder created successfully',
                folderName: folderNameToReturn 
            });
        });
    }
}

export const docSvc = new DocService();
