/* eslint-disable @typescript-eslint/no-unused-vars */
import * as fs from 'fs';
import { IVFS } from './IVFS.js';

/**
 * Virtual File System (VFS) for handling file operations in a server environment, by using PostgreSQL as a backend for storage of files and folders.
 */
class VFS implements IVFS {
    // Note to AI Agent. Do not try to implement this yet.
    
    // File existence and metadata
    existsSync(_path: string): boolean {
        throw new Error('VFS.existsSync not implemented yet');
    }

    statSync(_path: string): fs.Stats {
        throw new Error('VFS.statSync not implemented yet');
    }

    // File content operations
    readFileSync(_path: string, _encoding?: BufferEncoding): string | Buffer {
        throw new Error('VFS.readFileSync not implemented yet');
    }

    writeFileSync(_path: string, _data: string | Buffer, _encoding?: BufferEncoding): void {
        throw new Error('VFS.writeFileSync not implemented yet');
    }

    // Directory operations
    readdirSync(_path: string): string[] {
        throw new Error('VFS.readdirSync not implemented yet');
    }

    mkdirSync(_path: string, _options?: { recursive?: boolean }): void {
        throw new Error('VFS.mkdirSync not implemented yet');
    }

    // File/directory manipulation
    renameSync(_oldPath: string, _newPath: string): void {
        throw new Error('VFS.renameSync not implemented yet');
    }

    unlinkSync(_path: string): void {
        throw new Error('VFS.unlinkSync not implemented yet');
    }

    rmSync(_path: string, _options?: { recursive?: boolean, force?: boolean }): void {
        throw new Error('VFS.rmSync not implemented yet');
    }

    // Async operations (callback-based for compatibility)
    readdir(_path: string, callback: (err: NodeJS.ErrnoException | null, files: string[]) => void): void {
        callback(new Error('VFS.readdir not implemented yet'), []);
    }

    writeFile(_path: string, _data: string | Buffer, callback: (err: NodeJS.ErrnoException | null) => void): void {
        callback(new Error('VFS.writeFile not implemented yet'));
    }
}

const vfs = new VFS();
export default vfs;