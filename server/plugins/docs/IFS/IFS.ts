
import * as fs from 'fs';

/**
 * Virtual File System Interface
 * 
 * This interface defines all file system operations needed by the docs plugin.
 * Implementations can provide either real file system access (LFS) or PostgreSQL-based virtual file system (VFS).
 */
export interface IFS {
    // File existence and metadata
    exists(path: string): Promise<boolean>;
    stat(path: string): Promise<fs.Stats>;

    // File content operations
    readFile(path: string, encoding?: BufferEncoding): Promise<string | Buffer>;
    writeFile(path: string, data: string | Buffer, encoding?: BufferEncoding): Promise<void>;

    // Directory operations
    readdir(path: string): Promise<string[]>;
    mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;

    // File/directory manipulation
    rename(oldPath: string, newPath: string): Promise<void>;
    unlink(path: string): Promise<void>;
    rm(path: string, options?: { recursive?: boolean, force?: boolean }): Promise<void>;

    checkFileAccess(filename: string, root: string): void;
}