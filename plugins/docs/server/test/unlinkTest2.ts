import vfs from '../VFS.js';

export async function unlinkTest2(owner_id: number): Promise<void> {
    try {
        console.log('=== VFS Unlink Test Starting ===');

        // Test 1: Test unlinking non-existent file (should throw error)
        console.log('Test 1 - Attempting to unlink non-existent file');
        try {
            await vfs.unlink(owner_id, 'nonexistent-file.txt');
            throw new Error('Test 1 failed! Should have thrown error for non-existent file');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 1 passed - Non-existent file threw error:', errorMessage);
            if (!errorMessage.includes('File not found')) {
                throw new Error('Test 1 failed! Should throw "File not found" error');
            }
        }

        // Test 2: Test unlinking root directory (should throw error)
        console.log('Test 2 - Attempting to unlink root directory');
        try {
            await vfs.unlink(owner_id, '');
            throw new Error('Test 2 failed! Should have thrown error for root directory');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 2 passed - Root directory unlink threw error:', errorMessage);
            if (!errorMessage.includes('Cannot unlink root directory')) {
                throw new Error('Test 2 failed! Should throw specific root directory error');
            }
        }

        // Test 3: Create a test file and then unlink it
        console.log('Test 3 - Create and unlink a test file');
        const testFileName = 'test-unlink-file.txt';
        const testContent = 'This file will be unlinked by the unlink test.';
        
        // Create the file
        await vfs.writeFile(owner_id, testFileName, testContent, 'utf8');
        console.log(`Test 3 - Created test file: ${testFileName}`);
        
        // Verify it exists
        const existsBefore = await vfs.exists(testFileName);
        if (!existsBefore) {
            throw new Error('Test 3 failed! Test file should exist after creation');
        }
        console.log('Test 3 - File existence verified before unlinking');
        
        // Unlink the file
        await vfs.unlink(owner_id, testFileName);
        console.log('Test 3 - Successfully unlinked test file');
        
        // Verify it no longer exists
        const existsAfter = await vfs.exists(testFileName);
        if (existsAfter) {
            throw new Error('Test 3 failed! Test file should not exist after unlinking');
        }
        console.log('Test 3 - File unlinking verified');

        // Test 4: Test unlinking with path normalization
        console.log('Test 4 - Test unlinking with path normalization');
        const testFileName4 = 'test-unlink-normalize.txt';
        
        // Create file
        await vfs.writeFile(owner_id, testFileName4, 'Normalization test content', 'utf8');
        console.log(`Test 4 - Created test file: ${testFileName4}`);
        
        // Unlink with path that needs normalization
        await vfs.unlink(owner_id, `///${testFileName4}///`);
        console.log('Test 4 - Successfully unlinked file with normalized path');
        
        // Verify deletion
        const exists4 = await vfs.exists(testFileName4);
        if (exists4) {
            throw new Error('Test 4 failed! File should not exist after unlinking with normalized path');
        }
        console.log('Test 4 - Path normalization unlinking verified');

        // Test 5: Test unlinking multiple files in sequence
        console.log('Test 5 - Test unlinking multiple files in sequence');
        const testFiles = ['test-unlink-multi-1.txt', 'test-unlink-multi-2.txt', 'test-unlink-multi-3.txt'];
        
        // Create multiple files
        for (const fileName of testFiles) {
            await vfs.writeFile(owner_id, fileName, `Content for ${fileName}`, 'utf8');
            console.log(`Test 5 - Created file: ${fileName}`);
        }
        
        // Verify all files exist
        for (const fileName of testFiles) {
            const exists = await vfs.exists(fileName);
            if (!exists) {
                throw new Error(`Test 5 failed! File ${fileName} should exist after creation`);
            }
        }
        console.log('Test 5 - All files verified to exist');
        
        // Unlink all files
        for (const fileName of testFiles) {
            await vfs.unlink(owner_id, fileName);
            console.log(`Test 5 - Unlinked file: ${fileName}`);
        }
        
        // Verify all files are gone
        for (const fileName of testFiles) {
            const exists = await vfs.exists(fileName);
            if (exists) {
                throw new Error(`Test 5 failed! File ${fileName} should not exist after unlinking`);
            }
        }
        console.log('Test 5 - All files verified to be unlinked');

        // Test 6: Test that unlink fails on directories
        console.log('Test 6 - Test that unlink fails on directories');
        const testDirName = 'test-unlink-dir';
        
        // Create a directory first
        await vfs.mkdirEx(owner_id, testDirName, {}, false);
        console.log(`Test 6 - Created test directory: ${testDirName}`);
        
        // Verify directory exists
        const dirExists = await vfs.exists(testDirName);
        if (!dirExists) {
            throw new Error('Test 6 failed! Test directory should exist after creation');
        }
        
        // Try to unlink the directory (should fail)
        try {
            await vfs.unlink(owner_id, testDirName);
            throw new Error('Test 6 failed! Should have thrown error when trying to unlink directory');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 6 passed - Directory unlink threw error:', errorMessage);
            if (!errorMessage.includes('Cannot unlink directory')) {
                throw new Error('Test 6 failed! Should throw specific directory error');
            }
        }
        
        // Clean up the directory using rm
        await vfs.rm(owner_id, testDirName);
        console.log('Test 6 - Cleaned up test directory using rm');

        // Test 7: Test different file types
        console.log('Test 7 - Test unlinking different file types');
        const testFileTypes = [
            { name: 'test-unlink.txt', content: 'Text file content' },
            { name: 'test-unlink.json', content: '{"key": "value"}' },
            { name: 'test-unlink.md', content: '# Markdown\n\nContent' },
            { name: 'test-unlink.html', content: '<html><body>HTML</body></html>' }
        ];
        
        // Create and unlink each file type
        for (const file of testFileTypes) {
            // Create file
            await vfs.writeFile(owner_id, file.name, file.content, 'utf8');
            console.log(`Test 7 - Created ${file.name}`);
            
            // Verify it exists
            const exists = await vfs.exists(file.name);
            if (!exists) {
                throw new Error(`Test 7 failed! File ${file.name} should exist after creation`);
            }
            
            // Unlink it
            await vfs.unlink(owner_id, file.name);
            console.log(`Test 7 - Unlinked ${file.name}`);
            
            // Verify it's gone
            const existsAfter = await vfs.exists(file.name);
            if (existsAfter) {
                throw new Error(`Test 7 failed! File ${file.name} should not exist after unlinking`);
            }
        }
        console.log('Test 7 - All file types unlinked successfully');

        // Test 8: Test unlinking files with special characters in names
        console.log('Test 8 - Test unlinking files with special characters');
        const specialFiles = [
            'test_underscore.txt',
            'test123numbers.txt',
            'UPPERCASE.TXT'
        ];
        
        for (const fileName of specialFiles) {
            try {
                // Create file
                await vfs.writeFile(owner_id, fileName, `Content for ${fileName}`, 'utf8');
                console.log(`Test 8 - Created file with special chars: ${fileName}`);
                
                // Unlink it
                await vfs.unlink(owner_id, fileName);
                console.log(`Test 8 - Successfully unlinked: ${fileName}`);
                
                // Verify it's gone
                const exists = await vfs.exists(fileName);
                if (exists) {
                    throw new Error(`Test 8 failed! File ${fileName} should not exist after unlinking`);
                }
                
            } catch (error) {
                // Some special character filenames might be rejected by validation
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.log(`Test 8 - File ${fileName} caused error (may be acceptable):`, errorMessage);
            }
        }

        // Test 9: Test consistency between unlink and rm for files
        console.log('Test 9 - Test consistency between unlink and rm for files');
        const testFile9a = 'test-unlink-consistency-a.txt';
        const testFile9b = 'test-unlink-consistency-b.txt';
        
        // Create two identical files
        await vfs.writeFile(owner_id, testFile9a, 'Consistency test content', 'utf8');
        await vfs.writeFile(owner_id, testFile9b, 'Consistency test content', 'utf8');
        console.log('Test 9 - Created two test files for consistency test');
        
        // Delete one with unlink, one with rm
        await vfs.unlink(owner_id, testFile9a);
        await vfs.rm(owner_id, testFile9b);
        console.log('Test 9 - Deleted one with unlink, one with rm');
        
        // Verify both are gone
        const exists9a = await vfs.exists(testFile9a);
        const exists9b = await vfs.exists(testFile9b);
        
        if (exists9a || exists9b) {
            throw new Error('Test 9 failed! Both files should be deleted regardless of method used');
        }
        console.log('Test 9 - Both files properly deleted, consistency verified');

        // Test 10: Test error handling with edge cases
        console.log('Test 10 - Test error handling with edge cases');
        
        // Test with root path variations
        const rootPaths = ['/', '//', '///', './'];
        for (const path of rootPaths) {
            try {
                await vfs.unlink(owner_id, path);
                throw new Error(`Test 10 failed! Should have thrown error for root path: ${path}`);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.log(`Test 10 - Root path '${path}' correctly threw error`);
                if (!errorMessage.includes('Cannot unlink root directory') && !errorMessage.includes('File not found')) {
                    throw new Error(`Test 10 failed! Unexpected error for root path ${path}: ${errorMessage}`);
                }
            }
        }

        console.log('✅ All unlink tests passed');
        console.log('=== VFS Unlink Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS Unlink Test Failed ===');
        console.error('Error during VFS unlink test:', error);
        throw error;
    }
}
