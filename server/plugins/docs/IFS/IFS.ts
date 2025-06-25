
// import * as fs from 'fs';

/**
 * Virtual File System Interface
 * 
 * This interface defines all file system operations needed by the docs plugin.
 * Implementations can provide either real file system access (LFS) or PostgreSQL-based virtual file system (VFS).
 */
export interface IFS {
    // File existence and metadata
    exists(path: string): Promise<boolean>;
    stat(path: string): Promise<any>; //<fs.Stats>; // todo-0: We need a wrapper around 'fs.Stats' so the API is clean and can abstract to LFS and VFS. For now we use 'any'

    // File content operations
    readFile(owner_id: number, path: string, encoding?: BufferEncoding): Promise<string | Buffer>;
    writeFile(owner_id: number, path: string, data: string | Buffer, encoding?: BufferEncoding): Promise<void>;

    // Directory operations
    readdir(owner_id: number, path: string): Promise<string[]>;
    mkdir(owner_id: number, path: string, options?: { recursive?: boolean }): Promise<void>;

    // File/directory manipulation
    rename(owner_id: number, oldPath: string, newPath: string): Promise<void>;
    unlink(owner_id: number, path: string): Promise<void>;
    rm(owner_id: number, path: string, options?: { recursive?: boolean, force?: boolean }): Promise<void>;

    checkFileAccess(filename: string, root: string): void;
}