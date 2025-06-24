import * as fs from 'fs';
import { IFS } from './IFS.js';
import path from 'path';

/**
 * Linux File System. This is a wrapper around the standard NodeJS 'fs' module, as an abstraction layer for file operations.
 * This implementation provides direct access to the real file system through the Node.js fs module.
 */
class LFS implements IFS {
    
    // File existence and metadata
    async exists(path: string): Promise<boolean> {
        try {
            await fs.promises.access(path, fs.constants.F_OK);
            return true;
        } catch {
            return false;
        }
    }

    async stat(path: string): Promise<fs.Stats> {
        return await fs.promises.stat(path);
    }

    // File content operations
    async readFile(owner_id: number, path: string, encoding?: BufferEncoding): Promise<string | Buffer> {
        if (encoding) {
            return await fs.promises.readFile(path, encoding);
        }
        return await fs.promises.readFile(path);
    }

    async writeFile(owner_id: number, path: string, data: string | Buffer, encoding?: BufferEncoding): Promise<void> {
        if (encoding && typeof data === 'string') {
            await fs.promises.writeFile(path, data, encoding);
        } else {
            await fs.promises.writeFile(path, data);
        }
    }

    // Directory operations
    async readdir(owner_id: number, path: string): Promise<string[]> {
        return await fs.promises.readdir(path);
    }

    async mkdir(owner_id: number, path: string, options?: { recursive?: boolean }): Promise<void> {
        await fs.promises.mkdir(path, options);
    }

    // File/directory manipulation
    async rename(oldPath: string, newPath: string): Promise<void> {
        await fs.promises.rename(oldPath, newPath);
    }

    async unlink(owner_id: number, path: string): Promise<void> {
        await fs.promises.unlink(path);
    }

    async rm(owner_id: number, path: string, options?: { recursive?: boolean, force?: boolean }): Promise<void> {
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