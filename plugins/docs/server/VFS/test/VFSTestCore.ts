import pgdb from '../../../../../server/PGDB.js';

const testRootKey = 'usr';

/**
 * Wipes all records from the vfs_nodes table
 */
export async function wipeTable(): Promise<void> {
    try {
        console.log('=== WIPING vfs_nodes TABLE ===');
        
        // Delete all records from the vfs_nodes table
        const result = await pgdb.query('DELETE FROM vfs_nodes');
        
        console.log(`Successfully wiped vfs_nodes table. ${result.rowCount || 0} rows deleted.`);
        console.log('=== TABLE WIPE COMPLETED ===');
        
    } catch (error) {
        console.error('=== TABLE WIPE FAILED ===');
        console.error('Error wiping vfs_nodes table:', error);
        throw error;
    }
}

/**
 * Prints the folder structure starting from the test root
 */
export async function printFolderStructure(owner_id: number, print: boolean=true): Promise<any> {
    const meta = { count: 0 }; // Metadata to track item count
    try {
        let output = '\n=== FOLDER STRUCTURE VISUALIZATION ===\n';
        output += '📁 = Folder, 📄 = File, [P] = Public item\n';
        const rootPath = ''; 
        output += await buildDirectoryContents(owner_id, rootPath, testRootKey, 0, meta);
        output += '=== END FOLDER STRUCTURE ===\n';
        if (print) {
            console.log(output);
        }
        
    } catch (error) {
        console.error('Error printing folder structure:', error);
    }
    return meta;
}

/**
 * Helper function to recursively build directory contents string
 */
async function buildDirectoryContents(owner_id: number, dirPath: string, rootKey: string, indentLevel: number, meta: any): Promise<string> {
    const indent = '  '.repeat(indentLevel);
    let output = '';
    
    // Get directory contents
    const dirResult = await pgdb.query(
        'SELECT * FROM vfs_readdir($1, $2, $3)',
        owner_id, dirPath, rootKey
    );
    
    // Sort by ordinal to ensure proper order
    const sortedItems = dirResult.rows.sort((a: any, b: any) => a.ordinal - b.ordinal);
    
    for (const item of sortedItems) {
        meta.count++;
        const icon = item.is_directory ? '📁' : '📄';
        output += `${indent}${icon} ${item.filename}\n`;
        
        // If it's a directory, recursively build its contents
        if (item.is_directory) {
            const subDirPath = `${dirPath}/${item.filename}`;
            output += await buildDirectoryContents(owner_id, subDirPath, rootKey, indentLevel + 1, meta);
        }
    }
    
    return output;
}

/** 
 * Creates the following folder structure:
 * 
📁 0001_test-structure
  📁 0001_one
    📄 0001_file1.md
    📄 0002_file2.md
    📄 0003_file3.md
    📁 0004_subfolder1
    📁 0005_subfolder2
    📁 0006_subfolder3
  📁 0002_two
    📄 0001_file1.md
    📄 0002_file2.md
    📄 0003_file3.md
    📁 0004_subfolder1
    📁 0005_subfolder2
    📁 0006_subfolder3
  📁 0003_three
    📄 0001_file1.md
    📄 0002_file2.md
    📄 0003_file3.md
    📁 0004_subfolder1
    📁 0005_subfolder2
    📁 0006_subfolder3
*/
export async function createFolderStructure(): Promise<void> {
    try {
        console.log('=== PGDB Folder Structure Test Starting ===');
        const rootPath = '0001_test-structure';
        
        // First, ensure the root directory structure exists
        console.log('Creating root path...');
        await pgdb.query('SELECT vfs_ensure_path($1, $2, $3)', pgdb.adminProfile!.id, rootPath, testRootKey);

        // Create 3 root-level folders
        console.log('Creating 3 root-level folders...');
        const rootFolders = ['one', 'two', 'three'];
        
        for (let i = 0; i < rootFolders.length; i++) {
            const folderName = rootFolders[i];
            const ordinalPrefix = (i + 1).toString().padStart(4, '0');
            const fullFolderName = `${ordinalPrefix}_${folderName}`;
            
            console.log(`Creating root folder: ${fullFolderName}`);
            await pgdb.query(
                'SELECT vfs_mkdir($1, $2, $3, $4, $5, $6) as folder_id',
                pgdb.adminProfile!.id, rootPath, fullFolderName, testRootKey, false, false
            );
            
            // Now create contents inside this folder
            const currentFolderPath = `${rootPath}/${fullFolderName}`;
            
            console.log(`Creating 3 files in ${fullFolderName}...`);
            // Create 3 files in this folder
            for (let j = 1; j <= 3; j++) {
                const fileOrdinal = j.toString().padStart(4, '0');
                const fileName = `${fileOrdinal}_file${j}.md`;
                const fileContent = Buffer.from(`# File ${j} in ${folderName}\n\nThis is test file ${j} inside folder ${folderName}.`);
                
                await pgdb.query(
                    'SELECT vfs_write_text_file($1, $2, $3, $4, $5, $6, $7) as file_id',
                    pgdb.adminProfile!.id, currentFolderPath, fileName, fileContent.toString('utf8'), testRootKey, 'text/markdown', false
                );
            }
            
            console.log(`Creating 3 subfolders in ${fullFolderName}...`);
            // Create 5 subfolders in this folder
            for (let k = 4; k <= 6; k++) { // Start at 4 to avoid conflicts with files
                const subfolderOrdinal = k.toString().padStart(4, '0');
                const subfolderName = `${subfolderOrdinal}_subfolder${k - 3}`;
                
                await pgdb.query(
                    'SELECT vfs_mkdir($1, $2, $3, $4, $5, $6) as subfolder_id',
                    pgdb.adminProfile!.id, currentFolderPath, subfolderName, testRootKey, false, false
                );
            }
        }
    }
    catch (error) {
        console.error('=== PGDB Folder Structure Test Failed ===');
        console.error('Error during PGDB folder structure test:', error);
        throw error;
    }
}

export async function checkInitialFolderStructureTest(owner_id: number): Promise<void> {
    try {
        const rootPath = '0001_test-structure';
        // Test the structure by listing contents
        console.log('Verifying folder structure...');
        
        // List root directory
        const rootDirResult = await pgdb.query(
            'SELECT * FROM vfs_readdir($1, $2, $3)',
            owner_id, rootPath, testRootKey
        );
        
        console.log(`Root directory contains ${rootDirResult.rows.length} items:`);
        for (const row of rootDirResult.rows) {
            console.log(`  - ${row.filename} (${row.is_directory ? 'folder' : 'file'})`);
            
            // If it's a directory, list its contents too
            if (row.is_directory) {
                const subDirPath = `${rootPath}/${row.filename}`;
                const subDirResult = await pgdb.query(
                    'SELECT * FROM vfs_readdir($1, $2, $3)',
                    owner_id, subDirPath, testRootKey
                );
                
                console.log(`    ${row.filename} contains ${subDirResult.rows.length} items:`);
                for (const subRow of subDirResult.rows) {
                    console.log(`      - ${subRow.filename} (${subRow.is_directory ? 'folder' : 'file'})`);
                }
            }
        }

        // Test ordinal functions
        console.log('Testing ordinal functions...');
        const maxOrdinal = await pgdb.query(
            'SELECT vfs_get_max_ordinal($1, $2) as max_ordinal',
            rootPath, testRootKey
        );
        console.log(`Maximum ordinal in root: ${maxOrdinal.rows[0].max_ordinal}`);

        console.log('=== PGDB Folder Structure Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== PGDB Folder Structure Test Failed ===');
        console.error('Error during PGDB folder structure test:', error);
        throw error;
    }
}

/**
 * Lists all records in the vfs_nodes table showing id, directory status, parent_path, and filename
 * Uses folder/file icons to indicate directory vs non-directory status
 * 
 * @param rootKey - Optional root key to filter by (defaults to testRootKey)
 */
export async function listAllVfsNodes(rootKey: string = testRootKey): Promise<void> {
    try {
        console.log(`\n=== VFS NODES LISTING${rootKey ? ` (${rootKey})` : ''} ===`);
        
        // Query records from vfs_nodes, filtering by rootKey if provided
        const query = rootKey 
            ? 'SELECT id, is_directory, parent_path, filename FROM vfs_nodes WHERE doc_root_key = $1 ORDER BY parent_path, filename'
            : 'SELECT id, is_directory, parent_path, filename FROM vfs_nodes ORDER BY parent_path, filename';
                
        const result = await pgdb.query(query, rootKey);
        
        console.log(`Found ${result.rows.length} records in vfs_nodes table:\n`);
        
        if (result.rows.length === 0) {
            console.log('No records found.');
            console.log(`\n=== END VFS NODES LISTING (0 records) ===\n`);
            return;
        }
        
        // Calculate column widths for proper alignment
        const idWidth = Math.max(6, ...result.rows.map((r: any) => r.id.toString().length));
        const pathWidth = Math.max(15, ...result.rows.map((r: any) => (r.parent_path || '/').length));
        
        // Print header
        console.log(
            `${'ID'.padEnd(idWidth)} | TYPE | ${'PARENT_PATH'.padEnd(pathWidth)} | FILENAME`
        );
        console.log('-'.repeat(idWidth + 3 + 6 + 3 + pathWidth + 3 + 20));
        
        // Format and display each row
        result.rows.forEach((row: any) => {
            const icon = row.is_directory ? '📁' : '📄';
            const idStr = row.id.toString().padEnd(idWidth);
            const pathStr = (row.parent_path || '/').padEnd(pathWidth);
            console.log(`${idStr} | ${icon}  | ${pathStr} | ${row.filename}`);
        });
        
        console.log('-'.repeat(idWidth + 3 + 6 + 3 + pathWidth + 3 + 20));
        console.log(`\n=== END VFS NODES LISTING (${result.rows.length} records) ===\n`);
        
    } catch (error) {
        console.error('=== VFS NODES LISTING FAILED ===');
        console.error('Error listing vfs_nodes:', error);
        throw error;
    }
}
