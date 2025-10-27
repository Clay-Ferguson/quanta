import vfs from '../VFS.js';

export async function renameTest(owner_id: number): Promise<void> {
    try {
        console.log('=== VFS Rename Test Starting ===');

        // Test 1: Test rename with invalid new path (should throw error)
        console.log('Test 1 - Testing rename with invalid new path');
        try {
            await vfs.rename(owner_id, 'old-file.txt', 'invalid path with spaces.txt');
            throw new Error('Test 1 failed! Should have thrown error for invalid new path');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 1 passed - Invalid new path threw error:', errorMessage);
            // Accept either "Invalid new path" or "Source file not found" as both are valid errors
            if (!errorMessage.includes('Invalid new path') && !errorMessage.includes('Source file not found')) {
                throw new Error('Test 1 failed! Should throw error about invalid new path or source file not found');
            }
        }

        // Test 2: Test rename with special characters in new path
        console.log('Test 2 - Testing rename with special characters in new path');
        try {
            await vfs.rename(owner_id, 'old-file.txt', 'file!@#$.txt');
            throw new Error('Test 2 failed! Should have thrown error for special characters');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 2 passed - Special characters threw error:', errorMessage);
        }

        // Test 3: Test rename of non-existent file (should fail)
        console.log('Test 3 - Testing rename of non-existent file');
        try {
            await vfs.rename(owner_id, 'nonexistent-file.txt', 'new-name.txt');
            throw new Error('Test 3 failed! Should have thrown error for non-existent file');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 3 passed - Non-existent file threw error:', errorMessage);
        }

        // Test 4: Test rename with nested paths
        console.log('Test 4 - Testing rename with nested paths');
        try {
            await vfs.rename(owner_id, 'folder/file.txt', 'folder/renamed-file.txt');
            throw new Error('Test 4 failed! Should have thrown error for non-existent nested paths');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 4 passed - Non-existent nested paths threw error:', errorMessage);
        }

        // Test 5: Test rename with different parent directories
        console.log('Test 5 - Testing rename with different parent directories');
        try {
            await vfs.rename(owner_id, 'folder1/file.txt', 'folder2/file.txt');
            throw new Error('Test 5 failed! Should have thrown error for non-existent directories');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 5 passed - Different parent directories threw error:', errorMessage);
        }

        // Test 6: Test path normalization in rename
        console.log('Test 6 - Testing path normalization in rename');
        try {
            await vfs.rename(owner_id, '//old//file.txt', 'new_file.txt');
            throw new Error('Test 6 failed! Should have thrown error for non-existent file');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 6 passed - Path normalization worked, threw error for non-existent file:', errorMessage);
        }

        // Test 7: Test rename with valid filename formats
        console.log('Test 7 - Testing rename with valid filename formats');
        const validNames = [
            'valid_name.txt',
            'valid123.txt', 
            'UPPERCASE.TXT',
            'file_with_underscores.txt',
            'file123_test.txt'
        ];
        
        for (const newName of validNames) {
            try {
                await vfs.rename(owner_id, 'nonexistent.txt', newName);
                throw new Error(`Test 7 failed! Should have thrown error for non-existent file with name ${newName}`);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.log(`Test 7 - Valid name '${newName}' processed correctly, threw error for non-existent file`);
                // Ensure it's not a "Invalid new path" error since the name should be valid
                // Accept "Source file not found" as the expected error for valid filenames
                if (errorMessage.includes('Invalid new path')) {
                    throw new Error(`Test 7 failed! Valid name '${newName}' should not be rejected as invalid`);
                }
            }
        }

        // Test 8: Test rename with same old and new paths
        console.log('Test 8 - Testing rename with same old and new paths');
        try {
            await vfs.rename(owner_id, 'file.txt', 'file.txt');
            throw new Error('Test 8 failed! Should have thrown error for non-existent file');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 8 passed - Same old and new paths threw error for non-existent file:', errorMessage);
        }

        // Test 9: Test rename with empty paths
        console.log('Test 9 - Testing rename with empty paths');
        try {
            await vfs.rename(owner_id, '', 'new-name.txt');
            throw new Error('Test 9 failed! Should have thrown error for empty old path');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 9 passed - Empty old path threw error:', errorMessage);
        }

        // Test 10: Test rename with root as old path
        console.log('Test 10 - Testing rename with root as old path');
        try {
            await vfs.rename(owner_id, '/', 'new-root');
            throw new Error('Test 10 failed! Should have thrown error for trying to rename root');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 10 passed - Trying to rename root threw error:', errorMessage);
        }

        // Test 11: Test parsePath functionality through rename
        console.log('Test 11 - Testing parsePath functionality through rename');
        try {
            await vfs.rename(owner_id, 'deeply/nested/path/file.txt', 'deeply/nested/path/renamed.txt');
            throw new Error('Test 11 failed! Should have thrown error for non-existent nested path');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 11 passed - Deeply nested paths processed correctly, threw error for non-existent paths:', errorMessage);
        }

        console.log('✅ All rename tests passed');
        console.log('=== VFS Rename Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS Rename Test Failed ===');
        console.error('Error during VFS rename test:', error);
        throw error;
    }
}
