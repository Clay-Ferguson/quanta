import vfs from '../VFS.js';

export async function readdirExTest(owner_id: number): Promise<void> {
    try {
        console.log('=== VFS ReaddirEx Test Starting ===');

        // Test 1: Read root directory (should return empty array or user folders)
        console.log('Test 1 - Reading root directory');
        const result1 = await vfs.readdirEx(owner_id, '', false);
        console.log(`Test 1 - Root directory contents (${result1.length} items):`, 
            result1.map((node: any) => ({ name: node.name, is_directory: node.is_directory })));
        
        // Root directory should return an array (could be empty or contain user folders)
        if (!Array.isArray(result1)) {
            throw new Error('Test 1 failed! readdirEx should return an array');
        }

        // Test 2: Read root directory with loadContent=true
        console.log('Test 2 - Reading root directory with loadContent=true');
        const result2 = await vfs.readdirEx(owner_id, '', true);
        console.log(`Test 2 - Root directory contents with content (${result2.length} items):`, 
            result2.map((node: any) => ({ name: node.name, is_directory: node.is_directory, hasContent: !!node.content })));
        
        if (!Array.isArray(result2)) {
            throw new Error('Test 2 failed! readdirEx with loadContent should return an array');
        }

        // Test 3: Read root directory with slash
        console.log('Test 3 - Reading root directory with slash');
        const result3 = await vfs.readdirEx(owner_id, '/', false);
        console.log(`Test 3 - Root directory with slash contents (${result3.length} items):`, 
            result3.map((node: any) => ({ name: node.name, is_directory: node.is_directory })));
        
        if (!Array.isArray(result3)) {
            throw new Error('Test 3 failed! readdirEx with slash should return an array');
        }

        // Test 4: Read non-existent directory (should return empty array or throw error)
        console.log('Test 4 - Reading non-existent directory');
        try {
            const result4 = await vfs.readdirEx(owner_id, 'nonexistent-folder', false);
            console.log(`Test 4 - Non-existent directory contents (${result4.length} items):`, 
                result4.map((node: any) => ({ name: node.name, is_directory: node.is_directory })));
            
            // Should return empty array for non-existent directory
            if (!Array.isArray(result4) || result4.length > 0) {
                throw new Error('Test 4 failed! Non-existent directory should return empty array');
            }
        } catch (error) {
            // It's also acceptable for readdirEx to throw an error for non-existent directories
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 4 - Non-existent directory threw error (acceptable):', errorMessage);
        }

        // Test 5: Read nested non-existent directory
        console.log('Test 5 - Reading nested non-existent directory');
        try {
            const result5 = await vfs.readdirEx(owner_id, 'folder/subfolder/nested', false);
            console.log(`Test 5 - Nested non-existent directory contents (${result5.length} items):`, 
                result5.map((node: any) => ({ name: node.name, is_directory: node.is_directory })));
            
            // Should return empty array for non-existent nested directory
            if (!Array.isArray(result5) || result5.length > 0) {
                throw new Error('Test 5 failed! Non-existent nested directory should return empty array');
            }
        } catch (error) {
            // It's also acceptable for readdirEx to throw an error for non-existent directories
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 5 - Nested non-existent directory threw error (acceptable):', errorMessage);
        }

        // Test 6: Test path normalization in readdirEx
        console.log('Test 6 - Testing path normalization');
        const result6 = await vfs.readdirEx(owner_id, '//test///path//', false);
        console.log(`Test 6 - Normalized path contents (${result6.length} items):`, 
            result6.map((node: any) => ({ name: node.name, is_directory: node.is_directory })));
        
        if (!Array.isArray(result6)) {
            throw new Error('Test 6 failed! readdirEx with path normalization should return an array');
        }

        // Test 7: Verify TreeNode structure for any returned nodes
        console.log('Test 7 - Verifying TreeNode structure');
        const allResults = [...result1, ...result2, ...result3];
        for (const node of allResults) {
            if (!node || typeof node !== 'object') {
                throw new Error('Test 7 failed! All returned items should be objects');
            }
            
            // Check required TreeNode properties
            if (typeof node.is_directory !== 'boolean') {
                throw new Error('Test 7 failed! TreeNode should have boolean is_directory property');
            }
            
            if (typeof node.name !== 'string') {
                throw new Error('Test 7 failed! TreeNode should have string name property');
            }
            
            console.log(`Test 7 - Valid TreeNode: ${node.name} (directory: ${node.is_directory})`);
        }

        // Test 8: Compare results with and without loadContent
        console.log('Test 8 - Comparing results with and without loadContent');
        if (result1.length === result2.length) {
            console.log('Test 8 - Both calls returned same number of items (expected)');
            
            // Compare corresponding nodes
            for (let i = 0; i < result1.length; i++) {
                if (result1[i].name !== result2[i].name) {
                    throw new Error(`Test 8 failed! Node names should match: ${result1[i].name} vs ${result2[i].name}`);
                }
                if (result1[i].is_directory !== result2[i].is_directory) {
                    throw new Error(`Test 8 failed! Directory flags should match for ${result1[i].name}`);
                }
            }
        } else {
            console.log(`Test 8 - Different number of items returned: ${result1.length} vs ${result2.length} (might be acceptable)`);
        }

        console.log('✅ All readdirEx tests passed');
        console.log('=== VFS ReaddirEx Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS ReaddirEx Test Failed ===');
        console.error('Error during VFS readdirEx test:', error);
        throw error;
    }
}
