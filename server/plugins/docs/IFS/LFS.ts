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
    readFileSync(path: string, encoding?: BufferEncoding): string | Buffer {
        if (encoding) {
            return fs.readFileSync(path, encoding);
        }
        return fs.readFileSync(path);
    }

    writeFileSync(path: string, data: string | Buffer, encoding?: BufferEncoding): void {
        if (encoding && typeof data === 'string') {
            fs.writeFileSync(path, data, encoding);
        } else {
            fs.writeFileSync(path, data);
        }
    }

    // Directory operations
    readdirSync(path: string): string[] {
        return fs.readdirSync(path);
    }

    mkdirSync(path: string, options?: { recursive?: boolean }): void {
        fs.mkdirSync(path, options);
    }

    // File/directory manipulation
    renameSync(oldPath: string, newPath: string): void {
        fs.renameSync(oldPath, newPath);
    }

    unlinkSync(path: string): void {
        fs.unlinkSync(path);
    }

    rmSync(path: string, options?: { recursive?: boolean, force?: boolean }): void {
        fs.rmSync(path, options);
    }

    // Async operations (callback-based for compatibility)
    readdir(path: string, callback: (err: NodeJS.ErrnoException | null, files: string[]) => void): void {
        fs.readdir(path, callback);
    }

    writeFile(path: string, data: string | Buffer, callback: (err: NodeJS.ErrnoException | null) => void): void {
        fs.writeFile(path, data, callback);
    }
}

const lfs = new LFS();
export default lfs;