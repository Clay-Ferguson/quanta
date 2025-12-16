import pgdb from '../../../../server/db/PGDB.js';

const testRootKey = 'usr';

export async function mkdirRmdirTest(owner_id: number): Promise<void> {
    const testParentPath = '/test-mkdir-rmdir';
    
    try {
        console.log('=== VFS Mkdir/Rmdir Test Starting ===');

        // Clean up any leftover test data from previous runs first
        console.log('Cleaning up any existing test data...');
        try {
            await pgdb.query(`
                DELETE FROM vfs_nodes 
                WHERE doc_root_key = $1 AND parent_path LIKE $2
            `, testRootKey, testParentPath + '%');
        } catch (cleanupError) {
            console.log('Warning: Initial cleanup failed (this is usually not a problem):', cleanupError);
        }
        
        // Test 1: Create a directory using vfs_mkdir
        const testDirName = 'test-directory';
        const testDirOrdinal = 1000;

        console.log('Testing vfs_mkdir function...');
        
        const mkdirResult = await pgdb.query(`
            SELECT vfs_mkdir($1, $2, $3, $4, $5, $6, $7) as dir_id
        `, owner_id, testParentPath, testDirName, testRootKey, testDirOrdinal, false, false);
        
        const dirId = mkdirResult.rows[0].dir_id;
        console.log(`Directory created with ID: ${dirId}`);

        // Verify the directory was created correctly
        console.log('Verifying directory was created correctly...');
        
        const verifyResult = await pgdb.query(`
            SELECT filename, ordinal, is_directory, owner_id, is_public, content_type, size_bytes
            FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, testDirName);
        
        if (verifyResult.rows.length === 0) {
            throw new Error('Directory not found after creation');
        }

        const dirData = verifyResult.rows[0];
        
        console.log('Verifying directory properties...');
        console.log(`Directory - filename: ${dirData.filename}, ordinal: ${dirData.ordinal}, is_directory: ${dirData.is_directory}`);
        console.log(`Directory - owner_id: ${dirData.owner_id}, is_public: ${dirData.is_public}, content_type: ${dirData.content_type}`);
        
        if (dirData.filename !== testDirName) {
            throw new Error(`Filename mismatch! Expected: ${testDirName}, Got: ${dirData.filename}`);
        }
        
        if (dirData.ordinal !== testDirOrdinal) {
            throw new Error(`Ordinal mismatch! Expected: ${testDirOrdinal}, Got: ${dirData.ordinal}`);
        }
        
        if (dirData.is_directory !== true) {
            throw new Error(`Directory flag mismatch! Expected: true, Got: ${dirData.is_directory}`);
        }
        
        if (dirData.owner_id !== owner_id) {
            throw new Error(`Owner ID mismatch! Expected: ${owner_id}, Got: ${dirData.owner_id}`);
        }
        
        if (dirData.is_public !== false) {
            throw new Error(`Public flag mismatch! Expected: false, Got: ${dirData.is_public}`);
        }
        
        if (dirData.content_type !== 'directory') {
            throw new Error(`Content type mismatch! Expected: 'directory', Got: ${dirData.content_type}`);
        }
        
        if (Number(dirData.size_bytes) !== 0) {
            throw new Error(`Size bytes mismatch! Expected: 0, Got: ${dirData.size_bytes}`);
        }

        console.log('✅ Directory creation test passed');

        // Test 2: Verify the directory exists using vfs_exists
        console.log('Testing that created directory exists...');
        
        const existsResult = await pgdb.query(`
            SELECT vfs_exists($1, $2, $3) as dir_exists
        `, testParentPath, testDirName, testRootKey);
        
        const dirExists = existsResult.rows[0].dir_exists;
        console.log(`Directory exists: ${dirExists}`);
        
        if (dirExists !== true) {
            throw new Error(`Directory should exist after creation, got: ${dirExists}`);
        }

        console.log('✅ Directory exists verification test passed');

        // Test 3: Try to create the same directory again (should fail)
        console.log('Testing vfs_mkdir for duplicate directory (should fail)...');
        
        try {
            await pgdb.query(`
                SELECT vfs_mkdir($1, $2, $3, $4, $5, $6, $7) as dir_id
            `, owner_id, testParentPath, testDirName, testRootKey, testDirOrdinal, false, false);
            
            throw new Error('Expected exception for duplicate directory, but function succeeded');
        } catch (error: any) {
            if (error.message && error.message.includes('Directory already exists')) {
                console.log('✅ Duplicate directory test passed - correctly threw exception');
            } else {
                throw new Error(`Unexpected error for duplicate directory: ${error.message}`);
            }
        }

        // Test 4: Delete the directory using vfs_rm
        console.log('Testing vfs_rm function for empty directory...');
        
        const rmdirResult = await pgdb.query(`
            SELECT vfs_rm($1, $2, $3, $4, $5, $6) as deleted_count
        `, owner_id, testParentPath, testDirName, testRootKey, false, false);
        
        const deletedCount = rmdirResult.rows[0].deleted_count;
        console.log(`Directory deletion result - deleted count: ${deletedCount}`);
        
        if (deletedCount !== 1) {
            throw new Error(`Expected 1 deleted item (the directory), got: ${deletedCount}`);
        }

        console.log('✅ Empty directory deletion test passed');

        // Test 5: Verify the directory no longer exists
        console.log('Testing that deleted directory no longer exists...');
        
        const noLongerExistsResult = await pgdb.query(`
            SELECT vfs_exists($1, $2, $3) as dir_exists
        `, testParentPath, testDirName, testRootKey);
        
        const dirNoLongerExists = noLongerExistsResult.rows[0].dir_exists;
        console.log(`Directory exists after deletion: ${dirNoLongerExists}`);
        
        if (dirNoLongerExists !== false) {
            throw new Error(`Directory should not exist after deletion, got: ${dirNoLongerExists}`);
        }

        console.log('✅ Directory removal verification test passed');

        // Test 6: Create directory with subdirectories and files, then delete recursively
        const testDirName2 = 'test-directory-with-content';
        const testDirOrdinal2 = 2000;

        console.log('Testing vfs_mkdir and recursive deletion with content...');
        
        // Create parent directory
        await pgdb.query(`
            SELECT vfs_mkdir($1, $2, $3, $4, $5, $6, $7) as dir_id
        `, owner_id, testParentPath, testDirName2, testRootKey, testDirOrdinal2, false, false);
        
        console.log(`Created parent directory: ${testDirName2}`);

        // Create some files and subdirectories inside it
        const dirPath = testParentPath + '/' + testDirName2;
        
        // Create a file in the directory
        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, dirPath, 'file-in-dir.txt', 1000,
        false, false, 'Content in directory', null, false, 'text/plain', Buffer.from('Content in directory').length);
        
        console.log('Created file in directory: file-in-dir.txt');

        // Create a subdirectory
        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, dirPath, 'subdir', 2000,
        true, false, null, null, false, 'directory', 0);
        
        console.log('Created subdirectory: subdir');

        // Create a file in the subdirectory
        const subDirPath = dirPath + '/subdir';
        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, subDirPath, 'file-in-subdir.txt', 1000,
        false, false, 'Content in subdirectory', null, false, 'text/plain', Buffer.from('Content in subdirectory').length);
        
        console.log('Created file in subdirectory: file-in-subdir.txt');

        // Verify directory has content before deletion
        const beforeDeleteResult = await pgdb.query(`
            SELECT filename, parent_path 
            FROM vfs_nodes 
            WHERE doc_root_key = $1 AND (parent_path = $2 OR parent_path LIKE $3)
            ORDER BY parent_path, filename
        `, testRootKey, dirPath, dirPath + '/%');
        
        console.log(`Found ${beforeDeleteResult.rows.length} items in directory structure before deletion:`);
        beforeDeleteResult.rows.forEach((row: any, index: number) => {
            console.log(`  ${index + 1}. ${row.filename} (in ${row.parent_path})`);
        });
        
        if (beforeDeleteResult.rows.length !== 3) { // file-in-dir.txt, subdir, file-in-subdir.txt
            throw new Error(`Expected 3 items in directory structure, got: ${beforeDeleteResult.rows.length}`);
        }

        // Test recursive deletion
        console.log('Testing vfs_rm for directory with content (recursive deletion)...');
        
        const rmdirRecursiveResult = await pgdb.query(`
            SELECT vfs_rm($1, $2, $3, $4, $5, $6) as deleted_count
        `, owner_id, testParentPath, testDirName2, testRootKey, true, false);
        
        const recursiveDeletedCount = rmdirRecursiveResult.rows[0].deleted_count;
        console.log(`Recursive directory deletion result - deleted count: ${recursiveDeletedCount}`);
        
        if (recursiveDeletedCount !== 4) { // parent dir + file-in-dir.txt + subdir + file-in-subdir.txt
            throw new Error(`Expected 4 deleted items (dir + 3 contents), got: ${recursiveDeletedCount}`);
        }

        // Verify all content was deleted
        const afterDeleteResult = await pgdb.query(`
            SELECT filename, parent_path 
            FROM vfs_nodes 
            WHERE doc_root_key = $1 AND (parent_path = $2 OR parent_path LIKE $3)
        `, testRootKey, dirPath, dirPath + '/%');
        
        console.log(`Found ${afterDeleteResult.rows.length} items in directory structure after deletion`);
        
        if (afterDeleteResult.rows.length !== 0) {
            throw new Error(`Expected 0 items after recursive deletion, got: ${afterDeleteResult.rows.length}`);
        }

        console.log('✅ Recursive directory deletion test passed');

        // Test 7: Try to delete non-existent directory (should fail)
        console.log('Testing vfs_rm for non-existent directory (should fail)...');
        
        try {
            await pgdb.query(`
                SELECT vfs_rm($1, $2, $3, $4, $5, $6) as deleted_count
            `, owner_id, testParentPath, 'non-existent-directory', testRootKey, false, false);
            
            throw new Error('Expected exception for non-existent directory, but function succeeded');
        } catch (error: any) {
            if (error.message && (error.message.includes('Directory not found') || error.message.includes('File or directory not found'))) {
                console.log('✅ Non-existent directory deletion test passed - correctly threw exception');
            } else {
                throw new Error(`Unexpected error for non-existent directory: ${error.message}`);
            }
        }

        // Test 7b: Try to delete non-existent directory with force=true (should succeed with 0 count)
        console.log('Testing vfs_rm for non-existent directory with force=true...');
        
        const forceRmdirResult = await pgdb.query(`
            SELECT vfs_rm($1, $2, $3, $4, $5, $6) as deleted_count
        `, owner_id, testParentPath, 'non-existent-directory-force', testRootKey, false, true);
        
        const forceDeletedCount = forceRmdirResult.rows[0].deleted_count;
        console.log(`Force directory deletion result - deleted count: ${forceDeletedCount}`);
        
        if (forceDeletedCount !== 0) {
            throw new Error(`Expected 0 deleted items with force=true, got: ${forceDeletedCount}`);
        }
        console.log('✅ Non-existent directory force deletion test passed');

        // Test 8: Create public directory and test permissions
        const publicDirName = 'public-test-directory';
        const publicDirOrdinal = 3000;

        console.log('Testing vfs_mkdir with public directory...');
        
        const publicMkdirResult = await pgdb.query(`
            SELECT vfs_mkdir($1, $2, $3, $4, $5, $6, $7) as dir_id
        `, owner_id, testParentPath, publicDirName, testRootKey, publicDirOrdinal, false, true); // is_public = true
        
        const publicDirId = publicMkdirResult.rows[0].dir_id;
        console.log(`Public directory created with ID: ${publicDirId}`);

        // Verify public directory properties
        const publicDirVerifyResult = await pgdb.query(`
            SELECT is_public, is_directory
            FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, publicDirName);
        
        const publicDirData = publicDirVerifyResult.rows[0];
        
        if (publicDirData.is_public !== true) {
            throw new Error(`Public directory flag mismatch! Expected: true, Got: ${publicDirData.is_public}`);
        }
        
        if (publicDirData.is_directory !== true) {
            throw new Error(`Directory flag mismatch! Expected: true, Got: ${publicDirData.is_directory}`);
        }

        console.log('✅ Public directory creation test passed');

        // Delete the public directory
        console.log('Testing vfs_rm for public directory...');
        
        const publicRmdirResult = await pgdb.query(`
            SELECT vfs_rm($1, $2, $3, $4, $5, $6) as deleted_count
        `, owner_id, testParentPath, publicDirName, testRootKey, false, false);
        
        const publicDeletedCount = publicRmdirResult.rows[0].deleted_count;
        console.log(`Public directory deletion result - deleted count: ${publicDeletedCount}`);
        
        if (publicDeletedCount !== 1) {
            throw new Error(`Expected 1 deleted item (public directory), got: ${publicDeletedCount}`);
        }

        console.log('✅ Public directory deletion test passed');

        // Test 9: Test ordinal ordering with multiple directories
        console.log('Testing vfs_mkdir with multiple directories for ordinal ordering...');
        
        const testDirs = [
            { name: 'dir-c', ordinal: 3000 },
            { name: 'dir-a', ordinal: 1000 },
            { name: 'dir-b', ordinal: 2000 },
        ];

        // Create all test directories
        for (const testDir of testDirs) {
            await pgdb.query(`
                SELECT vfs_mkdir($1, $2, $3, $4, $5, $6, $7) as dir_id
            `, owner_id, testParentPath, testDir.name, testRootKey, testDir.ordinal, false, false);
            
            console.log(`Created directory: ${testDir.name} (ordinal: ${testDir.ordinal})`);
        }
        
        // Verify ordering by reading directory
        const orderingResult = await pgdb.query(`
            SELECT filename, ordinal, is_directory
            FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND is_directory = true
            ORDER BY ordinal ASC, filename ASC
        `, testRootKey, testParentPath);
        
        console.log(`Found ${orderingResult.rows.length} directories (ordered by ordinal):`);
        orderingResult.rows.forEach((row: any, index: number) => {
            console.log(`  ${index + 1}. ${row.filename} (ordinal: ${row.ordinal})`);
        });
        
        // Verify the ordering is correct (by ordinal)
        const expectedOrder = ['dir-a', 'dir-b', 'dir-c']; // ordinals: 1000, 2000, 3000
        const actualOrder = orderingResult.rows.map((row: any) => row.filename);
        
        if (JSON.stringify(actualOrder) !== JSON.stringify(expectedOrder)) {
            throw new Error(`Ordering incorrect! Expected: ${expectedOrder.join(', ')}, Got: ${actualOrder.join(', ')}`);
        }

        console.log('✅ Multiple directories ordinal ordering test passed');

        // Delete all test directories
        console.log('Cleaning up test directories...');
        
        for (const testDir of testDirs) {
            await pgdb.query(`
                SELECT vfs_rm($1, $2, $3, $4, $5, $6) as deleted_count
            `, owner_id, testParentPath, testDir.name, testRootKey, false, false);
            
            console.log(`Deleted directory: ${testDir.name}`);
        }

        // Final verification that all directories are gone
        const finalVerifyResult = await pgdb.query(`
            SELECT filename 
            FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2
        `, testRootKey, testParentPath);
        
        console.log(`Found ${finalVerifyResult.rows.length} items after cleanup`);
        
        if (finalVerifyResult.rows.length !== 0) {
            throw new Error(`Expected 0 items after cleanup, got: ${finalVerifyResult.rows.length}`);
        }

        console.log('✅ Final cleanup verification test passed');
        console.log('=== VFS Mkdir/Rmdir Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS Mkdir/Rmdir Test Failed ===');
        console.error('Error during VFS mkdir/rmdir test:', error);
        throw error;
    } finally {
        // Always clean up test data, even if test fails
        console.log('Final cleanup of test data...');
        try {
            await pgdb.query(`
                DELETE FROM vfs_nodes 
                WHERE doc_root_key = $1 AND parent_path LIKE $2
            `, testRootKey, testParentPath + '%');
        } catch (cleanupError) {
            console.log('Warning: Final cleanup failed:', cleanupError);
        }
    }
}