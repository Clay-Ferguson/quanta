/* eslint-disable @typescript-eslint/no-unused-vars */
import * as fs from 'fs';
import { IFS } from './IFS.js';

/**
 * Virtual File System (VFS) for handling file operations in a server environment, by using PostgreSQL as a backend for storage of files and folders.
 */
class VFS implements IFS {
    // Note to AI Agent. Do not try to implement this yet.
    
    // File existence and metadata
    async exists(_path: string): Promise<boolean> {
        throw new Error('VFS.existsSync not implemented yet');
    }

    async stat(_path: string): Promise<fs.Stats> {
        throw new Error('VFS.statSync not implemented yet');
    }

    // File content operations
    async readFile(_path: string, _encoding?: BufferEncoding):Promise<string | Buffer> {
        throw new Error('VFS.readFileSync not implemented yet');
    }

    async writeFile(path: string, data: string | Buffer, encoding?: BufferEncoding): Promise<void> {
        throw new Error('VFS.writeFileSync not implemented yet');
    }

    // Directory operations
    async readdir(_path: string): Promise<string[]> {
        throw new Error('VFS.readdirSync not implemented yet');
    }

    async mkdir(_path: string, _options?: { recursive?: boolean }): Promise<void> {
        throw new Error('VFS.mkdirSync not implemented yet');
    }

    // File/directory manipulation
    async rename(_oldPath: string, _newPath: string): Promise<void> {
        throw new Error('VFS.renameSync not implemented yet');
    }

    unlinkSync(_path: string): void {
        throw new Error('VFS.unlinkSync not implemented yet');
    }

    rmSync(_path: string, _options?: { recursive?: boolean, force?: boolean }): void {
        throw new Error('VFS.rmSync not implemented yet');
    }
}

const vfs = new VFS();
export default vfs;