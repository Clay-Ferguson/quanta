import * as fs from 'fs';
import { IVFS } from './IVFS.js';

/**
 * Linux File System. This is a wrapper around the standard NodeJS 'fs' module, as an abstraction layer for file operations.
 * This implementation provides direct access to the real file system through the Node.js fs module.
 */
class LFS implements IVFS {
    
    // File existence and metadata
    existsSync(path: string): boolean {
        return fs.existsSync(path);
    }

    statSync(path: string): fs.Stats {
        return fs.statSync(path);
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