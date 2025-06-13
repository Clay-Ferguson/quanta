import { TreeNode } from "../../../common/types/CommonTypes.js";
import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import {  TreeRender_Response } from "../../../common/types/EndpointTypes.js";
import { svrUtil } from "../../ServerUtil.js";
import { config } from "../../Config.js";
import { docUtil } from "./DocUtil.js";
const { exec } = await import('child_process');

/**
 * Service class for handling document management operations in the docs plugin.
 */
class DocService {

    /**
     * On the file system we have folders that all have 4-digit ordinals in their names, like "1234_FolderName/1234_SubFolderName".
     * This method allows us to resolve a non-ordinal path like "FolderName/SubFolderName" to the correct ordinal path based on the document root key and tree folder.
     *
     * @param docRootKey key of the document root, for which we can get the actual root via 'getPublicFolderByKey'
     * @param treeFolder non-ordinal path to resolve, e.g. "FolderName/SubFolderName"
     * @returns the resolved path with ordinals, e.g. "/1234_FolderName/5678_SubFolderName"
     */
    resolveNonOrdinalPath = (docRootKey: string, treeFolder: string): string => {        
        // Resolve the wildcard path based on the docRootKey and treeFolder
        const root = config.getPublicFolderByKey(docRootKey).path;
        if (!root) {
            throw new Error('Invalid document root key');
        }
        
        // Ensure the treeFolder is properly decoded and sanitized
        const decodedTreeFolder = decodeURIComponent(treeFolder);
        
        // Handle root case
        if (decodedTreeFolder === '/' || decodedTreeFolder === '') {
            return '/';
        }
        
        // Split the path into individual folder components, removing empty strings
        const folderComponents = decodedTreeFolder.split('/').filter(component => component.length > 0);
        
        // Build the resolved path by finding the ordinal version of each folder
        let currentPath = root;
        let resolvedPath = '';
        
        for (let i = 0; i < folderComponents.length; i++) {
            const folderName = folderComponents[i];
            
            // Read the current directory to find matching folders
            if (!fs.existsSync(currentPath)) {
                throw new Error(`Directory not found: ${currentPath}`);
            }
            
            docUtil.checkFileAccess(currentPath, root);
            const entries = fs.readdirSync(currentPath);
            
            // Find the folder that matches the non-ordinal name
            let matchedFolder: string | null = null;
            
            for (const entry of entries) {
                // Skip hidden files and files starting with underscore
                if (entry.startsWith('.') || entry.startsWith('_')) {
                    continue;
                }
                
                // Check if this entry is a directory with an ordinal prefix
                const entryPath = path.join(currentPath, entry);
                const stat = fs.statSync(entryPath);
                
                if (stat.isDirectory() && /^\d+_/.test(entry)) {                    // Extract the name without ordinal prefix
                    const nameWithoutOrdinal = entry.substring(entry.indexOf('_') + 1);
                    
                    // Check if this matches our target folder name (case-insensitive)
                    if (nameWithoutOrdinal.toLowerCase() === folderName.toLowerCase()) {
                        matchedFolder = entry;
                        break;
                    }
                } else {
                    console.log(`    Entry "${entry}" is ${!stat.isDirectory() ? 'not a directory' : 'directory without ordinal prefix'}`);
                }
            }
            
            if (!matchedFolder) {
                for (const entry of entries) {
                    const entryPath = path.join(currentPath, entry);
                    const stat = fs.statSync(entryPath);
                    if (stat.isDirectory() && /^\d+_/.test(entry)) {
                        const nameWithoutOrdinal = entry.substring(entry.indexOf('_') + 1);
                        console.log(`  - "${entry}" -> "${nameWithoutOrdinal}"`);
                    }
                }
                throw new Error(`Folder not found: ${folderName} in path ${currentPath}`);
            }
            
            // Update current path and resolved path
            currentPath = path.join(currentPath, matchedFolder);
            resolvedPath += '/' + matchedFolder;
        }        
        return resolvedPath;
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
        // console.log("Tree Render Request:", pathName);
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

            docUtil.checkFileAccess(absolutePath, root);
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
 
    /**
     * Recursively builds tree nodes for files and folders in a directory
     * @param absolutePath - The absolute path to the directory to scan
     * @param pullup - Whether to treat folders ending with '_' as pullup folders (inline contents)
     * @param root - The root directory for security validation
     * @returns Array of TreeNode objects representing the directory contents
     */
    getTreeNodes = (absolutePath: string, pullup: boolean, root: string): TreeNode[] => {
        docUtil.checkFileAccess(absolutePath, root); 
        // Read directory contents
        const files = fs.readdirSync(absolutePath);
        const treeNodes: TreeNode[] = [];
        let nextOrdinal = docUtil.getMaxOrdinal(absolutePath, root);

        for (let file of files) {
            // Skip files that start with a dot (hidden files), or underscores.
            if (file.startsWith('.') || file.startsWith('_')) {
                continue;
            }

            // We only consider files that are named like "NNNNN_" where N is a digit. We allow any number of digits followed by the underscore.
            if (!/^\d+_/.test(file)) {
                // We need to use nextOrdinal to ensure that files without a numeric prefix get a new ordinal
                // We will ensure that the file has a 4-digit ordinal prefix
                file = docUtil.ensureOrdinalPrefix(absolutePath, file, ++nextOrdinal, root);
            }

            // Ensure file has 4-digit ordinal prefix
            const currentFileName = docUtil.ensureFourDigitOrdinal(absolutePath, file, root);
                
            const filePath = path.join(absolutePath, currentFileName);
            docUtil.checkFileAccess(filePath, root); 
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
     * Creates a new file in the tree viewer with proper ordinal positioning
     * @param req - Express request object containing fileName, treeFolder, insertAfterNode, and docRootKey
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
            docUtil.checkFileAccess(absoluteParentPath, root); 
            if (!fs.existsSync(absoluteParentPath)) {
                res.status(404).json({ error: 'Parent directory not found' });
                return;
            }

            let insertOrdinal = 0; // Default to insert at top

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
            docUtil.shiftOrdinalsDown(1, absoluteParentPath, insertOrdinal, root, null);

            // Create the new file with the calculated ordinal
            const ordinalPrefix = insertOrdinal.toString().padStart(4, '0'); // Use 4-digit padding
            const newFileName = `${ordinalPrefix}_${fileName}`;
            
            // Add .md extension if the fileName doesn't already have an extension
            let finalFileName = newFileName;
            if (!path.extname(fileName)) {
                finalFileName = `${newFileName}.md`;
            }
            
            const newFilePath = path.join(absoluteParentPath, finalFileName);

            // Safety check: ensure target doesn't already exist to prevent overwriting
            if (fs.existsSync(newFilePath)) {
                res.status(409).json({ error: 'A file with this name already exists at the target location' });
                return;
            }

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
     * Creates a new folder in the tree viewer with proper ordinal positioning
     * @param req - Express request object containing folderName, treeFolder, insertAfterNode, and docRootKey
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
            docUtil.checkFileAccess(absoluteParentPath, root);
            if (!fs.existsSync(absoluteParentPath)) {
                res.status(404).json({ error: 'Parent directory not found' });
                return;
            }

            let insertOrdinal = 0; // Default to insert at top

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
            docUtil.shiftOrdinalsDown(1, absoluteParentPath, insertOrdinal, root, null);

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
     * Searches through documents for the given query string using various search modes
     * Supports REGEX, MATCH_ANY, and MATCH_ALL search modes with file modification time ordering
     *
     * todo-0: make this method still be available, as a text only search, and give users option for 'text only files' or 'all files' because
     * the text only is much faster. 
     * 
     * @param req - Express request object containing query, treeFolder, docRootKey, and optional searchMode
     * @param res - Express response object
     */
    searchTextFiles = async (req: Request<any, any, { 
        query: string; 
        treeFolder: string; 
        docRootKey: string; 
        searchMode?: string,
        requireDate?: boolean }>, res: Response): Promise<void> => {
        console.log("Document Search Request");
        try {
            // todo-1: make this optional.
            const orderByModTime = true;
            const { query, treeFolder, docRootKey, searchMode = 'MATCH_ANY', requireDate } = req.body;
            
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
            docUtil.checkFileAccess(absoluteSearchPath, root);
            
            // Check if the search directory exists
            if (!fs.existsSync(absoluteSearchPath)) {
                res.status(404).json({ error: 'Search directory not found' });
                return;
            }

            console.log(`Search query: "${query}" with mode: "${searchMode}" in folder: "${absoluteSearchPath}"`);
            
            // Use grep to search for the query string recursively            
            let cmd: string; 

            // Set to null to disable timestamp filtering (search all files), 
            // or set to a regex pattern to enable filtering (search only files with timestamps)
            // Note: remove the '^' at the start of the regex to allow matching lines that don't start with a timestamp but just contain it.
            const dateRegex: string | null = requireDate ? 
                "^\\[20[0-9][0-9]/[0-9][0-9]/[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9] (AM|PM)\\]" : null;

            const include = '--include="*.md" --include="*.txt" --exclude="_*" --exclude=".*"';
            const chain = 'xargs -0 --no-run-if-empty';
            
            // REGEX
            if (searchMode === 'REGEX') {
                // For REGEX mode, use the query as-is as a regex pattern
                // Escape backslashes for shell usage (other characters like quotes are handled by the shell quoting)
                const escapedQuery = query.replace(/\\/g, '\\\\');
                
                if (dateRegex) {
                    // Search only in files that contain timestamps
                    cmd = `grep -rlZ ${include} -E "${dateRegex}" "${absoluteSearchPath}" | ${chain} grep -niH -E "${escapedQuery}"`;
                } else {
                    // Search in all files (no timestamp filtering)
                    cmd = `grep -rniH ${include} -E "${escapedQuery}" "${absoluteSearchPath}"`;
                }
            } 
            // MATCH_ANY / MATCH_ALL
            else {
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
                
                // MATCH_ANY
                if (searchMode === 'MATCH_ANY') {
                    // For MATCH_ANY, search for any of the terms
                    const escapedTerms = searchTerms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                    const regexPattern = escapedTerms.join('|');
                    
                    if (dateRegex) {
                        // Search only in files that contain timestamps
                        cmd = `grep -rlZ ${include} -E "${dateRegex}" "${absoluteSearchPath}" | ${chain} grep -niH -E "${regexPattern}"`;
                    } else {
                        // Search in all files (no timestamp filtering)
                        cmd = `grep -rniH ${include} -E "${regexPattern}" "${absoluteSearchPath}"`;
                    }
                } 
                // MATCH_ALL
                else { 
                    const escapedTerms = searchTerms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                    
                    if (dateRegex) {
                        // Search only in files that contain timestamps
                        let baseCommand = `grep -rlZ ${include} -E "${dateRegex}" "${absoluteSearchPath}"`;
                        
                        // Chain additional greps for each search term
                        for (let i = 0; i < escapedTerms.length; i++) {
                            baseCommand += ` | ${chain} grep -lZ -i "${escapedTerms[i]}"`;
                        }
                        cmd = `${baseCommand} | ${chain} grep -niH -E "${escapedTerms.join('|')}"`;
                    } else {
                        // Search in all files (no timestamp filtering)
                        let baseCommand = `grep -rlZ ${include} "${escapedTerms[0]}" "${absoluteSearchPath}"`;
                        
                        // Chain additional greps for each search term
                        for (let i = 1; i < escapedTerms.length; i++) {
                            baseCommand += ` | ${chain} grep -lZ -i "${escapedTerms[i]}"`;
                        }
                        cmd = `${baseCommand} | ${chain} grep -niH -E "${escapedTerms.join('|')}"`;
                    }
                }
            }
            console.log(`Executing grep command: ${cmd}`);
            
            exec(cmd, (error, stdout, stderr) => {
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
     * Simple search that treats all files as binary matches (no line-by-line parsing)
     * Supports REGEX, MATCH_ANY, and MATCH_ALL search modes with file modification time ordering
     * This method will run slower because it searches thru PDFs in a special way too
     * 
     * @param req - Express request object containing query, treeFolder, docRootKey, and optional searchMode
     * @param res - Express response object
     */
    searchBinaries = async (req: Request<any, any, { 
        query: string; 
        treeFolder: string; 
        docRootKey: string; 
        searchMode?: string,
        requireDate?: boolean }>, res: Response): Promise<void> => {
        console.log("Document Simple Search Request");
        try {
            // todo-1: make this optional.
            const orderByModTime = true;
            const { query, treeFolder, docRootKey, searchMode = 'MATCH_ANY', requireDate } = req.body;
            
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
            docUtil.checkFileAccess(absoluteSearchPath, root);
            
            // Check if the search directory exists
            if (!fs.existsSync(absoluteSearchPath)) {
                res.status(404).json({ error: 'Search directory not found' });
                return;
            }

            console.log(`Simple search query: "${query}" with mode: "${searchMode}" in folder: "${absoluteSearchPath}"`);
            
            // Build search commands - separate grep for non-PDFs and pdfgrep for PDFs
            let grepCmd: string = '';
            let pdfgrepCmd: string = '';

            // Set to null to disable timestamp filtering (search all files), 
            // or set to a regex pattern to enable filtering (search only files with timestamps)
            // Note: remove the '^' at the start of the regex to allow matching lines that don't start with a timestamp but just contain it.
            const dateRegex: string | null = requireDate ? 
                "^\\[20[0-9][0-9]/[0-9][0-9]/[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9] (AM|PM)\\]" : null;

            // Include text-based files only
            const include = '--include="*.md" --include="*.txt" --exclude="*.pdf" --exclude="_*" --exclude=".*"';
            const chain = 'xargs -0 --no-run-if-empty';
            
            // Build search terms first
            let searchTerms: string[] = [];
            if (searchMode !== 'REGEX') {
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
            }
            
            // REGEX MODE
            // todo-0: Claude put in '-E' for all the pdfgrep calls, which I think was wrong, because searches like "this|that" were not working.
            //         but when I switchd the upper case '-E' to lower case '-e', it worked, but this hasn't been fully tested yet in all scenarios.
            if (searchMode === 'REGEX') {
                // For REGEX mode, use the query as-is as a regex pattern
                const escapedQuery = query.replace(/\\/g, '\\\\');
                
                if (dateRegex) {
                    // Search only in files that contain timestamps
                    grepCmd = `grep -rlZ ${include} -E "${dateRegex}" "${absoluteSearchPath}" | ${chain} grep -l -E "${escapedQuery}"`;
                    pdfgrepCmd = `find "${absoluteSearchPath}" -name "*.pdf" -print0 | ${chain} sh -c 'for f; do if pdfgrep -q -e "${dateRegex}" "$f" 2>/dev/null; then echo "$f"; fi; done' sh | ${chain} sh -c 'for f; do if pdfgrep -q -e "${escapedQuery}" "$f" 2>/dev/null; then echo "$f"; fi; done' sh`;
                } else {
                    // Search in all files (no timestamp filtering)
                    grepCmd = `grep -rl ${include} -E "${escapedQuery}" "${absoluteSearchPath}"`;
                    pdfgrepCmd = `find "${absoluteSearchPath}" -name "*.pdf" -exec sh -c 'if pdfgrep -q -e "${escapedQuery}" "$1" 2>/dev/null; then echo "$1"; fi' sh {} \\;`;
                }
            } 
            // MATCH_ANY MODE
            else if (searchMode === 'MATCH_ANY') {
                // For MATCH_ANY, search for any of the terms
                const escapedTerms = searchTerms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                
                if (searchTerms.length === 1) {
                    // Single term - use simple string search for better compatibility
                    if (dateRegex) {
                        // Search only in files that contain timestamps
                        grepCmd = `grep -rlZ ${include} -E "${dateRegex}" "${absoluteSearchPath}" | ${chain} grep -l "${escapedTerms[0]}"`;
                        pdfgrepCmd = `find "${absoluteSearchPath}" -name "*.pdf" -print0 | ${chain} sh -c 'for f; do if pdfgrep -q -e "${dateRegex}" "$f" 2>/dev/null; then echo "$f"; fi; done' sh | ${chain} sh -c 'for f; do if pdfgrep -q "${escapedTerms[0]}" "$f" 2>/dev/null; then echo "$f"; fi; done' sh`;
                    } else {
                        // Search in all files (no timestamp filtering)
                        grepCmd = `grep -rl ${include} "${escapedTerms[0]}" "${absoluteSearchPath}"`;
                        pdfgrepCmd = `find "${absoluteSearchPath}" -name "*.pdf" -exec sh -c 'if pdfgrep -q "${escapedTerms[0]}" "$1" 2>/dev/null; then echo "$1"; fi' sh {} \\;`;
                    }
                } else {
                    // Multiple terms - use regex pattern
                    const regexPattern = escapedTerms.join('|');
                    if (dateRegex) {
                        // Search only in files that contain timestamps
                        grepCmd = `grep -rlZ ${include} -E "${dateRegex}" "${absoluteSearchPath}" | ${chain} grep -l -E "${regexPattern}"`;
                        pdfgrepCmd = `find "${absoluteSearchPath}" -name "*.pdf" -print0 | ${chain} sh -c 'for f; do if pdfgrep -q -e "${dateRegex}" "$f" 2>/dev/null; then echo "$f"; fi; done' sh | ${chain} sh -c 'for f; do if pdfgrep -q -e "${regexPattern}" "$f" 2>/dev/null; then echo "$f"; fi; done' sh`;
                    } else {
                        // Search in all files (no timestamp filtering)
                        grepCmd = `grep -rl ${include} -E "${regexPattern}" "${absoluteSearchPath}"`;
                        pdfgrepCmd = `find "${absoluteSearchPath}" -name "*.pdf" -exec sh -c 'if pdfgrep -q -e "${regexPattern}" "$1" 2>/dev/null; then echo "$1"; fi' sh {} \\;`;
                    }
                }
            } 
            // MATCH_ALL MODE
            else { 
                const escapedTerms = searchTerms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                
                if (dateRegex) {
                    // Search only in files that contain timestamps
                    let baseCommand = `grep -rlZ ${include} -E "${dateRegex}" "${absoluteSearchPath}"`;
                    
                    // Chain additional greps for each search term
                    for (let i = 0; i < escapedTerms.length; i++) {
                        baseCommand += ` | ${chain} grep -lZ -i "${escapedTerms[i]}"`;
                    }
                    grepCmd = baseCommand;
                    
                    // For PDFs with timestamp filtering and MATCH_ALL
                    let pdfBaseCommand = `find "${absoluteSearchPath}" -name "*.pdf" -print0 | ${chain} sh -c 'for f; do if pdfgrep -q -e "${dateRegex}" "$f" 2>/dev/null; then echo "$f"; fi; done' sh`;
                    for (let i = 0; i < escapedTerms.length; i++) {
                        pdfBaseCommand += ` | ${chain} sh -c 'for f; do if pdfgrep -q "${escapedTerms[i]}" "$f" 2>/dev/null; then echo "$f"; fi; done' sh`;
                    }
                    pdfgrepCmd = pdfBaseCommand;
                } else {
                    // Search in all files (no timestamp filtering)
                    let baseCommand = `grep -rlZ ${include} "${escapedTerms[0]}" "${absoluteSearchPath}"`;
                    
                    // Chain additional greps for each search term
                    for (let i = 1; i < escapedTerms.length; i++) {
                        baseCommand += ` | ${chain} grep -lZ -i "${escapedTerms[i]}"`;
                    }
                    grepCmd = baseCommand;
                    
                    // For PDFs with MATCH_ALL
                    let pdfBaseCommand = `find "${absoluteSearchPath}" -name "*.pdf" -print0 | ${chain} sh -c 'for f; do if pdfgrep -q "${escapedTerms[0]}" "$f" 2>/dev/null; then echo "$f"; fi; done' sh`;
                    for (let i = 1; i < escapedTerms.length; i++) {
                        pdfBaseCommand += ` | ${chain} sh -c 'for f; do if pdfgrep -q "${escapedTerms[i]}" "$f" 2>/dev/null; then echo "$f"; fi; done' sh`;
                    }
                    pdfgrepCmd = pdfBaseCommand;
                }
            }

            console.log(`Executing grep command: ${grepCmd}`);
            console.log(`Executing pdfgrep command: ${pdfgrepCmd}`);
            
            // Execute both commands and combine results
            const allResults: any[] = [];
            const fileModTimes = orderByModTime ? new Map<string, number>() : null;
            let completedCommands = 0;
            const totalCommands = 2;
            
            const processResults = () => {
                completedCommands++;
                if (completedCommands === totalCommands) {
                    // Sort results by modification time (newest first), then by file name
                    if (orderByModTime) {
                        allResults.sort((a, b) => {
                            // First sort by modification time (descending - newest first)
                            if (a.modTime !== b.modTime) {
                                return b.modTime - a.modTime;
                            }
                            // If modification times are equal, sort by file name (ascending)
                            return a.file.localeCompare(b.file);
                        });
                    }
                    
                    // Remove the modTime property from results before sending to client (if it was added)
                    const cleanResults = orderByModTime ? 
                        allResults.map(result => ({
                            file: result.file,
                            line: result.line,
                            content: result.content
                        })) : 
                        allResults;
                    
                    res.json({ 
                        success: true, 
                        message: `Simple search completed for query: "${query}". Found ${cleanResults.length} matches.`,
                        query: query,
                        searchPath: treeFolder,
                        results: cleanResults
                    });
                }
            };
            
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const addResultsFromOutput = (stdout: string, _isFromPdf: boolean = false) => {
                if (stdout.trim()) {
                    const filePaths = stdout.trim().split('\n');
                    
                    for (const filePath of filePaths) {
                        if (filePath.trim()) {
                            // Make the file path relative to the search root
                            const relativePath = path.relative(absoluteSearchPath, filePath.trim());
                            
                            let modTime: number | undefined;
                            
                            // Get modification time for this file if ordering is enabled
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
                            
                            const result: any = {
                                file: relativePath,
                                // No line number for simple search - just indicate file match
                                line: -1,
                                content: ''
                            };
                            
                            // Only add modTime if ordering is enabled
                            if (orderByModTime && modTime !== undefined) {
                                result.modTime = modTime;
                            }
                            
                            allResults.push(result);
                        }
                    }
                }
            };
            
            // Execute grep command for non-PDF files
            exec(grepCmd, (error, stdout, stderr) => {
                if (error && error.code !== 1) {
                    console.error('Grep command error:', error);
                    if (completedCommands === 0) {
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
                    console.warn('Pdfgrep command error (this is normal if no PDFs found):', error);
                }
                
                if (stderr) {
                    console.warn('Pdfgrep stderr:', stderr);
                }
                
                addResultsFromOutput(stdout, true);
                processResults();
            });
            
        } catch (error) {
            svrUtil.handleError(error, res, 'Failed to perform simple search');
        }
    }
}

export const docSvc = new DocService();
                         