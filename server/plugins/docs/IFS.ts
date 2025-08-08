import { TreeNode } from "../../../common/types/CommonTypes.js";

// Similar to 'fs.Stats', but for our virtual file system (VFS) or local file system (LFS)
export interface IFSStats {
    is_public?: boolean;
    is_directory: boolean;
    birthtime: Date;
    mtime: Date;
    size: number;
}

/**
 * Virtual File System Interface
 * 
 * This interface defines all file system operations needed by the docs plugin.
 * Implementations can provide either real file system access (LFS) or PostgreSQL-based virtual file system (VFS).
 */
export interface IFS {
    // File existence and metadata
    exists(path: string, info?: any): Promise<boolean>;
    childrenExist(owner_id: number, path: string): Promise<boolean>;

    stat(path: string): Promise<IFSStats>; 

    // File content operations
    readFile(owner_id: number, path: string, encoding?: BufferEncoding): Promise<string | Buffer>;
    writeFile(owner_id: number, path: string, data: string | Buffer, encoding: BufferEncoding): Promise<void>;
    writeFileEx(owner_id: number, path: string, data: string | Buffer, encoding: BufferEncoding, is_public: boolean): Promise<void>;

    // Currently only used by VFS but theoretically could be done in LFS using XATTRS or some other approach.
    getItemByID(uuid: string, rootKey: string): Promise<{ node: TreeNode | null; docPath: string }>;

    // Directory operations
    readdir(owner_id: number, path: string): Promise<string[]>;
    readdirEx(owner_id: number, fullPath: string, loadContent: boolean): Promise<TreeNode[]>;
    mkdir(owner_id: number, path: string, options?: { recursive?: boolean }): Promise<void>;
    mkdirEx(owner_id: number, path: string, options?: { recursive?: boolean }, is_public?: boolean): Promise<void>;

    // File/directory manipulation
    rename(owner_id: number, oldPath: string, newPath: string): Promise<void>;
    unlink(owner_id: number, path: string): Promise<void>;
    rm(owner_id: number, path: string, options?: { recursive?: boolean, force?: boolean }): Promise<void>;

    pathJoin(...parts: string[]): string;
    normalizePath(fullPath: string): string;

    checkFileAccess(filename: string, root: string): void;
}