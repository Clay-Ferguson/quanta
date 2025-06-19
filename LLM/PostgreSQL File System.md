# Notes to Copilot AI Agent about the `PostgreSQL-based File System Implementation`

Note: This file contains information and instructions for the Github Copilot Agent to use to perform the below refactorings on this project, to enable the PostgreSQL-based File System Implementation.

Note: In this document 'FS' refers to 'File System'. 'PGFS' means Postgres File System, which is what we'll be creating. 

## Plan Bullet Points

* For a general overview of the 'Tree Viewer' feature itself (i.e. The File System Browser/Editor, you can see `/LLM/Tree Viewer Feature.md`, which is fully completed work)

* We will be creating a PostgreSQL-based partial implementation of a FS, entirely made up of only PostgreSQL functions. By 'functions' we do mean actual literal Postgre functions as created by sql 'CREATE OR REPLACE FUNCTION...`. The goal is that we will support all FS operations that we need by implementing them directly in Postgre functions! 

* We will be creating a Pluggable API which allows the existing document-manager plugin (i.e. the 'plugins/docs' folder files) to optionally be able to use a PostgreSQL database to hold file content rather than holding file content in an actual Linux FS. We'll create an abstraction layer around all FS access so that we can choose to either interact with a real Linux FS, or a 'virtual' Postgres-backed FS.

* When the docs plugin loads, the DocServerPlugin (in `/server/plugins/docs/init.ts`) will detect if `process.env.POSTGRES_HOST` is set, and if so it sets it's `pgMode` (Postgres Mode) variable to 'true' indicating we're using the Postres-backed FS rather than a normal Linux FS. This is how we will determine which version of our FS abstraction layer to use.

* This will let us optionally turn the Quanta FS Plugin into an online cloud-based Document Manager. We will be keeping the "path" concept the same. That is, in the PGFS design we'll have both files and folders and they will have slash-delimited folder paths (just like any FS), and modification timestamps just like a real FS does. The `schema.sql` for this is alreacy created and is in `/server/plugins/docs/schema.sql`. We will continue to use ordinal prefixes on all filenames. We also have a first-pass rough draft if what the functions might look like in `server/plugins/docs/pg_functions.sql`

* The PGFS will not need to be a complete implemention of everything Fils Systems can do. Instead, the PGDB will only be a FS that supports what we need supported to enable our  'docs' plugin to run using PostgreSQL tables, in place of file-system access. 

* For now we can ignore all the 'grep' based searching stuff in the 'search' function in 'DocsService.ts', because we'll be relying on the PostgreSQL database search capability, for searching capability in the PGFS. 

## Current Status

Notice the 'DATABASE.md' file in the project root, which describes how we're setting up our Postgre Database, to run inside a Docker Compose container along with our app. You can see the `docker-compose-dev.yaml`, which is what you can also assume we're using during this work. You will eventually find a series of "Steps" (Step 1, Step 2, etc), below where we'll tackle this Virtual File System Implemenation one step at a time, but keep reading, because the rest of this is to give you more context about where we're headed.

## PostgreSQL File System Abstraction Layer Requirements

### Core File System Operations Required:

This list is not known to be comprehensive and correct, but is a first rough-draft:

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


## Basic File Operations

The following is also just a rough-draft of what some of the Postgres calls can be like. None of this is complete, but just to get you prepared for the steps below.

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

Rough draft of functions...

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

Rough draft of a wrapper class...

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

## Steps

The following steps are the actual steps I need you (The AI Agent), to take as we tackle implementing all of what was described above. We are picking up at a point where I think the `schema.sql` is probably perfect as is, but the `pg_functions.sql` is definitely not correct yet. This functions sql file will be where most of the non-trivial work is done too. So let's get started, and do it step by step.

Current Status: We are doing Step 1.

### Step 1 (completed)

When we originally created the `pg_functions.sql` we were working under the assumption that the `fs_nodes` table would have an ordinal, which would be used instead of having an `NNNN_` prefix on file/folder names. However I decided to be consistent, and keep the code uniform across both 'Virtual' and 'Real' File Systems, it's best to just let the Postgre version of the FS also use `NNNN_` ordinals on the file/folder names as well. So in Step 1, please look at the ordinals-related functions in `pg_functions.sql` and rewrite all of those to be using the file/folder name prefix-based ordinals. Note: Remember, you can refer to the existing File System-based code inside `server/plugins/docs` for any hints you might need to understand ordinals, but they're very simple, of course, because they're just for maintaining positional ordering. Feel free to correct anything else you see wrong in `pg_functions.sql`. Note: We don't have a way to test this code yet. That's the next step I'll tell you abuot. So don't try to look around and figure out how to run any of this code you're working on. Don't try to test it yet. Please just do your best to write the code.

#### Final Outcome of Step 1

We've successfully updated `pg_functions.sql` to work with ordinals in file/folder name prefixes rather than an ordinal column.

### Step 2 (completed)

We will be writing a test for testing some of our `pg_functions.sql` functions.

We run the app (and tests) using `docker-run-dev.sh` which uses `docker-compose-dev.yaml` to start our app inside a docker conatiner alonside the Postgre DB. Inside `/server/plugins/docs/init.ts` we have a line  `await pgdbTest()` which runs the test inside `PGDBTest.ts`. I've partially created a `createFolderStructureTest` function for you in there, which I'd like for you to implement in this step. Please add the code to create a little folder structure with 5 folders in the root, named (0001_one.md, 0002_two.md, etc). Then inside each of those root level folders, create five files and five folders. So we'll have a little folder structure, that's two levels deep. That's all this test function will do. It will simply create that folder structure. By of calling the Postgres functions. 

### Step 3 (completed)

Note: The content for Step 3 is omitteded for the sake of brevity, but to summarize all that happened as Step 3 (a big step!) was that we iteratively collaborated to create a fairly comprehensive set of functions for testing our `pg_functions.sql` virtual File System implementation, and it's all in `PGDBTest.ts` right now. So with our tests proving that we have some confidence that `pg_functions.sql` is on decent shape we can move in to implementing the abstraction layer.

### Step 4 (completed)

Please implement the abstraction layer interface in the existing `IVFS.ts`, and then implement an actual `fs` (as in NodeJS `fs` package) wrapper in `LFS.ts`. I've already created both of those files. Note that there will not be any Postgres-related calls or calls to `pg_functions.sql` functions in this, because we're just creating the abstraction layer around the `fs` file system. Also please don't try to actually start using the LFS instance anywhere in the code yet. Just implement the LFS for now. We'll be integrating the code to use it in a future step, but not in Step 4. So you can just read thru `DocBinary.ts`, `DocMod.ts`, `DocService.ts`, and `DocUtils.ts` to come up with the list if which parts of `fs` we need coverage for. Eventually we will of course also be implementing the `VFS` which will hold the abstraction layer wrapper that will call `pg_functions.sql` but again, we do not want to do that yet in Step 4. 

### Step 5 (completed)

Our system already has the ability to define multiple file system `roots` as you can see in `config-dev.yaml`. Each entry in the array under the `public-folders` variable of that config yaml represents a `root`. That config file has only one root right now. We will treat any `root` having a `type` entry equal to "lfs" as a Linux File System, in terms of our abstractionl layer, and "vfs" will indicate the PostgreSQL abstraction layer. So we'll have a factory method that uses this 'type' value to determine which abstraction to use in any function where were's accessing a real or virtual file system.

So let's start by working first only in `DocService.ts` `treeRender` method. So inside `DocService.ts` you can implement a factory pattern method to return either the imported `lfs` instance or `vfs` instance modules based on the `type` of the `root`. Then for now make use of this factory method only in the `treeRender` method and let's see if we can get that working where I can pull it up in the GUI! So for now it will be a trivial case of just mapping to the same functions it's already calling (in 'fs' module) but doing it thru the abstraction layer.

#### Step 5 outcome:

We now have a factory method on `DocService.ts` having this signature: `private getFileSystem(docRootKey: string): IVFS`. So any method having a docRootKey can use it to get the proper IVFS instance to use. This is fully functional already in `treeRender` from Step 4.

### Step 6 (current step)

For this step please make the `createFile` method (inside `DocService.ts`) use the `getFileSystem` to get the IVFS instance to use, and use it in `createFile` and pass it down to any methods called, like `treeRender` does. This will make `createFile` be using our new abstraction layer.