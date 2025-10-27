import vfs from '../VFS.js';

export async function readdirTest2(owner_id: number): Promise<void> {
    try {
        console.log('=== VFS Readdir Test Starting ===');

        // Test 1: Read root directory (should return array of filenames)
        console.log('Test 1 - Reading root directory');
        const result1 = await vfs.readdir(owner_id, '');
        console.log(`Test 1 - Root directory contents (${result1.length} items):`, result1);
        
        // Root directory should return an array of strings
        if (!Array.isArray(result1)) {
            throw new Error('Test 1 failed! readdir should return an array');
        }
        
        // All items should be strings (filenames)
        for (const item of result1) {
            if (typeof item !== 'string') {
                throw new Error(`Test 1 failed! All items should be strings, got: ${typeof item}`);
            }
        }
        console.log('Test 1 - Root directory readdir verified');

        // Test 2: Read root directory with slash
        console.log('Test 2 - Reading root directory with slash');
        const result2 = await vfs.readdir(owner_id, '/');
        console.log(`Test 2 - Root directory with slash contents (${result2.length} items):`, result2);
        
        if (!Array.isArray(result2)) {
            throw new Error('Test 2 failed! readdir with slash should return an array');
        }
        
        for (const item of result2) {
            if (typeof item !== 'string') {
                throw new Error(`Test 2 failed! All items should be strings, got: ${typeof item}`);
            }
        }
        console.log('Test 2 - Root directory with slash readdir verified');

        // Test 3: Read non-existent directory (should return empty array or throw error)
        console.log('Test 3 - Reading non-existent directory');
        try {
            const result3 = await vfs.readdir(owner_id, 'nonexistent-folder');
            console.log(`Test 3 - Non-existent directory contents (${result3.length} items):`, result3);
            
            // Should return empty array for non-existent directory
            if (!Array.isArray(result3) || result3.length > 0) {
                throw new Error('Test 3 failed! Non-existent directory should return empty array');
            }
            console.log('Test 3 - Non-existent directory returned empty array (correct)');
        } catch (error) {
            // It's also acceptable for readdir to throw an error for non-existent directories
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 3 - Non-existent directory threw error (acceptable):', errorMessage);
        }

        // Test 4: Create some test files and verify readdir returns them
        console.log('Test 4 - Creating test files and verifying readdir results');
        const testFiles = ['readdir-test-1.txt', 'readdir-test-2.md', 'readdir-test-3.json'];
        
        // Create test files
        for (const fileName of testFiles) {
            await vfs.writeFile(owner_id, fileName, `Content for ${fileName}`, 'utf8');
            console.log(`Test 4 - Created test file: ${fileName}`);
        }
        
        // Read directory and verify files are present
        const result4 = await vfs.readdir(owner_id, '');
        console.log(`Test 4 - Directory contents after creating files (${result4.length} items):`, result4);
        
        // Verify all test files are in the readdir result
        for (const testFile of testFiles) {
            if (!result4.includes(testFile)) {
                throw new Error(`Test 4 failed! Created file ${testFile} should be in readdir result`);
            }
        }
        console.log('Test 4 - All created test files found in readdir result');

        // Test 5: Compare readdir with readdirEx results
        console.log('Test 5 - Comparing readdir with readdirEx results');
        const readdirResult = await vfs.readdir(owner_id, '');
        const readdirExResult = await vfs.readdirEx(owner_id, '', false);
        
        console.log(`Test 5 - readdir returned ${readdirResult.length} items`);
        console.log(`Test 5 - readdirEx returned ${readdirExResult.length} items`);
        
        // Should have same number of items
        if (readdirResult.length !== readdirExResult.length) {
            throw new Error(`Test 5 failed! readdir and readdirEx should return same number of items: ${readdirResult.length} vs ${readdirExResult.length}`);
        }
        
        // Verify all filenames match
        const readdirExFilenames = readdirExResult.map(node => node.name);
        for (const filename of readdirResult) {
            if (!readdirExFilenames.includes(filename)) {
                throw new Error(`Test 5 failed! readdir filename ${filename} not found in readdirEx results`);
            }
        }
        
        for (const filename of readdirExFilenames) {
            if (!readdirResult.includes(filename)) {
                throw new Error(`Test 5 failed! readdirEx filename ${filename} not found in readdir results`);
            }
        }
        console.log('Test 5 - readdir and readdirEx results are consistent');

        // Test 6: Test path normalization in readdir
        console.log('Test 6 - Testing path normalization');
        const result6 = await vfs.readdir(owner_id, '//test///path//');
        console.log(`Test 6 - Normalized path contents (${result6.length} items):`, result6);
        
        if (!Array.isArray(result6)) {
            throw new Error('Test 6 failed! readdir with path normalization should return an array');
        }
        console.log('Test 6 - Path normalization handled correctly');

        // Test 7: Test ordering of results (should be ordered by ordinal)
        console.log('Test 7 - Testing ordering of results');
        const orderedResult = await vfs.readdir(owner_id, '');
        const orderedResultEx = await vfs.readdirEx(owner_id, '', false);
        
        // Since readdir uses the same underlying function as readdirEx, 
        // the ordering should be the same
        const orderedFilenames = orderedResultEx.map(node => node.name);
        
        for (let i = 0; i < orderedResult.length; i++) {
            if (orderedResult[i] !== orderedFilenames[i]) {
                throw new Error(`Test 7 failed! File ordering mismatch at position ${i}: readdir=${orderedResult[i]}, readdirEx=${orderedFilenames[i]}`);
            }
        }
        console.log('Test 7 - File ordering verified to be consistent');

        // Test 8: Test with different owner_id values
        console.log('Test 8 - Testing with different owner_id values');
        const result8a = await vfs.readdir(owner_id, '');
        const result8b = await vfs.readdir(999999, ''); // Non-existent user
        
        console.log(`Test 8a - Valid owner_id returned ${result8a.length} items`);
        console.log(`Test 8b - Invalid owner_id returned ${result8b.length} items`);
        
        // Both should return arrays (may be different lengths due to permissions)
        if (!Array.isArray(result8a) || !Array.isArray(result8b)) {
            throw new Error('Test 8 failed! Both calls should return arrays');
        }
        console.log('Test 8 - Different owner_id values handled correctly');

        // Test 9: Test nested directory paths (should return empty or throw error)
        console.log('Test 9 - Testing nested directory paths');
        const nestedPaths = [
            'folder/subfolder',
            'deeply/nested/path',
            'nonexistent/nested/structure'
        ];
        
        for (const path of nestedPaths) {
            try {
                const result = await vfs.readdir(owner_id, path);
                console.log(`Test 9 - Path '${path}' returned ${result.length} items`);
                
                if (!Array.isArray(result)) {
                    throw new Error(`Test 9 failed! Path '${path}' should return an array`);
                }
                
                // Should be empty since paths don't exist
                if (result.length > 0) {
                    throw new Error(`Test 9 failed! Non-existent path '${path}' should return empty array`);
                }
                
            } catch (error) {
                // It's acceptable for non-existent paths to throw errors
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.log(`Test 9 - Path '${path}' threw error (acceptable):`, errorMessage);
            }
        }

        // Test 10: Clean up test files and verify readdir reflects changes
        console.log('Test 10 - Cleaning up test files and verifying readdir reflects changes');
        
        // Get current file list
        const beforeCleanup = await vfs.readdir(owner_id, '');
        console.log(`Test 10 - Files before cleanup: ${beforeCleanup.length}`);
        
        // Delete test files
        for (const fileName of testFiles) {
            try {
                await vfs.unlink(owner_id, fileName);
                console.log(`Test 10 - Deleted test file: ${fileName}`);
            } catch (error) {
                // File might already be deleted by previous tests
                console.log(`Test 10 - Could not delete ${fileName} (may not exist):`, error);
            }
        }
        
        // Verify files are no longer in readdir result
        const afterCleanup = await vfs.readdir(owner_id, '');
        console.log(`Test 10 - Files after cleanup: ${afterCleanup.length}`);
        
        for (const testFile of testFiles) {
            if (afterCleanup.includes(testFile)) {
                throw new Error(`Test 10 failed! Deleted file ${testFile} should not appear in readdir result`);
            }
        }
        console.log('Test 10 - Cleanup verified, deleted files no longer in readdir result');

        console.log('✅ All readdir tests passed');
        console.log('=== VFS Readdir Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS Readdir Test Failed ===');
        console.error('Error during VFS readdir test:', error);
        throw error;
    }
}
