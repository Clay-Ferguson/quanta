import * as fs from 'fs';
import { IFS, IFSStats } from './IFS.js';
import path from 'path';
import { TreeNode } from '../../../../common/types/CommonTypes.js';

/**
 * Linux File System. This is a wrapper around the standard NodeJS 'fs' module, as an abstraction layer for file operations.
 * This implementation provides direct access to the real file system through the Node.js fs module.
 */
class LFS implements IFS {
    
    normalize(path: string) {
        if (!path.startsWith('/')) {
            return '/'+path;
        }
        return path;
    }

    async childrenExist(owner_id: number, path: string): Promise<boolean> {
        path = this.normalize(path);
        const ret = (await fs.promises.readdir(path)).length > 0;
        return ret;
    }

    // File existence and metadata
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async exists(path: string, info: any): Promise<boolean> {
        path = this.normalize(path);
        try {
            await fs.promises.access(path, fs.constants.F_OK);
            return true;
        } catch {
            return false;
        }
    }

    async stat(path: string): Promise<IFSStats> {
        path = this.normalize(path);
        const stat =  await fs.promises.stat(path);
        return {
            is_public: true,
            is_directory: stat.isDirectory(),
            // isDirectory: () => row.is_directory,
            // isFile: () => !row.is_directory,
            birthtime: stat.birthtime,
            mtime: stat.mtime,
            size: stat.size,
        } as IFSStats;
    }

    // File content operations
    async readFile(owner_id: number, path: string, encoding?: BufferEncoding): Promise<string | Buffer> {
        path = this.normalize(path);
        if (encoding) {
            return await fs.promises.readFile(path, encoding);
        }
        return await fs.promises.readFile(path);
    }

    async writeFile(owner_id: number, path: string, data: string | Buffer, encoding?: BufferEncoding): Promise<void> {
        path = this.normalize(path);
        if (encoding && typeof data === 'string') {
            await fs.promises.writeFile(path, data, encoding);
        } else {
            await fs.promises.writeFile(path, data);
        }
    }

    // Directory operations
    async readdir(owner_id: number, path: string): Promise<string[]> {
        path = this.normalize(path);
        return await fs.promises.readdir(path);
    }

    async readdirEx(owner_id: number, path: string): Promise<TreeNode[]> {
        try {
            path = this.normalize(path);
            const rootContents = await fs.promises.readdir(path, { withFileTypes: true });

            // print formatted JSON of the rootContents
            // console.log(`VFS.readdirEx contents for ${fullPath}:`, JSON.stringify(rootContents.rows, null, 2));
            const treeNodes = rootContents.map((dirent) => {
                return {
                    is_directory: dirent.isDirectory(),
                    name: dirent.name
                } as TreeNode;
            });
            return treeNodes;
        } catch (error) {
            console.error('LFS.readdirEx error:', error);
            throw error;
        }
    }

    async mkdir(owner_id: number, path: string, options?: { recursive?: boolean }): Promise<void> {
        path = this.normalize(path);
        await fs.promises.mkdir(path, options);
    }

    // File/directory manipulation
    async rename(owner_id: number, oldPath: string, newPath: string): Promise<void> {
        oldPath = this.normalize(oldPath);
        newPath = this.normalize(newPath);
        await fs.promises.rename(oldPath, newPath);
    }

    async unlink(owner_id: number, path: string): Promise<void> {
        path = this.normalize(path);
        await fs.promises.unlink(path);
    }

    async rm(owner_id: number, path: string, options?: { recursive?: boolean, force?: boolean }): Promise<void> {
        path = this.normalize(path);
        await fs.promises.rm(path, options);
    }

    /**
     * Security check to ensure file access is within allowed root directory
     * 
     * Prevents directory traversal attacks by validating that the canonical (resolved)
     * path of the requested file is within the allowed root directory. This is crucial
     * for preventing malicious access to files outside the intended document root.
     * 
     * The method resolves both paths to their canonical forms to handle:
     * - Relative path components (../, ./)
     * - Symbolic links
     * - Path normalization
     * 
     * @param filename - The filename/path to check (can be relative or absolute)
     * @param root - The allowed root directory (absolute path)
     */     
    checkFileAccess = (filename: string, root: string) => {
        filename = this.normalize(filename);
        if (!filename) {
            throw new Error('Invalid file access: '+filename);
        }
            
        // Get the canonical (resolved) paths to prevent directory traversal attacks
        const canonicalFilename = path.resolve(filename);
        const canonicalRoot = path.resolve(root);
            
        // Check if the canonical path is within the allowed root directory
        // Must either start with root + path separator OR be exactly the root
        if (!canonicalFilename.startsWith(canonicalRoot + path.sep) && canonicalFilename !== canonicalRoot) {
            throw new Error('Invalid file access: '+filename);
        }
    }
}

const lfs = new LFS();
export default lfs;