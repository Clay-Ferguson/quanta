import { IFS, IFSStats } from '../IFS/IFS.js'
import pgdb from '../../../PGDB.js';
import { config } from '../../../Config.js';
import { TreeNode, UserProfileCompact } from '../../../../common/types/CommonTypes.js';
import { svrUtil } from '../../../ServerUtil.js';
import { docSvc } from '../DocService.js';

const rootKey = "usr"; // Default root key for VFS, can be changed based on configuration

/**
 * Virtual File System (VFS) for handling file operations in a server environment, by using PostgreSQL as a backend for storage of files and folders.
 */
class VFS implements IFS {
    /**
     * Parse a full path to extract parent path and filename
     * @param fullPath - The full absolute path 
     * @returns Object with parentPath and filename
     */
    private parsePath(fullPath: string): { parentPath: string; filename: string } {
        const normalizedPath = svrUtil.normalizePath(fullPath);

        // Split the path into parent directory and filename, using string functions, by finding the last slash
        const lastSlashIndex = normalizedPath.lastIndexOf('/');
        let parentPath: string;
        let filename: string;
        if (lastSlashIndex === -1) {
            // No slashes found, this is just a filename
            parentPath = '';
            filename = normalizedPath;
        } else {
            // Split into parent path and filename
            parentPath = normalizedPath.slice(0, lastSlashIndex);
            filename = normalizedPath.slice(lastSlashIndex + 1);
        }
        
        return { parentPath, filename };
    }

    /**
     * Get the root key for the given path by finding which configured root contains this path
     * @param fullPath - The full absolute path
     * @returns The root key for this path
     */
    private getRootKeyForPath(fullPath: string): string {
        const roots = config.getPublicFolders();
        
        for (const root of roots) {
            if (root.type === 'vfs' && fullPath.startsWith(root.path)) {
                return root.key;
            }
        }
        
        throw new Error(`No VFS root found for path: ${fullPath}`);
    }

    async childrenExist(owner_id: number, path: string): Promise<boolean> {
        try {
            const relativePath = svrUtil.normalizePath(path);
            
            // Special case for root directory
            if (relativePath === '') {
                return true;
            }
            const result = await pgdb.query(
                'SELECT vfs_children_exist($1, $2, $3)',
                pgdb.authId(owner_id), relativePath, rootKey
            );
            
            return result.rows[0].vfs_children_exist;
        } catch (error) {
            console.error('VFS.children_exist error:', error);
            return false;
        }
    }

    // File existence and metadata
    async exists(fullPath: string, info: any=null): Promise<boolean> {
        // if a non-info object was passed the caller needs additional info so we run getNodeByName
        // which returns the whole record.
        console.log('VFS.exists:', fullPath, 'info:', info);
        if (info) {
            const node = await this.getNodeByName(fullPath);
            if (node) {
                info.node = node; // Attach the node to the info object
                return true; // File exists
            }
            return false; // File does not exist
        }

        try {
            const relativePath = svrUtil.normalizePath(fullPath);
            
            // Special case for root directory. It always exists and we have no DB table 'row' for it.
            if (relativePath === '') {
                return true;
            }
            
            const { parentPath, filename } = this.parsePath(relativePath);
            
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

    async getNodeByName(fullPath: string): Promise<any | null> {
        try {
            const relativePath = svrUtil.normalizePath(fullPath);
            
            // Special case for root directory. It always exists and we have no DB table 'row' for it.
            if (relativePath === '') {
                return {}; // Root directory has no database row
            }
            
            const { parentPath, filename } = this.parsePath(relativePath);
            
            pgdb.logEnabled = true;
            const result = await pgdb.query(
                'SELECT * FROM vfs_get_node_by_name($1, $2, $3)',
                parentPath, filename, rootKey
            );
            pgdb.logEnabled = false;
            
            // Return the first row if found, null if no rows returned
            return result.rows.length > 0 ? result.rows[0] : null;
        } catch (error) {
            console.error('VFS.getNodeByName error:', error);
            return null;
        }
    }

    async stat(fullPath: string): Promise<IFSStats> { 
        try {
            const relativePath = svrUtil.normalizePath(fullPath);
            
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
                } as IFSStats;
            }
            
            const { parentPath, filename } = this.parsePath(relativePath);
            const result = await pgdb.query(
                'SELECT * FROM vfs_stat($1, $2, $3)',
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
            } as IFSStats;
        } catch (error) {
            console.error('VFS.stat error:', error);
            throw error;
        }
    }

    // File content operations
    async readFile(owner_id: number, fullPath: string, encoding?: BufferEncoding): Promise<string | Buffer> {
        try {
            const { parentPath, filename } = this.parsePath(fullPath);
            
            const result = await pgdb.query(
                'SELECT vfs_read_file($1, $2, $3, $4)',
                pgdb.authId(owner_id), parentPath, filename, rootKey
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
        try {
            const { parentPath, filename } = this.parsePath(fullPath);
            
            // Determine if this is a binary file based on extension
            const ext = svrUtil.getFilenameExtension(filename).toLowerCase();

            // todo-1: What we need instead of this is an 'isTextFile' because it's a shorter list and everythin else is binary.
            const isBinary = this.isBinaryFile(ext);
            
            // Determine content type based on file extension
            const contentType = this.getContentType(ext);
            
            if (isBinary) {
                // Handle binary files
                let content: Buffer;
                if (typeof data === 'string') {
                    content = Buffer.from(data, encoding || 'utf8');
                } else {
                    content = data;
                }
                
                await pgdb.query(
                    'SELECT vfs_write_binary_file($1, $2, $3, $4, $5, $6)',
                    owner_id, parentPath, filename, content, rootKey, contentType
                );
            } else {
                // Handle text files
                let textContent: string;
                if (typeof data === 'string') {
                    textContent = data;
                } else {
                    textContent = data.toString(encoding || 'utf8');
                }
                
                await pgdb.query(
                    'SELECT vfs_write_text_file($1, $2, $3, $4, $5, $6)',
                    owner_id, parentPath, filename, textContent, rootKey, contentType
                );
            }
        } catch (error) {
            console.error('VFS.writeFile error:', error);
            throw error;
        }
    }

    /**
     * Determine if a file is binary based on its extension
     */
    private isBinaryFile(ext: string): boolean {
        const binaryExtensions = [
            '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.tiff', '.webp',
            '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
            '.zip', '.tar', '.gz', '.rar', '.7z',
            '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv',
            '.exe', '.dll', '.so', '.dylib',
            '.woff', '.woff2', '.ttf', '.otf'
        ];
        
        return binaryExtensions.includes(ext.toLowerCase());
    }

    /**
     * Get content type based on file extension
     */
    private getContentType(ext: string): string {
        switch (ext.toLowerCase()) {
        case '.md':
            return 'text/markdown';
        case '.txt':
            return 'text/plain';
        case '.json':
            return 'application/json';
        case '.html':
        case '.htm':
            return 'text/html';
        case '.css':
            return 'text/css';
        case '.js':
            return 'application/javascript';
        case '.ts':
            return 'text/typescript';
        case '.xml':
            return 'application/xml';
        case '.yaml':
        case '.yml':
            return 'application/yaml';
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.png':
            return 'image/png';
        case '.gif':
            return 'image/gif';
        case '.pdf':
            return 'application/pdf';
        case '.zip':
            return 'application/zip';
        case '.mp3':
            return 'audio/mpeg';
        case '.mp4':
            return 'video/mp4';
        default:
            return 'application/octet-stream';
        }
    }

    // Directory operations
    async readdir(owner_id: number, fullPath: string): Promise<string[]> {
        try {
            const relativePath = svrUtil.normalizePath(fullPath);
            
            const result = await pgdb.query(
                'SELECT vfs_readdir_names($1, $2, $3)',
                pgdb.authId(owner_id), relativePath, rootKey
            );
            
            return result.rows[0].vfs_readdir_names || [];
        } catch (error) {
            console.error('VFS.readdir error:', error);
            throw error;
        }
    }

    // Special version with no 'LFS' equivalent called only from Docs plugin
    async readdirEx(owner_id: number, fullPath: string): Promise<TreeNode[]> {
        try {
            const relativePath = svrUtil.normalizePath(fullPath);
            
            const rootContents = await pgdb.query(
                'SELECT * FROM vfs_readdir($1, $2, $3)',
                pgdb.authId(owner_id), relativePath, rootKey
            );
            // print formatted JSON of the rootContents
            // console.log(`VFS.readdirEx contents for ${fullPath}:`, JSON.stringify(rootContents.rows, null, 2));
            const treeNodes = rootContents.rows.map((row: any) => {
                // Convert PostgreSQL row to TreeNode format
                // todo-0: need a "Row Converter" class that can convert any row to a TreeNode
                return {
                    owner_id: row.owner_id,
                    is_public: row.is_public,
                    is_directory: row.is_directory,
                    name: row.filename, 
                    createTime: row.created_time,
                    modifyTime: row.modified_time,
                    content: row.content,
                } as TreeNode;
            });
            return treeNodes;
        } catch (error) {
            console.error('VFS.readdirEx error:', error);
            throw error;
        }
    }

    /**
     * Gets the maximum ordinal value for files/folders in a directory
     * Useful for creating new items with the next available ordinal
     * @param fullPath - The directory path to check
     * @returns The maximum ordinal value (0 if no files with ordinals exist)
     */
    async getMaxOrdinal(fullPath: string): Promise<number> {
        try {
            const relativePath = svrUtil.normalizePath(fullPath);
            // console.log(`VFS.getMaxOrdinal: fullPath=[${fullPath}], relativePath=[${relativePath}], rootKey=[${rootKey}]`);
            
            const result = await pgdb.query(
                'SELECT vfs_get_max_ordinal($1, $2)',
                relativePath, rootKey
            );
            
            return result.rows[0].vfs_get_max_ordinal || 0;
        } catch (error) {
            console.error('VFS.getMaxOrdinal error:', error);
            return 0; // Return 0 as default if there's an error
        }
    }

    async mkdir(owner_id: number, fullPath: string, options?: { recursive?: boolean }): Promise<void> {
        try {
            const { parentPath, filename } = this.parsePath(fullPath);
            
            // The PostgreSQL function expects directories to have ordinal prefixes
            // If the filename doesn't have one, we need to generate it
            let finalFilename = filename;
            if (!filename.match(/^[0-9]+_/)) {
                // Get the next ordinal for this directory using our wrapper method
                // Find the full path for the parent directory
                const root = config.getPublicFolderByKey(rootKey);
                const fullParentPath = svrUtil.pathJoin(
                    root?.path || '',
                    parentPath
                );
                const maxOrdinal = await this.getMaxOrdinal(fullParentPath);
                const nextOrdinal = maxOrdinal + 1;
                const ordinalPrefix = nextOrdinal.toString().padStart(4, '0');
                finalFilename = `${ordinalPrefix}_${filename}`;
            }
            
            await pgdb.query(
                'SELECT vfs_mkdir($1, $2, $3, $4, $5)',
                owner_id, parentPath, finalFilename, rootKey, options?.recursive || false
            );
        } catch (error) {
            console.error('VFS.mkdir error:', error);
            throw error;
        }
    }

    // File/directory manipulation
    async rename(owner_id: number, oldPath: string, newPath: string): Promise<void> {
        if (!svrUtil.validPath(newPath)) {
            throw new Error(`Invalid new path: ${newPath}. Only alphanumeric characters and underscores`);
        }
        // console.log('VFS.rename:', oldPath, '->', newPath);    
        const { parentPath: oldParentPath, filename: oldFilename } = this.parsePath(oldPath);
        const { parentPath: newParentPath, filename: newFilename } = this.parsePath(newPath);
            
        const result = await pgdb.query(
            'SELECT * FROM vfs_rename($1, $2, $3, $4, $5, $6)',
            pgdb.authId(owner_id), oldParentPath, oldFilename, newParentPath, newFilename, rootKey
        );
            
        // Log the diagnostic information
        // console.log(`VFS rename diagnostic: ${result.rows[0].diagnostic}`);
            
        // If the operation wasn't successful, throw an error with the diagnostic message
        if (!result.rows[0].success) {
            throw new Error(`Failed to rename: ${result.rows[0].diagnostic}`);
        }
    }

    async unlink(owner_id: number, fullPath: string): Promise<void> {
        try {
            const { parentPath, filename } = this.parsePath(fullPath);
            
            await pgdb.query(
                'SELECT vfs_unlink($1, $2, $3, $4)',
                pgdb.authId(owner_id), parentPath, filename, rootKey
            );
        } catch (error) {
            console.error('VFS.unlink error:', error);
            throw error;
        }
    }

    async rm(owner_id: number, fullPath: string, options?: { recursive?: boolean, force?: boolean }): Promise<void> {
        try {
            const { parentPath, filename } = this.parsePath(fullPath);
            
            // Check if this is a directory or file
            const stats = await this.stat(fullPath);
            
            if (stats.is_directory) {
                // Use vfs_rmdir for directories
                await pgdb.query(
                    'SELECT vfs_rmdir($1, $2, $3, $4, $5)',
                    pgdb.authId(owner_id), parentPath, filename, rootKey, options?.recursive || false, options?.force || false
                );
            } else {
                // Use vfs_unlink for files
                await pgdb.query(
                    'SELECT vfs_unlink($1, $2, $3, $4)',
                    pgdb.authId(owner_id), parentPath, filename, rootKey
                );
            }
        } catch (error) {
            // If force option is enabled, don't throw errors for non-existent files/directories
            if (options?.force && error instanceof Error && error.message.includes('not found')) {
                return;
            }
            console.error('VFS.rm error:', error);
            throw error;
        }
    }

    // todo-0: We should really create a subfolder named "u" that contains all user folders, so that we can have a single root, and admin 
    // remains free to own all the rest of the root.
    async createUserFolder(userProfile: UserProfileCompact) {
        // todo-0: NOTE: Currently if user changes their username this will lead to left over abandoned folders with the old name, so really what we need here
        // is to find ANY folder in the root that matches the user_id, and then that's their root. The fact that it doesn't get renamed when they
        // rename their user name is a separate problem to be solved.
        console.log(`Creating user folder for: ${userProfile.name} (ID: ${userProfile.id})`);
        const rootKey = "usr";

        // Throw an error if 'userProfile.name' is not a valid filename containing only alphanumeric characters and underscores.
        if (!/^[a-zA-Z0-9_]+$/.test(userProfile.name)) {
            throw new Error(`Invalid user name: ${userProfile.name}. Only alphanumeric characters and underscores are allowed.`);
        }

        // Check for already existing user folder
        const docPath = await docSvc.resolveNonOrdinalPath(0, rootKey, userProfile.name);
        if (docPath) {
            console.log(`Resolved docPath: ${docPath}`);
            if (await this.exists(docPath)) {
                console.log(`User folder already exists: ${docPath}`);
                return; 
            }
        }

        let maxOrdinal = await this.getMaxOrdinal(""); 
        maxOrdinal++;
        const maxOrdinalStr = maxOrdinal.toString().padStart(4, '0');

        await pgdb.query(
            'SELECT vfs_mkdir($1, $2, $3, $4, $5)',
            userProfile.id, "", `${maxOrdinalStr}_${userProfile.name}`, rootKey, false
        );
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    checkFileAccess(filename: string, root: string): void {
        // NOTE to AI: Do not try to implement this method, it is not needed for VFS. It needs to remain a no-op.
    }
}

const vfs = new VFS();
export default vfs;