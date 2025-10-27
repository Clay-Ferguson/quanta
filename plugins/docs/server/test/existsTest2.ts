import vfs from '../VFS.js';

export async function existsTest2(): Promise<void> {
    try {
        console.log('=== VFS Exists Test Starting ===');

        // Test 1: Check if root directory exists (should always be true)
        const result1 = await vfs.exists('');
        console.log(`Test 1 - Root directory exists: ${result1}`);
        if (!result1) {
            throw new Error('Test 1 failed! Root directory should always exist');
        }

        // Test 2: Check if root directory exists with slash (should always be true)
        const result2 = await vfs.exists('/');
        console.log(`Test 2 - Root directory with slash exists: ${result2}`);
        if (!result2) {
            throw new Error('Test 2 failed! Root directory should always exist');
        }

        // Test 3: Check if non-existent file exists (should be false)
        const result3 = await vfs.exists('nonexistent-file.txt');
        console.log(`Test 3 - Non-existent file exists: ${result3}`);
        if (result3) {
            throw new Error('Test 3 failed! Non-existent file should not exist');
        }

        // Test 4: Check if non-existent nested path exists (should be false)
        const result4 = await vfs.exists('folder/subfolder/file.txt');
        console.log(`Test 4 - Non-existent nested path exists: ${result4}`);
        if (result4) {
            throw new Error('Test 4 failed! Non-existent nested path should not exist');
        }

        // Test 5: Test exists with info parameter for root directory
        const info5: any = {};
        const result5 = await vfs.exists('', info5);
        console.log(`Test 5 - Root directory exists with info: ${result5}`);
        if (!result5 || !info5.node || !info5.node.is_directory) {
            throw new Error('Test 5 failed! Root directory should exist and have proper node info');
        }
        console.log(`Test 5 - Root node info:`, JSON.stringify(info5.node, null, 2));

        // Test 6: Test exists with info parameter for non-existent file
        const info6: any = {};
        const result6 = await vfs.exists('nonexistent.txt', info6);
        console.log(`Test 6 - Non-existent file exists with info: ${result6}`);
        if (result6 || info6.node) {
            throw new Error('Test 6 failed! Non-existent file should not exist and should not have node info');
        }

        // Test 7: Test path normalization in exists
        const result7 = await vfs.exists('//test///path//');
        console.log(`Test 7 - Path with multiple slashes exists: ${result7}`);
        if (result7) {
            throw new Error('Test 7 failed! Non-existent path with multiple slashes should not exist');
        }

        // Test 8: Test exists with various path formats
        const testPaths = [
            'single-file.txt',
            '/single-file.txt',
            './single-file.txt',
            'folder/file.txt',
            '/folder/file.txt',
            './folder/file.txt',
            'deeply/nested/folder/structure/file.txt'
        ];
        
        for (const path of testPaths) {
            const result = await vfs.exists(path);
            console.log(`Test 8 - Path '${path}' exists: ${result}`);
            // All should be false since we haven't created any files yet
            if (result) {
                throw new Error(`Test 8 failed! Path '${path}' should not exist`);
            }
        }

        console.log('✅ All exists tests passed');
        console.log('=== VFS Exists Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS Exists Test Failed ===');
        console.error('Error during VFS exists test:', error);
        throw error;
    }
}
