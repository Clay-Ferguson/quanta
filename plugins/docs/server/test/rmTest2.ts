import vfs from '../VFS.js';

/**
 * rmTest2 - Additional edge cases for VFS rm() method
 * 
 * This test covers:
 * 1. Deleting an empty directory
 * 2. Deleting a deeply nested file (3+ levels)
 * 3. Recursive deletion of deeply nested directory structure
 * 4. Force + recursive options combined
 * 5. Deleting binary files
 * 6. Deleting files with special characters in names
 * 7. Attempting to delete a non-empty directory without recursive flag
 * 8. Verifying parent directories remain after child deletion
 */
export async function rmTest2(owner_id: number): Promise<void> {
    try {
        console.log('=== VFS RM Test 2 (Edge Cases) Starting ===');

        // Test 1: Delete an empty directory
        console.log('Test 1 - Create and delete an empty directory');
        const emptyDirName = 'test-rm2-empty-dir';
        
        // Create empty directory
        await vfs.mkdirEx(owner_id, emptyDirName);
        console.log(`Test 1 - Created empty directory: ${emptyDirName}`);
        
        // Verify it exists
        const emptyDirExists = await vfs.exists(emptyDirName);
        if (!emptyDirExists) {
            throw new Error('Test 1 failed! Empty directory should exist after creation');
        }
        
        // Delete the empty directory
        await vfs.rm(owner_id, emptyDirName);
        console.log('Test 1 - Deleted empty directory');
        
        // Verify it no longer exists
        const emptyDirExistsAfter = await vfs.exists(emptyDirName);
        if (emptyDirExistsAfter) {
            throw new Error('Test 1 failed! Empty directory should not exist after deletion');
        }
        console.log('Test 1 passed - Empty directory deletion verified');

        // Test 2: Delete a deeply nested file (3+ levels deep)
        console.log('Test 2 - Create and delete a deeply nested file');
        const deepPath = 'test-rm2-deep/level2/level3';
        const deepFileName = 'test-rm2-deep/level2/level3/deep-file.txt';
        
        // Create the deep directory structure (recursive: true needed for nested paths)
        await vfs.mkdirEx(owner_id, deepPath, { recursive: true });
        console.log(`Test 2 - Created deep directory structure: ${deepPath}`);
        
        // Create a file at the deepest level
        await vfs.writeFile(owner_id, deepFileName, 'Content at deep level', 'utf8');
        console.log(`Test 2 - Created deep file: ${deepFileName}`);
        
        // Verify it exists
        const deepFileExists = await vfs.exists(deepFileName);
        if (!deepFileExists) {
            throw new Error('Test 2 failed! Deep file should exist after creation');
        }
        
        // Delete just the file (not the directories)
        await vfs.rm(owner_id, deepFileName);
        console.log('Test 2 - Deleted deep file');
        
        // Verify file is gone
        const deepFileExistsAfter = await vfs.exists(deepFileName);
        if (deepFileExistsAfter) {
            throw new Error('Test 2 failed! Deep file should not exist after deletion');
        }
        
        // Verify parent directories still exist
        const parentDirExists = await vfs.exists(deepPath);
        if (!parentDirExists) {
            throw new Error('Test 2 failed! Parent directories should still exist after file deletion');
        }
        console.log('Test 2 passed - Deep file deletion verified, parent dirs intact');
        
        // Cleanup the deep structure
        await vfs.rm(owner_id, 'test-rm2-deep', { recursive: true, force: true });

        // Test 3: Recursive deletion of deeply nested directory structure
        console.log('Test 3 - Recursive deletion of deeply nested structure');
        const nestedBase = 'test-rm2-nested-structure';
        const nestedPaths = [
            `${nestedBase}/a/b/c`,
            `${nestedBase}/a/b/d`,
            `${nestedBase}/a/e`,
            `${nestedBase}/f`
        ];
        
        // Create the complex structure (recursive: true needed for nested paths)
        for (const path of nestedPaths) {
            await vfs.mkdirEx(owner_id, path, { recursive: true });
        }
        
        // Add files at various levels
        await vfs.writeFile(owner_id, `${nestedBase}/root-file.txt`, 'Root level file', 'utf8');
        await vfs.writeFile(owner_id, `${nestedBase}/a/a-file.txt`, 'Level a file', 'utf8');
        await vfs.writeFile(owner_id, `${nestedBase}/a/b/b-file.txt`, 'Level b file', 'utf8');
        await vfs.writeFile(owner_id, `${nestedBase}/a/b/c/c-file.txt`, 'Level c file', 'utf8');
        await vfs.writeFile(owner_id, `${nestedBase}/f/f-file.txt`, 'Level f file', 'utf8');
        console.log('Test 3 - Created complex nested structure with files at multiple levels');
        
        // Delete recursively from the base
        await vfs.rm(owner_id, nestedBase, { recursive: true });
        console.log('Test 3 - Recursively deleted nested structure');
        
        // Verify entire structure is gone
        const nestedExistsAfter = await vfs.exists(nestedBase);
        if (nestedExistsAfter) {
            throw new Error('Test 3 failed! Nested structure should be completely removed');
        }
        console.log('Test 3 passed - Recursive nested deletion verified');

        // Test 4: Force + recursive options combined
        console.log('Test 4 - Force + recursive combined on non-existent path');
        
        // This should not throw an error even though the path doesn't exist
        await vfs.rm(owner_id, 'totally-non-existent-path/with/nested/parts', { 
            recursive: true, 
            force: true 
        });
        console.log('Test 4 passed - Force + recursive on non-existent path did not throw');

        // Test 5: Deleting binary files
        console.log('Test 5 - Create and delete a binary file');
        const binaryFileName = 'test-rm2-binary.bin';
        
        // Create binary content
        const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0xFF, 0xFE, 0xFD]);
        await vfs.writeFile(owner_id, binaryFileName, binaryContent);
        console.log(`Test 5 - Created binary file: ${binaryFileName}`);
        
        // Verify it exists
        const binaryExists = await vfs.exists(binaryFileName);
        if (!binaryExists) {
            throw new Error('Test 5 failed! Binary file should exist after creation');
        }
        
        // Delete the binary file
        await vfs.rm(owner_id, binaryFileName);
        console.log('Test 5 - Deleted binary file');
        
        // Verify it's gone
        const binaryExistsAfter = await vfs.exists(binaryFileName);
        if (binaryExistsAfter) {
            throw new Error('Test 5 failed! Binary file should not exist after deletion');
        }
        console.log('Test 5 passed - Binary file deletion verified');

        // Test 6: Deleting files with special characters in names
        console.log('Test 6 - Files with special characters in names');
        const specialNames = [
            'test-rm2-file-with-dashes.txt',
            'test_rm2_file_with_underscores.txt',
            'test.rm2.file.with.dots.txt',
            'test rm2 file with spaces.txt'
        ];
        
        // Create files with special names
        for (const fileName of specialNames) {
            await vfs.writeFile(owner_id, fileName, `Content for ${fileName}`, 'utf8');
            console.log(`Test 6 - Created: ${fileName}`);
        }
        
        // Delete each and verify
        for (const fileName of specialNames) {
            await vfs.rm(owner_id, fileName);
            const exists = await vfs.exists(fileName);
            if (exists) {
                throw new Error(`Test 6 failed! File "${fileName}" should not exist after deletion`);
            }
        }
        console.log('Test 6 passed - Special character file deletions verified');

        // Test 7: Attempting to delete a non-empty directory without recursive flag
        console.log('Test 7 - Delete non-empty directory without recursive (should fail)');
        const nonEmptyDir = 'test-rm2-non-empty-dir';
        
        // Create directory with content
        await vfs.mkdirEx(owner_id, nonEmptyDir);
        await vfs.writeFile(owner_id, `${nonEmptyDir}/child-file.txt`, 'Child content', 'utf8');
        console.log(`Test 7 - Created non-empty directory: ${nonEmptyDir}`);
        
        // Try to delete without recursive (should fail)
        try {
            await vfs.rm(owner_id, nonEmptyDir); // no recursive option
            throw new Error('Test 7 failed! Should have thrown error for non-empty directory');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            if (!errorMessage.includes('not empty') && !errorMessage.includes('Directory not empty')) {
                throw new Error(`Test 7 failed! Expected "not empty" error, got: ${errorMessage}`);
            }
            console.log('Test 7 - Correctly threw error for non-empty directory:', errorMessage);
        }
        
        // Cleanup with recursive
        await vfs.rm(owner_id, nonEmptyDir, { recursive: true });
        console.log('Test 7 passed - Non-empty directory correctly rejected without recursive');

        // Test 8: Verify that deleting a file inside a directory leaves the directory intact
        console.log('Test 8 - Verify parent directory remains after child file deletion');
        const parentDir = 'test-rm2-parent-intact';
        const siblingFile1 = `${parentDir}/sibling1.txt`;
        const siblingFile2 = `${parentDir}/sibling2.txt`;
        
        // Create directory with two files
        await vfs.mkdirEx(owner_id, parentDir);
        await vfs.writeFile(owner_id, siblingFile1, 'Sibling 1 content', 'utf8');
        await vfs.writeFile(owner_id, siblingFile2, 'Sibling 2 content', 'utf8');
        console.log(`Test 8 - Created parent directory with 2 sibling files`);
        
        // Delete just one sibling
        await vfs.rm(owner_id, siblingFile1);
        console.log('Test 8 - Deleted sibling1');
        
        // Verify sibling1 is gone
        const sibling1Exists = await vfs.exists(siblingFile1);
        if (sibling1Exists) {
            throw new Error('Test 8 failed! Deleted sibling1 should not exist');
        }
        
        // Verify sibling2 still exists
        const sibling2Exists = await vfs.exists(siblingFile2);
        if (!sibling2Exists) {
            throw new Error('Test 8 failed! Sibling2 should still exist');
        }
        
        // Verify parent directory still exists
        const parentExists = await vfs.exists(parentDir);
        if (!parentExists) {
            throw new Error('Test 8 failed! Parent directory should still exist');
        }
        
        // Cleanup
        await vfs.rm(owner_id, parentDir, { recursive: true });
        console.log('Test 8 passed - Parent directory and sibling files remain after single file deletion');

        console.log('✅ All rm Test 2 edge case tests passed');
        console.log('=== VFS RM Test 2 Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS RM Test 2 Failed ===');
        console.error('Error during VFS rm test 2:', error);
        throw error;
    }
}
