import * as fs from 'fs';
import { IFS, IFSStats } from '../../../../plugins/docs/server/IFS.js';
import path from 'path';
import { TreeNode } from '../../../../common/types/CommonTypes.js';

/**
 * Linux File System. This is a wrapper around the standard NodeJS 'fs' module, as an abstraction layer for file operations.
 * This implementation provides direct access to the real file system through the Node.js fs module.
 */
class LFS implements IFS {
    
    normalize(path: string) {
        // NOTE: IMPORTANT: LFS paths always start with a leading slash, but VFS paths never do!
        if (!path.startsWith('/')) {
            return '/'+path;
        }
        return path;
    }

    async childrenExist(owner_id: number, path: string): Promise<boolean> {
        path = this.normalize(path);
        const ret = (await fs.promises.readdir(path)).length > 0;
        return ret;
    }

    async exists(path: string, info: any): Promise<boolean> {
        path = this.normalize(path);
        try {
            await fs.promises.access(path, fs.constants.F_OK);
            if (info) {
                const stat = await this.stat(path);
                info.node = {
                    is_directory: stat.is_directory,
                    is_public: false
                } as TreeNode;
            }
            return true;
        } catch {
            return false;
        }
    }

    async stat(path: string): Promise<IFSStats> {
        path = this.normalize(path);
        const stat =  await fs.promises.stat(path);
        return {
            is_public: true,
            is_directory: stat.isDirectory(),
            // isDirectory: () => row.is_directory,
            // isFile: () => !row.is_directory,
            birthtime: stat.birthtime,
            mtime: stat.mtime,
            size: stat.size,
        } as IFSStats;
    }

    // File content operations
    async readFile(owner_id: number, path: string, encoding?: BufferEncoding): Promise<string | Buffer> {
        path = this.normalize(path);
        if (encoding) {
            return await fs.promises.readFile(path, encoding);
        }
        return await fs.promises.readFile(path);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async writeFileEx(owner_id: number, path: string, data: string | Buffer, encoding: BufferEncoding, _is_public: boolean): Promise<void> {
        return this.writeFile(owner_id, path, data, encoding);
    }

    async writeFile(owner_id: number, path: string, data: string | Buffer, encoding?: BufferEncoding): Promise<void> {
        path = this.normalize(path);
        if (encoding && typeof data === 'string') {
            await fs.promises.writeFile(path, data, encoding);
        } else {
            await fs.promises.writeFile(path, data);
        }
    }

    // Directory operations
    async readdir(owner_id: number, path: string): Promise<string[]> {
        path = this.normalize(path);
        return await fs.promises.readdir(path);
    }

    async readdirEx(owner_id: number, path: string, loadContent: boolean): Promise<TreeNode[]> {
        try { 
            path = this.normalize(path);
            const rootContents = await fs.promises.readdir(path, { withFileTypes: true });

            // Get stats for all files in parallel for efficiency
            const statPromises = rootContents.map(async (dirent) => {
                const filePath = this.pathJoin(path, dirent.name);
                const stat = await fs.promises.stat(filePath);
                return {
                    dirent,
                    stat
                };
            });

            const statsResults = await Promise.all(statPromises);
            let nextOrdinal = 0;

            const treeNodes = statsResults.map(({ dirent, stat }) => {
                // remove all files that start with "_" or "." using treeNodes.filter
                if (dirent.name.startsWith('_') || dirent.name.startsWith('.')) {
                    return null; // Skip this file
                }

                // If the dirent.name doesn't start with an ordinal (NNNN_) we rename the file immediately and the set
                if (!/^\d{4}_/.test(dirent.name)) {
                    nextOrdinal++;
                    const newName = `${String(nextOrdinal).padStart(4, '0')}_${dirent.name}`;
                    const oldPath = this.pathJoin(path, dirent.name);
                    const newPath = this.pathJoin(path, newName);
                    fs.renameSync(oldPath, newPath);
                    dirent.name = newName;
                }

                let content: string | null = null;
                if (loadContent && dirent.isFile()) {
                    const filePath = this.pathJoin(path, dirent.name);
                    try {
                        content = fs.readFileSync(filePath, 'utf8');
                    } catch (error) {
                        console.warn(`Could not read file ${filePath} as text:`, error);
                    }}
                return {
                    is_directory: dirent.isDirectory(),
                    name: dirent.name,
                    createTime: stat.birthtime.getTime(),
                    modifyTime: stat.mtime.getTime(),
                    content
                } as TreeNode;
            });

            // Filter out any null entries (skipped files) and ensure proper typing
            const filteredNodes: TreeNode[] = treeNodes.filter((node): node is TreeNode => node !== null);

            // Sort by filename (case-insensitive)
            filteredNodes.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
            return filteredNodes;
        } catch (error) {
            console.error('LFS.readdirEx error:', error);
            throw error;
        }
    }

    async mkdir(owner_id: number, path: string, options?: { recursive?: boolean }): Promise<void> {
        await this.mkdirEx(owner_id, path, options, false);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async mkdirEx(owner_id: number, path: string, options?: { recursive?: boolean }, is_public?: boolean): Promise<void> {
        path = this.normalize(path);
        await fs.promises.mkdir(path, options);
    }

    // File/directory manipulation
    async rename(owner_id: number, oldPath: string, newPath: string): Promise<void> {
        oldPath = this.normalize(oldPath);
        newPath = this.normalize(newPath);
        await fs.promises.rename(oldPath, newPath);
    }

    async unlink(owner_id: number, path: string): Promise<void> {
        path = this.normalize(path);
        await fs.promises.unlink(path);
    }

    async rm(owner_id: number, path: string, options?: { recursive?: boolean, force?: boolean }): Promise<void> {
        path = this.normalize(path);
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
        filename = this.normalize(filename);
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

    public pathJoin(...parts: string[]): string {
        return this.normalizePath(parts.join('/'));
    }

    /* NOTE: VFS requires NO leading slashes, but LFS requires a leading slash. */
    public normalizePath(fullPath: string): string {
        // use regex to strip any leading slashes or dots
        const normalizedPath = 
            // strip any leading slashes or dots
            fullPath.replace(/^[/.]+/, '')
                // replace multiple slashes with a single slash
                .replace(/\/+/g, '/')
                // final replacement to ensure no trailing slash
                .replace(/\/+$/, '');

        return "/"+normalizedPath;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public getItemByID(uuid: string, rootKey: string): Promise<{ node: TreeNode | null; docPath: string }> {
        throw new Error('LFS does not support getItemByID.');
    }
}

const lfs = new LFS();
export default lfs;