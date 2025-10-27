import vfs from '../VFS.js';

export async function rmTest(owner_id: number): Promise<void> {
    try {
        console.log('=== VFS RM Test Starting ===');

        // Test 1: Test deleting non-existent file without force (should throw error)
        console.log('Test 1 - Attempting to delete non-existent file without force');
        try {
            await vfs.rm(owner_id, 'nonexistent-file.txt');
            throw new Error('Test 1 failed! Should have thrown error for non-existent file');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 1 passed - Non-existent file threw error:', errorMessage);
            if (!errorMessage.includes('not found') && !errorMessage.includes('File not found')) {
                throw new Error('Test 1 failed! Should throw "not found" error');
            }
        }

        // Test 2: Test deleting non-existent file with force (should not throw error)
        console.log('Test 2 - Attempting to delete non-existent file with force');
        await vfs.rm(owner_id, 'nonexistent-file.txt', { force: true });
        console.log('Test 2 passed - Non-existent file with force did not throw error');

        // Test 3: Test deleting root directory (should throw error)
        console.log('Test 3 - Attempting to delete root directory');
        try {
            await vfs.rm(owner_id, '');
            throw new Error('Test 3 failed! Should have thrown error for root directory');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 3 passed - Root directory deletion threw error:', errorMessage);
            if (!errorMessage.includes('Cannot delete root directory')) {
                throw new Error('Test 3 failed! Should throw specific root directory error');
            }
        }

        // Test 4: Create a test file and then delete it
        console.log('Test 4 - Create and delete a test file');
        const testFileName = 'test-rm-file.txt';
        const testContent = 'This file will be deleted by the rm test.';
        
        // Create the file
        await vfs.writeFile(owner_id, testFileName, testContent, 'utf8');
        console.log(`Test 4 - Created test file: ${testFileName}`);
        
        // Verify it exists
        const existsBefore = await vfs.exists(testFileName);
        if (!existsBefore) {
            throw new Error('Test 4 failed! Test file should exist after creation');
        }
        console.log('Test 4 - File existence verified before deletion');
        
        // Delete the file
        await vfs.rm(owner_id, testFileName);
        console.log('Test 4 - Successfully deleted test file');
        
        // Verify it no longer exists
        const existsAfter = await vfs.exists(testFileName);
        if (existsAfter) {
            throw new Error('Test 4 failed! Test file should not exist after deletion');
        }
        console.log('Test 4 - File deletion verified');

        // Test 5: Test deleting with path normalization
        console.log('Test 5 - Test deletion with path normalization');
        const testFileName5 = 'test-rm-normalize.txt';
        
        // Create file
        await vfs.writeFile(owner_id, testFileName5, 'Normalization test content', 'utf8');
        console.log(`Test 5 - Created test file: ${testFileName5}`);
        
        // Delete with path that needs normalization
        await vfs.rm(owner_id, `///${testFileName5}///`);
        console.log('Test 5 - Successfully deleted file with normalized path');
        
        // Verify deletion
        const exists5 = await vfs.exists(testFileName5);
        if (exists5) {
            throw new Error('Test 5 failed! File should not exist after deletion with normalized path');
        }
        console.log('Test 5 - Path normalization deletion verified');

        // Test 6: Test deleting multiple files in sequence
        console.log('Test 6 - Test deleting multiple files in sequence');
        const testFiles = ['test-rm-multi-1.txt', 'test-rm-multi-2.txt', 'test-rm-multi-3.txt'];
        
        // Create multiple files
        for (const fileName of testFiles) {
            await vfs.writeFile(owner_id, fileName, `Content for ${fileName}`, 'utf8');
            console.log(`Test 6 - Created file: ${fileName}`);
        }
        
        // Verify all files exist
        for (const fileName of testFiles) {
            const exists = await vfs.exists(fileName);
            if (!exists) {
                throw new Error(`Test 6 failed! File ${fileName} should exist after creation`);
            }
        }
        console.log('Test 6 - All files verified to exist');
        
        // Delete all files
        for (const fileName of testFiles) {
            await vfs.rm(owner_id, fileName);
            console.log(`Test 6 - Deleted file: ${fileName}`);
        }
        
        // Verify all files are gone
        for (const fileName of testFiles) {
            const exists = await vfs.exists(fileName);
            if (exists) {
                throw new Error(`Test 6 failed! File ${fileName} should not exist after deletion`);
            }
        }
        console.log('Test 6 - All files verified to be deleted');

        console.log('✅ All rm tests passed');
        console.log('=== VFS RM Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS RM Test Failed ===');
        console.error('Error during VFS rm test:', error);
        throw error;
    }
}
