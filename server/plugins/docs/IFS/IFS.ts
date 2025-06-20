
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
    writeFileSync(path: string, data: string | Buffer, encoding?: BufferEncoding): void;

    // Directory operations
    readdirSync(path: string): string[];
    mkdirSync(path: string, options?: { recursive?: boolean }): void;

    // File/directory manipulation
    renameSync(oldPath: string, newPath: string): void;
    unlinkSync(path: string): void;
    rmSync(path: string, options?: { recursive?: boolean, force?: boolean }): void;

    // Async operations (callback-based for compatibility)
    readdir(path: string, callback: (err: NodeJS.ErrnoException | null, files: string[]) => void): void;
    writeFile(path: string, data: string | Buffer, callback: (err: NodeJS.ErrnoException | null) => void): void;
}