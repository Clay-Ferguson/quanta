import pgdb from '../../../../server/db/PGDB.js';

const testRootKey = 'usr';

export async function mkdirRmdirTest2(owner_id: number): Promise<void> {
    const testParentPath = '/test-mkdir-rmdir-2';
    
    try {
        console.log('=== VFS Mkdir/Rmdir Edge Cases Test Starting ===');

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
        
        // Test 1: Create a directory with NULL ordinal (auto-calculate feature)
        console.log('Test 1: Testing vfs_mkdir with NULL ordinal (auto-calculation)...');
        
        // First create a directory with explicit ordinal 100
        await pgdb.query(`
            SELECT vfs_mkdir($1, $2, $3, $4, $5, $6, $7) as dir_id
        `, owner_id, testParentPath, 'first-dir', testRootKey, 100, false, false);
        
        // Create another directory with explicit ordinal 200
        await pgdb.query(`
            SELECT vfs_mkdir($1, $2, $3, $4, $5, $6, $7) as dir_id
        `, owner_id, testParentPath, 'second-dir', testRootKey, 200, false, false);
        
        // Now create a directory with NULL ordinal - should get ordinal 201 (max + 1)
        const nullOrdinalResult = await pgdb.query(`
            SELECT vfs_mkdir($1, $2, $3, $4, NULL, $5, $6) as dir_id
        `, owner_id, testParentPath, 'auto-ordinal-dir', testRootKey, false, false);
        
        const autoOrdinalDirId = nullOrdinalResult.rows[0].dir_id;
        console.log(`Directory with auto ordinal created with ID: ${autoOrdinalDirId}`);
        
        // Verify the ordinal was auto-calculated correctly
        const verifyAutoOrdinalResult = await pgdb.query(`
            SELECT ordinal FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, testParentPath, 'auto-ordinal-dir');
        
        const autoOrdinal = verifyAutoOrdinalResult.rows[0].ordinal;
        console.log(`Auto-calculated ordinal: ${autoOrdinal}`);
        
        if (autoOrdinal !== 201) {
            throw new Error(`Expected auto-ordinal to be 201 (max + 1), got: ${autoOrdinal}`);
        }
        
        console.log('✅ Test 1 passed: NULL ordinal auto-calculation works correctly');

        // Test 2: Delete non-empty directory without recursive flag (should fail)
        console.log('Test 2: Testing vfs_rm on non-empty directory without recursive flag...');
        
        // Create a directory with content
        await pgdb.query(`
            SELECT vfs_mkdir($1, $2, $3, $4, $5, $6, $7) as dir_id
        `, owner_id, testParentPath, 'non-empty-dir', testRootKey, 300, false, false);
        
        // Add a file inside the directory
        const nonEmptyDirPath = testParentPath + '/non-empty-dir';
        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, nonEmptyDirPath, 'file-inside.txt', 1000,
        false, false, 'Content inside directory', null, false, 'text/plain', 25);
        
        console.log('Created non-empty directory with file inside');
        
        // Try to delete without recursive flag
        try {
            await pgdb.query(`
                SELECT vfs_rm($1, $2, $3, $4, $5, $6) as deleted_count
            `, owner_id, testParentPath, 'non-empty-dir', testRootKey, false, false);
            
            throw new Error('Expected exception for non-empty directory without recursive flag');
        } catch (error: any) {
            if (error.message && error.message.includes('Directory not empty')) {
                console.log('✅ Test 2 passed: Non-empty directory correctly rejects non-recursive delete');
            } else {
                throw new Error(`Unexpected error: ${error.message}`);
            }
        }

        // Test 3: Delete the same directory WITH recursive flag (should succeed)
        console.log('Test 3: Testing vfs_rm on non-empty directory WITH recursive flag...');
        
        const recursiveResult = await pgdb.query(`
            SELECT vfs_rm($1, $2, $3, $4, $5, $6) as deleted_count
        `, owner_id, testParentPath, 'non-empty-dir', testRootKey, true, false);
        
        const recursiveDeletedCount = recursiveResult.rows[0].deleted_count;
        console.log(`Recursive delete count: ${recursiveDeletedCount}`);
        
        if (recursiveDeletedCount !== 2) { // dir + file inside
            throw new Error(`Expected 2 deleted items, got: ${recursiveDeletedCount}`);
        }
        
        console.log('✅ Test 3 passed: Recursive deletion of non-empty directory works');

        // Test 4: Directory names with special characters
        console.log('Test 4: Testing directory names with special characters...');
        
        const specialNames = [
            'dir-with-dashes',
            'dir_with_underscores',
            'dir.with.dots',
            'dir with spaces',
            'dir(with)parens',
            'dir[with]brackets'
        ];
        
        for (let i = 0; i < specialNames.length; i++) {
            const dirName = specialNames[i];
            const ordinal = 400 + i;
            
            await pgdb.query(`
                SELECT vfs_mkdir($1, $2, $3, $4, $5, $6, $7) as dir_id
            `, owner_id, testParentPath, dirName, testRootKey, ordinal, false, false);
            
            // Verify it was created correctly
            const verifyResult = await pgdb.query(`
                SELECT filename FROM vfs_nodes 
                WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
            `, testRootKey, testParentPath, dirName);
            
            if (verifyResult.rows.length !== 1) {
                throw new Error(`Failed to create directory with special name: ${dirName}`);
            }
            
            console.log(`  Created directory: "${dirName}"`);
        }
        
        console.log('✅ Test 4 passed: Special character directory names work correctly');

        // Test 5: Authorization check - different owner trying to delete
        console.log('Test 5: Testing authorization for vfs_rm with different owner...');
        
        const differentOwnerId = owner_id + 999;
        
        // Create a directory owned by original owner
        await pgdb.query(`
            SELECT vfs_mkdir($1, $2, $3, $4, $5, $6, $7) as dir_id
        `, owner_id, testParentPath, 'auth-test-dir', testRootKey, 500, false, false);
        
        // Try to delete with different owner
        try {
            await pgdb.query(`
                SELECT vfs_rm($1, $2, $3, $4, $5, $6) as deleted_count
            `, differentOwnerId, testParentPath, 'auth-test-dir', testRootKey, false, false);
            
            throw new Error('Expected exception for unauthorized delete');
        } catch (error: any) {
            if (error.message && error.message.includes('Not authorized')) {
                console.log('✅ Test 5 passed: Authorization correctly blocks unauthorized delete');
            } else {
                throw new Error(`Unexpected error: ${error.message}`);
            }
        }

        // Test 6: Creating directory at root path (empty parent_path)
        console.log('Test 6: Testing vfs_mkdir at root path (empty parent_path)...');
        
        const rootDirName = 'test-root-level-dir-' + Date.now();
        
        const rootMkdirResult = await pgdb.query(`
            SELECT vfs_mkdir($1, $2, $3, $4, $5, $6, $7) as dir_id
        `, owner_id, '', rootDirName, testRootKey, 1, false, false);
        
        const rootDirId = rootMkdirResult.rows[0].dir_id;
        console.log(`Root-level directory created with ID: ${rootDirId}`);
        
        // Verify it was created with empty parent_path
        const verifyRootResult = await pgdb.query(`
            SELECT parent_path, filename, is_directory 
            FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = '' AND filename = $2
        `, testRootKey, rootDirName);
        
        if (verifyRootResult.rows.length !== 1) {
            throw new Error('Failed to create directory at root path');
        }
        
        if (verifyRootResult.rows[0].parent_path !== '') {
            throw new Error(`Expected empty parent_path, got: "${verifyRootResult.rows[0].parent_path}"`);
        }
        
        // Clean up root-level directory
        await pgdb.query(`
            SELECT vfs_rm($1, $2, $3, $4, $5, $6) as deleted_count
        `, owner_id, '', rootDirName, testRootKey, false, false);
        
        console.log('✅ Test 6 passed: Root-level directory creation/deletion works');

        // Test 7: Deeply nested directory with auto-ordinals
        console.log('Test 7: Testing deeply nested directories with auto-ordinals...');
        
        let currentPath = testParentPath;
        const nestedDirNames = ['level1', 'level2', 'level3', 'level4', 'level5'];
        
        for (const dirName of nestedDirNames) {
            // Use NULL ordinal for all nested directories
            await pgdb.query(`
                SELECT vfs_mkdir($1, $2, $3, $4, NULL, $5, $6) as dir_id
            `, owner_id, currentPath, dirName, testRootKey, false, false);
            
            currentPath = currentPath + '/' + dirName;
        }
        
        // Verify all directories exist
        const verifyDeepResult = await pgdb.query(`
            SELECT EXISTS (
                SELECT 1 FROM vfs_nodes 
                WHERE doc_root_key = $1 AND parent_path = $2
            ) as dir_exists
        `, testRootKey, testParentPath + '/level1/level2/level3/level4');
        
        if (!verifyDeepResult.rows[0].dir_exists) {
            throw new Error('Failed to create deeply nested directories');
        }
        
        console.log('✅ Test 7 passed: Deeply nested directory creation works');

        // Test 8: Delete deeply nested structure recursively from top level
        console.log('Test 8: Testing recursive deletion of deeply nested structure...');
        
        const deleteNestedResult = await pgdb.query(`
            SELECT vfs_rm($1, $2, $3, $4, $5, $6) as deleted_count
        `, owner_id, testParentPath, 'level1', testRootKey, true, false);
        
        const nestedDeletedCount = deleteNestedResult.rows[0].deleted_count;
        console.log(`Nested structure deleted, count: ${nestedDeletedCount}`);
        
        if (nestedDeletedCount !== 5) {
            throw new Error(`Expected 5 deleted directories, got: ${nestedDeletedCount}`);
        }
        
        console.log('✅ Test 8 passed: Recursive deletion of nested structure works');

        // Test 9: First directory in empty folder with NULL ordinal
        console.log('Test 9: Testing first directory in empty folder with NULL ordinal...');
        
        // Create a fresh parent folder first
        await pgdb.query(`
            SELECT vfs_mkdir($1, $2, $3, $4, $5, $6, $7) as dir_id
        `, owner_id, testParentPath, 'empty-parent', testRootKey, 600, false, false);
        
        // Create first child with NULL ordinal - should get ordinal 0 (since max is -1 + 1 = 0)
        const emptyParentPath = testParentPath + '/empty-parent';
        await pgdb.query(`
            SELECT vfs_mkdir($1, $2, $3, $4, NULL, $5, $6) as dir_id
        `, owner_id, emptyParentPath, 'first-child', testRootKey, false, false);
        
        const verifyFirstChildResult = await pgdb.query(`
            SELECT ordinal FROM vfs_nodes 
            WHERE doc_root_key = $1 AND parent_path = $2 AND filename = $3
        `, testRootKey, emptyParentPath, 'first-child');
        
        const firstChildOrdinal = verifyFirstChildResult.rows[0].ordinal;
        console.log(`First child ordinal in empty parent: ${firstChildOrdinal}`);
        
        if (firstChildOrdinal !== 0) {
            throw new Error(`Expected first child ordinal to be 0, got: ${firstChildOrdinal}`);
        }
        
        console.log('✅ Test 9 passed: First directory in empty folder gets ordinal 0');

        // Test 10: Multiple directories with same ordinal (edge case - should they work?)
        console.log('Test 10: Testing duplicate ordinal handling...');
        
        await pgdb.query(`
            SELECT vfs_mkdir($1, $2, $3, $4, $5, $6, $7) as dir_id
        `, owner_id, testParentPath, 'dup-ordinal-1', testRootKey, 999, false, false);
        
        // Try creating another with same ordinal - this might succeed or fail depending on DB constraints
        try {
            await pgdb.query(`
                SELECT vfs_mkdir($1, $2, $3, $4, $5, $6, $7) as dir_id
            `, owner_id, testParentPath, 'dup-ordinal-2', testRootKey, 999, false, false);
            
            console.log('  Note: Duplicate ordinals are allowed (no unique constraint on ordinal alone)');
            console.log('✅ Test 10 passed: Duplicate ordinals handled (allowed or rejected gracefully)');
        } catch (error: any) {
            if (error.message.includes('duplicate') || error.message.includes('unique')) {
                console.log('  Note: Duplicate ordinals are rejected by unique constraint');
                console.log('✅ Test 10 passed: Duplicate ordinals handled (allowed or rejected gracefully)');
            } else {
                throw error;
            }
        }

        console.log('=== VFS Mkdir/Rmdir Edge Cases Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS Mkdir/Rmdir Edge Cases Test Failed ===');
        console.error('Error during test:', error);
        throw error;
    } finally {
        // Always clean up test data, even if test fails
        console.log('Final cleanup of test data...');
        try {
            await pgdb.query(`
                DELETE FROM vfs_nodes 
                WHERE doc_root_key = $1 AND parent_path LIKE $2
            `, testRootKey, testParentPath + '%');
            
            // Clean up any items directly in testParentPath
            await pgdb.query(`
                DELETE FROM vfs_nodes 
                WHERE doc_root_key = $1 AND parent_path = $2
            `, testRootKey, testParentPath);
        } catch (cleanupError) {
            console.log('Warning: Final cleanup failed:', cleanupError);
        }
    }
}
