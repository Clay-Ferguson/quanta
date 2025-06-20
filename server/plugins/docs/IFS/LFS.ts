import * as fs from 'fs';
import { IFS } from './IFS.js';

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
    async readFile(path: string, encoding?: BufferEncoding): Promise<string | Buffer> {
        if (encoding) {
            return await fs.promises.readFile(path, encoding);
        }
        return await fs.promises.readFile(path);
    }

    async writeFile(path: string, data: string | Buffer, encoding?: BufferEncoding): Promise<void> {
        if (encoding && typeof data === 'string') {
            await fs.promises.writeFile(path, data, encoding);
        } else {
            await fs.promises.writeFile(path, data);
        }
    }

    // Directory operations
    async readdir(path: string): Promise<string[]> {
        return await fs.promises.readdir(path);
    }

    async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
        await fs.promises.mkdir(path, options);
    }

    // File/directory manipulation
    async rename(oldPath: string, newPath: string): Promise<void> {
        await fs.promises.rename(oldPath, newPath);
    }

    async unlink(path: string): Promise<void> {
        await fs.promises.unlink(path);
    }

    rmSync(path: string, options?: { recursive?: boolean, force?: boolean }): void {
        fs.rmSync(path, options);
    }
}

const lfs = new LFS();
export default lfs;