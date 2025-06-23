import pgdb from '../../../../PGDB.js';
import { wipeTable, printFolderStructure, createFolderStructureTest, listAllVfsNodes } from './VFSTestCore.js';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { pgdbTestMoveUp } from './VFSTestFileMoves.js';
import { testFolderRenameWithChildren } from './testFolderRename.js';

const testRootKey = 'pgroot';

/**
 * Test function to verify PostgreSQL database functionality
 * Creates a test file record and reads it back to verify everything is working
 */
export async function pgdbTest(): Promise<void> {
    await wipeTable();
    //await simpleReadWriteTest();
    await createFolderStructureTest();
    // Test our fix for the folder rename bug
    await testFolderRenameWithChildren();
    // await testOrdinalOperations();
    // await testFileOperations();
    // await testPathOperations();
    // await testErrorHandling();
    // await createNewFileAtTopOfRoot();
    // await pgdbTestMoveUp();

    // Test search functionality
    // await pgdbTestSearch();

    // now reset for gui to have a clean slate
    // await wipeTable();
    // await createFolderStructureTest();
    await printFolderStructure();
    await listAllVfsNodes();
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function deleteFolder(folderName: string): Promise<void> {
    try {
        console.log(`=== DELETING FOLDER: ${folderName} ===`);
        
        const rootPath = '';  // Empty string for root directory
        
        // Debug: List what's in the root directory first
        console.log('Listing contents of root directory for debugging...');
        try {
            const rootContents = await pgdb.query(
                'SELECT * FROM vfs_readdir($1, $2)',
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
            'SELECT vfs_exists($1, $2, $3) as exists',
            [rootPath, folderName, testRootKey]
        );
        
        console.log(`Checking if ${folderName} exists in path '${rootPath}': ${exists.rows[0].exists}`);
        
        if (exists.rows[0].exists) {
            console.log(`Folder ${folderName} exists, deleting recursively...`);
            
            // Delete the folder recursively (this will delete all contents too)
            const result = await pgdb.query(
                'SELECT vfs_rmdir($1, $2, $3, $4, $5) as deleted_count',
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function simpleReadWriteTest(): Promise<void> {
    try {
        console.log('=== PGDB Test Starting ===');

        const testParentPath = '/test-documents';
        const testFilename = '0001_test-file.md';  // Use ordinal-prefixed filename from the start
        const testContent = Buffer.from('# Test Document 2\n\nThis is a test file created by the PGDB test function.');
        const testContentType = 'text/markdown';

        console.log('Creating test record...');
        
        // Insert a test file record using our PostgreSQL function
        const result = await pgdb.query(
            'SELECT vfs_write_text_file($1, $2, $3, $4, $5) as file_id',
            [testParentPath, testFilename, testContent.toString('utf8'), testRootKey, testContentType]
        );
        
        const fileId = result.rows[0].file_id;
        console.log(`Test file created with ID: ${fileId}`);

        // Now read the record back
        console.log('Reading test record back...');
        
        const readResult = await pgdb.query(
            'SELECT vfs_read_file($1, $2, $3) as content',
            [testParentPath, testFilename, testRootKey]
        );
        
        const retrievedContent = readResult.rows[0].content;
        const contentAsString = retrievedContent.toString('utf8');
        
        console.log('Retrieved content:', contentAsString);
        
        // Also get file metadata using vfs_stat
        const statResult = await pgdb.query(
            'SELECT * FROM vfs_stat($1, $2, $3)',
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
            'SELECT * FROM vfs_readdir($1, $2)',
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function testFileOperations(): Promise<void> {
    try {
        console.log('\n=== TESTING FILE OPERATIONS ===');        
        const testPath = '/0001_test-structure/0002_two';  // Test in the 'two' folder
        
        console.log('1. Testing vfs_stat function...');
        const statResult = await pgdb.query(
            'SELECT * FROM vfs_stat($1, $2, $3)',
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
        
        console.log('2. Testing vfs_rename function...');
        await pgdb.query(
            'SELECT vfs_rename($1, $2, $3, $4, $5)',
            [testPath, '0005_file5.md', testPath, '0005_renamed-file.md', testRootKey]
        );
        console.log('   Successfully renamed 0005_file5.md to 0005_renamed-file.md');
        
        console.log('3. Testing file read after rename...');
        const readRenamedResult = await pgdb.query(
            'SELECT vfs_read_file($1, $2, $3) as content',
            [testPath, '0005_renamed-file.md', testRootKey]
        );
        const renamedContent = readRenamedResult.rows[0].content.toString('utf8');
        console.log(`   Read renamed file content: ${renamedContent.substring(0, 50)}...`);
        
        console.log('4. Testing vfs_unlink (file deletion)...');
        await pgdb.query(
            'SELECT vfs_unlink($1, $2, $3)',
            [testPath, '0004_file4.md', testRootKey]
        );
        console.log('   Successfully deleted 0004_file4.md');
        
        console.log('5. Verifying file no longer exists...');
        const existsAfterDelete = await pgdb.query(
            'SELECT vfs_exists($1, $2, $3) as exists',
            [testPath, '0004_file4.md', testRootKey]
        );
        console.log(`   File exists after deletion: ${existsAfterDelete.rows[0].exists}`);
        
        console.log('6. Testing directory operations...');
        // Test vfs_is_directory
        const isDirResult = await pgdb.query(
            'SELECT vfs_is_directory($1, $2, $3) as is_dir',
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function testPathOperations(): Promise<void> {
    try {
        console.log('\n=== TESTING PATH OPERATIONS ===');
                
        console.log('1. Testing manual deep path creation...');
        // Create nested directories manually since vfs_ensure_path may not handle ordinal prefixes correctly
        const basePath = '/0001_test-structure/0003_three';
        
        // Create each level manually
        await pgdb.query(
            'SELECT vfs_mkdir($1, $2, $3, $4)',
            [basePath, '0011_deep', testRootKey, false]
        );
        console.log('   Created 0011_deep directory');
        
        const deepPath1 = basePath + '/0011_deep';
        await pgdb.query(
            'SELECT vfs_mkdir($1, $2, $3, $4)',
            [deepPath1, '0001_nested', testRootKey, false]
        );
        console.log('   Created 0001_nested directory');
        
        const deepPath2 = deepPath1 + '/0001_nested';
        await pgdb.query(
            'SELECT vfs_mkdir($1, $2, $3, $4)',
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
                'SELECT vfs_exists($1, $2, $3) as exists',
                [check.path, check.folder, testRootKey]
            );
            console.log(`   ${check.folder} exists: ${exists.rows[0].exists}`);
        }
        
        console.log('3. Testing file creation in deep path...');
        const finalDeepPath = deepPath2 + '/0001_final';
        await pgdb.query(
            'SELECT vfs_write_text_file($1, $2, $3, $4, $5)',
            [finalDeepPath, '0001_deep-file.txt', 'File in deep nested path', testRootKey, 'text/plain']
        );
        console.log('   Created file in deep nested path');
        
        console.log('4. Testing directory removal of nested structure...');
        // Remove the deep nested structure
        await pgdb.query(
            'SELECT vfs_rmdir($1, $2, $3, $4, $5)',
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function testErrorHandling(): Promise<void> {
    try {
        console.log('\n=== TESTING ERROR HANDLING ===');        
        const testPath = '/0001_test-structure/0001_one';
        
        console.log('1. Testing invalid filename format (missing ordinal)...');
        try {
            await pgdb.query(
                'SELECT vfs_write_text_file($1, $2, $3, $4, $5)',
                [testPath, 'invalid-filename.md', 'test', testRootKey, 'text/markdown']
            );
            console.log('   **** ERROR ****: Should have failed but did not!');
        } catch (error: any) {
            console.log('   All Ok. Expected error occurred:', error.message);
        }
        
        console.log('2. Testing file not found error...');
        try {
            await pgdb.query(
                'SELECT vfs_read_file($1, $2, $3)',
                [testPath, '9999_nonexistent.md', testRootKey]
            );
            console.log('   **** ERROR ****: Should have failed but did not!');
        } catch (error: any) {
            console.log('   All Ok. Expected error occurred:', error.message);
        }
        
        console.log('3. Testing directory creation with invalid name...');
        try {
            await pgdb.query(
                'SELECT vfs_mkdir($1, $2, $3, $4)',
                [testPath, 'invalid-dirname', testRootKey, false]
            );
            console.log('   **** ERROR ****: Should have failed but did not!');
        } catch (error: any) {
            console.log('   All Ok. Expected error occurred:', error.message);
        }
        
        console.log('4. Testing ordinal extraction from invalid filename...');
        try {
            await pgdb.query(
                'SELECT vfs_get_ordinal_from_name($1, $2, $3)',
                ['no-ordinal-file.md', testPath, testRootKey]
            );
            console.log('   **** ERROR ****: Should have failed but did not!');
        } catch (error: any) {
            console.log('   All Ok. Expected error occurred:', error.message);
        }
        
        console.log('5. Testing deletion of non-existent file...');
        try {
            await pgdb.query(
                'SELECT vfs_unlink($1, $2, $3)',
                [testPath, '8888_does-not-exist.md', testRootKey]
            );
            console.log('   **** ERROR ****: Should have failed but did not!');
        } catch (error: any) {
            console.log('   All Ok. Expected error occurred:', error.message);
        }
        
        console.log('6. Testing duplicate directory creation...');
        // First, let's see what actually exists in the test directory
        const dirContents = await pgdb.query(
            'SELECT * FROM vfs_readdir($1, $2)',
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
                    'SELECT vfs_mkdir($1, $2, $3, $4)',
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

/**
 * Test creating a new file at the top of root using actual DocService.createFile method
 * This will help debug the issue where folder children disappear after createFile
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function createNewFileAtTopOfRoot(): Promise<void> {
    try {
        console.log('\n=== TESTING CREATE NEW FILE AT TOP OF ROOT ===');
        
        // Import DocService instance
        const { docSvc } = await import('../../DocService.js');
        
        // Set up parameters for the createFile request
        const docRootKey = testRootKey; // 'pgroot'

        // todo-0: I believe with "/" here for 'treeFolder' this used to cause a bug (come back to this and test it)
        const treeFolder = '/0001_test-structure'; // Root folder where files exist
        const fileName = 'new-test-file'; // Without extension, should get .md added
        const insertAfterNode = ''; // Empty means insert at top (ordinal 0)
        
        console.log(`Calling DocService.createFile with:`);
        console.log(`  fileName: "${fileName}"`);
        console.log(`  treeFolder: "${treeFolder}"`);
        console.log(`  insertAfterNode: "${insertAfterNode}"`);
        console.log(`  docRootKey: "${docRootKey}"`);
        
        // Create mock request and response objects
        const mockReq = {
            body: {
                fileName,
                treeFolder,
                insertAfterNode,
                docRootKey
            }
        } as any;
        
        const mockRes = {
            status: (code: number) => ({
                json: (data: any) => {
                    console.log(`Response status ${code}:`, data);
                    return mockRes;
                }
            }),
            json: (data: any) => {
                console.log('Response:', data);
                return mockRes;
            }
        } as any;
        
        console.log('Calling DocService.createFile...');
        
        // Call the actual createFile method
        await docSvc.createFile(mockReq, mockRes);
        
        console.log('DocService.createFile completed!');
        console.log('=== CREATE NEW FILE TEST COMPLETED ===\n');
        
    } catch (error) {
        console.error('=== CREATE NEW FILE TEST FAILED ===');
        console.error('Error during create new file test:', error);
        throw error;
    }
}

/**
 * Test to verify that renaming folders preserves their children
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function testFolderRenamePreservesChildren(): Promise<void> {
    try {
        console.log('\n=== TESTING FOLDER RENAME PRESERVES CHILDREN ===');
        
        // Debug: Show some sample records to understand the data structure
        console.log('Sample database records:');
        const sampleRecords = await pgdb.query(
            'SELECT parent_path, filename, is_directory FROM vfs_nodes WHERE doc_root_key = $1 ORDER BY parent_path, filename LIMIT 10',
            [testRootKey]
        );
        sampleRecords.rows.forEach((row: any) => {
            const type = row.is_directory ? '📁' : '📄';
            console.log(`  ${type} parent_path:"${row.parent_path}" filename:"${row.filename}"`);
        });
        
        // Test renaming 0001_one to 0099_renamed-one and verify children are preserved
        const oldParentPath = '/0001_test-structure';
        const oldFilename = '0001_one'; // Use the correct existing folder name
        const newFilename = '0099_renamed-one';
        
        console.log(`Renaming folder ${oldFilename} to ${newFilename}...`);
        
        // First verify the folder exists
        const folderExists = await pgdb.query(
            'SELECT vfs_exists($1, $2, $3) as exists',
            [oldParentPath, oldFilename, testRootKey]
        );
        console.log(`Folder ${oldFilename} exists: ${folderExists.rows[0].exists}`);
        
        // Count children before rename
        const expectedChildPath = `${oldParentPath}/${oldFilename}`;
        console.log(`Looking for children with parent_path: "${expectedChildPath}"`);
        
        const beforeChildren = await pgdb.query(
            'SELECT COUNT(*) as count FROM vfs_nodes WHERE doc_root_key = $1 AND parent_path = $2',
            [testRootKey, expectedChildPath]
        );
        console.log(`Children before rename: ${beforeChildren.rows[0].count}`);
        
        // List some actual children for debugging
        const sampleChildren = await pgdb.query(
            'SELECT filename, parent_path FROM vfs_nodes WHERE doc_root_key = $1 AND parent_path = $2 LIMIT 5',
            [testRootKey, expectedChildPath]
        );
        console.log(`Sample children found:`, sampleChildren.rows);
        
        // Perform the rename
        await pgdb.query(
            'SELECT vfs_rename($1, $2, $3, $4, $5)',
            [oldParentPath, oldFilename, oldParentPath, newFilename, testRootKey]
        );
        
        // Count children after rename
        const afterChildren = await pgdb.query(
            'SELECT COUNT(*) as count FROM vfs_nodes WHERE doc_root_key = $1 AND parent_path = $2',
            [testRootKey, `${oldParentPath}/${newFilename}`]
        );
        console.log(`Children after rename: ${afterChildren.rows[0].count}`);
        
        // Verify children count is preserved
        if (beforeChildren.rows[0].count === afterChildren.rows[0].count) {
            console.log('✅ SUCCESS: Children count preserved during folder rename');
        } else {
            console.log('❌ FAILED: Children count changed during folder rename');
        }
        
        console.log('=== FOLDER RENAME TEST COMPLETED ===\n');
        
    } catch (error) {
        console.error('=== FOLDER RENAME TEST FAILED ===');
        console.error('Error during folder rename test:', error);
        throw error;
    }
}

/**
 * Test function to verify PostgreSQL search functionality
 * Tests the vfs_search_text function with basic substring search
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function pgdbTestSearch(): Promise<void> {
    try {
        console.log('=== PGDB SEARCH TEST STARTING ===');
        
        // First, let's add some specific content to search for
        const testPath = '/0001_test-structure/0002_two';
        const testFileName = '0003_search-test.md';
        const searchContent = `# Search Test File

This is a special test file for searching functionality.
It contains the keyword SEARCHME for testing purposes.
Also includes some other content like database and postgresql.

Another line with SEARCHME keyword to test multiple matches.
And some unique content: UNIQUESTRING123 for exact matching.
`;

        console.log('Writing test file with searchable content...');
        await pgdb.query(
            'SELECT vfs_write_text_file($1, $2, $3, $4, $5) as file_id',
            [testPath, testFileName, searchContent, testRootKey, 'text/markdown']
        );

        // Test 1: Basic substring search (MATCH_ANY mode)
        console.log('Test 1: Basic substring search for "SEARCHME"...');
        const searchResult1 = await pgdb.query(
            'SELECT * FROM vfs_search_text($1, $2, $3, $4, $5, $6)',
            ['SEARCHME', '/0001_test-structure', testRootKey, 'MATCH_ANY', false, 'MOD_TIME']
        );
        
        console.log(`Found ${searchResult1.rows.length} files containing "SEARCHME"`);
        searchResult1.rows.forEach((row: any) => {
            console.log(`  - ${row.file} (${row.content_type}, ${row.size_bytes} bytes)`);
        });

        // Verify we found our test file
        const foundTestFile = searchResult1.rows.some((row: any) => row.file === testFileName);
        if (foundTestFile) {
            console.log('✅ SUCCESS: Found the test file with SEARCHME content');
        } else {
            console.log('❌ FAILED: Did not find the test file with SEARCHME content');
        }

        // Test 2: Search for content that should match existing files
        console.log('Test 2: Search for "test file" (should match multiple files)...');
        const searchResult2 = await pgdb.query(
            'SELECT * FROM vfs_search_text($1, $2, $3, $4, $5, $6)',
            ['test file', '/0001_test-structure', testRootKey, 'MATCH_ANY', false, 'MOD_TIME']
        );
        
        console.log(`Found ${searchResult2.rows.length} files containing "test file"`);
        console.log('Files found:');
        searchResult2.rows.forEach((row: any) => {
            console.log(`  - ${row.file} in ${row.full_path}`);
        });

        // Test 3: Search for something unique that should only match our test file
        console.log('Test 3: Search for unique string "UNIQUESTRING123"...');
        const searchResult3 = await pgdb.query(
            'SELECT * FROM vfs_search_text($1, $2, $3, $4, $5, $6)',
            ['UNIQUESTRING123', '/0001_test-structure', testRootKey, 'MATCH_ANY', false, 'MOD_TIME']
        );
        
        console.log(`Found ${searchResult3.rows.length} files containing "UNIQUESTRING123"`);
        if (searchResult3.rows.length === 1 && searchResult3.rows[0].file === testFileName) {
            console.log('✅ SUCCESS: Unique search found exactly one matching file');
        } else {
            console.log('❌ FAILED: Unique search did not return expected single result');
        }

        // Test 4: Search for something that should not be found
        console.log('Test 4: Search for non-existent string "NOTFOUND12345"...');
        const searchResult4 = await pgdb.query(
            'SELECT * FROM vfs_search_text($1, $2, $3, $4, $5, $6)',
            ['NOTFOUND12345', '/0001_test-structure', testRootKey, 'MATCH_ANY', false, 'MOD_TIME']
        );
        
        console.log(`Found ${searchResult4.rows.length} files containing "NOTFOUND12345"`);
        if (searchResult4.rows.length === 0) {
            console.log('✅ SUCCESS: Search for non-existent content returned no results as expected');
        } else {
            console.log('❌ FAILED: Search for non-existent content unexpectedly found results');
        }

        // Test 5: Test MATCH_ALL mode
        console.log('Test 5: MATCH_ALL search for "database postgresql" (both words must be present)...');
        const searchResult5 = await pgdb.query(
            'SELECT * FROM vfs_search_text($1, $2, $3, $4, $5, $6)',
            ['database postgresql', '/0001_test-structure', testRootKey, 'MATCH_ALL', false, 'MOD_TIME']
        );
        
        console.log(`Found ${searchResult5.rows.length} files containing both "database" and "postgresql"`);
        if (searchResult5.rows.length >= 1) {
            console.log('✅ SUCCESS: MATCH_ALL search found files with both terms');
        } else {
            console.log('❌ FAILED: MATCH_ALL search did not find expected results');
        }

        console.log('=== PGDB SEARCH TEST COMPLETED SUCCESSFULLY ===\n');
        
    } catch (error) {
        console.error('=== PGDB SEARCH TEST FAILED ===');
        console.error('Error during search test:', error);
        throw error;
    }
}