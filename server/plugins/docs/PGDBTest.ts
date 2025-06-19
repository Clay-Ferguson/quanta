import pgdb from '../../PDGB.js';

/**
 * Test function to verify PostgreSQL database functionality
 * Creates a test file record and reads it back to verify everything is working
 */
export async function pgdbTest(): Promise<void> {
    await simpleReadWriteTest();
    await deleteFolder("0001_test-structure");
    await createFolderStructureTest();
    await testOrdinalOperations();
    await testFileOperations();
    await testPathOperations();
    await testErrorHandling();
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

async function testOrdinalOperations(): Promise<void> {
    try {
        console.log('\n=== TESTING ORDINAL OPERATIONS ===');
        
        const testRootKey = 'test-structure';
        const testPath = '/0001_test-structure/0001_one';  // Test inside one of our existing folders
        
        console.log('1. Testing pg_get_max_ordinal...');
        const maxOrdinalResult = await pgdb.query(
            'SELECT pg_get_max_ordinal($1, $2) as max_ordinal',
            [testPath, testRootKey]
        );
        const currentMaxOrdinal = maxOrdinalResult.rows[0].max_ordinal;
        console.log(`   Current max ordinal in ${testPath}: ${currentMaxOrdinal}`);
        
        console.log('2. Testing pg_get_ordinal_from_name...');
        const ordinalFromNameResult = await pgdb.query(
            'SELECT pg_get_ordinal_from_name($1, $2, $3) as ordinal',
            ['0003_file3.md', testPath, testRootKey]
        );
        console.log(`   Ordinal of '0003_file3.md': ${ordinalFromNameResult.rows[0].ordinal}`);
        
        console.log('3. Testing file insertion at specific ordinal (position 3)...');
        // This should shift files 0003_file3.md and above down by one position
        const insertResult = await pgdb.query(
            'SELECT pg_insert_file_at_ordinal($1, $2, $3, $4, $5, $6, $7) as file_id',
            [
                testPath, 
                '0003_inserted-file.md', 
                3, 
                testRootKey, 
                false, 
                Buffer.from('# Inserted File\n\nThis file was inserted at ordinal position 3.'),
                'text/markdown'
            ]
        );
        console.log(`   Inserted file with ID: ${insertResult.rows[0].file_id}`);
        
        console.log('4. Verifying ordinal shifting occurred...');
        const afterInsertContents = await pgdb.query(
            'SELECT * FROM pg_readdir($1, $2)',
            [testPath, testRootKey]
        );
        
        console.log(`   Contents after insertion (${afterInsertContents.rows.length} items):`);
        const sortedItems = afterInsertContents.rows.sort((a: any, b: any) => a.ordinal - b.ordinal);
        sortedItems.forEach((item: any) => {
            console.log(`     ${item.ordinal}: ${item.filename} (${item.is_directory ? 'folder' : 'file'})`);
        });
        
        console.log('5. Testing manual ordinal shifting...');
        // Create a test file to shift
        await pgdb.query(
            'SELECT pg_write_file($1, $2, $3, $4, $5)',
            [testPath, '0020_temp-file.md', Buffer.from('Temporary file'), testRootKey, 'text/markdown']
        );
        
        // Now shift ordinals down from position 8
        const shiftResult = await pgdb.query(
            'SELECT * FROM pg_shift_ordinals_down($1, $2, $3, $4)',
            [2, testPath, 8, testRootKey]  // Add 2 slots starting at ordinal 8
        );
        
        console.log(`   Shifted ${shiftResult.rows.length} files:`);
        shiftResult.rows.forEach((row: any) => {
            console.log(`     ${row.old_filename} (ordinal ${row.old_ordinal}) -> ${row.new_filename} (ordinal ${row.new_ordinal})`);
        });
        
        console.log('6. Testing final max ordinal after operations...');
        const finalMaxResult = await pgdb.query(
            'SELECT pg_get_max_ordinal($1, $2) as max_ordinal',
            [testPath, testRootKey]
        );
        console.log(`   Final max ordinal: ${finalMaxResult.rows[0].max_ordinal}`);
        
        console.log('=== ORDINAL OPERATIONS TEST COMPLETED ===\n');
        
    } catch (error) {
        console.error('=== ORDINAL OPERATIONS TEST FAILED ===');
        console.error('Error during ordinal operations test:', error);
        throw error;
    }
}

async function testFileOperations(): Promise<void> {
    try {
        console.log('\n=== TESTING FILE OPERATIONS ===');
        
        const testRootKey = 'test-structure';
        const testPath = '/0001_test-structure/0002_two';  // Test in the 'two' folder
        
        console.log('1. Testing pg_stat function...');
        const statResult = await pgdb.query(
            'SELECT * FROM pg_stat($1, $2, $3)',
            [testPath, '0001_file1.md', testRootKey]
        );
        
        if (statResult.rows.length > 0) {
            const stats = statResult.rows[0];
            console.log(`   File stats for '0001_file1.md':`);
            console.log(`     Size: ${stats.size_bytes} bytes`);
            console.log(`     Type: ${stats.content_type}`);
            console.log(`     Is Directory: ${stats.is_directory}`);
            console.log(`     Ordinal: ${stats.ordinal}`);
            console.log(`     Created: ${stats.created_time}`);
            console.log(`     Modified: ${stats.modified_time}`);
        }
        
        console.log('2. Testing pg_rename function...');
        await pgdb.query(
            'SELECT pg_rename($1, $2, $3, $4, $5)',
            [testPath, '0005_file5.md', testPath, '0005_renamed-file.md', testRootKey]
        );
        console.log('   Successfully renamed 0005_file5.md to 0005_renamed-file.md');
        
        console.log('3. Testing file read after rename...');
        const readRenamedResult = await pgdb.query(
            'SELECT pg_read_file($1, $2, $3) as content',
            [testPath, '0005_renamed-file.md', testRootKey]
        );
        const renamedContent = readRenamedResult.rows[0].content.toString('utf8');
        console.log(`   Read renamed file content: ${renamedContent.substring(0, 50)}...`);
        
        console.log('4. Testing pg_unlink (file deletion)...');
        await pgdb.query(
            'SELECT pg_unlink($1, $2, $3)',
            [testPath, '0004_file4.md', testRootKey]
        );
        console.log('   Successfully deleted 0004_file4.md');
        
        console.log('5. Verifying file no longer exists...');
        const existsAfterDelete = await pgdb.query(
            'SELECT pg_exists($1, $2, $3) as exists',
            [testPath, '0004_file4.md', testRootKey]
        );
        console.log(`   File exists after deletion: ${existsAfterDelete.rows[0].exists}`);
        
        console.log('6. Testing directory operations...');
        // Test pg_is_directory
        const isDirResult = await pgdb.query(
            'SELECT pg_is_directory($1, $2, $3) as is_dir',
            [testPath, '0006_subfolder1', testRootKey]
        );
        console.log(`   0006_subfolder1 is directory: ${isDirResult.rows[0].is_dir}`);
        
        console.log('=== FILE OPERATIONS TEST COMPLETED ===\n');
        
    } catch (error) {
        console.error('=== FILE OPERATIONS TEST FAILED ===');
        console.error('Error during file operations test:', error);
        throw error;
    }
}

async function testPathOperations(): Promise<void> {
    try {
        console.log('\n=== TESTING PATH OPERATIONS ===');
        
        const testRootKey = 'test-structure';
        
        console.log('1. Testing manual deep path creation...');
        // Create nested directories manually since pg_ensure_path may not handle ordinal prefixes correctly
        const basePath = '/0001_test-structure/0003_three';
        
        // Create each level manually
        await pgdb.query(
            'SELECT pg_mkdir($1, $2, $3, $4)',
            [basePath, '0011_deep', testRootKey, false]
        );
        console.log('   Created 0011_deep directory');
        
        const deepPath1 = basePath + '/0011_deep';
        await pgdb.query(
            'SELECT pg_mkdir($1, $2, $3, $4)',
            [deepPath1, '0001_nested', testRootKey, false]
        );
        console.log('   Created 0001_nested directory');
        
        const deepPath2 = deepPath1 + '/0001_nested';
        await pgdb.query(
            'SELECT pg_mkdir($1, $2, $3, $4)',
            [deepPath2, '0001_final', testRootKey, false]
        );        console.log('   Created 0001_final directory');
        
        console.log('2. Verifying each level of the nested path exists...');
        const pathChecks = [
            { path: basePath, folder: '0011_deep' },
            { path: deepPath1, folder: '0001_nested' },
            { path: deepPath2, folder: '0001_final' }
        ];
        
        for (const check of pathChecks) {
            const exists = await pgdb.query(
                'SELECT pg_exists($1, $2, $3) as exists',
                [check.path, check.folder, testRootKey]
            );
            console.log(`   ${check.folder} exists: ${exists.rows[0].exists}`);
        }
        
        console.log('3. Testing file creation in deep path...');
        const finalDeepPath = deepPath2 + '/0001_final';
        await pgdb.query(
            'SELECT pg_write_file($1, $2, $3, $4, $5)',
            [finalDeepPath, '0001_deep-file.txt', Buffer.from('File in deep nested path'), testRootKey, 'text/plain']
        );
        console.log('   Created file in deep nested path');
        
        console.log('4. Testing directory removal of nested structure...');
        // Remove the deep nested structure
        await pgdb.query(
            'SELECT pg_rmdir($1, $2, $3, $4, $5)',
            [basePath, '0011_deep', testRootKey, true, false]
        );
        console.log('   Removed nested structure recursively');
        
        console.log('=== PATH OPERATIONS TEST COMPLETED ===\n');
        
    } catch (error) {
        console.error('=== PATH OPERATIONS TEST FAILED ===');
        console.error('Error during path operations test:', error);
        throw error;
    }
}

async function testErrorHandling(): Promise<void> {
    try {
        console.log('\n=== TESTING ERROR HANDLING ===');
        
        const testRootKey = 'test-structure';
        const testPath = '/0001_test-structure/0001_one';
        
        console.log('1. Testing invalid filename format (missing ordinal)...');
        try {
            await pgdb.query(
                'SELECT pg_write_file($1, $2, $3, $4, $5)',
                [testPath, 'invalid-filename.md', Buffer.from('test'), testRootKey, 'text/markdown']
            );
            console.log('   **** ERROR ****: Should have failed but did not!');
        } catch (error: any) {
            console.log('   All Ok. Expected error occurred:', error.message);
        }
        
        console.log('2. Testing file not found error...');
        try {
            await pgdb.query(
                'SELECT pg_read_file($1, $2, $3)',
                [testPath, '9999_nonexistent.md', testRootKey]
            );
            console.log('   **** ERROR ****: Should have failed but did not!');
        } catch (error: any) {
            console.log('   All Ok. Expected error occurred:', error.message);
        }
        
        console.log('3. Testing directory creation with invalid name...');
        try {
            await pgdb.query(
                'SELECT pg_mkdir($1, $2, $3, $4)',
                [testPath, 'invalid-dirname', testRootKey, false]
            );
            console.log('   **** ERROR ****: Should have failed but did not!');
        } catch (error: any) {
            console.log('   All Ok. Expected error occurred:', error.message);
        }
        
        console.log('4. Testing ordinal extraction from invalid filename...');
        try {
            await pgdb.query(
                'SELECT pg_get_ordinal_from_name($1, $2, $3)',
                ['no-ordinal-file.md', testPath, testRootKey]
            );
            console.log('   **** ERROR ****: Should have failed but did not!');
        } catch (error: any) {
            console.log('   All Ok. Expected error occurred:', error.message);
        }
        
        console.log('5. Testing deletion of non-existent file...');
        try {
            await pgdb.query(
                'SELECT pg_unlink($1, $2, $3)',
                [testPath, '8888_does-not-exist.md', testRootKey]
            );
            console.log('   **** ERROR ****: Should have failed but did not!');
        } catch (error: any) {
            console.log('   All Ok. Expected error occurred:', error.message);
        }
        
        console.log('6. Testing duplicate directory creation...');
        // First, let's see what actually exists in the test directory
        const dirContents = await pgdb.query(
            'SELECT * FROM pg_readdir($1, $2)',
            [testPath, testRootKey]
        );
        console.log(`   Current contents of ${testPath}:`);
        dirContents.rows.forEach((item: any) => {
            console.log(`     - ${item.filename} (${item.is_directory ? 'folder' : 'file'})`);
        });
        
        // Now try to create a directory that should already exist
        // Use one of the folders that actually exists
        const existingFolder = dirContents.rows.find((item: any) => item.is_directory);
        if (existingFolder) {
            try {
                await pgdb.query(
                    'SELECT pg_mkdir($1, $2, $3, $4)',
                    [testPath, existingFolder.filename, testRootKey, false]
                );
                console.log('   **** ERROR ****: Should have failed but did not!');
            } catch (error: any) {
                console.log('   All Ok. Expected error occurred:', error.message);
            }
        } else {
            console.log('   Skipping duplicate directory test - no existing directories found');
        }
        
        console.log('=== ERROR HANDLING TEST COMPLETED ===\n');
        
    } catch (error) {
        console.error('=== ERROR HANDLING TEST FAILED ===');
        console.error('Unexpected error during error handling test:', error);
        throw error;
    }
}