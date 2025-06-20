/* eslint-disable @typescript-eslint/no-unused-vars */
import * as fs from 'fs';
import path from 'path';
import { IFS } from './IFS.js';
import pgdb from '../../../PDGB.js';
import { config } from '../../../Config.js';

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
                'SELECT pg_exists($1, $2, $3)',
                [parentPath, filename, rootKey]
            );
            
            return result.rows[0].pg_exists;
        } catch (error) {
            console.error('VFS.exists error:', error);
            return false;
        }
    }

    async stat(fullPath: string): Promise<fs.Stats> {
        try {
            const { rootKey, relativePath } = this.getRelativePath(fullPath);
            
            // Special case for root directory
            if (relativePath === '') {
                // Return mock stats for root directory
                return {
                    isDirectory: () => true,
                    isFile: () => false,
                    birthtime: new Date(),
                    mtime: new Date(),
                    size: 0
                } as fs.Stats;
            }
            
            const { parentPath, filename } = this.parsePath(relativePath);
            
            const result = await pgdb.query(
                'SELECT * FROM pg_stat($1, $2, $3)',
                [parentPath, filename, rootKey]
            );
            
            if (result.rows.length === 0) {
                throw new Error(`File not found: ${fullPath}`);
            }
            
            const row = result.rows[0];
            
            // Create a mock fs.Stats object with the required properties
            return {
                isDirectory: () => row.is_directory,
                isFile: () => !row.is_directory,
                birthtime: new Date(row.created_time),
                mtime: new Date(row.modified_time),
                size: row.size_bytes || 0
            } as fs.Stats;
        } catch (error) {
            console.error('VFS.stat error:', error);
            throw error;
        }
    }

    // File content operations
    async readFile(fullPath: string, encoding?: BufferEncoding): Promise<string | Buffer> {
        try {
            const { rootKey, relativePath } = this.getRelativePath(fullPath);
            const { parentPath, filename } = this.parsePath(relativePath);
            
            const result = await pgdb.query(
                'SELECT pg_read_file($1, $2, $3)',
                [parentPath, filename, rootKey]
            );
            
            if (result.rows.length === 0) {
                throw new Error(`File not found: ${fullPath}`);
            }
            
            const content = result.rows[0].pg_read_file;
            
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

    async writeFile(path: string, data: string | Buffer, encoding?: BufferEncoding): Promise<void> {
        throw new Error('VFS.writeFile not implemented yet');
    }

    // Directory operations
    async readdir(fullPath: string): Promise<string[]> {
        try {
            const { rootKey, relativePath } = this.getRelativePath(fullPath);
            
            const result = await pgdb.query(
                'SELECT pg_readdir_names($1, $2)',
                [relativePath, rootKey]
            );
            
            return result.rows[0].pg_readdir_names || [];
        } catch (error) {
            console.error('VFS.readdir error:', error);
            throw error;
        }
    }

    async mkdir(_path: string, _options?: { recursive?: boolean }): Promise<void> {
        throw new Error('VFS.mkdir not implemented yet');
    }

    // File/directory manipulation
    async rename(oldPath: string, newPath: string): Promise<void> {
        try {
            const { rootKey: oldRootKey, relativePath: oldRelativePath } = this.getRelativePath(oldPath);
            const { rootKey: newRootKey, relativePath: newRelativePath } = this.getRelativePath(newPath);
            
            // Ensure both paths are in the same root
            if (oldRootKey !== newRootKey) {
                throw new Error('Cannot rename across different VFS roots');
            }
            
            const { parentPath: oldParentPath, filename: oldFilename } = this.parsePath(oldRelativePath);
            const { parentPath: newParentPath, filename: newFilename } = this.parsePath(newRelativePath);
            
            await pgdb.query(
                'SELECT pg_rename($1, $2, $3, $4, $5)',
                [oldParentPath, oldFilename, newParentPath, newFilename, oldRootKey]
            );
        } catch (error) {
            console.error('VFS.rename error:', error);
            throw error;
        }
    }

    async unlink(_path: string): Promise<void> {
        throw new Error('VFS.unlink not implemented yet');
    }

    async rm(_path: string, _options?: { recursive?: boolean, force?: boolean }): Promise<void> {
        throw new Error('VFS.rm not implemented yet');
    }
}

const vfs = new VFS();
export default vfs;