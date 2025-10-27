import vfs from '../VFS.js';

export async function statTest2(): Promise<void> {
    try {
        console.log('=== VFS Stat Test Starting ===');

        // Test 1: Check stat for root directory (should always work)
        console.log('Test 1 - Getting stat for root directory');
        const result1 = await vfs.stat('');
        console.log('Test 1 - Root directory stat:', JSON.stringify(result1, null, 2));
        
        // Verify root directory properties
        if (!result1.is_directory) {
            throw new Error('Test 1 failed! Root should be a directory');
        }
        if (result1.is_public !== false) {
            throw new Error('Test 1 failed! Root should not be public');
        }
        if (typeof result1.size !== 'number' || result1.size < 0) {
            throw new Error('Test 1 failed! Root size should be a non-negative number');
        }
        if (!(result1.birthtime instanceof Date)) {
            throw new Error('Test 1 failed! Root birthtime should be a Date object');
        }
        if (!(result1.mtime instanceof Date)) {
            throw new Error('Test 1 failed! Root mtime should be a Date object');
        }

        // Test 2: Check stat for root directory with slash
        console.log('Test 2 - Getting stat for root directory with slash');
        const result2 = await vfs.stat('/');
        console.log('Test 2 - Root directory with slash stat:', JSON.stringify(result2, null, 2));
        
        // Should be identical to Test 1
        if (!result2.is_directory) {
            throw new Error('Test 2 failed! Root with slash should be a directory');
        }
        if (result2.is_public !== false) {
            throw new Error('Test 2 failed! Root with slash should not be public');
        }

        // Test 3: Check stat for non-existent file (should throw error)
        console.log('Test 3 - Getting stat for non-existent file');
        try {
            await vfs.stat('nonexistent-file.txt');
            throw new Error('Test 3 failed! Should have thrown error for non-existent file');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 3 passed - Non-existent file threw error:', errorMessage);
            if (!errorMessage.includes('File not found')) {
                throw new Error('Test 3 failed! Should throw specific "File not found" error');
            }
        }

        // Test 4: Check stat for non-existent nested path (should throw error)
        console.log('Test 4 - Getting stat for non-existent nested path');
        try {
            await vfs.stat('folder/subfolder/file.txt');
            throw new Error('Test 4 failed! Should have thrown error for non-existent nested path');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 4 passed - Non-existent nested path threw error:', errorMessage);
            if (!errorMessage.includes('File not found')) {
                throw new Error('Test 4 failed! Should throw specific "File not found" error');
            }
        }

        // Test 5: Test path normalization in stat
        console.log('Test 5 - Testing path normalization');
        try {
            await vfs.stat('//test///path//file.txt');
            throw new Error('Test 5 failed! Should have thrown error for non-existent normalized path');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 5 passed - Normalized non-existent path threw error:', errorMessage);
            if (!errorMessage.includes('File not found')) {
                throw new Error('Test 5 failed! Should throw specific "File not found" error');
            }
        }

        // Test 6: Test various non-existent path formats
        const testPaths = [
            'single-file.txt',
            '/single-file.txt', 
            './single-file.txt',
            'folder/file.txt',
            '/folder/file.txt',
            './folder/file.txt',
            'deeply/nested/folder/structure/file.txt'
        ];
        
        console.log('Test 6 - Testing various non-existent path formats');
        for (const path of testPaths) {
            try {
                await vfs.stat(path);
                throw new Error(`Test 6 failed! Path '${path}' should not exist`);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.log(`Test 6 - Path '${path}' correctly threw error: ${errorMessage.substring(0, 50)}...`);
                if (!errorMessage.includes('File not found')) {
                    throw new Error(`Test 6 failed! Path '${path}' should throw "File not found" error`);
                }
            }
        }

        // Test 7: Test stat with different path normalizations for root
        const rootPaths = [
            '',
            '/',
            '//',
            '///',
            './',
            './/',
            '././'
        ];
        
        console.log('Test 7 - Testing root path normalizations');
        for (const path of rootPaths) {
            const result = await vfs.stat(path);
            console.log(`Test 7 - Path '${path}' normalized correctly, is_directory: ${result.is_directory}`);
            
            if (!result.is_directory) {
                throw new Error(`Test 7 failed! Path '${path}' should resolve to root directory`);
            }
            if (result.is_public !== false) {
                throw new Error(`Test 7 failed! Path '${path}' should resolve to non-public root`);
            }
            if (typeof result.size !== 'number') {
                throw new Error(`Test 7 failed! Path '${path}' should have numeric size`);
            }
        }

        // Test 8: Test VFSStats interface compliance
        console.log('Test 8 - Testing VFSStats interface compliance');
        const rootStat = await vfs.stat('');
        
        // Check all required properties exist
        const requiredProps = ['is_directory', 'birthtime', 'mtime', 'size'];
        for (const prop of requiredProps) {
            if (!(prop in rootStat)) {
                throw new Error(`Test 8 failed! Missing required property: ${prop}`);
            }
        }
        
        // Check optional property
        if (!('is_public' in rootStat)) {
            throw new Error('Test 8 failed! Missing is_public property');
        }
        
        // Check types
        if (typeof rootStat.is_directory !== 'boolean') {
            throw new Error('Test 8 failed! is_directory should be boolean');
        }
        if (typeof rootStat.is_public !== 'boolean') {
            throw new Error('Test 8 failed! is_public should be boolean');
        }
        if (!(rootStat.birthtime instanceof Date)) {
            throw new Error('Test 8 failed! birthtime should be Date object');
        }
        if (!(rootStat.mtime instanceof Date)) {
            throw new Error('Test 8 failed! mtime should be Date object');
        }
        if (typeof rootStat.size !== 'number') {
            throw new Error('Test 8 failed! size should be number');
        }

        // Test 9: Test consistency between multiple calls
        console.log('Test 9 - Testing consistency between multiple calls');
        for (let i = 0; i < 3; i++) {
            const stat1 = await vfs.stat('');
            const stat2 = await vfs.stat('/');
            
            if (stat1.is_directory !== stat2.is_directory) {
                throw new Error(`Test 9 failed! is_directory should be consistent (iteration ${i})`);
            }
            if (stat1.is_public !== stat2.is_public) {
                throw new Error(`Test 9 failed! is_public should be consistent (iteration ${i})`);
            }
            if (stat1.size !== stat2.size) {
                throw new Error(`Test 9 failed! size should be consistent (iteration ${i})`);
            }
        }

        // Test 10: Test error handling for edge cases
        console.log('Test 10 - Testing error handling for edge cases');
        const edgeCases = [
            'file with spaces.txt',
            'file\ttab.txt',
            'file\nnewline.txt',
            'file!@#$.txt',
            'very/long/path/with/many/segments/and/a/very/long/filename/that/exceeds/normal/limits/but/should/still/be/handled/gracefully.txt'
        ];
        
        for (const path of edgeCases) {
            try {
                await vfs.stat(path);
                throw new Error(`Test 10 failed! Edge case path '${path.replace(/\s/g, '\\s')}' should not exist`);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.log(`Test 10 - Edge case '${path.replace(/\s/g, '\\s').substring(0, 30)}...' handled correctly`);
                if (!errorMessage) {
                    throw new Error('Test 10 failed! Edge case should throw an error with message');
                }
            }
        }

        console.log('✅ All stat tests passed');
        console.log('=== VFS Stat Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS Stat Test Failed ===');
        console.error('Error during VFS stat test:', error);
        throw error;
    }
}
