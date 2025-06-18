# IMPORTANT: This file On Hold!

This work, for the PostgreSQL File System is currently on hold in it's current state until we first switch SQLite3 over to PostgreSQL. Instructions to AI for this can be found in file 'Converting SQLite3 to Postgres.md' file in this same folder.

# Notes to Copilot AI Agent about the `PostgreSQL-based File System Implementation` 

Note: In this document 'FS' refers to 'File System'. 'PGFS' means Postgres File System, which is what we'll be creating. 

* We will be creating a PostgreSQL-based partial implementation of a FS, entirely made up of only PostgreSQL functions. 

* We will be creating a Pluggable API which allows the existing document-manager plugin (i.e. the 'plugins/docs' folder files) to be able to use a PostgreSQL database to hold file content rather than holding content in an actual FS. We'll create an abstraction layer around all FS access so that we can choose to either interact with a real Linux FS, or a 'virtual' Postgres-backed FS where all file content is stored in the DB.

* This will let us turn the Quanta FS Plugin into an online cloud-based Document Manager. We will be keeping the "path" concept the same. That is, in the PGFS design we'll have both files and folders and they will have slash-delimited names (just like a FS), and modification timestamps just like a real FS does.

* The main thing the PGFS will do differnently than the real Linux FS impelmentation (which we already have in the code), is that instead of having file/folder ordinals as prefixes on the file/folder names, we'll simply use an integer field in the database instead.

* The PGFS will not need to be a complete implemention of everything Fils Systems can do. Instead the PGDB will only be a FS that supports what we need supported to port this 'doc' folder files over into a SQL-based system, to replace all file-system access. 

* For now we can ignore all the 'grep' based searching stuff in the 'search' function in 'DocsService.ts', because we'll be relying on the PostgreSQL database search capability, for searching capability in the PGFS. 

# Current Status

Notice the 'DATABASE.md' file in the project root, which describes how we're setting up our Postgre Database, to run inside a Docker Compose container along with our app.


# PostgreSQL File System Abstraction Layer Requirements

Core File System Operations Required:

1. Directory Operations
* List directory contents: fs.readdirSync() - Get all files/folders in a path
* Check directory existence: fs.existsSync() for directories
* Create directories: fs.mkdirSync() with recursive option
* Remove directories: fs.rmSync() with recursive and force options
* Directory statistics: fs.statSync().isDirectory()

2. File Operations
* Read file content: fs.readFileSync() for text files
* Write file content: fs.writeFileSync() for saving content
* File existence check: fs.existsSync() for files
* Delete files: fs.unlinkSync() for single file deletion
* Rename/move files: fs.renameSync() for file operations
* File statistics: fs.statSync() for metadata (size, timestamps, type)

3. File Metadata & Timestamps
* Creation time: fileStat.birthtime.getTime()
* Modification time: fileStat.mtime.getTime()
* File size: For display and sorting
* File type detection: Based on extensions (.md, .txt, .png, .jpg, etc.)

# Database Tables

```sql
CREATE TABLE fs_nodes (
    id SERIAL PRIMARY KEY,
    doc_root_key VARCHAR(255) NOT NULL,
    parent_path TEXT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    ordinal INTEGER NOT NULL,
    is_directory BOOLEAN NOT NULL DEFAULT FALSE,
    content BYTEA,
    content_type VARCHAR(100),
    size_bytes BIGINT DEFAULT 0,
    created_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    modified_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(doc_root_key, parent_path, filename)
);

CREATE INDEX idx_fs_nodes_parent ON fs_nodes(doc_root_key, parent_path);
CREATE INDEX idx_fs_nodes_ordinal ON fs_nodes(doc_root_key, parent_path, ordinal);
```

# Rough Draft Guesses at some Postgres Functions

```sql
-- Equivalent to fs.readdirSync()
CREATE OR REPLACE FUNCTION pg_readdir(path_param TEXT, root_key TEXT)
RETURNS TABLE(name TEXT, type TEXT, ordinal INTEGER) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        filename,
        CASE WHEN is_directory THEN 'folder' ELSE 'file' END,
        CAST(SUBSTRING(filename FROM '^(\d+)_') AS INTEGER)
    FROM fs_nodes 
    WHERE parent_path = path_param AND doc_root_key = root_key
    ORDER BY ordinal;
END;
$$ LANGUAGE plpgsql;

-- Equivalent to fs.readFileSync()
CREATE OR REPLACE FUNCTION pg_read_file(file_path TEXT, root_key TEXT)
RETURNS BYTEA AS $$
BEGIN
    RETURN (SELECT content FROM fs_nodes WHERE full_path = file_path AND doc_root_key = root_key);
END;
$$ LANGUAGE plpgsql;

-- Equivalent to fs.writeFileSync()
CREATE OR REPLACE FUNCTION pg_write_file(file_path TEXT, content_data BYTEA, root_key TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO fs_nodes (full_path, content, doc_root_key, modified_time)
    VALUES (file_path, content_data, root_key, NOW())
    ON CONFLICT (full_path, doc_root_key) 
    DO UPDATE SET content = content_data, modified_time = NOW();
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
```

# Example calls to PGFS from NodeJS

Using Postgre functions defined in `server/plugins/docs/pg_functions.sql`


## Reading Files/Folders

```ts
// Get all files in a directory
const files = await db.query('SELECT * FROM pg_readdir($1, $2)', ['/some/path', 'rootKey']);

// Get just filenames as array
const filenames = await db.query('SELECT pg_readdir_names($1, $2)', ['/some/path', 'rootKey']);

// Get only ordinal-prefixed files (your current use case)
const numberedFiles = await db.query('SELECT * FROM pg_readdir_numbered($1, $2)', ['/some/path', 'rootKey']);
```

## Shifting Ordinals

```ts
// Instead of your current complex shiftOrdinalsDown method:
async shiftOrdinalsDown(slotsToAdd: number, absoluteParentPath: string, insertOrdinal: number, root: string, itemsToIgnore: string[] | null): Promise<Map<string, string>> {
    const result = await this.db.query(
        'SELECT * FROM pg_shift_ordinals_down($1, $2, $3, $4, $5)', 
        [slotsToAdd, absoluteParentPath, insertOrdinal, root, itemsToIgnore]
    );
    
    // Convert to Map for compatibility with existing code
    const pathMapping = new Map<string, string>();
    result.rows.forEach(row => {
        // In DB version, paths don't actually change since filenames stay the same
        // But we maintain the API for compatibility
        pathMapping.set(row.old_filename, row.new_filename);
    });
    return pathMapping;
}

// Get max ordinal becomes trivial:
async getMaxOrdinal(absolutePath: string, root: string): Promise<number> {
    const result = await this.db.query('SELECT pg_get_max_ordinal($1, $2)', [absolutePath, root]);
    return result.rows[0].pg_get_max_ordinal;
}

// Insert a new file with automatic ordinal management:
async insertFileAtOrdinal(parentPath: string, filename: string, ordinal: number, rootKey: string, content: Buffer) {
    const fileId = await this.db.query(
        'SELECT pg_insert_file_at_ordinal($1, $2, $3, $4, FALSE, $5, $6)',
        [parentPath, filename, ordinal, rootKey, content, 'text/markdown']
    );
    return fileId.rows[0];
}
```

## Basic File Operations

```ts
// Read file content (equivalent to fs.readFileSync())
const content = await db.query('SELECT pg_read_file($1, $2, $3)', ['/documents', 'readme.md', 'rootKey']);
const fileData = content.rows[0].pg_read_file;

// Write file content (equivalent to fs.writeFileSync())
const fileId = await db.query('SELECT pg_write_file($1, $2, $3, $4, $5)', 
    ['/documents', 'new-file.md', Buffer.from('# Hello World'), 'rootKey', 'text/markdown']);

// Check if file exists (equivalent to fs.existsSync())
const exists = await db.query('SELECT pg_exists($1, $2, $3)', ['/documents', 'readme.md', 'rootKey']);
const fileExists = exists.rows[0].pg_exists;

// Get file metadata (equivalent to fs.statSync())
const stat = await db.query('SELECT * FROM pg_stat($1, $2, $3)', ['/documents', 'readme.md', 'rootKey']);
const fileStats = stat.rows[0]; // { is_directory, size_bytes, created_time, modified_time, content_type, ordinal }

// Delete file (equivalent to fs.unlinkSync())
await db.query('SELECT pg_unlink($1, $2, $3)', ['/documents', 'old-file.md', 'rootKey']);

// Rename/move file (equivalent to fs.renameSync())
await db.query('SELECT pg_rename($1, $2, $3, $4, $5)', 
    ['/documents', 'old-name.md', '/documents', 'new-name.md', 'rootKey']);
```

## Directory Operations

```ts
// Create directory (equivalent to fs.mkdirSync())
const dirId = await db.query('SELECT pg_mkdir($1, $2, $3)', ['/documents', 'new-folder', 'rootKey']);

// Remove directory (equivalent to fs.rmSync())
await db.query('SELECT pg_rmdir($1, $2, $3, $4, $5)', 
    ['/documents', 'old-folder', 'rootKey', true, false]); // recursive=true, force=false

// Check if path is directory
const isDir = await db.query('SELECT pg_is_directory($1, $2, $3)', ['/documents', 'folder-name', 'rootKey']);
const isDirectory = isDir.rows[0].pg_is_directory;

// Create directory path recursively (like mkdir -p)
await db.query('SELECT pg_ensure_path($1, $2)', ['/documents/deep/nested/path', 'rootKey']);
```

## Complete Node.js Wrapper Class

```ts
class PostgreSQLFileSystem {
    constructor(private db: any) {}

    // Directory listing
    async readdirSync(path: string, rootKey: string): Promise<string[]> {
        const result = await this.db.query('SELECT pg_readdir_names($1, $2)', [path, rootKey]);
        return result.rows[0].pg_readdir_names || [];
    }

    // File operations
    async readFileSync(path: string, filename: string, rootKey: string): Promise<Buffer> {
        const result = await this.db.query('SELECT pg_read_file($1, $2, $3)', [path, filename, rootKey]);
        return result.rows[0].pg_read_file;
    }

    async writeFileSync(path: string, filename: string, content: Buffer, rootKey: string, contentType?: string): Promise<void> {
        await this.db.query('SELECT pg_write_file($1, $2, $3, $4, $5)', 
            [path, filename, content, rootKey, contentType || 'application/octet-stream']);
    }

    async existsSync(path: string, filename: string, rootKey: string): Promise<boolean> {
        const result = await this.db.query('SELECT pg_exists($1, $2, $3)', [path, filename, rootKey]);
        return result.rows[0].pg_exists;
    }

    async statSync(path: string, filename: string, rootKey: string): Promise<any> {
        const result = await this.db.query('SELECT * FROM pg_stat($1, $2, $3)', [path, filename, rootKey]);
        return result.rows[0];
    }

    async unlinkSync(path: string, filename: string, rootKey: string): Promise<void> {
        await this.db.query('SELECT pg_unlink($1, $2, $3)', [path, filename, rootKey]);
    }

    async renameSync(oldPath: string, oldName: string, newPath: string, newName: string, rootKey: string): Promise<void> {
        await this.db.query('SELECT pg_rename($1, $2, $3, $4, $5)', [oldPath, oldName, newPath, newName, rootKey]);
    }

    // Directory operations
    async mkdirSync(path: string, dirname: string, rootKey: string, options?: { recursive?: boolean }): Promise<void> {
        await this.db.query('SELECT pg_mkdir($1, $2, $3, $4)', 
            [path, dirname, rootKey, options?.recursive || false]);
    }

    async rmSync(path: string, dirname: string, rootKey: string, options?: { recursive?: boolean, force?: boolean }): Promise<void> {
        await this.db.query('SELECT pg_rmdir($1, $2, $3, $4, $5)', 
            [path, dirname, rootKey, options?.recursive || false, options?.force || false]);
    }

    // Ordinal operations (your special sauce!)
    async shiftOrdinalsDown(slotsToAdd: number, parentPath: string, insertOrdinal: number, rootKey: string, itemsToIgnore?: string[]): Promise<Map<string, string>> {
        const result = await this.db.query('SELECT * FROM pg_shift_ordinals_down($1, $2, $3, $4, $5)', 
            [slotsToAdd, parentPath, insertOrdinal, rootKey, itemsToIgnore]);
        
        const pathMapping = new Map<string, string>();
        result.rows.forEach(row => pathMapping.set(row.old_filename, row.new_filename));
        return pathMapping;
    }

    async getMaxOrdinal(parentPath: string, rootKey: string): Promise<number> {
        const result = await this.db.query('SELECT pg_get_max_ordinal($1, $2)', [parentPath, rootKey]);
        return result.rows[0].pg_get_max_ordinal;
    }

    async insertFileAtOrdinal(parentPath: string, filename: string, ordinal: number, rootKey: string, 
                            content?: Buffer, contentType?: string): Promise<number> {
        const result = await this.db.query('SELECT pg_insert_file_at_ordinal($1, $2, $3, $4, $5, $6, $7)', 
            [parentPath, filename, ordinal, rootKey, false, content, contentType]);
        return result.rows[0].pg_insert_file_at_ordinal;
    }
}
```

