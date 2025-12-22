import pgdb from '../../../../server/db/PGDB.js';

const testRootKey = 'usr';

export async function ensurePathAndRenameTest2(owner_id: number): Promise<void> {
    const testParentPath = '/test-ensure-path-rename2';
    const randomSuffix = Math.floor(Math.random() * 10000);
    
    try {
        console.log('=== VFS Ensure Path and Rename Edge Cases Test Starting ===');

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

        // Test 1: vfs_ensure_path idempotency - calling on already existing path should succeed
        console.log('Test 1: Testing vfs_ensure_path idempotency...');
        const idempotencyPath = `${testParentPath}/idempotency-${randomSuffix}`;
        
        // Create path first time
        const firstCreateResult = await pgdb.query(`
            SELECT vfs_ensure_path($1, $2, $3) as path_created
        `, owner_id, idempotencyPath, testRootKey);
        
        if (firstCreateResult.rows[0].path_created !== true) {
            throw new Error(`First vfs_ensure_path call failed`);
        }
        
        // Call again on same path - should still return true
        const secondCreateResult = await pgdb.query(`
            SELECT vfs_ensure_path($1, $2, $3) as path_created
        `, owner_id, idempotencyPath, testRootKey);
        
        if (secondCreateResult.rows[0].path_created !== true) {
            throw new Error(`Second vfs_ensure_path call should return true for existing path`);
        }
        console.log('✅ Test 1 passed: vfs_ensure_path is idempotent');

        // Test 2: vfs_ensure_path with trailing slashes should work
        console.log('Test 2: Testing vfs_ensure_path with trailing slashes...');
        const trailingSlashPath = `${testParentPath}/trailing-slash-${randomSuffix}/`;
        
        const trailingSlashResult = await pgdb.query(`
            SELECT vfs_ensure_path($1, $2, $3) as path_created
        `, owner_id, trailingSlashPath, testRootKey);
        
        if (trailingSlashResult.rows[0].path_created !== true) {
            throw new Error(`vfs_ensure_path with trailing slash failed`);
        }
        
        // Verify the directory was created (without trailing slash)
        const trailingVerify = await pgdb.query(`
            SELECT vfs_exists($1, $2, $3) as exists
        `, testParentPath, `trailing-slash-${randomSuffix}`, testRootKey);
        
        if (trailingVerify.rows[0].exists !== true) {
            throw new Error(`Directory with trailing slash not created properly`);
        }
        console.log('✅ Test 2 passed: vfs_ensure_path handles trailing slashes');

        // Test 3: vfs_ensure_path with empty or root path
        console.log('Test 3: Testing vfs_ensure_path with empty and root paths...');
        
        const emptyPathResult = await pgdb.query(`
            SELECT vfs_ensure_path($1, $2, $3) as path_created
        `, owner_id, '', testRootKey);
        
        if (emptyPathResult.rows[0].path_created !== true) {
            throw new Error(`vfs_ensure_path with empty path should return true`);
        }
        
        const rootPathResult = await pgdb.query(`
            SELECT vfs_ensure_path($1, $2, $3) as path_created
        `, owner_id, '/', testRootKey);
        
        if (rootPathResult.rows[0].path_created !== true) {
            throw new Error(`vfs_ensure_path with '/' path should return true`);
        }
        console.log('✅ Test 3 passed: vfs_ensure_path handles empty and root paths');

        // Test 4: Cross-folder move (rename to different parent)
        console.log('Test 4: Testing cross-folder move...');
        
        // Create source and destination directories
        const sourceDirPath = `${testParentPath}/source-dir-${randomSuffix}`;
        const destParentPath = `${testParentPath}/dest-parent-${randomSuffix}`;
        const itemToMoveName = `item-to-move-${randomSuffix}`;
        
        await pgdb.query(`SELECT vfs_ensure_path($1, $2, $3)`, owner_id, sourceDirPath, testRootKey);
        await pgdb.query(`SELECT vfs_ensure_path($1, $2, $3)`, owner_id, destParentPath, testRootKey);
        
        // Create a directory inside source to move
        await pgdb.query(`SELECT vfs_ensure_path($1, $2, $3)`, owner_id, `${sourceDirPath}/${itemToMoveName}`, testRootKey);
        
        // Move the directory to a different parent
        const crossFolderResult = await pgdb.query(`
            SELECT * FROM vfs_rename($1, $2, $3, $4, $5, $6)
        `, owner_id, sourceDirPath, itemToMoveName, destParentPath, itemToMoveName, testRootKey);
        
        if (crossFolderResult.rows[0].success !== true) {
            throw new Error(`Cross-folder move failed: ${crossFolderResult.rows[0].diagnostic}`);
        }
        
        // Verify old location is gone, new location exists
        const oldLocationCheck = await pgdb.query(`
            SELECT vfs_exists($1, $2, $3) as exists
        `, sourceDirPath, itemToMoveName, testRootKey);
        
        const newLocationCheck = await pgdb.query(`
            SELECT vfs_exists($1, $2, $3) as exists
        `, destParentPath, itemToMoveName, testRootKey);
        
        if (oldLocationCheck.rows[0].exists !== false) {
            throw new Error(`Old location should not exist after cross-folder move`);
        }
        
        if (newLocationCheck.rows[0].exists !== true) {
            throw new Error(`New location should exist after cross-folder move`);
        }
        console.log('✅ Test 4 passed: Cross-folder move works correctly');

        // Test 5: vfs_rename when target already exists (should fail)
        console.log('Test 5: Testing vfs_rename when target already exists...');
        
        const existingDir1 = `existing-dir1-${randomSuffix}`;
        const existingDir2 = `existing-dir2-${randomSuffix}`;
        
        await pgdb.query(`SELECT vfs_ensure_path($1, $2, $3)`, owner_id, `${testParentPath}/${existingDir1}`, testRootKey);
        await pgdb.query(`SELECT vfs_ensure_path($1, $2, $3)`, owner_id, `${testParentPath}/${existingDir2}`, testRootKey);
        
        // Try to rename existingDir1 to existingDir2 (should fail)
        const conflictResult = await pgdb.query(`
            SELECT * FROM vfs_rename($1, $2, $3, $4, $5, $6)
        `, owner_id, testParentPath, existingDir1, testParentPath, existingDir2, testRootKey);
        
        if (conflictResult.rows[0].success !== false) {
            throw new Error(`Rename to existing target should fail`);
        }
        
        if (!conflictResult.rows[0].diagnostic.includes('already exists')) {
            throw new Error(`Expected 'already exists' in diagnostic, got: ${conflictResult.rows[0].diagnostic}`);
        }
        console.log('✅ Test 5 passed: vfs_rename correctly fails when target exists');

        // Test 6: Renaming a file (not directory)
        console.log('Test 6: Testing renaming a file...');
        
        const fileParentPath = `${testParentPath}/file-test-${randomSuffix}`;
        await pgdb.query(`SELECT vfs_ensure_path($1, $2, $3)`, owner_id, fileParentPath, testRootKey);
        
        // Create a file using vfs_write_text_file
        const oldFileName = `test-file-${randomSuffix}.txt`;
        const newFileName = `renamed-file-${randomSuffix}.txt`;
        const fileContent = 'Test file content for rename test';
        
        await pgdb.query(`
            SELECT vfs_write_text_file($1, $2, $3, $4, $5, $6, $7, $8)
        `, owner_id, fileParentPath, oldFileName, fileContent, testRootKey, 0, 'text/plain', false);
        
        // Rename the file
        const fileRenameResult = await pgdb.query(`
            SELECT * FROM vfs_rename($1, $2, $3, $4, $5, $6)
        `, owner_id, fileParentPath, oldFileName, fileParentPath, newFileName, testRootKey);
        
        if (fileRenameResult.rows[0].success !== true) {
            throw new Error(`File rename failed: ${fileRenameResult.rows[0].diagnostic}`);
        }
        
        // Verify old file name is gone, new file name exists
        const oldFileCheck = await pgdb.query(`
            SELECT vfs_exists($1, $2, $3) as exists
        `, fileParentPath, oldFileName, testRootKey);
        
        const newFileCheck = await pgdb.query(`
            SELECT vfs_exists($1, $2, $3) as exists
        `, fileParentPath, newFileName, testRootKey);
        
        if (oldFileCheck.rows[0].exists !== false) {
            throw new Error(`Old file name should not exist after rename`);
        }
        
        if (newFileCheck.rows[0].exists !== true) {
            throw new Error(`New file name should exist after rename`);
        }
        
        // Verify file content is preserved
        const contentCheck = await pgdb.query(`
            SELECT vfs_read_file($1, $2, $3, $4) as content
        `, owner_id, fileParentPath, newFileName, testRootKey);
        
        const retrievedContent = contentCheck.rows[0].content ? contentCheck.rows[0].content.toString('utf8') : null;
        if (retrievedContent !== fileContent) {
            throw new Error(`File content was not preserved after rename. Expected: "${fileContent}", Got: "${retrievedContent}"`);
        }
        console.log('✅ Test 6 passed: File rename works correctly and preserves content');

        // Test 7: Verifying children paths are updated when parent directory is moved
        console.log('Test 7: Testing children path updates on parent move...');
        
        const parentDirPath = `${testParentPath}/parent-with-children-${randomSuffix}`;
        const childDirName = `child-dir-${randomSuffix}`;
        const grandchildFileName = `grandchild-${randomSuffix}.txt`;
        
        // Create nested structure: parent -> child -> grandchild
        await pgdb.query(`SELECT vfs_ensure_path($1, $2, $3)`, owner_id, `${parentDirPath}/${childDirName}`, testRootKey);
        await pgdb.query(`
            SELECT vfs_write_text_file($1, $2, $3, $4, $5, $6, $7, $8)
        `, owner_id, `${parentDirPath}/${childDirName}`, grandchildFileName, 'grandchild content', testRootKey, 0, 'text/plain', false);
        
        // Rename the parent directory
        const newParentName = `renamed-parent-${randomSuffix}`;
        const renameParentResult = await pgdb.query(`
            SELECT * FROM vfs_rename($1, $2, $3, $4, $5, $6)
        `, owner_id, testParentPath, `parent-with-children-${randomSuffix}`, testParentPath, newParentName, testRootKey);
        
        if (renameParentResult.rows[0].success !== true) {
            throw new Error(`Parent directory rename failed: ${renameParentResult.rows[0].diagnostic}`);
        }
        
        // Verify child directory now has updated parent_path
        const childCheck = await pgdb.query(`
            SELECT vfs_exists($1, $2, $3) as exists
        `, `${testParentPath}/${newParentName}`, childDirName, testRootKey);
        
        if (childCheck.rows[0].exists !== true) {
            throw new Error(`Child directory path was not updated after parent rename`);
        }
        
        // Verify grandchild file now has updated parent_path
        const grandchildCheck = await pgdb.query(`
            SELECT vfs_exists($1, $2, $3) as exists
        `, `${testParentPath}/${newParentName}/${childDirName}`, grandchildFileName, testRootKey);
        
        if (grandchildCheck.rows[0].exists !== true) {
            throw new Error(`Grandchild file path was not updated after parent rename`);
        }
        
        // Verify grandchild content is still accessible
        const grandchildContent = await pgdb.query(`
            SELECT vfs_read_file($1, $2, $3, $4) as content
        `, owner_id, `${testParentPath}/${newParentName}/${childDirName}`, grandchildFileName, testRootKey);
        
        const retrievedGrandchildContent = grandchildContent.rows[0].content ? grandchildContent.rows[0].content.toString('utf8') : null;
        if (retrievedGrandchildContent !== 'grandchild content') {
            throw new Error(`Grandchild content was not preserved after parent rename. Expected: "grandchild content", Got: "${retrievedGrandchildContent}"`);
        }
        console.log('✅ Test 7 passed: Children paths are correctly updated on parent move');

        // Test 8: vfs_rename with non-existent source (should fail)
        console.log('Test 8: Testing vfs_rename with non-existent source...');
        
        const nonExistentResult = await pgdb.query(`
            SELECT * FROM vfs_rename($1, $2, $3, $4, $5, $6)
        `, owner_id, testParentPath, `nonexistent-${randomSuffix}`, testParentPath, `new-name-${randomSuffix}`, testRootKey);
        
        if (nonExistentResult.rows[0].success !== false) {
            throw new Error(`Rename of non-existent source should fail`);
        }
        
        if (!nonExistentResult.rows[0].diagnostic.includes('not found')) {
            throw new Error(`Expected 'not found' in diagnostic, got: ${nonExistentResult.rows[0].diagnostic}`);
        }
        console.log('✅ Test 8 passed: vfs_rename correctly fails for non-existent source');

        // Test 9: vfs_ensure_path with multiple consecutive slashes
        console.log('Test 9: Testing vfs_ensure_path with multiple consecutive slashes...');
        
        const multiSlashPath = `${testParentPath}//multi//slash//${randomSuffix}`;
        const multiSlashResult = await pgdb.query(`
            SELECT vfs_ensure_path($1, $2, $3) as path_created
        `, owner_id, multiSlashPath, testRootKey);
        
        if (multiSlashResult.rows[0].path_created !== true) {
            throw new Error(`vfs_ensure_path with multiple slashes failed`);
        }
        
        // Verify the path was created (should skip empty parts from consecutive slashes)
        const multiSlashVerify = await pgdb.query(`
            SELECT vfs_exists($1, $2, $3) as exists
        `, `${testParentPath}/multi/slash`, `${randomSuffix}`, testRootKey);
        
        if (multiSlashVerify.rows[0].exists !== true) {
            throw new Error(`Directory with multiple consecutive slashes not created properly`);
        }
        console.log('✅ Test 9 passed: vfs_ensure_path handles multiple consecutive slashes');

        console.log('=== VFS Ensure Path and Rename Edge Cases Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS Ensure Path and Rename Edge Cases Test Failed ===');
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
        } catch (cleanupError) {
            console.log('Warning: Final cleanup failed:', cleanupError);
        }
    }
}
