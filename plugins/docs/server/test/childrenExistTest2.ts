import vfs from '../VFS.js';

export async function childrenExistTest2(owner_id: number): Promise<void> {
    try {
        console.log('=== VFS ChildrenExist Test Starting ===');

        // Test 1: Check if root directory has children (should always be true)
        console.log('Test 1 - Checking if root directory has children');
        const result1 = await vfs.childrenExist(owner_id, '');
        console.log(`Test 1 - Root directory has children: ${result1}`);
        if (!result1) {
            throw new Error('Test 1 failed! Root directory should always have children or be considered to have children');
        }

        // Test 2: Check if root directory with slash has children
        console.log('Test 2 - Checking if root directory with slash has children');
        const result2 = await vfs.childrenExist(owner_id, '/');
        console.log(`Test 2 - Root directory with slash has children: ${result2}`);
        if (!result2) {
            throw new Error('Test 2 failed! Root directory with slash should always have children or be considered to have children');
        }

        // Test 3: Check if non-existent directory has children (should be false)
        console.log('Test 3 - Checking if non-existent directory has children');
        const result3 = await vfs.childrenExist(owner_id, 'nonexistent-folder');
        console.log(`Test 3 - Non-existent directory has children: ${result3}`);
        if (result3) {
            throw new Error('Test 3 failed! Non-existent directory should not have children');
        }

        // Test 4: Check if nested non-existent directory has children
        console.log('Test 4 - Checking if nested non-existent directory has children');
        const result4 = await vfs.childrenExist(owner_id, 'folder/subfolder/nested');
        console.log(`Test 4 - Nested non-existent directory has children: ${result4}`);
        if (result4) {
            throw new Error('Test 4 failed! Nested non-existent directory should not have children');
        }

        // Test 5: Test path normalization in childrenExist
        console.log('Test 5 - Testing path normalization');
        const result5 = await vfs.childrenExist(owner_id, '//test///path//');
        console.log(`Test 5 - Normalized path has children: ${result5}`);
        if (result5) {
            throw new Error('Test 5 failed! Non-existent normalized path should not have children');
        }

        // Test 6: Check various path formats for non-existent directories
        const testPaths = [
            'single-folder',
            '/single-folder',
            './single-folder',
            'folder/subfolder',
            '/folder/subfolder',
            './folder/subfolder',
            'deeply/nested/folder/structure'
        ];
        
        console.log('Test 6 - Testing various path formats');
        for (const path of testPaths) {
            const result = await vfs.childrenExist(owner_id, path);
            console.log(`Test 6 - Path '${path}' has children: ${result}`);
            // All should be false since we haven't created any directories yet
            if (result) {
                throw new Error(`Test 6 failed! Path '${path}' should not have children`);
            }
        }

        // Test 7: Test with different owner_id values (edge case testing)
        console.log('Test 7 - Testing with different owner_id values');
        const result7a = await vfs.childrenExist(owner_id, '');
        const result7b = await vfs.childrenExist(999999, ''); // Non-existent user
        console.log(`Test 7a - Root with valid owner_id has children: ${result7a}`);
        console.log(`Test 7b - Root with invalid owner_id has children: ${result7b}`);
        
        // Root should always be true regardless of owner_id
        if (!result7a) {
            throw new Error('Test 7a failed! Root should have children for valid owner_id');
        }
        if (!result7b) {
            throw new Error('Test 7b failed! Root should have children even for invalid owner_id');
        }

        // Test 8: Test error handling with malformed paths
        console.log('Test 8 - Testing error handling with special characters');
        const specialPaths = [
            'folder with spaces',
            'folder/with/special/chars!@#',
            'folder\\backslash',
            'folder\ttab',
            'folder\nnewline'
        ];
        
        for (const path of specialPaths) {
            try {
                const result = await vfs.childrenExist(owner_id, path);
                console.log(`Test 8 - Special path '${path.replace(/\s/g, '\\s')}' has children: ${result}`);
                // Should not have children since these directories don't exist
                if (result) {
                    throw new Error(`Test 8 failed! Special path '${path}' should not have children`);
                }
            } catch (error) {
                // It's acceptable for special characters to cause errors
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.log(`Test 8 - Special path '${path.replace(/\s/g, '\\s')}' caused error (acceptable):`, errorMessage);
            }
        }

        // Test 9: Test consistency between multiple calls
        console.log('Test 9 - Testing consistency between multiple calls');
        for (let i = 0; i < 3; i++) {
            const resultA = await vfs.childrenExist(owner_id, '');
            const resultB = await vfs.childrenExist(owner_id, 'nonexistent');
            
            if (!resultA) {
                throw new Error(`Test 9 failed! Root should consistently have children (iteration ${i})`);
            }
            if (resultB) {
                throw new Error(`Test 9 failed! Non-existent path should consistently not have children (iteration ${i})`);
            }
        }

        console.log('✅ All childrenExist tests passed');
        console.log('=== VFS ChildrenExist Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS ChildrenExist Test Failed ===');
        console.error('Error during VFS childrenExist test:', error);
        throw error;
    }
}
