/* eslint-disable @typescript-eslint/no-unused-vars */
import * as fs from 'fs';
import path from 'path';
import { IFS } from '../IFS/IFS.js'
import pgdb from '../../../PGDB.js';
import { config } from '../../../Config.js';
import { TreeNode } from '../../../../common/types/CommonTypes.js';

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
        const normalizedPath = path.normalize(fullPath);
        const parentPath = path.dirname(normalizedPath);
        const filename = path.basename(normalizedPath);
        
        // Convert root parent path to empty string for PostgreSQL functions
        const pgParentPath = parentPath === '/' ? '' : parentPath;
        
        return { parentPath: pgParentPath, filename };
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

    /**
     * Convert full path to relative path within the VFS root
     * @param fullPath - The full absolute path
     * @returns Object with rootKey and relativePath
     */
    private getRelativePath(fullPath: string): { rootKey: string; relativePath: string } {
        const roots = config.getPublicFolders();
        
        for (const root of roots) {
            if (root.type === 'vfs' && fullPath.startsWith(root.path)) {
                const relativePath = path.relative(root.path, fullPath);
                // Convert to parent/filename format for PostgreSQL
                if (relativePath === '') {
                    // This is the root directory itself
                    return { rootKey: root.key, relativePath: '' };
                }
                return { rootKey: root.key, relativePath: '/' + relativePath.replace(/\\/g, '/') };
            }
        }
        
        throw new Error(`No VFS root found for path: ${fullPath}`);
    }

    // File existence and metadata
    async exists(fullPath: string): Promise<boolean> {
        try {
            const { rootKey, relativePath } = this.getRelativePath(fullPath);
            
            // Special case for root directory
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

    // todo-0: We need a wrapper around 'fs.Stats' so the API is clean and can abstract to LFS and VFS. For now we use 'any'
    async stat(fullPath: string): Promise<any> { // <fs.Stats> {
        try {
            const { rootKey, relativePath } = this.getRelativePath(fullPath);
            
            // Special case for root directory
            if (relativePath === '') {
                // Return mock stats for root directory
                return {
                    // Root is considered owned by admin and not public.
                    is_public: false,
                    isDirectory: () => true,
                    isFile: () => false,
                    birthtime: new Date(),
                    mtime: new Date(),
                    size: 0
                } as any; //as fs.Stats;
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
            
            // Create a mock fs.Stats object with the required properties
            return {
                is_public: row.is_public,
                isDirectory: () => row.is_directory,
                isFile: () => !row.is_directory,
                birthtime: new Date(row.created_time),
                mtime: new Date(row.modified_time),
                size: row.size_bytes || 0
            }; // as fs.Stats;
        } catch (error) {
            console.error('VFS.stat error:', error);
            throw error;
        }
    }

    // File content operations
    async readFile(owner_id: number, fullPath: string, encoding?: BufferEncoding): Promise<string | Buffer> {
        try {
            const { rootKey, relativePath } = this.getRelativePath(fullPath);
            const { parentPath, filename } = this.parsePath(relativePath);
            
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
        try {
            const { rootKey, relativePath } = this.getRelativePath(fullPath);
            const { parentPath, filename } = this.parsePath(relativePath);
            
            // Determine if this is a binary file based on extension
            const ext = path.extname(filename).toLowerCase();
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
            const { rootKey, relativePath } = this.getRelativePath(fullPath);
            
            const result = await pgdb.query(
                'SELECT vfs_readdir_names($1, $2, $3)',
                owner_id, relativePath, rootKey
            );
            
            return result.rows[0].vfs_readdir_names || [];
        } catch (error) {
            console.error('VFS.readdir error:', error);
            throw error;
        }
    }

    // Special version with no 'LFS' equivalent called only from Docs plugin
    // todo-0: for the treeRender method we can use this to get CONTENTS instad of doing a read of the file records one by one.
    async readdirEx(owner_id: number, fullPath: string): Promise<TreeNode[]> {
        try {
            const { rootKey, relativePath } = this.getRelativePath(fullPath);
            
            const rootContents = await pgdb.query(
                'SELECT * FROM vfs_readdir($1, $2, $3)',
                owner_id, relativePath, rootKey
            );
            const treeNodes = rootContents.rows.map((row: any) => {
                // Convert PostgreSQL row to TreeNode format
                return {
                    is_public: row.is_public,
                    name: row.filename, 
                    createTime: row.created_time,
                    modifyTime: row.modified_time,
                    content: row.content,
                    type: row.is_directory ? 'folder' : 'text', // todo-0: need to make 'type' column just be an 'is_directory' boolean
                } as TreeNode;
            });
            return treeNodes;
        } catch (error) {
            console.error('VFS.readdirEx error:', error);
            throw error;
        }
    }

    async mkdir(owner_id: number, fullPath: string, options?: { recursive?: boolean }): Promise<void> {
        try {
            const { rootKey, relativePath } = this.getRelativePath(fullPath);
            const { parentPath, filename } = this.parsePath(relativePath);
            
            // The PostgreSQL function expects directories to have ordinal prefixes
            // If the filename doesn't have one, we need to generate it
            let finalFilename = filename;
            if (!filename.match(/^[0-9]+_/)) {
                // Get the next ordinal for this directory
                const maxOrdinalResult = await pgdb.query(
                    'SELECT vfs_get_max_ordinal($1, $2)',
                    parentPath, rootKey
                );
                const maxOrdinal = maxOrdinalResult.rows[0].vfs_get_max_ordinal || 0;
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
        // console.log('VFS.rename:', oldPath, '->', newPath);
        const { rootKey: oldRootKey, relativePath: oldRelativePath } = this.getRelativePath(oldPath);
        const { rootKey: newRootKey, relativePath: newRelativePath } = this.getRelativePath(newPath);
            
        // Ensure both paths are in the same root
        if (oldRootKey !== newRootKey) {
            throw new Error('Cannot rename across different VFS roots');
        }
            
        const { parentPath: oldParentPath, filename: oldFilename } = this.parsePath(oldRelativePath);
        const { parentPath: newParentPath, filename: newFilename } = this.parsePath(newRelativePath);
            
        const result = await pgdb.query(
            'SELECT * FROM vfs_rename($1, $2, $3, $4, $5, $6)',
            owner_id, oldParentPath, oldFilename, newParentPath, newFilename, oldRootKey
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
            const { rootKey, relativePath } = this.getRelativePath(fullPath);
            const { parentPath, filename } = this.parsePath(relativePath);
            
            await pgdb.query(
                'SELECT vfs_unlink($1, $2, $3, $4)',
                owner_id, parentPath, filename, rootKey
            );
        } catch (error) {
            console.error('VFS.unlink error:', error);
            throw error;
        }
    }

    async rm(owner_id: number, fullPath: string, options?: { recursive?: boolean, force?: boolean }): Promise<void> {
        try {
            const { rootKey, relativePath } = this.getRelativePath(fullPath);
            const { parentPath, filename } = this.parsePath(relativePath);
            
            // Check if this is a directory or file
            const stats = await this.stat(fullPath);
            
            if (stats.isDirectory()) {
                // Use vfs_rmdir for directories
                await pgdb.query(
                    'SELECT vfs_rmdir($1, $2, $3, $4, $5)',
                    parentPath, filename, rootKey, options?.recursive || false, options?.force || false
                );
            } else {
                // Use vfs_unlink for files
                await pgdb.query(
                    'SELECT vfs_unlink($1, $2, $3, $4)',
                    owner_id, parentPath, filename, rootKey
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

    checkFileAccess(filename: string, root: string): void {
        // NOTE to AI: Do not try to implement this method, it is not needed for VFS. It needs to remain a no-op.
    }
}

const vfs = new VFS();
export default vfs;