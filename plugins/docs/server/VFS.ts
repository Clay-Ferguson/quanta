import pgdb from '../../../server/db/PGDB.js';
import { UserProfileCompact } from '../../../common/types/CommonTypes.js';
import { getFilenameExtension } from '../../../common/CommonUtils.js';
import { CompactTreeNode, TreeNode } from '../common/CommonTypes.js';
import { docUtil } from './DocUtil.js';

const rootKey = "usr"; // Default root key for VFS, can be changed based on configuration

export interface VFSStats {
    is_public?: boolean;
    is_directory: boolean;
    birthtime: Date;
    mtime: Date;
    size: number;
}

/**
 * Virtual File System 2 (VFS) for handling file operations in a server environment, by using PostgreSQL as a backend for storage of files and folders.
 */
class VFS {
    /* Ensures that this user has a folder in the VFS root directory, and that it's named after their username. */
    async createUserFolder(userProfile: UserProfileCompact) {
        console.log(`Creating user folder for: ${userProfile.name} (ID: ${userProfile.id})`);
        const rootKey = "usr";

        // Throw an error if 'userProfile.name' is not valid.
        if (!/^[a-zA-Z0-9_]+$/.test(userProfile.name!)) {
            throw new Error(`Invalid user name: ${userProfile.name}. Only alphanumeric characters and underscores are allowed.`);
        }

        if (!userProfile.id) {
            throw new Error(`User profile must have an ID to create a folder. User: ${JSON.stringify(userProfile)}`);
        }

        // Check if user's root folder already exists
        const folderName = `rt_${userProfile.id}`;
        const existingFolder = await pgdb.query(
            'SELECT * FROM vfs_nodes WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3',
            rootKey, "", folderName
        );

        if (existingFolder.rows.length > 0) {
            console.log(`User folder ${folderName} already exists, skipping creation`);
            return;
        }

        // Using user's ID to build their root folder, since all users are part of a single tree.
        // Pass null for ordinal to let vfs_mkdir calculate the next available ordinal automatically
        await pgdb.query(
            'SELECT vfs_mkdir($1, $2, $3, $4, $5, $6, $7)',
            userProfile.id, "", folderName, rootKey, null, false, false
        );
    }

    async getNodeByName(fullPath: string): Promise<TreeNode | null> {
        try {
            const relativePath = docUtil.normalizePath(fullPath);
            
            // Special case for root directory. It always exists and we have no DB table 'row' for it.
            if (relativePath === '') {
                return {is_directory: true} as TreeNode; // Root directory has no database row
            }
            
            const { parentPath, filename } = docUtil.parsePath(relativePath);
            
            const result = await pgdb.query(
                'SELECT * FROM vfs_get_node_by_name($1, $2, $3)',
                parentPath, filename, rootKey
            );
            
            // Return the first row if found, null if no rows returned
            return result.rows.length > 0 ? docUtil.convertToTreeNode(result.rows[0]) : null;
        } catch (error) {
            console.error('VFS.getNodeByName error:', error);
            return null;
        }
    }

    // File existence and metadata
    async exists(fullPath: string, info: any=null): Promise<boolean> {
        // if a non-info object was passed the caller needs additional info so we run getNodeByName
        // which returns the whole record.
        fullPath = docUtil.normalizePath(fullPath);

        if (info) {
            if (fullPath === '') {
                // Special case for root directory
                info.node = { is_directory: true, is_public: false, owner_id: pgdb.adminProfile!.id } as TreeNode; // Root directory has no database row
                return true; // Root directory always exists
            }
            const node: TreeNode | null = await this.getNodeByName(fullPath);
            if (node) {
                info.node = node; // Attach the node to the info object
                return true; // File exists
            }
            return false; // File does not exist
        }

        try {
            const relativePath = docUtil.normalizePath(fullPath);
            
            // Special case for root directory. It always exists and we have no DB table 'row' for it.
            if (relativePath === '') {
                return true;
            }
            
            const { parentPath, filename } = docUtil.parsePath(relativePath);
            
            const result = await pgdb.query(
                'SELECT vfs_exists($1, $2, $3)',
                parentPath, filename, rootKey
            );
            
            return result.rows[0].vfs_exists;
        } catch (error) {
            console.error('VFS.exists error:', error);
            return false;
        }
    }
    
    async childrenExist(owner_id: number, path: string): Promise<boolean> {
        try {
            const relativePath = docUtil.normalizePath(path);
            
            // Special case for root directory
            if (relativePath === '') {
                return true;
            }
            const result = await pgdb.query(
                'SELECT vfs_children_exist($1, $2, $3)',
                owner_id, relativePath, rootKey
            );
            
            return result.rows[0].vfs_children_exist;
        } catch (error) {
            console.error('VFS.children_exist error:', error);
            return false;
        }
    }
    
    async stat(fullPath: string): Promise<VFSStats> { 
        try {
            const relativePath = docUtil.normalizePath(fullPath);
            
            // Special case for root directory
            if (relativePath === '') {
                // Return mock stats for root directory
                return {
                    // Root is considered owned by admin and not public.
                    is_public: false,
                    is_directory: true,
                    birthtime: new Date(),
                    mtime: new Date(),
                    size: 0
                } as VFSStats;
            }
            
            const { parentPath, filename } = docUtil.parsePath(relativePath);
            const result = await pgdb.query(
                'SELECT * FROM vfs_get_node_by_name($1, $2, $3)',
                parentPath, filename, rootKey
            );
            
            if (result.rows.length === 0) {
                throw new Error(`File not found: ${fullPath}`);
            }
            
            const row = result.rows[0];
            return {
                is_public: row.is_public,
                is_directory: row.is_directory,
                birthtime: new Date(row.created_time),
                mtime: new Date(row.modified_time),
                size: row.size_bytes || 0
            } as VFSStats;
        } catch (error) {
            console.error('VFS.stat error:', error);
            throw error;
        }
    }
    
    async readFile(owner_id: number, fullPath: string, encoding?: BufferEncoding): Promise<string | Buffer> {
        try {
            const { parentPath, filename } = docUtil.parsePath(fullPath);
            
            const result = await pgdb.query(
                'SELECT vfs_read_file($1, $2, $3, $4)',
                owner_id, parentPath, filename, rootKey
            );
            
            if (result.rows.length === 0) {
                throw new Error(`File not found: ${fullPath}`);
            }
            const content = result.rows[0].vfs_read_file;
            if (encoding) {
                return content.toString(encoding);
            } else {
                return content;
            }
        } catch (error) {
            console.error('VFS.readFile error:', error);
            throw error;
        }
    }
    
    async writeFile(owner_id: number, fullPath: string, data: string | Buffer, encoding?: BufferEncoding): Promise<void> {
        return await this.writeFileEx(owner_id, fullPath, data, encoding || 'utf8', false);
    }
    
    async writeFileEx(owner_id: number, fullPath: string, data: string | Buffer, encoding: BufferEncoding, is_public: boolean, ordinal?: number): Promise<void> {
        try {
            const relativePath = docUtil.normalizePath(fullPath);
            const { parentPath, filename } = docUtil.parsePath(relativePath);
            
            // Pass null for ordinal if not provided to let the SQL function calculate it automatically
            const finalOrdinal = ordinal ?? null;
            
            // Determine if this is a binary file based on extension
            const ext = getFilenameExtension(filename).toLowerCase();
            const isBinary = docUtil.isBinaryFile(ext);
            
            // Determine content type based on file extension
            const contentType = docUtil.getContentType(ext);
            
            if (isBinary || Buffer.isBuffer(data)) {
                // Handle binary files
                let content: Buffer;
                if (typeof data === 'string') {
                    content = Buffer.from(data, encoding || 'utf8');
                } else {
                    content = data;
                }
                
                await pgdb.query(
                    'SELECT vfs_write_binary_file($1, $2, $3, $4, $5, $6, $7, $8)',
                    owner_id, parentPath, filename, content, rootKey, finalOrdinal, contentType, is_public
                );
            } else {
                // Handle text files
                let textContent: string;
                if (typeof data === 'string') {
                    textContent = data;
                } else {
                    // data is Buffer - explicitly cast to ensure TypeScript knows it has toString method
                    textContent = (data as Buffer).toString(encoding || 'utf8');
                }
                
                await pgdb.query(
                    'SELECT vfs_write_text_file($1, $2, $3, $4, $5, $6, $7, $8)',
                    owner_id, parentPath, filename, textContent, rootKey, finalOrdinal, contentType, is_public
                );
            }
        } catch (error) {
            console.error('VFS.writeFileEx error:', error);
            throw error;
        }
    }
    
    /**
     * Get a node by its UUID and return the TreeNode with constructed docPath
     * @param uuid - The UUID of the node to retrieve
     * @param rootKey - The root key for the VFS (defaults to "usr")
     * @returns The TreeNode with docPath constructed from parent_path and filename, or null if not found
     */
    async getItemByID(uuid: string, rootKey: string = "usr"): Promise<{ node: TreeNode | null; docPath: string }> {
        try {
            const result = await pgdb.query(
                'SELECT * FROM vfs_nodes WHERE uuid = $1 AND doc_root_key = $2',
                uuid, rootKey
            );
            
            if (result.rows.length === 0) {
                return { node: null, docPath: '' };
            }
            
            const row = result.rows[0];
            const node = docUtil.convertToTreeNode(row);
            
            // Construct the docPath from parent_path and filename
            let docPath: string;
            if (row.parent_path === '' || row.parent_path === '/') {
                // If parent_path is empty or root, docPath is just the filename
                docPath = row.filename;
            } else {
                // Combine parent_path and filename with proper path separator
                docPath = docUtil.pathJoin(row.parent_path, row.filename);
            }
            
            return { node, docPath };
        } catch (error) {
            console.error('VFS.getItemByID error:', error);
            return { node: null, docPath: '' };
        }
    }

    /**
     * Get a compact node by its UUID containing only uuid, parent_path, filename, and ordinal
     * @param uuid - The UUID of the node to retrieve
     * @param rootKey - The root key for the VFS (defaults to "usr")
     * @returns The CompactTreeNode or null if not found
     */
    async getCompactNodeById(uuid: string, rootKey: string = "usr"): Promise<CompactTreeNode | null> {
        try {
            const result = await pgdb.query(
                'SELECT uuid, parent_path, filename, ordinal FROM vfs_nodes WHERE uuid = $1 AND doc_root_key = $2',
                uuid, rootKey
            );
            
            if (result.rows.length === 0) {
                return null;
            }
            
            const row = result.rows[0];
            return {
                uuid: row.uuid,
                parent_path: row.parent_path,
                filename: row.filename,
                ordinal: row.ordinal
            };
        } catch (error) {
            console.error('VFS.getCompactNodeById error:', error);
            return null;
        }
    }
    
    async readdir(owner_id: number, fullPath: string): Promise<string[]> {
        try {
            const relativePath = docUtil.normalizePath(fullPath);
            
            const result = await pgdb.query(
                'SELECT * FROM vfs_readdir($1, $2, $3, $4)',
                owner_id, relativePath, rootKey, false
            );
            
            // Extract just the filenames from the result
            return result.rows.map((row: any) => row.filename);
        } catch (error) {
            console.error('VFS.readdir error:', error);
            throw error;
        }
    }
    
    async readdirEx(owner_id: number, fullPath: string, loadContent: boolean): Promise<TreeNode[]> {
        try {
            const relativePath = docUtil.normalizePath(fullPath);
            
            const rootContents = await pgdb.query(
                'SELECT * FROM vfs_readdir($1, $2, $3, $4)',
                owner_id, relativePath, rootKey, loadContent
            );
            
            const treeNodes = rootContents.rows.map((row: any) => {
                return docUtil.convertToTreeNode(row);
            });
            return treeNodes;
        } catch (error) {
            console.error('VFS.readdirEx error:', error);
            throw error;
        }
    }
        
    async mkdirEx(owner_id: number, fullPath: string, options?: { recursive?: boolean }, is_public?: boolean, ordinal?: number): Promise<void> {
        try {
            const relativePath = docUtil.normalizePath(fullPath);
            const { parentPath, filename } = docUtil.parsePath(relativePath);
            
            // Pass null for ordinal if not provided to let the SQL function calculate it automatically
            const finalOrdinal = ordinal ?? null;
            
            await pgdb.query(
                'SELECT vfs_mkdir($1, $2, $3, $4, $5, $6, $7)',
                owner_id, parentPath, filename, rootKey, finalOrdinal, options?.recursive || false, is_public || false
            );
        } catch (error) {
            console.error('VFS.mkdirEx error:', error);
            throw error;
        }
    } 
    
    async rename(owner_id: number, oldPath: string, newPath: string): Promise<void> {
        if (!docUtil.validPath(newPath)) {
            throw new Error(`Invalid new path: ${newPath}. Only alphanumeric characters and underscores`);
        }
        
        const { parentPath: oldParentPath, filename: oldFilename } = docUtil.parsePath(oldPath);
        const { parentPath: newParentPath, filename: newFilename } = docUtil.parsePath(newPath);
            
        const result = await pgdb.query(
            'SELECT * FROM vfs_rename($1, $2, $3, $4, $5, $6)',
            owner_id, oldParentPath, oldFilename, newParentPath, newFilename, rootKey
        );
            
        // If the operation wasn't successful, throw an error with the diagnostic message
        if (!result.rows[0].success) {
            throw new Error(`Failed to rename: ${result.rows[0].diagnostic}`);
        }
    }
    
    async unlink(owner_id: number, fullPath: string): Promise<void> {
        try {
            const relativePath = docUtil.normalizePath(fullPath);
            
            // Special case: prevent deletion of root directory
            if (relativePath === '') {
                throw new Error('Cannot unlink root directory');
            }
            
            const { parentPath, filename } = docUtil.parsePath(relativePath);
            
            // Check if the file exists and get its info
            let stats: VFSStats;
            try {
                stats = await this.stat(fullPath);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (error) {
                throw new Error(`File not found: ${fullPath}`);
            }
            
            // unlink should only work on files, not directories
            if (stats.is_directory) {
                throw new Error(`Cannot unlink directory: ${fullPath}. Use rm with recursive option instead.`);
            }
            
            // Delete the file using direct DELETE query
            const result = await pgdb.query(
                'DELETE FROM vfs_nodes WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3 AND is_directory = false AND (owner_id = $4 OR $4 = 0) RETURNING *',
                rootKey, parentPath, filename, owner_id
            );
            
            if (result.rowCount === 0) {
                throw new Error(`Permission denied or file not found: ${fullPath}`);
            }
        } catch (error) {
            console.error('VFS.unlink error:', error);
            throw error;
        }
    }
    
    async rm(owner_id: number, fullPath: string, options?: { recursive?: boolean, force?: boolean }): Promise<void> {
        try {
            const relativePath = docUtil.normalizePath(fullPath);
            
            // Special case: prevent deletion of root directory
            if (relativePath === '') {
                throw new Error('Cannot delete root directory');
            }
            
            const { parentPath, filename } = docUtil.parsePath(relativePath);
            
            // Check if the file/directory exists and get its info
            let stats: VFSStats;
            try {
                stats = await this.stat(fullPath);
            } catch (error) {
                // If force option is enabled, don't throw errors for non-existent files/directories
                if (options?.force) {
                    return;
                }
                throw error;
            }
            
            if (stats.is_directory) {
                // For directories, check if they have children (unless recursive is enabled)
                if (!options?.recursive) {
                    const hasChildren = await this.childrenExist(owner_id, relativePath);
                    if (hasChildren) {
                        throw new Error(`Directory not empty: ${fullPath}. Use recursive option to delete non-empty directories.`);
                    }
                }
                
                // Use a direct DELETE query for now since vfs_rmdir doesn't exist yet
                const result = await pgdb.query(
                    'DELETE FROM vfs_nodes WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3 AND (owner_id = $4 OR $4 = 0) RETURNING *',
                    rootKey, parentPath, filename, owner_id
                );
                
                if (result.rowCount === 0) {
                    throw new Error(`Permission denied or directory not found: ${fullPath}`);
                }
                
                // If recursive, also delete all children
                if (options?.recursive) {
                    const childPath = relativePath;
                    await pgdb.query(
                        'DELETE FROM vfs_nodes WHERE doc_root_key = $1 AND (parent_path = $2 OR parent_path LIKE $3) AND (owner_id = $4 OR $4 = 0)',
                        rootKey, childPath, childPath + '/%', owner_id
                    );
                }
            } else {
                // For files, use direct DELETE query since vfs_unlink doesn't exist yet
                const result = await pgdb.query(
                    'DELETE FROM vfs_nodes WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3 AND (owner_id = $4 OR $4 = 0) RETURNING *',
                    rootKey, parentPath, filename, owner_id
                );
                
                if (result.rowCount === 0) {
                    throw new Error(`Permission denied or file not found: ${fullPath}`);
                }
            }
        } catch (error) {
            // If force option is enabled, don't throw errors for certain types of failures
            if (options?.force && error instanceof Error && 
                (error.message.includes('not found') || error.message.includes('File not found'))) {
                return;
            }
            console.error('VFS.rm error:', error);
            throw error;
        }
    }
    
    /**
     * Shifts ordinals down for all files/folders at or above a given ordinal position
     * This creates space for new files to be inserted at specific positions by
     * incrementing the ordinal values directly in the database.
     * 
     * @param owner_id - The owner ID for authorization
     * @param parentPath - The absolute path to the directory containing items to shift
     * @param insertOrdinal - The ordinal position where we're inserting (files at this position and above get shifted)
     * @param slotsToAdd - Number of ordinal slots to add (shift amount)
     * @returns Map of old relative paths to new relative paths (filenames don't change in VFS, so they map to themselves)
     */
    async shiftOrdinalsDown(owner_id: number, parentPath: string, insertOrdinal: number, slotsToAdd: number): Promise<Map<string, string>> {
        try {
            const relativePath = docUtil.normalizePath(parentPath);
            
            const result = await pgdb.query(
                'SELECT * FROM vfs_shift_ordinals_down($1, $2, $3, $4, $5)',
                owner_id, relativePath, rootKey, insertOrdinal, slotsToAdd
            );
            
            // Create path mapping for compatibility with existing code
            // In VFS, filenames don't change (only ordinals do), so old and new filenames are the same
            const pathMapping = new Map<string, string>();
            
            for (const row of result.rows) {
                // Since filenames don't change in VFS, we map each filename to itself
                const filename = row.old_filename;
                pathMapping.set(filename, filename);
            }
            
            return pathMapping;
        } catch (error) {
            console.error('VFS.shiftOrdinalsDown error:', error);
            throw error;
        }
    }
    
    /**
     * Set the ordinal value for a file/folder record
     * @param uuid - The UUID of the file/folder to update
     * @param ordinal - The new ordinal value to set
     */
    async setOrdinal(uuid: string, ordinal: number): Promise<void> {
        try {
            const result = await pgdb.query(
                'UPDATE vfs_nodes SET ordinal = $1 WHERE uuid = $2 AND doc_root_key = $3 RETURNING *',
                ordinal, uuid, rootKey
            );
            
            if (result.rowCount === 0) {
                throw new Error(`File/folder with UUID ${uuid} not found`);
            }
            
            console.log(`Set ordinal for UUID ${uuid} to ${ordinal}`);
        } catch (error) {
            console.error('VFS.setOrdinal error:', error);
            throw error;
        }
    }
    
    /**
     * Swap the ordinal values of two files/folders in a single atomic operation
     * This safely handles the unique constraint on (doc_root_key, parent_path, ordinal)
     * @param uuid1 - The UUID of the first file/folder
     * @param uuid2 - The UUID of the second file/folder
     * @returns Object containing the UUIDs and their new ordinal values
     */
    async swapOrdinals(uuid1: string, uuid2: string): Promise<{ uuid1: string; ordinal1: number; uuid2: string; ordinal2: number }> {
        try {
            const result = await pgdb.query(
                'SELECT * FROM vfs_swap_ordinals($1, $2, $3)',
                uuid1, uuid2, rootKey
            );
            
            if (result.rows.length === 0) {
                throw new Error(`Failed to swap ordinals for UUIDs ${uuid1} and ${uuid2}`);
            }
            
            const row = result.rows[0];
            console.log(`Swapped ordinals: ${uuid1} (${row.ordinal1}) <-> ${uuid2} (${row.ordinal2})`);
            
            return {
                uuid1: row.uuid1,
                ordinal1: row.ordinal1,
                uuid2: row.uuid2,
                ordinal2: row.ordinal2
            };
        } catch (error) {
            console.error('VFS.swapOrdinals error:', error);
            throw error;
        }
    }

    /**
     * Set the public/private status of a file or folder
     * @param owner_id - The owner ID for authorization
     * @param parentPath - The parent directory path
     * @param filename - The name of the file or folder to update
     * @param is_public - Whether the item should be public (true) or private (false)
     * @param recursive - Whether to apply the change recursively to subdirectories and files
     * @returns Object containing success status and diagnostic message
     */
    async setPublic(owner_id: number, parentPath: string, filename: string, is_public: boolean, recursive: boolean = false): Promise<{ success: boolean; diagnostic: string }> {
        try {
            const relativePath = docUtil.normalizePath(parentPath);
            
            const result = await pgdb.query(
                'SELECT * FROM vfs_set_public($1, $2, $3, $4, $5, $6)',
                owner_id, relativePath, filename, rootKey, is_public, recursive
            );
            
            return {
                success: result.rows[0]?.success || false,
                diagnostic: result.rows[0]?.diagnostic || 'Unknown error'
            };
        } catch (error) {
            console.error('VFS.setPublic error:', error);
            throw error;
        }
    }

    /**
     * Search for text within files in the VFS
     * @param user_id - The user ID for authorization 
     * @param query - The search query string
     * @param treeFolder - The folder path to search within
     * @param rootKey - The root key for the VFS (defaults to "usr")
     * @param searchMode - The search mode (REGEX, MATCH_ANY, MATCH_ALL)
     * @param searchOrder - The search result ordering (MOD_TIME, etc.)
     * @returns Array of search result objects with normalized file paths
     */
    async search(user_id: number, query: string, treeFolder: string, rootKey: string = "usr", searchMode: string = "MATCH_ANY", searchOrder: string = "MOD_TIME"): Promise<any[]> {
        try {
            const result = await pgdb.query(
                'SELECT * FROM vfs_search_text($1, $2, $3, $4, $5, $6)',
                user_id, query, treeFolder, rootKey, searchMode, searchOrder
            );
            
            // Transform results to match the expected format (file-level results without line numbers)
            const transformedResults = result.rows.map((row: any) => ({
                // remove "/" prefix if it exists, to ensure full path is consistent
                file: row.full_path.startsWith("/") ? row.full_path.substring(1) : row.full_path,
            }));
            
            return transformedResults;
        } catch (error) {
            console.error('VFS.search error:', error);
            throw error;
        }
    }
}

const vfs = new VFS();
export default vfs;