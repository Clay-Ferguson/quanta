import pgdb from '../../PDGB.js';

/**
 * Test function to verify PostgreSQL database functionality
 * Creates a test file record and reads it back to verify everything is working
 */
export async function pgdbTest(): Promise<void> {
    await simpleReadWriteTest();
    await deleteFolder("0001_test-structure");
    await createFolderStructureTest();
    await printFolderStructure();
}

async function deleteFolder(folderName: string): Promise<void> {
    try {
        console.log(`=== DELETING FOLDER: ${folderName} ===`);
        
        const testRootKey = 'test-structure';
        const rootPath = '';  // Empty string for root directory
        
        // Debug: List what's in the root directory first
        console.log('Listing contents of root directory for debugging...');
        try {
            const rootContents = await pgdb.query(
                'SELECT * FROM pg_readdir($1, $2)',
                [rootPath, testRootKey]
            );
            console.log(`Found ${rootContents.rows.length} items in root:`);
            rootContents.rows.forEach((row: any) => {
                console.log(`  - ${row.filename} (${row.is_directory ? 'folder' : 'file'})`);
            });
        } catch (debugError) {
            console.log('Error listing root contents:', debugError);
        }
        
        // Check if the folder exists before trying to delete it
        const exists = await pgdb.query(
            'SELECT pg_exists($1, $2, $3) as exists',
            [rootPath, folderName, testRootKey]
        );
        
        console.log(`Checking if ${folderName} exists in path '${rootPath}': ${exists.rows[0].exists}`);
        
        if (exists.rows[0].exists) {
            console.log(`Folder ${folderName} exists, deleting recursively...`);
            
            // Delete the folder recursively (this will delete all contents too)
            const result = await pgdb.query(
                'SELECT pg_rmdir($1, $2, $3, $4, $5) as deleted_count',
                [rootPath, folderName, testRootKey, true, false] // recursive=true, force=false
            );
            
            console.log(`Successfully deleted folder ${folderName} and ${result.rows[0].deleted_count} items`);
        } else {
            console.log(`Folder ${folderName} does not exist, nothing to delete`);
        }
        
        console.log('=== DELETE FOLDER TEST COMPLETED ===');
        
    } catch (error) {
        console.log('=== DELETE FOLDER TEST FAILED ===');
        console.error('Error during folder deletion test:', error);
        // Don't throw the error - we want tests to continue even if deletion fails
        // (e.g., if the folder doesn't exist on first run)
    }
}

async function printFolderStructure(): Promise<void> {
    try {
        console.log('\n=== FOLDER STRUCTURE VISUALIZATION ===');
        
        const testRootKey = 'test-structure';
        const rootPath = '/0001_test-structure';
        
        await printDirectoryContents(rootPath, testRootKey, 0);
        
        console.log('=== END FOLDER STRUCTURE ===\n');
        
    } catch (error) {
        console.error('Error printing folder structure:', error);
    }
}

async function printDirectoryContents(dirPath: string, rootKey: string, indentLevel: number): Promise<void> {
    const indent = '  '.repeat(indentLevel);
    
    // Get directory contents
    const dirResult = await pgdb.query(
        'SELECT * FROM pg_readdir($1, $2)',
        [dirPath, rootKey]
    );
    
    // Sort by ordinal to ensure proper order
    const sortedItems = dirResult.rows.sort((a: any, b: any) => a.ordinal - b.ordinal);
    
    for (const item of sortedItems) {
        const icon = item.is_directory ? '📁' : '📄';
        console.log(`${indent}${icon} ${item.filename}`);
        
        // If it's a directory, recursively print its contents
        if (item.is_directory) {
            const subDirPath = `${dirPath}/${item.filename}`;
            await printDirectoryContents(subDirPath, rootKey, indentLevel + 1);
        }
    }
}

async function createFolderStructureTest(): Promise<void> {
    try {
        console.log('=== PGDB Folder Structure Test Starting ===');

        const testRootKey = 'test-structure';
        const rootPath = '/0001_test-structure';
        
        // First, ensure the root directory structure exists
        console.log('Creating root path...');
        await pgdb.query('SELECT pg_ensure_path($1, $2)', [rootPath, testRootKey]);

        // Create 5 root-level folders
        console.log('Creating 5 root-level folders...');
        const rootFolders = ['one', 'two', 'three', 'four', 'five'];
        
        for (let i = 0; i < rootFolders.length; i++) {
            const folderName = rootFolders[i];
            const ordinalPrefix = (i + 1).toString().padStart(4, '0');
            const fullFolderName = `${ordinalPrefix}_${folderName}`;
            
            console.log(`Creating root folder: ${fullFolderName}`);
            await pgdb.query(
                'SELECT pg_mkdir($1, $2, $3, $4) as folder_id',
                [rootPath, fullFolderName, testRootKey, false]
            );
            
            // Now create contents inside this folder
            const currentFolderPath = `${rootPath}/${fullFolderName}`;
            
            console.log(`Creating 5 files in ${fullFolderName}...`);
            // Create 5 files in this folder
            for (let j = 1; j <= 5; j++) {
                const fileOrdinal = j.toString().padStart(4, '0');
                const fileName = `${fileOrdinal}_file${j}.md`;
                const fileContent = Buffer.from(`# File ${j} in ${folderName}\n\nThis is test file ${j} inside folder ${folderName}.`);
                
                await pgdb.query(
                    'SELECT pg_write_file($1, $2, $3, $4, $5) as file_id',
                    [currentFolderPath, fileName, fileContent, testRootKey, 'text/markdown']
                );
            }
            
            console.log(`Creating 5 subfolders in ${fullFolderName}...`);
            // Create 5 subfolders in this folder
            for (let k = 6; k <= 10; k++) { // Start at 6 to avoid conflicts with files
                const subfolderOrdinal = k.toString().padStart(4, '0');
                const subfolderName = `${subfolderOrdinal}_subfolder${k - 5}`;
                
                await pgdb.query(
                    'SELECT pg_mkdir($1, $2, $3, $4) as subfolder_id',
                    [currentFolderPath, subfolderName, testRootKey, false]
                );
            }
        }

        // Test the structure by listing contents
        console.log('Verifying folder structure...');
        
        // List root directory
        const rootDirResult = await pgdb.query(
            'SELECT * FROM pg_readdir($1, $2)',
            [rootPath, testRootKey]
        );
        
        console.log(`Root directory contains ${rootDirResult.rows.length} items:`);
        for (const row of rootDirResult.rows) {
            console.log(`  - ${row.filename} (${row.is_directory ? 'folder' : 'file'}, ordinal: ${row.ordinal})`);
            
            // If it's a directory, list its contents too
            if (row.is_directory) {
                const subDirPath = `${rootPath}/${row.filename}`;
                const subDirResult = await pgdb.query(
                    'SELECT * FROM pg_readdir($1, $2)',
                    [subDirPath, testRootKey]
                );
                
                console.log(`    ${row.filename} contains ${subDirResult.rows.length} items:`);
                for (const subRow of subDirResult.rows) {
                    console.log(`      - ${subRow.filename} (${subRow.is_directory ? 'folder' : 'file'}, ordinal: ${subRow.ordinal})`);
                }
            }
        }

        // Test ordinal functions
        console.log('Testing ordinal functions...');
        const maxOrdinal = await pgdb.query(
            'SELECT pg_get_max_ordinal($1, $2) as max_ordinal',
            [rootPath, testRootKey]
        );
        console.log(`Maximum ordinal in root: ${maxOrdinal.rows[0].max_ordinal}`);

        // Test getting ordinal from a specific filename
        const ordinalResult = await pgdb.query(
            'SELECT pg_get_ordinal_from_name($1, $2, $3) as ordinal',
            ['0003_three', rootPath, testRootKey]
        );
        console.log(`Ordinal of '0003_three': ${ordinalResult.rows[0].ordinal}`);

        console.log('=== PGDB Folder Structure Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== PGDB Folder Structure Test Failed ===');
        console.error('Error during PGDB folder structure test:', error);
        throw error;
    }
}

async function simpleReadWriteTest(): Promise<void> {
    try {
        console.log('=== PGDB Test Starting ===');

        const testRootKey = 'test-root';
        const testParentPath = '/test-documents';
        const testFilename = '0001_test-file.md';  // Use ordinal-prefixed filename from the start
        const testContent = Buffer.from('# Test Document 2\n\nThis is a test file created by the PGDB test function.');
        const testContentType = 'text/markdown';

        console.log('Creating test record...');
        
        // Insert a test file record using our PostgreSQL function
        const result = await pgdb.query(
            'SELECT pg_write_file($1, $2, $3, $4, $5) as file_id',
            [testParentPath, testFilename, testContent, testRootKey, testContentType]
        );
        
        const fileId = result.rows[0].file_id;
        console.log(`Test file created with ID: ${fileId}`);

        // Now read the record back
        console.log('Reading test record back...');
        
        const readResult = await pgdb.query(
            'SELECT pg_read_file($1, $2, $3) as content',
            [testParentPath, testFilename, testRootKey]
        );
        
        const retrievedContent = readResult.rows[0].content;
        const contentAsString = retrievedContent.toString('utf8');
        
        console.log('Retrieved content:', contentAsString);
        
        // Also get file metadata using pg_stat
        const statResult = await pgdb.query(
            'SELECT * FROM pg_stat($1, $2, $3)',
            [testParentPath, testFilename, testRootKey]
        );
        
        if (statResult.rows.length > 0) {
            const fileStats = statResult.rows[0];
            console.log('File metadata:', {
                is_directory: fileStats.is_directory,
                size_bytes: fileStats.size_bytes,
                content_type: fileStats.content_type,
                ordinal: fileStats.ordinal,
                created_time: fileStats.created_time,
                modified_time: fileStats.modified_time
            });
        }

        // Test directory listing
        console.log('Testing directory listing...');
        const dirResult = await pgdb.query(
            'SELECT * FROM pg_readdir($1, $2)',
            [testParentPath, testRootKey]
        );
        
        console.log(`Found ${dirResult.rows.length} files in directory ${testParentPath}:`);
        dirResult.rows.forEach((row: any, index: number) => {
            console.log(`  ${index + 1}. ${row.filename} (${row.is_directory ? 'directory' : 'file'}, ordinal: ${row.ordinal})`);
        });

        console.log('=== PGDB Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== PGDB Test Failed ===');
        console.error('Error during PGDB test:', error);
        throw error;
    }
}